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


def _safe_check_all(
    drift_monitor,
    *,
    features_df=None,
    trades_df=None,
) -> dict[str, Any]:
    """Call drift monitor check_all with whichever calling convention it supports."""
    check_all = getattr(drift_monitor, "check_all", None)
    if not callable(check_all):
        return {}

    try:
        return check_all(features_df=features_df, trades_df=trades_df)
    except TypeError:
        try:
            return check_all(features_df, trades_df)
        except TypeError:
            return check_all(trades_df=trades_df)


def _get_last_training_record(db, cfg: MonitoringConfig) -> dict | None:
    """Resolve the most recent training record without assuming one DB API shape."""
    if not db:
        return None

    prefix = (cfg.model_prefix or "").strip()
    candidates = []
    if prefix:
        if prefix.endswith("_"):
            candidates.extend([f"{prefix}ensemble", prefix.rstrip("_")])
        else:
            candidates.extend([prefix, f"{prefix}_ensemble"])
    candidates.append("direction_ensemble")
    candidates = [name for idx, name in enumerate(candidates) if name and name not in candidates[:idx]]

    getter = getattr(db, "get_last_training", None)
    if callable(getter):
        for model_name in candidates:
            try:
                record = getter(model_name)
            except TypeError:
                try:
                    record = getter()
                except TypeError:
                    record = None
            if record:
                return record

    for attr_name in ("last_training", "_last_training"):
        attr = getattr(db, attr_name, None)
        if attr:
            return attr() if callable(attr) else attr

    return None


def _count_new_trades_since_last_training(db, last_training: dict | None) -> int:
    if not db or not last_training:
        return 0

    completed_at = (
        last_training.get("completed_at")
        if isinstance(last_training, dict)
        else getattr(last_training, "completed_at", None)
    )
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


def _get_snapshot_cache(maxsize: int = 1, ttl: int = 240) -> TTLCache | dict:
    """Get or create the TTL snapshot cache (max 4-min TTL per 5-min DAG schedule)."""
    global _snapshot_cache
    if not _CACHE_AVAILABLE:
        return {}
    if _snapshot_cache is None:
        _snapshot_cache = TTLCache(maxsize=maxsize, ttl=ttl)
    return _snapshot_cache


def _raw_concept_drift_values(concept_drift) -> dict[str, Any]:
    """Extract raw numeric values from concept drift detector (not just status strings)."""
    if concept_drift is None:
        return {}
    try:
        return {
            "baseline_win_rate": getattr(concept_drift, "_baseline_win_rate", None),
            "current_win_rate": getattr(concept_drift, "_current_win_rate", None),
            "win_rate_drop_pct": getattr(concept_drift, "_win_rate_drop_pct", None),
            "rolling_window_size": getattr(concept_drift, "_window_size", None),
        }
    except Exception:
        return {}


def _raw_regime_drift_values(regime_drift) -> dict[str, Any]:
    """Extract raw numeric values from regime drift detector."""
    if regime_drift is None:
        return {}
    try:
        return {
            "baseline_regime_probs": getattr(regime_drift, "_baseline_probs", None),
            "current_regime_probs": getattr(regime_drift, "_current_probs", None),
            "max_prob_shift": getattr(regime_drift, "_max_prob_shift", None),
        }
    except Exception:
        return {}


