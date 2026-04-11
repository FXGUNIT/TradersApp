"""
OpenTelemetry Distributed Tracing Module for TradersApp.

Provides:
  - Auto-instrumentation for FastAPI (ml-engine), gRPC, HTTP, SQLite
  - Trace propagation across bounded contexts (W3C TraceContext)
  - Custom spans for ML model inference, feature retrieval, consensus aggregation
  - Export to Jaeger (all-in-one, port 4317/4318) or OTLP-compatible backends
  - Service-level trace sampling (head-based, configurable rate)

Usage:
  # ML Engine (FastAPI)
  from ml_engine.infrastructure.opentelemetry import init_otel, trace_inference
  app = FastAPI()
  init_otel(app, service_name="ml-engine", otlp_endpoint="http://jaeger:4317")

  # Wrap inference in a span
  @trace_inference("consensus_prediction")
  async def predict(...): ...

  # Context propagation (cross-service)
  trace_id = propagate_trace(headers, "ml-engine")
"""

from __future__ import annotations

import os
import time
import logging
from typing import Optional, Callable, Any
from contextvars import ContextVar
from functools import wraps

# OpenTelemetry core
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider, SpanProcessor
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from opentelemetry.propagate import set_global_textmap, get_global_textmap
from opentelemetry.trace import Status, StatusCode

# FastAPI/Starlette instrumentation
try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.starlette import StarletteInstrumentor
    INSTRUMENT_FASTAPI = True
except ImportError:
    INSTRUMENT_FASTAPI = False

# gRPC instrumentation
try:
    from opentelemetry.instrumentation.grpc import GRPCInstrumentorClient, GRPCInstrumentorServer
    INSTRUMENT_GRPC = True
except ImportError:
    INSTRUMENT_GRPC = False

# HTTP client instrumentation (for ML Engine → Redis, ML Engine → MLflow)
try:
    from opentelemetry.instrumentation.requests import RequestsInstrumentor
    INSTRUMENT_REQUESTS = True
except ImportError:
    INSTRUMENT_REQUESTS = False

# OTLP exporter
try:
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
    OTLP_AVAILABLE = True
except ImportError:
    OTLP_AVAILABLE = False

logger = logging.getLogger(__name__)

# ─── Global trace context ────────────────────────────────────────────────────

_otel_initialized = False
_tracer: Optional[trace.Tracer] = None
_meter: Optional[metrics.Meter] = None

# Context variable for current trace ID (for propagation)
current_trace_id: ContextVar[Optional[str]] = ContextVar("current_trace_id", default=None)
current_span_id: ContextVar[Optional[str]] = ContextVar("current_span_id", default=None)


def _get_otlp_endpoint() -> str:
    """Get OTLP endpoint from environment or default to Jaeger."""
    return os.environ.get(
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        os.environ.get("OTLP_ENDPOINT", "http://jaeger:4317"),
    )


def _get_service_name() -> str:
    """Get service name from environment."""
    return os.environ.get("OTEL_SERVICE_NAME", "ml-engine")


def _get_sample_rate() -> float:
    """Get trace sampling rate (0.0-1.0)."""
    return float(os.environ.get("OTEL_TRACE_SAMPLE_RATE", "1.0"))


class CustomBatchSpanProcessor(BatchSpanProcessor):
    """BatchSpanProcessor with configurable export interval."""

    def __init__(self, exporter, max_queue_size: int = 2048,
                 schedule_delay_millis: int = 5000,
                 max_export_batch_size: int = 512):
        super().__init__(exporter, max_queue_size, schedule_delay_millis, max_export_batch_size)


# ─── Initialization ──────────────────────────────────────────────────────────

