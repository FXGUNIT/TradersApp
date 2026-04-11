"""
ML Engine — Infrastructure Helpers
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)

Holds: idempotency, model registry accessors, MLflow client, profiler helpers,
       drift monitoring snapshot, and global `app` reference.
"""
import hashlib
import json as _json
import time as _time
from typing import Any

from fastapi import HTTPException, Request as FastAPIRequest, Response
from fastapi.encoders import jsonable_encoder

import config
from infrastructure.performance import get_cache, get_sla_monitor, SLAMonitor

# ── Idempotency ──────────────────────────────────────────────────────────────

try:
    from infrastructure.idempotency import IdempotencyClaim, get_idempotency_service
    IDEMPOTENCY_AVAILABLE = True
except ImportError:
    IDEMPOTENCY_AVAILABLE = False
    IdempotencyClaim = None

try:
    from infrastructure.request_context import (
        RequestIdMiddleware,
        get_request_id,
        install_request_id_logging,
        request_logger,
    )
    REQUEST_CONTEXT_AVAILABLE = True
except ImportError:
    REQUEST_CONTEXT_AVAILABLE = False
    RequestIdMiddleware = None
    get_request_id = lambda: "unknown"
    install_request_id_logging = lambda: None

try:
    from infrastructure.profiler import (
        init_profiler,
        profile_endpoint,
        profile_function,
        LatencyBreakdown,
        MemorySnapshot,
    )
    PROFILER_AVAILABLE = True
except ImportError:
    profile_endpoint = lambda *a, **k: (lambda f: f)
    profile_function = lambda *a, **k: (lambda f: f)
    PROFILER_AVAILABLE = False

try:
    from infrastructure.drift_detector import DriftMonitor, DriftThresholds
    DRIFT_AVAILABLE = True
except ImportError:
    DRIFT_AVAILABLE = False
    DriftMonitor = None

# ── MLflow ───────────────────────────────────────────────────────────────────

try:
    from infrastructure.mlflow_client import get_mlflow_client, MLFLOW_TRACKING_URI
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False
    MLFLOW_TRACKING_URI = "http://localhost:5000"

    class _NoOpMLflowClient:
        def start_run(self, *a, **k): return self
        def log_params(self, *a, **k): pass
        def log_metrics(self, *a, **k): pass
        def log_tag(self, *a, **k): pass
        def get_experiment_summary(self): return {"available": False}
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def end_run(self, *a, **k): pass

    def get_mlflow_client(*args, **kwargs): return _NoOpMLflowClient()

# ── Prometheus helpers (no-op stubs) ─────────────────────────────────────

try:
    from infrastructure.prometheus_exporter import (
        record_prediction as _rec_pred,
        record_cache as _rec_cache,
        record_retrain as _rec_retrain,
        set_models_loaded as _set_models,
        set_active_runs as _set_runs,
        set_drift_monitoring_snapshot as _set_drift,
        set_mlflow_experiment_count as _set_mlflow_exp,
        sync_mlflow_registry as _sync_reg,
    )
    _PROM_AVAILABLE = True
except ImportError:
    _PROM_AVAILABLE = False
    _rec_pred = _rec_cache = _rec_retrain = None
    _set_models = _set_runs = _set_drift = _set_mlflow_exp = _sync_reg = None

PROMETHEUS_AVAILABLE = _PROM_AVAILABLE

def record_prometheus_prediction(**kw): ...
def record_prometheus_cache(**kw): ...
def record_prometheus_retrain(**kw): ...
def set_prometheus_models_loaded(**kw): ...
def set_prometheus_active_runs(**kw): ...
def set_prometheus_drift_monitoring_snapshot(**kw): ...
def set_prometheus_mlflow_experiment_count(**kw): ...
def sync_prometheus_mlflow_registry(**kw): ...

if _PROM_AVAILABLE:
    record_prometheus_prediction = _rec_pred
    record_prometheus_cache = _rec_cache
    record_prometheus_retrain = _rec_retrain
    set_prometheus_models_loaded = _set_models
    set_prometheus_active_runs = _set_runs
    set_prometheus_drift_monitoring_snapshot = _set_drift
    set_prometheus_mlflow_experiment_count = _set_mlflow_exp
    sync_prometheus_mlflow_registry = _sync_reg


