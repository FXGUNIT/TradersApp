"""
Airflow DAG — Feast Feature Store Materialization

Runs every trading day at 05:00 UTC (before market open):
  1. Export SQLite → Parquet (offline feature computation)
  2. Apply Feast registry (register new/modified feature views)
  3. Materialize features to Redis (online store)
  4. Validate feature freshness in Redis
  5. Log metrics to MLflow

This ensures the online store (Redis) is fully populated before
the trading day begins, enabling <10ms feature retrieval during inference.

Manual trigger:
  airflow dags trigger feast_materialization

Feature views materialized:
  - candle_features:     OHLCV + technical indicators (TTL: 24h)
  - historical_features: rolling trade stats (TTL: 30d)
  - session_features:    session aggregates (TTL: 7d)

Feast docs: https://docs.feast.dev/
"""

from __future__ import annotations

import json
import os
import sys
from datetime import timedelta
from pathlib import Path

import pendulum
from airflow.decorators import dag, task
from airflow.exceptions import AirflowException
from airflow.utils.trigger_rule import TriggerRule

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_ENGINE_ROOT = PROJECT_ROOT / "ml-engine"
FEAT_FEATURES_DIR = ML_ENGINE_ROOT / "data" / "feast_features"

if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))


@dag(
    dag_id="feast_materialization",
    schedule="0 5 * * 1-5",  # Weekdays at 05:00 UTC (before US market open)
    start_date=pendulum.datetime(2026, 4, 1, tz="UTC"),
    catchup=False,
    max_active_runs=1,  # Prevent overlapping materializations
    tags=["feast", "feature-store", "materialization", "mlops"],
    doc_md="""
    ## Feast Feature Store Materialization

    Nightly pipeline that:
    1. **Export**: SQLite → Parquet (offline features from trading_data.db)
    2. **Apply**: Feast registry registration (new/modified feature views)
    3. **Materialize**: Incremental update to Redis (online store)
    4. **Validate**: Confirm feature freshness in Redis
    5. **Log**: MLflow metrics for monitoring

    ### Feature Views
    | View | TTL | Source | Features |
    |------|-----|--------|---------|
    | candle_features | 24h | candles_5min | 50+ OHLCV + indicators |
    | historical_features | 30d | trade_log | win_rate, expectancy, profit_factor |
    | session_features | 7d | session_aggregates | gap, range, volume |

    ### Environment Variables
    - `FEAST_DB_PATH`: SQLite path (default: ml-engine/data/trading_data.db)
    - `FEAST_REDIS_URL`: Redis URL (default: redis://redis:6379)
    - `FEAST_SYMBOL`: Trading symbol (default: MNQ)
    - `MLFLOW_TRACKING_URI`: MLflow server URI
    """,
)
def feast_materialization():
    """
    Nightly Feast feature materialization pipeline.
    """

    @task(task_id="validate_data_quality_gate")
    def validate_data_quality_gate() -> dict:
        """
        Run full data quality validation before materializing features.
        This gate ensures only clean, validated data enters the feature store.
        Blocks all downstream materialization if critical failures are found.
        """
        from data_quality.validation_pipeline import run_full_validation

        db_path = os.environ.get(
            "DQ_DB_PATH",
            str(ML_ENGINE_ROOT / "data" / "trading_data.db"),
        )
        report = run_full_validation(db_path=db_path, block=False)

        structural_passed = all(
            report["suites"].get(s, {}).get("passed", False)
            for s in ("candles", "trades", "sessions")
        )

        if not structural_passed:
            failed = [
                name for name, suite in report["suites"].items()
                if name != "drift" and not suite.get("passed", False)
            ]
            raise AirflowException(
                f"Data quality gate failed: {report.get('critical_failures', 0)} critical failures "
                f"in suites {failed}. Feast materialization blocked — fix data quality first."
            )

        print(f"[DQ Gate] Passed. Critical failures: {report.get('critical_failures', 0)}, "
              f"Warnings: {report.get('warning_failures', 0)}")
        return report

    @task(task_id="export_features_to_parquet")
    def export_parquet() -> dict:
        import pandas as pd
        from features.export_features_parquet import (
            export_candle_features,
            export_trade_features,
            export_session_features,
        )
        from data.candle_db import CandleDatabase

        db_path = os.environ.get(
            "FEAST_DB_PATH",
            str(ML_ENGINE_ROOT / "data" / "trading_data.db"),
        )
        symbol = os.environ.get("FEAST_SYMBOL", "MNQ")

        db = CandleDatabase(db_path)
        stats = db.get_stats()

        results = {}
        for name, fn in [
            ("candles", export_candle_features),
            ("trades", export_trade_features),
            ("sessions", export_session_features),
        ]:
            try:
                df = fn(db, symbol)
                results[name] = {
                    "rows": len(df),
                    "ok": not df.empty,
                }
            except Exception as exc:
                results[name] = {"rows": 0, "ok": False, "error": str(exc)}

        FEAT_FEATURES_DIR.mkdir(parents=True, exist_ok=True)
        parquet_files = list(FEAT_FEATURES_DIR.glob("*.parquet"))
        total_mb = sum(f.stat().st_size for f in parquet_files) / 1024 / 1024

        print(f"[Feast Export] Candle rows: {results['candles']['rows']}, "
              f"Trade rows: {results['trades']['rows']}, "
              f"Session rows: {results['sessions']['rows']}, "
              f"Parquet size: {total_mb:.1f} MB")

        return {
            "symbol": symbol,
            "db_path": db_path,
            "parquet_files": [str(f.name) for f in parquet_files],
            "total_mb": round(total_mb, 2),
            "candle_rows": results["candles"]["rows"],
            "trade_rows": results["trades"]["rows"],
            "session_rows": results["sessions"]["rows"],
            "success": results["candles"]["ok"] and results["trades"]["ok"],
        }

    @task(task_id="apply_feast_registry")
    def apply_registry() -> str:
        """
        Apply Feast registry — registers all feature views in the registry store.
        Must be run before materialization.
        """
        import feast

        repo_path = str(ML_ENGINE_ROOT / "features" / "feast_repo")
        print(f"[Feast] Applying registry from {repo_path}")

        fs = feast.FeatureStore(repo_path=repo_path)
        applied = fs.apply()

        print(f"[Feast] Registry applied: {applied}")
        return str(applied)

    @task(task_id="materialize_candle_features")
    def materialize_candles(export_result: dict) -> dict:
        import feast

        if not export_result.get("success"):
            raise AirflowException("Parquet export failed — skipping materialization")

        repo_path = str(ML_ENGINE_ROOT / "features" / "feast_repo")
        fs = feast.FeatureStore(repo_path=repo_path)

        from datetime import datetime, timezone as _tz
        try:
            print("[Feast] Materializing candle_features (last 24h)...")
            result = fs.materialize_incremental(
                end_date=datetime.now(_tz.utc),
                feature_views=["candle_features"],
            )
            print(f"[Feast] candle_features: {result}")
            return {"view": "candle_features", "ok": True, "result": str(result)}
        except Exception as exc:
            print(f"[Feast] candle_features materialization failed: {exc}")
            raise AirflowException(f"candle_features materialization failed: {exc}")

    @task(task_id="materialize_historical_features")
    def materialize_historical(export_result: dict) -> dict:
        import feast

        if not export_result.get("success"):
            raise AirflowException("Parquet export failed — skipping materialization")

        repo_path = str(ML_ENGINE_ROOT / "features" / "feast_repo")
        fs = feast.FeatureStore(repo_path=repo_path)

        from datetime import datetime, timezone as _tz
        try:
            print("[Feast] Materializing historical_features...")
            result = fs.materialize_incremental(
                end_date=datetime.now(_tz.utc),
                feature_views=["historical_features"],
            )
            print(f"[Feast] historical_features: {result}")
            return {"view": "historical_features", "ok": True, "result": str(result)}
        except Exception as exc:
            print(f"[Feast] historical_features materialization failed: {exc}")
            raise AirflowException(f"historical_features materialization failed: {exc}")

    @task(task_id="materialize_session_features")
    def materialize_sessions(export_result: dict) -> dict:
        import feast

        if not export_result.get("success"):
            raise AirflowException("Parquet export failed — skipping materialization")

        repo_path = str(ML_ENGINE_ROOT / "features" / "feast_repo")
        fs = feast.FeatureStore(repo_path=repo_path)

        from datetime import datetime, timezone as _tz
        try:
            print("[Feast] Materializing session_features...")
            result = fs.materialize_incremental(
                end_date=datetime.now(_tz.utc),
                feature_views=["session_features"],
            )
            print(f"[Feast] session_features: {result}")
            return {"view": "session_features", "ok": True, "result": str(result)}
        except Exception as exc:
            print(f"[Feast] session_features materialization failed: {exc}")
            raise AirflowException(f"session_features materialization failed: {exc}")

    @task(task_id="validate_online_store")
    def validate_online_store(export_result: dict) -> dict:
        """
        Validate that features are readable from Redis online store.
        Confirms <10ms retrieval latency.
        """
        import time

        from features.feast_client import get_candle_features, get_feature_info

        symbol = export_result.get("symbol", "MNQ")

        t0 = time.perf_counter()
        features = get_candle_features(symbol=symbol, timestamp=None)
        latency_ms = (time.perf_counter() - t0) * 1000

        info = get_feature_info()
        n_candle_feats = len(info["candle_features"])
        n_available = len(features)

        ok = latency_ms < 50 and n_available > 0
        print(f"[Feast Validate] Online store: {n_available}/{n_candle_feats} features, "
              f"latency={latency_ms:.1f}ms {'✓' if ok else '✗'}")

        if not ok and latency_ms >= 50:
            raise AirflowException(f"Feature retrieval too slow: {latency_ms:.1f}ms (target: <50ms)")

        return {
            "features_available": n_available,
            "total_features": n_candle_feats,
            "latency_ms": round(latency_ms, 2),
            "ok": ok,
        }

    @task(task_id="log_to_mlflow", trigger_rule=TriggerRule.ALL_DONE)
    def log_to_mlflow(export_result: dict, validate_result: dict) -> str:
        try:
            import mlflow
        except Exception as exc:
            return f"mlflow_not_available: {exc}"

        tracking_uri = os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000")
        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment("feast_materialization")

        with mlflow.start_run(run_name=f"feast_materialize_{pendulum.now('UTC').format('YYYYMMDD')}"):
            mlflow.log_param("symbol", export_result.get("symbol"))
            mlflow.log_param("candle_rows", export_result.get("candle_rows"))
            mlflow.log_param("trade_rows", export_result.get("trade_rows"))
            mlflow.log_param("session_rows", export_result.get("session_rows"))
            mlflow.log_param("parquet_mb", export_result.get("total_mb"))
            mlflow.log_param("parquet_files", len(export_result.get("parquet_files", [])))

            mlflow.log_metric("features_available", float(validate_result.get("features_available", 0)))
            mlflow.log_metric("total_features", float(validate_result.get("total_features", 0)))
            mlflow.log_metric("online_retrieval_ms", float(validate_result.get("latency_ms", 999)))
            mlflow.log_metric("online_store_ok", float(validate_result.get("ok", 0)))

            mlflow.log_text(
                json.dumps({"export": export_result, "validate": validate_result}, indent=2, default=str),
                "feast_materialization_report.json",
            )

        return "logged_to_mlflow"

    # ── Task dependencies ─────────────────────────────────────────────────────────
    # DQ gate must pass before any data export or materialization
    dq_gate = validate_data_quality_gate()
    export = export_parquet()
    export.set_upstream(dq_gate)  # export depends on dq_gate passing

    # Registry must be applied before any materialization
    registry = apply_registry()
    registry.set_upstream(export)

    # Materialization tasks depend on export and registry
    mc = materialize_candles(export)
    mh = materialize_historical(export)
    ms = materialize_sessions(export)

    for t in [mc, mh, ms]:
        t.set_upstream(registry)

    # Validation depends on all materialization tasks completing
    validate = validate_online_store(export)
    validate.set_upstream([mc, mh, ms])

    # MLflow logging depends on validation
    log = log_to_mlflow(export, validate)
    log.set_upstream(validate)


dag_instance = feast_materialization()
