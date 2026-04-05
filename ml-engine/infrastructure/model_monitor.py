"""
Model monitoring service — continuous drift, SLA, and MLflow health snapshots.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Any

import pandas as pd

from features.feature_pipeline import engineer_features
from infrastructure.performance import get_sla_monitor

# TTL cache — avoid redundant snapshot computation between DAG runs (5-min schedule)
try:
    from cachetools import TTLCache
    _snapshot_cache: TTLCache | None = None
    _CACHE_AVAILABLE = True
except ImportError:
    _snapshot_cache = None
    _CACHE_AVAILABLE = False

try:
    from infrastructure.mlflow_client import get_mlflow_client
    MLFLOW_CLIENT_AVAILABLE = True
except ImportError:
    get_mlflow_client = None
    MLFLOW_CLIENT_AVAILABLE = False

try:
    from infrastructure.prometheus_exporter import (
        set_active_runs,
        set_drift_monitoring_snapshot,
        set_mlflow_experiment_count,
        sync_mlflow_registry,
    )
    PROMETHEUS_SYNC_AVAILABLE = True
except ImportError:
    set_active_runs = None
    set_drift_monitoring_snapshot = None
    set_mlflow_experiment_count = None
    sync_mlflow_registry = None
    PROMETHEUS_SYNC_AVAILABLE = False


@dataclass
class MonitoringConfig:
    symbol: str = os.environ.get("MODEL_MONITOR_SYMBOL", "MNQ")
    model_prefix: str = os.environ.get("MODEL_MONITOR_MODEL_PREFIX", "direction_")
    trade_limit: int = int(os.environ.get("MODEL_MONITOR_TRADE_LIMIT", "500"))
    candle_limit: int = int(os.environ.get("MODEL_MONITOR_CANDLE_LIMIT", "5000"))
    lookback_days: int = int(os.environ.get("MODEL_MONITOR_LOOKBACK_DAYS", "90"))
    max_predict_p95_ms: float = float(os.environ.get("MODEL_MONITOR_MAX_PREDICT_P95_MS", "50"))


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _registry_summary(registry: dict[str, list[dict]]) -> dict[str, Any]:
    now = time.time()
    stage_counts: dict[str, int] = {}
    production_versions: list[dict[str, Any]] = []
    newest_production_age_seconds: float | None = None

    for model_name, versions in (registry or {}).items():
        for version in versions or []:
            stage = str(version.get("stage") or "None")
            stage_counts[stage] = stage_counts.get(stage, 0) + 1

            created_raw = version.get("created") or version.get("creation_timestamp")
            created = None
            if created_raw not in (None, ""):
                created = float(created_raw)
                if created > 1e12:
                    created /= 1000.0

            if stage != "Production":
                continue

            age_seconds = None if created is None else max(0.0, now - created)
            if age_seconds is not None:
                if newest_production_age_seconds is None or age_seconds < newest_production_age_seconds:
                    newest_production_age_seconds = age_seconds

            production_versions.append(
                {
                    "model_name": model_name,
                    "version": version.get("version"),
                    "run_id": version.get("run_id"),
                    "age_seconds": round(age_seconds, 2) if age_seconds is not None else None,
                }
            )

    return {
        "stage_counts": stage_counts,
        "registered_families": len(registry or {}),
        "registered_versions": sum(len(versions or []) for versions in (registry or {}).values()),
        "production_versions": production_versions,
        "production_model_count": len(production_versions),
        "newest_production_model_age_seconds": (
            round(newest_production_age_seconds, 2)
            if newest_production_age_seconds is not None
            else None
        ),
    }


def _count_new_trades_since_last_training(db, last_training: dict | None) -> int:
    if not db or not last_training:
        return 0

    completed_at = last_training.get("completed_at")
    if not completed_at:
        return 0

    with db.conn() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) FROM trade_log
            WHERE exit_time IS NOT NULL
              AND entry_time > ?
            """,
            (completed_at,),
        ).fetchone()
    return int(row[0] if row else 0)


def _safe_sla_report(endpoint: str) -> dict[str, Any]:
    try:
        return get_sla_monitor().get_sla_report(endpoint)
    except Exception as exc:
        return {"error": str(exc)}


