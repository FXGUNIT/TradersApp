"""
ML Engine — Middleware Registration
Extracted from main.py (Rule #3 hard limit: Python ≤600 lines)
"""
from fastapi.middleware.cors import CORSMiddleware

try:
    from infrastructure.request_context import RequestIdMiddleware
    REQUEST_CONTEXT_AVAILABLE = True
except ImportError:
    REQUEST_CONTEXT_AVAILABLE = False
    RequestIdMiddleware = None

try:
    from infrastructure.prometheus_exporter import PrometheusMiddleware
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    PrometheusMiddleware = None

try:
    from infrastructure.tracing import init_tracing, add_jaeger_middleware
    TRACING_AVAILABLE = True
except ImportError:
    TRACING_AVAILABLE = False
    add_jaeger_middleware = None


def configure_middleware(app: "FastAPI") -> None:
    """Apply all middleware layers to the FastAPI app. Call once from main.py."""
    # CORS — restrict to known origins in production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request ID — must be outermost to capture all requests
    if REQUEST_CONTEXT_AVAILABLE and RequestIdMiddleware:
        app.add_middleware(RequestIdMiddleware)

    # Prometheus HTTP metrics
    if PROMETHEUS_AVAILABLE and PrometheusMiddleware:
        app.add_middleware(PrometheusMiddleware)

    # Jaeger distributed tracing
    if TRACING_AVAILABLE and add_jaeger_middleware:
        try:
            init_tracing()
            add_jaeger_middleware(app)
        except Exception as e:
            print(f"[Tracing] Could not initialize: {e}")