def init_otel(
    app=None,
    service_name: Optional[str] = None,
    service_version: Optional[str] = None,
    otlp_endpoint: Optional[str] = None,
    enable_console_export: bool = False,
    sample_rate: Optional[float] = None,
) -> None:
    """
    Initialize OpenTelemetry for TradersApp.

    Args:
        app: FastAPI/Starlette application instance (auto-instruments HTTP)
        service_name: Name of this service (default: OTEL_SERVICE_NAME env var)
        service_version: Version string (default: from package or "1.0.0")
        otlp_endpoint: OTLP-compatible endpoint (default: OTEL_EXPORTER_OTLP_ENDPOINT env var)
        enable_console_export: Also export to console (for local debugging)
        sample_rate: Trace sampling rate 0.0-1.0 (default: OTEL_TRACE_SAMPLE_RATE env var)

    Sets up:
      - TracerProvider with service resource
      - BatchSpanProcessor with OTLP exporter (Jaeger, Grafana Tempo, etc.)
      - ConsoleSpanExporter (optional, for local debugging)
      - FastAPI/Starlette auto-instrumentation
      - gRPC client/server instrumentation
      - HTTP client instrumentation
      - W3C TraceContext propagation
    """
    global _otel_initialized, _tracer, _meter

    if _otel_initialized:
        logger.debug("OpenTelemetry already initialized — skipping")
        return

    service = service_name or _get_service_name()
    version = service_version or os.environ.get("SERVICE_VERSION", "1.0.0")
    endpoint = otlp_endpoint or _get_otlp_endpoint()
    rate = sample_rate if sample_rate is not None else _get_sample_rate()

    logger.info(
        f"[OTel] Initializing: service={service}, version={version}, "
        f"endpoint={endpoint}, sample_rate={rate}"
    )

    # ─── Resource ────────────────────────────────────────────────────────────
    resource = Resource.create({
        SERVICE_NAME: service,
        SERVICE_VERSION: version,
        "deployment.environment": os.environ.get("DEPLOYMENT_ENV", "development"),
        "host.name": os.environ.get("HOSTNAME", "localhost"),
    })

    # ─── Tracer Provider ─────────────────────────────────────────────────────
    # Note: In production, use opentelemetry.sdk.trace.TracerProvider with
    # a ParentBased sampler (respects incoming trace context) combined with
    # a probabilistic sampler for the root span.
    from opentelemetry.sdk.trace import TracerProvider as SDKTracerProvider
    from opentelemetry.sdk.trace.sampling import (
        ParentBased, TraceIdRatioBased, AlwaysOnSampler, AlwaysOffSampler
    )

    if rate >= 1.0:
        base_sampler = AlwaysOnSampler()
    elif rate <= 0.0:
        base_sampler = AlwaysOffSampler()
    else:
        base_sampler = TraceIdRatioBased(rate)

    sampler = ParentBased(root=base_sampler)
    tracer_provider = SDKTracerProvider(resource=resource, sampler=sampler)

    # ─── Span Processors ─────────────────────────────────────────────────────
    # OTLP export (primary)
    if OTLP_AVAILABLE:
        try:
            otlp_exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
            tracer_provider.add_span_processor(
                CustomBatchSpanProcessor(otlp_exporter, schedule_delay_millis=1000)
            )
            logger.info(f"[OTel] OTLP exporter configured: {endpoint}")
        except Exception as e:
            logger.warning(f"[OTel] Failed to configure OTLP exporter: {e}")

    # Console export (debug)
    if enable_console_export:
        console_exporter = ConsoleSpanExporter()
        tracer_provider.add_span_processor(BatchSpanProcessor(console_exporter))

    trace.set_tracer_provider(tracer_provider)
    _tracer = trace.get_tracer(service, version)

    # ─── Meter Provider ──────────────────────────────────────────────────────
    if OTLP_AVAILABLE:
        try:
            metric_reader = PeriodicExportingMetricReader(
                OTLPMetricExporter(endpoint=endpoint, insecure=True),
                export_interval_millis=30000,
            )
            meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
        except Exception as e:
            logger.warning(f"[OTel] Failed to configure OTLP metric exporter: {e}")
            meter_provider = MeterProvider(resource=resource)
    else:
        meter_provider = MeterProvider(resource=resource)

    metrics.set_meter_provider(meter_provider)
    _meter = metrics.get_meter(service, version)

    # ─── Auto-instrumentation ────────────────────────────────────────────────
    if INSTRUMENT_FASTAPI and app is not None:
        FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
        StarletteInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
        logger.info("[OTel] FastAPI/Starlette auto-instrumented")

    if INSTRUMENT_GRPC:
        try:
            GRPCInstrumentorClient().instrument()
            GRPCInstrumentorServer().instrument()
            logger.info("[OTel] gRPC auto-instrumented")
        except Exception as e:
            logger.warning(f"[OTel] gRPC instrumentation failed: {e}")

    if INSTRUMENT_REQUESTS:
        try:
            RequestsInstrumentor().instrument()
            logger.info("[OTel] HTTP client (requests) auto-instrumented")
        except Exception as e:
            logger.warning(f"[OTel] requests instrumentation failed: {e}")

    # ─── W3C TraceContext propagation ────────────────────────────────────────
    set_global_textmap(TraceContextTextMapPropagator())
    logger.info("[OTel] W3C TraceContext propagation enabled")

    _otel_initialized = True
    logger.info("[OTel] OpenTelemetry initialization complete")