def _build_snapshot_uncached(
    db,
    drift_monitor,
    retrain_config,
    cfg: MonitoringConfig,
) -> dict[str, Any]:
    """Core snapshot building logic (no caching — called by build_monitoring_snapshot)."""
    symbol = cfg.symbol
    last_training = _get_last_training_record(db, cfg)
    drift_snapshot: dict[str, Any] = {
        "overall_status": "ok",
        "should_retrain": False,
        "feature_drift": {"status": "ok", "psi_scores": {}, "drifted_features": []},
        "concept_drift": {"status": "ok"},
        "regime_drift": {"status": "ok"},
        "reason": "Monitoring snapshot not yet computed",
    }
    trades_df = pd.DataFrame()
    drift_result: dict = {}

    try:
        trades_df = db.get_trade_log(limit=cfg.trade_limit, symbol=symbol) if db else pd.DataFrame()
        min_baseline = getattr(getattr(drift_monitor, "thresholds", None), "min_baseline_trades", 50)
        if len(trades_df) >= min_baseline:
            end_dt = datetime.now(timezone.utc)
            start_dt = end_dt - timedelta(days=cfg.lookback_days)
            candles_df = db.get_candles(
                start_dt.isoformat(),
                end_dt.isoformat(),
                symbol,
                limit=cfg.candle_limit,
            )

            # Check drift BEFORE feature engineering (so should_retrain is always computed)
            drift_result = _safe_check_all(drift_monitor, features_df=None, trades_df=trades_df)

            # Timeout wrapper on feature engineering (60s max)
            # Guard SIGALRM availability (Unix-only; not available on Windows)
            import signal
            _SIGALRM_AVAILABLE = hasattr(signal, "SIGALRM")

            def _engineer_with_timeout():
                if _SIGALRM_AVAILABLE:
                    def _handler(signum, frame):
                        raise TimeoutError("Feature engineering exceeded 60s")
                    signal.signal(signal.SIGALRM, _handler)
                    signal.alarm(60)
                    try:
                        return engineer_features(candles_df, trades_df, None, None, None)
                    finally:
                        signal.alarm(0)
                else:
                    return engineer_features(candles_df, trades_df, None, None, None)

            _feature_timeout = False
            try:
                feature_df = _engineer_with_timeout()
            except TimeoutError:
                _feature_timeout = True
                drift_snapshot = {
                    "overall_status": "error",
                    **drift_result,  # preserve should_retrain from check_all()
                    "feature_drift": {"status": "error", "psi_scores": {}, "drifted_features": []},
                    "concept_drift": {"status": "error", "error": "Feature engineering timed out after 60s"},
                    "regime_drift": {"status": "error", "error": "Feature engineering timed out after 60s"},
                    "error": "Feature engineering timeout",
                }

            if not _feature_timeout:
                if not getattr(drift_monitor.feature_drift, "_baselines", {}):
                    drift_monitor.feature_drift.update_baseline(feature_df, trades_df)
                if getattr(drift_monitor.concept_drift, "_baseline_win_rate", None) is None:
                    drift_monitor.concept_drift.set_baseline(trades_df)

                drift_result = _safe_check_all(drift_monitor, features_df=feature_df, trades_df=trades_df)

                # Inject raw numeric values (not just status strings)
                concept_detector = getattr(drift_monitor, "concept_drift", None)
                regime_detector = getattr(drift_monitor, "regime_drift", None)
                feature_detector = getattr(drift_monitor, "feature_drift", None)

                concept_raw = _raw_concept_drift_values(concept_detector)
                regime_raw = _raw_regime_drift_values(regime_detector)

                # Merge raw values into concept and regime drift snapshots
                if concept_detector:
                    concept_result = drift_result.get("concept_drift", {})
                    drift_result["concept_drift"] = {**concept_result, **concept_raw}
                if regime_detector:
                    regime_result = drift_result.get("regime_drift", {})
                    drift_result["regime_drift"] = {**regime_result, **regime_raw}

                drift_snapshot = drift_result

                # Inject raw PSI scores per feature (not just max)
                if feature_detector:
                    feature_result = drift_snapshot.get("feature_drift", {})
                    raw_psi = getattr(feature_detector, "_current_psi_scores", {})
                    if raw_psi:
                        feature_result = {**feature_result, "psi_scores_raw": raw_psi}
                        drift_snapshot["feature_drift"] = feature_result
        else:
            drift_snapshot = {
                **drift_snapshot,
                "reason": f"Only {len(trades_df)} closed trades available; need at least {min_baseline}",
            }
    except Exception as exc:
        drift_snapshot = {
            "overall_status": "error",
            **drift_result,  # preserve should_retrain if already computed
            "feature_drift": {"status": "error", "psi_scores": {}, "drifted_features": []},
            "concept_drift": {"status": "error", "error": str(exc)},
            "regime_drift": {"status": "error", "error": str(exc)},
            "error": str(exc),
        }

    return _finalize_snapshot(
        db, drift_monitor, retrain_config, cfg, symbol, last_training,
        drift_snapshot, None, None,
    )


def _finalize_snapshot(
    db,
    drift_monitor,
    retrain_config,
    cfg: MonitoringConfig,
    symbol: str,
    last_training,
    drift_snapshot: dict,
    mlflow_overview: dict,
    registry_snapshot: dict | None,
) -> dict[str, Any]:
    """Compute SLA, MLflow, and retrain recommendation, then return full snapshot."""
    predict_sla = _safe_sla_report("/predict")
    overall_sla = _safe_sla_report("ALL")
    predict_p95_ms = float(predict_sla.get("p95_ms", 0.0) or 0.0)
    latency_breached = bool(predict_p95_ms and predict_p95_ms > cfg.max_predict_p95_ms)

    registry_summary = _registry_summary(registry_snapshot or {})
    new_trades_since_last_training = _count_new_trades_since_last_training(db, last_training)
    min_trades_for_retrain = getattr(retrain_config, "min_trades_before_retrain", 20)
    retrain_recommended = bool(
        drift_snapshot.get("should_retrain", False)
        and new_trades_since_last_training >= min_trades_for_retrain
    )

    # Prometheus sync
    if PROMETHEUS_SYNC_AVAILABLE:
        if set_drift_monitoring_snapshot:
            set_drift_monitoring_snapshot(drift_snapshot)

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