def build_monitoring_snapshot(
    db,
    drift_monitor,
    retrain_config=None,
    *,
    symbol: str | None = None,
    sync_prometheus_metrics: bool = True,
    config: MonitoringConfig | None = None,
) -> dict[str, Any]:
    """Build a unified monitoring snapshot for drift, SLA, and MLflow."""
    cfg = config or MonitoringConfig()
    symbol = symbol or cfg.symbol

    last_training = db.get_last_training("direction_ensemble") if db else None
    drift_snapshot: dict[str, Any] = {
        "overall_status": "ok",
        "should_retrain": False,
        "feature_drift": {"status": "ok", "psi_scores": {}, "drifted_features": []},
        "concept_drift": drift_monitor.concept_drift.detect() if drift_monitor else {"status": "ok"},
        "regime_drift": drift_monitor.regime_drift.detect() if drift_monitor else {"status": "ok"},
        "reason": "Monitoring snapshot not yet computed",
    }
    trades_df = pd.DataFrame()

    try:
        trades_df = db.get_trade_log(limit=cfg.trade_limit, symbol=symbol) if db else pd.DataFrame()
        min_baseline = getattr(drift_monitor.thresholds, "min_baseline_trades", 50)
        if len(trades_df) >= min_baseline:
            end_dt = datetime.now(timezone.utc)
            start_dt = end_dt - timedelta(days=cfg.lookback_days)
            candles_df = db.get_candles(
                start_dt.isoformat(),
                end_dt.isoformat(),
                symbol,
                limit=cfg.candle_limit,
            )
            feature_df = engineer_features(candles_df, trades_df, None, None, None)

            if not getattr(drift_monitor.feature_drift, "_baselines", {}):
                drift_monitor.feature_drift.update_baseline(feature_df, trades_df)
            if getattr(drift_monitor.concept_drift, "_baseline_win_rate", None) is None:
                drift_monitor.concept_drift.set_baseline(trades_df)

            drift_snapshot = drift_monitor.check_all(feature_df, trades_df)
        else:
            drift_snapshot = {
                **drift_snapshot,
                "reason": f"Only {len(trades_df)} closed trades available; need at least {min_baseline}",
            }
    except Exception as exc:
        drift_snapshot = {
            "overall_status": "error",
            "should_retrain": False,
            "feature_drift": {"status": "error", "psi_scores": {}, "drifted_features": []},
            "concept_drift": {"status": "error", "error": str(exc)},
            "regime_drift": {"status": "error", "error": str(exc)},
            "error": str(exc),
        }

    predict_sla = _safe_sla_report("/predict")
    overall_sla = _safe_sla_report("ALL")
    predict_p95_ms = float(predict_sla.get("p95_ms", 0.0) or 0.0)
    latency_breached = bool(predict_p95_ms and predict_p95_ms > cfg.max_predict_p95_ms)

    mlflow_overview: dict[str, Any] = {"available": False}
    registry_snapshot: dict[str, list[dict]] = {}
    if MLFLOW_CLIENT_AVAILABLE and get_mlflow_client:
        try:
            client = get_mlflow_client("direction")
            mlflow_overview = client.get_tracking_overview()
            registry_snapshot = client.get_registry_models(cfg.model_prefix)
        except Exception as exc:
            mlflow_overview = {"available": False, "error": str(exc)}

    registry_summary = _registry_summary(registry_snapshot)
    new_trades_since_last_training = _count_new_trades_since_last_training(db, last_training)
    min_trades_for_retrain = getattr(retrain_config, "min_trades_before_retrain", 20)
    retrain_recommended = bool(
        drift_snapshot.get("should_retrain", False)
        and new_trades_since_last_training >= min_trades_for_retrain
    )

    if sync_prometheus_metrics and PROMETHEUS_SYNC_AVAILABLE:
        if set_drift_monitoring_snapshot:
            set_drift_monitoring_snapshot(drift_snapshot)
        if mlflow_overview.get("available"):
            if set_mlflow_experiment_count:
                set_mlflow_experiment_count(int(mlflow_overview.get("experiments", 0)))
            if set_active_runs:
                set_active_runs(int(mlflow_overview.get("active_runs", 0)))
        if sync_mlflow_registry:
            sync_mlflow_registry(registry_snapshot)

    return {
        "symbol": symbol,
        "generated_at": _utc_now_iso(),
        "drift": drift_snapshot,
        "sla": {
            "predict": predict_sla,
            "overall": overall_sla,
            "predict_p95_breached": latency_breached,
            "predict_p95_target_ms": cfg.max_predict_p95_ms,
        },
        "mlflow": {
            "overview": mlflow_overview,
            "registry": registry_summary,
        },
        "retrain": {
            "last_training": last_training,
            "new_trades_since_last_training": new_trades_since_last_training,
            "min_trades_before_retrain": min_trades_for_retrain,
            "recommended": retrain_recommended,
            "recommended_by_drift_only": bool(drift_snapshot.get("should_retrain", False)),
        },
    }
