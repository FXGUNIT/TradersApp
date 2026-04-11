"""
Distributed Tracing — Jaeger integration for TradersApp ML Engine.

Enables end-to-end request tracing across all ML Engine endpoints using OpenTelemetry.

Usage:
  from ml_engine.infrastructure.tracing import init_tracing, trace_span

  init_tracing(service_name="ml-engine", jaeger_agent="localhost:6831")

  with trace_span("predict"):
      result = predictor.predict(...)

Requires: pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-jaeger
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional, Callable, Any
from contextlib import contextmanager
from functools import wraps

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.resources import Resource, SERVICE_NAME
    from opentelemetry.exporter.jaeger.thrift import JaegerExporter
    from opentelemetry.trace import Status, StatusCode
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False


_tracer: Optional[trace.Tracer] = None
_initialized = False


def _resolve_service_name(default: str = "ml-engine") -> str:
    return (
        os.environ.get("OTEL_SERVICE_NAME")
        or os.environ.get("JAEGER_SERVICE_NAME")
        or default
    )


def _resolve_jaeger_agent(default: str = "localhost:6831") -> str:
    default_host, _, default_port = default.partition(":")
    host = (
        os.environ.get("OTEL_EXPORTER_JAEGER_AGENT_HOST_NAME")
        or os.environ.get("JAEGER_AGENT_HOST")
        or default_host
    )
    port = (
        os.environ.get("OTEL_EXPORTER_JAEGER_AGENT_PORT")
        or os.environ.get("JAEGER_AGENT_PORT")
        or default_port
        or "6831"
    )
    return f"{host}:{port}"


def init_tracing(
    service_name: str | None = None,
    jaeger_agent: str | None = None,
    enabled: bool | None = None,
):
    """
    Initialize OpenTelemetry tracing with Jaeger exporter.

    Args:
        service_name: Name of this service in traces
        jaeger_agent: Jaeger agent host:port (default: localhost:6831)
        enabled: Set to False to disable tracing (useful for testing)
    """
    global _tracer, _initialized

    if _initialized or not OTEL_AVAILABLE:
        return

    service_name = service_name or _resolve_service_name()
    jaeger_agent = jaeger_agent or _resolve_jaeger_agent()

    if enabled is None:
        enabled = os.environ.get("OTEL_ENABLED", "true").lower() != "false"

    if not enabled:
        print("[Tracing] Disabled via OTEL_ENABLED=false")
        _initialized = True
        return

    try:
        # Create resource
        resource = Resource.create({
            SERVICE_NAME: service_name,
            "service.version": "1.0.0",
            "deployment.environment": os.environ.get("OTEL_ENV", "development"),
        })

        # Create tracer provider
        provider = TracerProvider(resource=resource)

        # Configure Jaeger exporter
        jaeger_exporter = JaegerExporter(
            agent_host_name=jaeger_agent.split(":")[0],
            agent_port=int(jaeger_agent.split(":")[1]) if ":" in jaeger_agent else 6831,
        )

        # Add batch span processor
        provider.add_span_processor(BatchSpanProcessor(jaeger_exporter))

        # Set global tracer provider
        trace.set_tracer_provider(provider)

        _tracer = trace.get_tracer(service_name)
        print(f"[Tracing] Initialized: {service_name} → {jaeger_agent}")
        _initialized = True

    except Exception as e:
        print(f"[Tracing] Could not initialize: {e}")
        _initialized = True


def get_tracer() -> Optional[trace.Tracer]:
    """Get the configured tracer."""
    global _tracer
    if _tracer is None:
        init_tracing()
    return _tracer


@contextmanager
def trace_span(
    name: str,
    attributes: dict | None = None,
    record_exception: bool = True,
):
    """
    Context manager for creating a traced span.

    Usage:
        with trace_span("predict", {"symbol": "MNQ"}):
            result = predictor.predict(...)
    """
    tracer = get_tracer()
    if tracer is None:
        # Tracing not available — run without tracing
        yield
        return

    with tracer.start_as_current_span(name) as span:
        if attributes:
            for key, value in attributes.items():
                if value is not None:
                    span.set_attribute(key, str(value) if not isinstance(value, (int, float, bool)) else value)

        try:
            yield span
        except Exception as e:
            if record_exception:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
            raise


def trace_function(
    span_name: str | None = None,
    attributes: dict | None = None,
):
    """
    Decorator for tracing a function.

    Usage:
        @trace_function("predict", {"model": "lightgbm"})
        def my_predict(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        name = span_name or func.__name__

        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            with trace_span(name, attributes):
                return func(*args, **kwargs)

        return wrapper

    return decorator


# ─── FastAPI Integration ─────────────────────────────────────────────────────────

if OTEL_AVAILABLE:
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request

    class JaegerMiddleware(BaseHTTPMiddleware):
        """
        FastAPI middleware that creates a span for each HTTP request.
        Automatically propagated via W3C Trace Context headers.
        """

        async def dispatch(self, request: Request, call_next):
            span_name = f"{request.method} {request.url.path}"
            tracer = get_tracer()

            if tracer is None:
                return await call_next(request)

            with tracer.start_as_current_span(span_name) as span:
                span.set_attribute("http.method", request.method)
                span.set_attribute("http.url", str(request.url))
                span.set_attribute("http.route", request.url.path)
                span.set_attribute("http.host", request.url.hostname or "")
                span.set_attribute("http.scheme", request.url.scheme)

                try:
                    response = await call_next(request)
                    span.set_attribute("http.status_code", response.status_code)
                    return response
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise

    def add_jaeger_middleware(app):
        """Add Jaeger tracing middleware to FastAPI app."""
        init_tracing()
        app.add_middleware(JaegerMiddleware)