# ── Global app reference (set by main.py after router registration) ──────────

app: "FastAPI | None" = None

def set_app(fastapi_app):
    global app
    app = fastapi_app


# ── Idempotency helpers (inline, not using infrastructure.idempotency) ──────

def _resolve_idempotency_key(
    raw_request: FastAPIRequest,
    scope: str,
    payload: dict[str, Any],
    *,
    allow_body_fallback: bool,
) -> str | None:
    for header_name in ("Idempotency-Key", "X-Idempotency-Key"):
        header_value = raw_request.headers.get(header_name)
        if header_value and header_value.strip():
            return header_value.strip()

    request_id = payload.get("request_id") or raw_request.headers.get("X-Request-ID")
    if request_id:
        return str(request_id).strip()

    if not allow_body_fallback:
        return None

    normalized = _json.dumps(jsonable_encoder(payload), sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(f"{scope}:{normalized}".encode("utf-8")).hexdigest()


def _claim_idempotency(
    raw_request: FastAPIRequest,
    response: Response,
    scope: str,
    payload: dict[str, Any],
    *,
    allow_body_fallback: bool = True,
    wait_timeout_seconds: float = 0.25,
    lock_ttl_seconds: int = 3600,
):
    """Attempt to claim idempotency. Returns (claim, replay_or_none)."""
    key = _resolve_idempotency_key(raw_request, scope, payload, allow_body_fallback=allow_body_fallback)
    if not key:
        return None, None

    response.headers["Idempotency-Key"] = key

    if IDEMPOTENCY_AVAILABLE:
        try:
            claim = get_idempotency_service().claim(
                scope, key, payload,
                wait_timeout_seconds=wait_timeout_seconds,
                lock_ttl_seconds=lock_ttl_seconds,
            )
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

        if claim is None:
            return None, None

        if claim.replay_response is not None:
            response.headers["X-Idempotent-Replay"] = "true"
            if REQUEST_CONTEXT_AVAILABLE:
                request_logger("ml-engine.idempotency").info("Replay scope=%s key=%s", scope, key)
            return claim, claim.replay_response

        if claim.in_progress:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "Duplicate request with the same idempotency key is still processing.",
                    "idempotency_key": key,
                    "retryable": True,
                    "retry_after_ms": int(wait_timeout_seconds * 1000),
                },
            )

        response.headers["X-Idempotent-Replay"] = "false"
        return claim, None

    return None, None


def _store_idempotent_response(
    claim: Any,
    response_payload: Any,
    ttl_seconds: int,
) -> None:
    if claim is None or not IDEMPOTENCY_AVAILABLE:
        return
    get_idempotency_service().store_response(claim, jsonable_encoder(response_payload), ttl_seconds=ttl_seconds)


def _release_idempotency_claim(claim: Any) -> None:
    if claim is None or not IDEMPOTENCY_AVAILABLE:
        return
    get_idempotency_service().release(claim)


# ── Model registry helpers ────────────────────────────────────────────────────

def get_model_registry_client():
    if app is None:
        raise RuntimeError("Model registry client is not initialized")
    client = getattr(app.state, "model_registry_client", None)
    if client is None:
        raise RuntimeError("Model registry client is not initialized")
    return client


def get_model_registry_status() -> dict[str, Any]:
    return get_model_registry_client().status()


def sync_model_registry_metrics(status: dict[str, Any] | None = None) -> dict[str, Any]:
    status = status or get_model_registry_status()
    if PROMETHEUS_AVAILABLE and set_prometheus_models_loaded:
        cnt = status.get("predictor", {}).get("loaded_model_count", 0)
        set_prometheus_models_loaded(cnt)
    return status


# ── Training gate ────────────────────────────────────────────────────────────

def ensure_training_enabled() -> None:
    if config.MODEL_STORE_READ_ONLY:
        raise HTTPException(
            status_code=409,
            detail="Training is disabled in the stateless serving deployment. "
                   "Use a dedicated trainer job or write-enabled pipeline.",
        )