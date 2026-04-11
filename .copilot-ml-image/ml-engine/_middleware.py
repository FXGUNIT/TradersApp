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

# ── OpenTelemetry FastAPI auto-instrumentation (ID 47) ────────────────────────
# Wires FastAPIInstrumentor() so every endpoint generates an OTEL span.
# Requires: pip install opentelemetry-instrumentation-fastapi opentelemetry-exporter-otlp-proto-grpc
# Env vars (set in Helm chart): OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME
OTEL_FASTAPI_AVAILABLE = False
FastAPIInstrumentor = None


def _instrument_fastapi(app: "FastAPI") -> None:
    """
    Apply OpenTelemetry FastAPI auto-instrumentation.
    Creates spans for every HTTP request handler automatically.
    Spans are exported via the OTLP exporter to the collector (Jaeger/gRPC).
    """
    global OTEL_FASTAPI_AVAILABLE, FastAPIInstrumentor
    if OTEL_FASTAPI_AVAILABLE:
        return  # Already instrumented

    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor as _FI
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        import os as _os

        FastAPIInstrumentor = _FI
        OTEL_FASTAPI_AVAILABLE = True

        # Only auto-instrument if OTEL is enabled (defaults to true)
        if _os.environ.get("OTEL_ENABLED", "true").lower() == "false":
            print("[OTEL] FastAPI instrumentation disabled via OTEL_ENABLED=false")
            return

        # Initialize OTLP exporter from environment
        endpoint = _os.environ.get(
            "OTEL_EXPORTER_OTLP_ENDPOINT",
            "http://jaeger.monitoring:4317",
        )
        service_name = _os.environ.get("OTEL_SERVICE_NAME", "ml-engine")

        resource = Resource.create({SERVICE_NAME: service_name})

        provider = TracerProvider(resource=resource)

        otlp_exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

        trace.set_tracer_provider(provider)

        # Auto-instrument FastAPI — wraps every route handler
        _FI.instrument_app(app, tracer_provider=provider)

        print(f"[OTEL] FastAPIInstrumentor active — exporting to {endpoint}")

    except ImportError as e:
        print(f"[OTEL] FastAPI instrumentation packages not installed: {e}")
        OTEL_FASTAPI_AVAILABLE = False
    except Exception as e:
        print(f"[OTEL] FastAPIInstrumentor could not initialize: {e}")


def configure_middleware(app: "FastAPI") -> None:
    """Apply all middleware layers to the FastAPI app. Call once from main.py."""
    # ── OpenTelemetry FastAPI auto-instrumentation (ID 47) ──────────────
    # Must be called before adding other middleware so spans cover the full
    # request lifecycle including CORS, auth, and route handlers.
    _instrument_fastapi(app)

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