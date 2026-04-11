"""
ML Engine — Health, Metrics, SLA Endpoints
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)
"""
import time as _time
from datetime import datetime, timezone

from fastapi import Response
from fastapi.responses import PlainTextResponse

# Re-expose globals from _lifespan for convenience
from _lifespan import db, start_time, lineage_registry, feast_warmed

from _infrastructure import (
    get_request_id,
    get_model_registry_status,
    PROMETHEUS_AVAILABLE,
    get_sla_monitor,
    SLAMonitor,
)

try:
    from infrastructure.prometheus_exporter import handle_metrics
    _HANDLE_METRICS = handle_metrics
except ImportError:
    _HANDLE_METRICS = None


# ── /live and /ready ──────────────────────────────────────────────────────────

def live():
    """Liveness check — stays lightweight and never reaches external services."""
    return {
        "status": "live",
        "service": "tradersapp-ml-engine",
        "request_id": get_request_id(),
        "uptime_sec": round(_time.time() - start_time, 1),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def ready():
    """Readiness check — verifies the DB facade is initialized without heavy introspection."""
    db_available = False
    db_backend = "unknown"
    if db is not None:
        db_backend = getattr(db, "backend_type", "unknown")
        try:
            db_available = bool(db.health_check())
        except Exception:
            db_available = False

    return {
        "status": "ready" if db_available else "starting",
        "service": "tradersapp-ml-engine",
        "request_id": get_request_id(),
        "db_backend": db_backend,
        "db_available": db_available,
        "feast_warmed": feast_warmed,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── /health ───────────────────────────────────────────────────────────────────

def health():
    """Health check — uses globals set by _lifespan lifespan."""
    uptime = _time.time() - start_time
    try:
        stats = db.get_stats()
    except Exception:
        stats = {}
    try:
        registry_status = get_model_registry_status()
    except Exception as exc:
        registry_status = {
            "error": str(exc),
            "available_models": [],
            "predictor": {"loaded_model_count": 0},
        }
    models = registry_status.get("available_models", [])

    return {
        "status": "healthy",
        "request_id": get_request_id(),
        "uptime_sec": round(uptime, 1),
        "db_backend": db.backend_type if db else "unknown",
        "db_candles": stats.get("candles", 0),
        "db_trades": stats.get("trades", 0),
        "db_sessions": stats.get("sessions", 0),
        "models_loaded": registry_status.get("predictor", {}).get("loaded_model_count", 0),
        "models_available": models,
        "model_registry": registry_status,
        "last_training": stats.get("last_training"),
        "feast": {
            "lineage_registered": len(lineage_registry.get_all()) if lineage_registry else 0,
            "online_store_warmed": feast_warmed,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── /metrics ─────────────────────────────────────────────────────────────────

def metrics_endpoint():
    """Prometheus metrics endpoint. Returns # prometheus-client not installed\n when unavailable."""
    if PROMETHEUS_AVAILABLE and _HANDLE_METRICS:
        body, content_type = _HANDLE_METRICS()
        return Response(content=body, headers={"Content-Type": content_type})
    return PlainTextResponse(content="# prometheus-client not installed\n", media_type="text/plain")


# ── /sla ─────────────────────────────────────────────────────────────────────

def get_sla_report(endpoint: str | None = None):
    """SLA compliance report per endpoint (P50/P95/P99 latency, error rate, uptime)."""
    monitor = get_sla_monitor()
    report = monitor.get_sla_report(endpoint or "ALL")
    return {
        "endpoint": endpoint or "ALL",
        "windows": report,
        "targets": SLAMonitor.SLA_TARGETS,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ── /cache/stats ──────────────────────────────────────────────────────────────

def get_cache_stats():
    """Cache hit/miss statistics for the shared Redis cache."""
    from _infrastructure import get_cache
    cache = get_cache()
    return {
        "cache_stats": cache.get_stats(),
        "redis_available": cache._client is not None,
    }