def build_monitoring_snapshot(
    db,
    drift_monitor,
    retrain_config=None,
    *,
    symbol: str | None = None,
    sync_prometheus_metrics: bool = True,
    config: MonitoringConfig | None = None,
    wait_for_baseline: bool = False,
) -> dict[str, Any]:
    """
    Build a unified monitoring snapshot for drift, SLA, and MLflow.

    Uses a 4-minute TTL cache to avoid redundant computation between DAG runs
    (DAG runs every 5 minutes).

    Args:
        db: Database instance
        drift_monitor: DriftMonitor instance
        retrain_config: Optional retrain configuration
        symbol: Trading symbol (default: MNQ)
        sync_prometheus_metrics: Whether to sync metrics to Prometheus
        config: MonitoringConfig instance (overrides env-var defaults)
        wait_for_baseline: If True, block until baseline is established.
                           Useful for initial setup; not needed in steady state.

    Returns:
        Full monitoring snapshot dict with drift, SLA, MLflow, and retrain info.
    """
    cfg = config or MonitoringConfig()
    symbol = symbol or cfg.symbol

    # Check if baseline is established
    min_baseline = getattr(getattr(drift_monitor, "thresholds", None), "min_baseline_trades", 50)
    trades_df = db.get_trade_log(limit=cfg.trade_limit, symbol=symbol) if db else pd.DataFrame()
    baseline_ready = len(trades_df) >= min_baseline

    if wait_for_baseline and not baseline_ready:
        # Poll until baseline is ready (max 5 minutes)
        import time as _time
        for _ in range(60):  # 60 x 5s = 5 minutes
            _time.sleep(5)
            trades_df = db.get_trade_log(limit=cfg.trade_limit, symbol=symbol) if db else pd.DataFrame()
            if len(trades_df) >= min_baseline:
                break

    # Try to serve from TTL cache (keyed on symbol for multi-symbol support)
    cache = _get_snapshot_cache()
    cache_key = f"snapshot:{symbol}"
    if cache and cache_key in cache:
        # Refresh Prometheus sync even when serving from cache
        if sync_prometheus_metrics and PROMETHEUS_SYNC_AVAILABLE:
            if set_drift_monitoring_snapshot:
                cached = cache[cache_key]
                set_drift_monitoring_snapshot(cached.get("drift", {}))
        return cache[cache_key]

    # Build fresh snapshot
    mlflow_overview: dict[str, Any] = {"available": False}
    registry_snapshot: dict[str, list[dict]] = {}
    if MLFLOW_CLIENT_AVAILABLE and get_mlflow_client:
        try:
            client = get_mlflow_client("direction")
            mlflow_overview = client.get_tracking_overview()
            registry_snapshot = client.get_registry_models(cfg.model_prefix)
        except Exception as exc:
            mlflow_overview = {"available": False, "error": str(exc)}

    snapshot = _build_snapshot_uncached(db, drift_monitor, retrain_config, cfg)
    snapshot["mlflow"] = {
        "overview": mlflow_overview,
        "registry": _registry_summary(registry_snapshot),
    }

    # Sync MLflow metrics to Prometheus (after mlflow_overview is populated)
    if sync_prometheus_metrics and PROMETHEUS_SYNC_AVAILABLE:
        if mlflow_overview and mlflow_overview.get("available"):
            if set_mlflow_experiment_count:
                set_mlflow_experiment_count(int(mlflow_overview.get("experiments", 0)))
            if set_active_runs:
                set_active_runs(int(mlflow_overview.get("active_runs", 0)))
        if sync_mlflow_registry and registry_snapshot:
            sync_mlflow_registry(registry_snapshot)

    # Cache the result (4-min TTL)
    if cache is not None:
        cache[cache_key] = snapshot

    return snapshot


def get_monitoring_config() -> dict[str, Any]:
    """
    Return the current monitoring thresholds and configuration.
    Used by Airflow to self-document what thresholds are active.
    """
    cfg = MonitoringConfig()
    return {
        "symbol": cfg.symbol,
        "model_prefix": cfg.model_prefix,
        "trade_limit": cfg.trade_limit,
        "candle_limit": cfg.candle_limit,
        "lookback_days": cfg.lookback_days,
        "max_predict_p95_ms": cfg.max_predict_p95_ms,
        "min_baseline_trades": 50,  # from drift_monitor default
    }