def shutdown_otel(timeout_ms: int = 5000) -> None:
    """Flush and shutdown OpenTelemetry — call on app shutdown."""
    global _otel_initialized, _tracer, _meter

    if not _otel_initialized:
        return

    provider = trace.get_tracer_provider()
    if hasattr(provider, "shutdown"):
        provider.shutdown(timeout_ms / 1000)

    meter_provider = metrics.get_meter_provider()
    if hasattr(meter_provider, "shutdown"):
        meter_provider.shutdown(timeout_ms / 1000)

    _otel_initialized = False
    _tracer = None
    _meter = None
    logger.info("[OTel] OpenTelemetry shutdown complete")


# ─── Tracer access ──────────────────────────────────────────────────────────

def get_tracer() -> trace.Tracer:
    """Get the global tracer instance."""
    global _tracer
    if _tracer is None:
        return trace.get_tracer(_get_service_name())
    return _tracer


def get_meter() -> metrics.Meter:
    """Get the global meter instance."""
    global _meter
    if _meter is None:
        return metrics.get_meter(_get_service_name())
    return _meter


# ─── Trace propagation ────────────────────────────────────────────────────────

def inject_trace_context(carrier: dict) -> dict:
    """
    Inject current trace context into a carrier dict (e.g., HTTP headers or gRPC metadata).
    Used when calling downstream services.
    """
    propagator = get_global_textmap()
    ctx = trace.get_current_span().get_span_context()
    if ctx.is_valid:
        carrier = dict(carrier)
        propagator.inject(carrier)
    return carrier


def extract_trace_context(carrier: dict):
    """Extract trace context from a carrier dict. Used by receiving services."""
    propagator = get_global_textmap()
    return propagator.extract(carrier)


def get_current_trace_id() -> Optional[str]:
    """Get the current trace ID as a hex string."""
    ctx = trace.get_current_span().get_span_context()
    if ctx.is_valid:
        return format(ctx.trace_id, "032x")
    return None


def get_current_span_id() -> Optional[str]:
    """Get the current span ID as a hex string."""
    ctx = trace.get_current_span().get_span_context()
    if ctx.is_valid:
        return format(ctx.span_id, "016x")
    return None


# ─── Custom span decorators ─────────────────────────────────────────────────

def trace_inference(span_name: str, attributes: Optional[dict] = None):
    """
    Decorator to wrap ML inference functions in a custom span.

    Usage:
        @trace_inference("direction_model.predict")
        def predict_direction(features): ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            tracer = get_tracer()
            attrs = attributes or {}
            attrs["function"] = func.__name__

            with tracer.start_as_current_span(span_name, kind=trace.SpanKind.INTERNAL) as span:
                start = time.perf_counter()
                try:
                    result = func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as exc:
                    span.set_status(Status(StatusCode.ERROR, str(exc)))
                    span.record_exception(exc)
                    raise
                finally:
                    duration_ms = (time.perf_counter() - start) * 1000
                    span.set_attribute("inference.latency_ms", duration_ms)
                    if duration_ms > 100:
                        span.set_attribute("inference.slow", True)

        return wrapper
    return decorator


def trace_consensus_stage(stage_name: str):
    """
    Decorator for individual stages within consensus aggregation.

    Usage:
        @trace_consensus_stage("regime_detection")
        def detect_regime(candles): ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            tracer = get_tracer()
            with tracer.start_as_current_span(
                f"consensus.{stage_name}",
                kind=trace.SpanKind.INTERNAL,
            ) as span:
                span.set_attribute("stage", stage_name)
                start = time.perf_counter()
                try:
                    result = func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as exc:
                    span.set_status(Status(StatusCode.ERROR, str(exc)))
                    span.record_exception(exc)
                    raise
                finally:
                    span.set_attribute(
                        "stage.latency_ms",
                        (time.perf_counter() - start) * 1000
                    )

        return wrapper
    return decorator


