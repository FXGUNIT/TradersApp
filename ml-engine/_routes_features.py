"""
ML Engine — Feature / MLflow / Drift / Monitoring Routes
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)
"""
import time
import traceback
from datetime import datetime, timedelta, timezone

import pandas as pd
from fastapi import HTTPException, Query

import _lifespan

try:
    from features.feast_client import get_all_features as feast_get_all_features, get_feature_info
    from features.feature_lineage import warmup_online_store
    FEATURES_AVAILABLE = True
except ImportError:
    FEATURES_AVAILABLE = False
    feast_get_all_features = lambda **kw: {}
    get_feature_info = lambda: {}
    warmup_online_store = None

try:
    from infrastructure.model_monitor import build_monitoring_snapshot, get_monitoring_config
    MONITORING_AVAILABLE = True
except ImportError:
    MONITORING_AVAILABLE = False
    build_monitoring_snapshot = None
    get_monitoring_config = lambda: {}


# ── /features/* ─────────────────────────────────────────────────────────────────

def features_online(symbol: str = "MNQ", timestamp: str | None = None):
    """Pre-materialized features from Feast online store (Redis)."""
    start = time.time()
    try:
        features = feast_get_all_features(symbol=symbol, timestamp=timestamp)
        latency_ms = (time.time() - start) * 1000
        return {
            "ok": True, "symbol": symbol,
            "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
            "features": features, "feature_count": len(features),
            "latency_ms": round(latency_ms, 2),
            "online_store": "redis" if features else "db_fallback",
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def features_info():
    """Metadata about all available features."""
    lineage_registry = _lifespan.lineage_registry
    try:
        info = get_feature_info()
        catalog = lineage_registry.catalog() if lineage_registry else {}
        stale_critical = []
        if lineage_registry:
            stale_critical = [f.feature_name for f in lineage_registry.get_stale_features(24)]
        return {
            "ok": True,
            "feast_available": info.get("feast_available", False),
            "online_store": info.get("online_store", "unknown"),
            "feature_views": {
                "candle_features": len(info.get("candle_features", [])),
                "historical_features": len(info.get("historical_features", [])),
                "session_features": len(info.get("session_features", [])),
            },
            "total_features": sum(len(v) for v in info.get("feature_views", {}).values()),
            "catalog": catalog, "stale_features": stale_critical,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def feature_lineage(feature_view: str | None = None, stale_only: bool = False):
    """Feature lineage: source table, transformation, freshness."""
    lineage_registry = _lifespan.lineage_registry
    if lineage_registry is None:
        return {"ok": False, "error": "Feature lineage registry not initialized"}
    try:
        if stale_only:
            features = [f.to_dict() for f in lineage_registry.get_stale_features(24)]
        elif feature_view:
            features = [f.to_dict() for f in lineage_registry.get_by_view(feature_view)]
        else:
            features = [f.to_dict() for f in lineage_registry.get_all()]
        return {"ok": True, "feature_view": feature_view, "stale_only": stale_only,
                "count": len(features), "features": features}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def feature_lineage_single(feature_name: str):
    """Lineage for a single feature by name."""
    lineage_registry = _lifespan.lineage_registry
    if lineage_registry is None:
        return {"ok": False, "error": "Feature lineage registry not initialized"}
    try:
        lineage = lineage_registry.get(feature_name)
        if lineage is None:
            return {"ok": False, "error": f"Feature '{feature_name}' not found"}
        return {"ok": True, "lineage": lineage.to_dict()}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def materialization_history(feature_view: str | None = None, limit: int = 10):
    """Recent materialization run history."""
    lineage_registry = _lifespan.lineage_registry
    if lineage_registry is None:
        return {"ok": False, "error": "Feature lineage registry not initialized"}
    try:
        history = lineage_registry.get_materialization_history(feature_view=feature_view, limit=limit)
        return {"ok": True, "feature_view": feature_view, "runs": history, "count": len(history)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def trigger_warmup(symbol: str = "MNQ", lookback_minutes: int = 60):
    """Manually trigger Feast online store warmup."""
    import os
    if warmup_online_store is None:
        return {"ok": False, "error": "warmup_online_store not available"}
    try:
        result = warmup_online_store(
            redis_url=os.environ.get("FEAST_REDIS_URL", "redis://localhost:6379"),
            db_path=__import__("config", fromlist=["DB_PATH"]).DB_PATH,
            symbol=symbol, lookback_minutes=lookback_minutes,
        )
        return {"ok": True, "warmup": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── /mlflow/* ───────────────────────────────────────────────────────────────────

try:
    from _infrastructure import MLFLOW_AVAILABLE, MLFLOW_TRACKING_ENABLED, MLFLOW_TRACKING_URI
    from _infrastructure import set_prometheus_mlflow_experiment_count, set_prometheus_active_runs, sync_prometheus_mlflow_registry
except ImportError:
    MLFLOW_AVAILABLE = False
    MLFLOW_TRACKING_ENABLED = False
    MLFLOW_TRACKING_URI = "http://localhost:5000"
    set_prometheus_mlflow_experiment_count = lambda *a: None
    set_prometheus_active_runs = lambda *a: None
    sync_prometheus_mlflow_registry = lambda *a: None

def mlflow_status():
    """Check MLflow server connectivity."""
    if not MLFLOW_AVAILABLE:
        return {"ok": False, "mlflow_available": False,
                "message": "mlflow package not installed. Install: pip install mlflow"}
    if not MLFLOW_TRACKING_ENABLED:
        return {"ok": True, "mlflow_available": True, "tracking_enabled": False,
                "tracking_uri": None,
                "message": "MLflow tracking disabled in this environment."}
    try:
        from infrastructure.mlflow_client import get_mlflow_client
        client = get_mlflow_client("direction")
        summary = client.get_experiment_summary()
        overview = client.get_tracking_overview()
        if overview.get("available"):
            set_prometheus_mlflow_experiment_count(int(overview.get("experiments", 0)))
            set_prometheus_active_runs(int(overview.get("active_runs", 0)))
        return {"ok": True, "mlflow_available": True, "tracking_enabled": True, "tracking_uri": MLFLOW_TRACKING_URI,
                "experiments": summary, "overview": overview}
    except Exception as e:
        return {"ok": False, "mlflow_available": True, "tracking_enabled": True, "mlflow_error": str(e),
                "tracking_uri": MLFLOW_TRACKING_URI,
                "message": "MLflow installed but server unreachable."}


def mlflow_experiments(experiment: str | None = None):
    """Query MLflow experiments."""
    if not MLFLOW_AVAILABLE:
        return {"ok": False, "error": "mlflow not installed"}
    if not MLFLOW_TRACKING_ENABLED:
        return {"ok": False, "error": "MLflow tracking disabled in this environment", "tracking_uri": None}
    try:
        from infrastructure.mlflow_client import get_mlflow_client
        exp_name = experiment or "direction"
        client = get_mlflow_client(exp_name)
        summary = client.get_experiment_summary()
        overview = client.get_tracking_overview()
        if overview.get("available"):
            set_prometheus_mlflow_experiment_count(int(overview.get("experiments", 0)))
            set_prometheus_active_runs(int(overview.get("active_runs", 0)))
        return {"ok": True, "experiment": f"tradersapp_{exp_name}",
                "summary": summary, "overview": overview, "tracking_uri": MLFLOW_TRACKING_URI}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def mlflow_models(model_prefix: str = "direction"):
    """List registered models in MLflow registry."""
    if not MLFLOW_AVAILABLE:
        return {"ok": False, "error": "mlflow not installed"}
    if not MLFLOW_TRACKING_ENABLED:
        return {"ok": False, "error": "MLflow tracking disabled in this environment", "tracking_uri": None}
    try:
        from infrastructure.mlflow_client import get_mlflow_client
        client = get_mlflow_client(model_prefix)
        results = client.get_registry_models(f"{model_prefix}_")
        sync_prometheus_mlflow_registry(results)
        return {"ok": True, "models": results, "tracking_uri": MLFLOW_TRACKING_URI,
                "dashboard_url": f"{MLFLOW_TRACKING_URI}/#/models" if MLFLOW_TRACKING_URI else None}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def mlflow_promote(model_name: str, from_stage: str = "staging", to_stage: str = "production"):
    """Promote model from staging → production in MLflow registry."""
    if not MLFLOW_AVAILABLE:
        return {"ok": False, "error": "mlflow not installed"}
    if not MLFLOW_TRACKING_ENABLED:
        return {"ok": False, "error": "MLflow tracking disabled in this environment", "tracking_uri": None}
    try:
        from infrastructure.mlflow_client import get_mlflow_client
        client = get_mlflow_client("direction")
        result = client.promote_model(model_name, from_stage, to_stage)
        if not result.get("ok", False):
            return {"ok": False, "error": result.get("error") or result.get("reason") or "Promotion failed",
                    "promotion": result}
        registry_snapshot = client.get_registry_models("direction_")
        sync_prometheus_mlflow_registry(registry_snapshot)
        return {"ok": True, "promotion": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── /drift/* ────────────────────────────────────────────────────────────────────

try:
    from _infrastructure import PROMETHEUS_AVAILABLE, record_prometheus_cache, record_prometheus_drift_monitoring_snapshot
except ImportError:
    PROMETHEUS_AVAILABLE = False
    record_prometheus_cache = lambda **kw: None
    record_prometheus_drift_monitoring_snapshot = lambda **kw: None


def drift_status():
    """Current drift status for all three detectors (feature, concept, regime)."""
    db = _lifespan.db
    drift_monitor = _lifespan.drift_monitor
    retrain_pipeline = _lifespan.retrain_pipeline
    if drift_monitor is None:
        return {"ok": False, "error": "DriftMonitor not initialized"}
    try:
        snapshot = build_monitoring_snapshot(
            db, drift_monitor,
            retrain_config=(retrain_pipeline.config if retrain_pipeline else None),
            sync_prometheus_metrics=True,
        )
        return {"ok": True, **snapshot["drift"]}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def drift_detect(request: "DriftDetectRequest"):
    """Run full drift detection across all three detectors."""
    drift_monitor = _lifespan.drift_monitor
    if drift_monitor is None:
        return {"ok": False, "error": "DriftMonitor not initialized"}
    try:
        features_df = pd.DataFrame(request.candles) if request.candles else pd.DataFrame()
        if not features_df.empty and "timestamp" in features_df.columns:
            features_df["timestamp"] = pd.to_datetime(features_df["timestamp"], errors="coerce")
        trades_df = pd.DataFrame(request.trades) if request.trades else pd.DataFrame()
        result = drift_monitor.check_all(
            features_df=features_df, trades_df=trades_df,
            current_regime=request.current_regime, regime_confidence=request.regime_confidence,
        )
        record_prometheus_drift_monitoring_snapshot(result)
        return {"ok": True, **result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def drift_record_prediction(request: "RecordPredictionRequest"):
    """Record a prediction result for concept drift monitoring."""
    drift_monitor = _lifespan.drift_monitor
    if drift_monitor is None:
        return {"ok": False, "error": "DriftMonitor not initialized"}
    try:
        drift_monitor.concept_drift.record_prediction(correct=request.correct, confidence=request.confidence)
        concept_result = drift_monitor.concept_drift.detect()
        record_prometheus_drift_monitoring_snapshot({
            "overall_status": concept_result.get("status", "ok"),
            "should_retrain": drift_monitor.concept_drift.should_retrain(),
            "feature_drift": {"status": "ok", "psi_scores": {}, "drifted_features": []},
            "concept_drift": concept_result,
            "regime_drift": drift_monitor.regime_drift.detect(),
        })
        return {"ok": True, "recorded": True, "concept_drift": concept_result,
                "should_retrain": drift_monitor.concept_drift.should_retrain()}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def drift_set_baseline(symbol: str = "MNQ"):
    """Refresh drift baselines from current DB data."""
    db = _lifespan.db
    drift_monitor = _lifespan.drift_monitor
    if drift_monitor is None or db is None:
        return {"ok": False, "error": "DriftMonitor or DB not initialized"}
    try:
        trades_df = db.get_trade_log(limit=10000, symbol=symbol)
        end = datetime.now(timezone.utc).isoformat()
        start = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        features_df_raw = db.get_candles(start, end, symbol, limit=10000)
        features_df = features_df_raw
        if len(trades_df) < 50:
            return {"ok": False, "error": f"Not enough trades: {len(trades_df)} (need ≥50)"}
        drift_monitor.feature_drift.update_baseline(features_df, trades_df)
        drift_monitor.concept_drift.set_baseline(trades_df)
        return {"ok": True, "baseline_trades": len(trades_df), "baseline_candles": len(features_df),
                "message": "Drift baselines updated."}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def drift_thresholds():
    """Get current drift detection thresholds."""
    drift_monitor = _lifespan.drift_monitor
    if drift_monitor is None:
        return {"ok": False, "error": "DriftMonitor not initialized"}
    t = drift_monitor.thresholds
    return {"ok": True,
            "psi_feature_warning": t.psi_feature_warning, "psi_feature_alert": t.psi_feature_alert,
            "psi_feature_critical": t.psi_feature_critical,
            "accuracy_drop_warning": t.accuracy_drop_warning, "accuracy_drop_alert": t.accuracy_drop_alert,
            "rolling_window_trades": t.rolling_window_trades, "regime_change_threshold": t.regime_change_threshold,
            "min_baseline_trades": t.min_baseline_trades, "min_current_trades": t.min_current_trades}


# ── /monitoring/* ───────────────────────────────────────────────────────────────

def monitoring_status(symbol: str = "MNQ", sync_metrics: bool = True, wait_for_baseline: bool = False):
    """Unified model-monitoring snapshot (drift + SLA + MLflow registry)."""
    db = _lifespan.db
    drift_monitor = _lifespan.drift_monitor
    retrain_pipeline = _lifespan.retrain_pipeline
    if drift_monitor is None or db is None:
        raise HTTPException(status_code=503, detail="Monitoring components not initialized")
    try:
        snapshot = build_monitoring_snapshot(
            db, drift_monitor,
            retrain_config=(retrain_pipeline.config if retrain_pipeline else None),
            symbol=symbol, sync_prometheus_metrics=sync_metrics, wait_for_baseline=wait_for_baseline,
        )
        return {"ok": True, **snapshot}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def monitoring_config():
    """Current monitoring thresholds and configuration."""
    try:
        return {"ok": True, **get_monitoring_config()}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