# ─── Custom metrics for ML Engine ────────────────────────────────────────────

def create_inference_metrics(prefix: str = "ml_engine") -> dict:
    """
    Create Prometheus/OpenTelemetry metrics for ML inference.

    Returns a dict of metrics:
      - inference_latency_histogram
      - inference_requests_counter
      - inference_errors_counter
      - model_predictions_gauge
    """
    meter = get_meter()

    latency_histogram = meter.create_histogram(
        name=f"{prefix}_inference_latency_ms",
        description="ML model inference latency in milliseconds",
        unit="ms",
    )

    requests_counter = meter.create_counter(
        name=f"{prefix}_inference_requests_total",
        description="Total number of ML inference requests",
    )

    errors_counter = meter.create_counter(
        name=f"{prefix}_inference_errors_total",
        description="Total number of ML inference errors",
    )

    predictions_counter = meter.create_counter(
        name=f"{prefix}_model_predictions_total",
        description="Total predictions by model and signal type",
    )

    cb_state_gauge = meter.create_observable_gauge(
        name=f"{prefix}_circuit_breaker_state",
        description="Circuit breaker state (0=closed, 1=half-open, 2=open)",
        callbacks=[],
    )

    return {
        "latency_histogram": latency_histogram,
        "requests_counter": requests_counter,
        "errors_counter": errors_counter,
        "predictions_counter": predictions_counter,
        "cb_state_gauge": cb_state_gauge,
    }


def record_inference(
    metrics_dict: dict,
    model_name: str,
    latency_ms: float,
    signal: str,
    error: Optional[str] = None,
) -> None:
    """Record inference metrics."""
    attrs = {"model": model_name}

    metrics_dict["requests_counter"].add(1, attrs)
    metrics_dict["latency_histogram"].record(latency_ms, attrs)

    if error:
        metrics_dict["errors_counter"].add(1, {**attrs, "error": error})
    else:
        metrics_dict["predictions_counter"].add(
            1, {**attrs, "signal": signal}
        )


# ─── Context manager for spans ───────────────────────────────────────────────

class OTelSpan:
    """Context manager for creating OpenTelemetry spans with automatic error recording."""

    def __init__(
        self,
        name: str,
        kind: trace.SpanKind = trace.SpanKind.INTERNAL,
        attributes: Optional[dict] = None,
    ):
        self.name = name
        self.kind = kind
        self.attributes = attributes or {}
        self._span = None

    def __enter__(self):
        tracer = get_tracer()
        self._span = tracer.start_span(self.name, kind=self.kind)
        for k, v in self.attributes.items():
            self._span.set_attribute(k, v)
        return self._span

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_val is not None:
            self._span.set_status(Status(StatusCode.ERROR, str(exc_val)))
            self._span.record_exception(exc_val)
        else:
            self._span.set_status(Status(StatusCode.OK))
        self._span.end()
        return False


# ─── Service-specific instrumentation ──────────────────────────────────────────

def instrument_fastapi_app(app):
    """Instrument a FastAPI app — call from main.py startup."""
    if not _otel_initialized:
        init_otel(app=app)
    else:
        FastAPIInstrumentor.instrument_app(app)


def instrument_grpc_server():
    """Instrument gRPC server — call from analysis-server.mjs startup."""
    if INSTRUMENT_GRPC and not _otel_initialized:
        try:
            GRPCInstrumentorServer().instrument()
            logger.info("[OTel] gRPC server instrumented")
        except Exception as e:
            logger.warning(f"[OTel] gRPC server instrumentation failed: {e}")
