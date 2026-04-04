"""
Prometheus Metrics Exporter — exposes ML Engine metrics for Prometheus scraping.

Exposes:
  - ml_prediction_latency_seconds (histogram)
  - ml_prediction_confidence (gauge)
  - ml_drift_score (gauge)
  - ml_concept_drift_detected (counter)
  - ml_regime_drift_detected (counter)
  - ml_retrain_triggered (counter)
  - ml_model_loaded (gauge)
  - ml_cache_hit_ratio (gauge)
  - ml_circuit_breaker_state (gauge)
  - ml_feature_drift_psi (gauge)
  - http_requests_total (counter)
  - http_request_duration_seconds (histogram)

Usage:
  app.add_middleware(PrometheusMiddleware)
  app.add_route("/metrics", handle_metrics)

Requires: pip install prometheus-client
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

import pandas as pd

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


try:
    from prometheus_client import (
        Counter, Histogram, Gauge, Summary,
        generate_latest, CONTENT_TYPE_LATEST,
        CollectorRegistry, REGISTRY,
    )
    from prometheus_client.openmetrics.exposition import generate_latest as om_generate_latest
    PROMETHEUS_AVAILABLE = True
    DEFAULT_REGISTRY = REGISTRY
except ImportError:
    PROMETHEUS_AVAILABLE = False
    DEFAULT_REGISTRY = None


_metrics: Optional[dict] = None


# ─── Metric Definitions ─────────────────────────────────────────────────────────

def get_metrics(registry=DEFAULT_REGISTRY) -> dict:
    """
    Returns dict of all Prometheus metrics.
    Lazily initializes metrics on first access.
    """
    global _metrics

    if not PROMETHEUS_AVAILABLE:
        return {}

    if _metrics is not None:
        return _metrics

    metrics = {}

    # ── Prediction Latency ──────────────────────────────────────────────
    metrics["prediction_latency"] = Histogram(
        name="ml_prediction_latency_seconds",
        documentation="ML prediction latency in seconds",
        buckets=(0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 1.0, 2.5),
        registry=registry,
    )

    # ── Confidence Score ───────────────────────────────────────────────
    metrics["prediction_confidence"] = Gauge(
        name="ml_prediction_confidence",
        documentation="Most recent prediction confidence (0-1)",
        registry=registry,
    )

    # ── Drift Scores ───────────────────────────────────────────────────
    metrics["feature_drift_psi"] = Gauge(
        name="ml_feature_drift_psi",
        documentation="Population Stability Index (PSI) for feature drift",
        registry=registry,
    )
    metrics["concept_drift_win_rate"] = Gauge(
        name="ml_concept_drift_win_rate",
        documentation="Rolling win rate for concept drift detection",
        registry=registry,
    )

    # ── Drift Counters ─────────────────────────────────────────────────
    metrics["concept_drift_detected"] = Counter(
        name="ml_concept_drift_detected_total",
        documentation="Total number of concept drift alerts detected",
        registry=registry,
    )
    metrics["feature_drift_detected"] = Counter(
        name="ml_feature_drift_detected_total",
        documentation="Total number of feature drift alerts detected",
        registry=registry,
    )
    metrics["regime_drift_detected"] = Counter(
        name="ml_regime_drift_detected_total",
        documentation="Total number of regime drift alerts detected",
        registry=registry,
    )

    # ── Retraining ─────────────────────────────────────────────────────
    metrics["retrain_triggered"] = Counter(
        name="ml_retrain_triggered_total",
        documentation="Total number of model retrains triggered",
        registry=registry,
    )
    metrics["retrain_in_progress"] = Gauge(
        name="ml_retrain_in_progress",
        documentation="Whether a retrain is currently in progress (1=yes, 0=no)",
        registry=registry,
    )

    # ── Model Status ───────────────────────────────────────────────────
    metrics["models_loaded"] = Gauge(
        name="ml_models_loaded",
        documentation="Number of ML models currently loaded",
        registry=registry,
    )
    metrics["model_last_trained"] = Gauge(
        name="ml_model_last_trained_timestamp",
        documentation="Unix timestamp of last successful model training",
        registry=registry,
    )

    # ── Cache ──────────────────────────────────────────────────────────
    metrics["cache_hits"] = Counter(
        name="ml_cache_hits_total",
        documentation="Total number of cache hits",
        registry=registry,
    )
    metrics["cache_misses"] = Counter(
        name="ml_cache_misses_total",
        documentation="Total number of cache misses",
        registry=registry,
    )
    metrics["cache_hit_ratio"] = Gauge(
        name="ml_cache_hit_ratio",
        documentation="Cache hit ratio (0-1)",
        registry=registry,
    )

    # ── Circuit Breaker ────────────────────────────────────────────────
    metrics["circuit_breaker_state"] = Gauge(
        name="ml_circuit_breaker_state",
        documentation="Circuit breaker state: 0=closed, 1=half-open, 2=open",
        registry=registry,
    )
    metrics["circuit_breaker_failures"] = Counter(
        name="ml_circuit_breaker_failures_total",
        documentation="Total number of circuit breaker failures",
        registry=registry,
    )

    # ── Data Quality ──────────────────────────────────────────────────
    metrics["dq_critical_failures"] = Gauge(
        name="ml_dq_critical_failures",
        documentation="Number of critical data quality failures in last run",
        registry=registry,
    )
    metrics["dq_checks_passed"] = Gauge(
        name="ml_dq_checks_passed_total",
        documentation="Total number of data quality checks passed (cumulative)",
        registry=registry,
    )

    # ── HTTP Requests ─────────────────────────────────────────────────
    metrics["http_requests_total"] = Counter(
        name="ml_http_requests_total",
        documentation="Total HTTP requests",
        labelnames=["method", "endpoint", "status"],
        registry=registry,
    )
    metrics["http_request_duration"] = Histogram(
        name="ml_http_request_duration_seconds",
        documentation="HTTP request duration in seconds",
        labelnames=["method", "endpoint"],
        buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
        registry=registry,
    )

    # ── Candle Ingestion ──────────────────────────────────────────────
    metrics["candles_ingested"] = Counter(
        name="ml_candles_ingested_total",
        documentation="Total candles ingested from data source",
        registry=registry,
    )
    metrics["candles_last_timestamp"] = Gauge(
        name="ml_candles_last_timestamp_seconds",
        documentation="Unix timestamp of most recent candle ingested",
        registry=registry,
    )

    # ── Kafka Event Publishing ────────────────────────────────────────
    metrics["kafka_published"] = Counter(
        name="ml_kafka_messages_published_total",
        documentation="Total messages published to Kafka topics",
        labelnames=["topic"],
        registry=registry,
    )
    metrics["kafka_publish_errors"] = Counter(
        name="ml_kafka_publish_errors_total",
        documentation="Total Kafka publish failures",
        labelnames=["topic"],
        registry=registry,
    )
    metrics["kafka_consumer_processed"] = Counter(
        name="ml_kafka_consumer_messages_processed_total",
        documentation="Total messages consumed from Kafka topics",
        labelnames=["topic"],
        registry=registry,
    )
    metrics["kafka_consumer_lag"] = Gauge(
        name="ml_kafka_consumer_lag",
        documentation="Consumer lag per topic-partition",
        labelnames=["topic", "partition"],
        registry=registry,
    )

    # ── MLflow / MLOps ─────────────────────────────────────────────────
    metrics["training_runs_total"] = Counter(
        name="ml_training_runs_total",
        documentation="Total MLflow training runs completed",
        labelnames=["experiment", "status"],
        registry=registry,
    )
    metrics["active_runs"] = Gauge(
        name="ml_active_runs",
        documentation="Currently active MLflow runs",
        registry=registry,
    )
    metrics["models_registered"] = Gauge(
        name="ml_models_registered",
        documentation="Models registered in MLflow model registry",
        labelnames=["model_name", "stage"],
        registry=registry,
    )
    metrics["training_duration_seconds"] = Gauge(
        name="ml_training_duration_seconds",
        documentation="Training run wall-clock duration in seconds",
        labelnames=["experiment", "run"],
        registry=registry,
    )
    metrics["artifact_size_bytes"] = Gauge(
        name="ml_artifact_size_bytes",
        documentation="Model artifact size in bytes",
        labelnames=["model_name"],
        registry=registry,
    )
    metrics["mlflow_experiments"] = Gauge(
        name="ml_mlflow_experiments",
        documentation="Number of MLflow experiments",
        registry=registry,
    )

    _metrics = metrics
    return _metrics


# ─── Singleton Metrics ────────────────────────────────────────────────────────────

def record_prediction(
    latency_seconds: float,
    confidence: float,
    symbol: str = "MNQ",
):
    """Record a prediction event for Prometheus."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()

    if PROMETHEUS_AVAILABLE:
        _metrics["prediction_latency"].observe(latency_seconds)
        _metrics["prediction_confidence"].set(confidence)


def record_drift(
    drift_type: str,
    score: float,
    threshold: float,
    symbol: str = "MNQ",
):
    """Record a drift detection event."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()

    if not PROMETHEUS_AVAILABLE:
        return

    if drift_type == "feature":
        _metrics["feature_drift_psi"].set(score)
        if score > threshold:
            _metrics["feature_drift_detected"].inc()
    elif drift_type == "concept":
        _metrics["concept_drift_win_rate"].set(score)
    elif drift_type == "regime":
        if score > threshold:
            _metrics["regime_drift_detected"].inc()


def record_cache(hit: bool):
    """Record cache hit/miss."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()

    if not PROMETHEUS_AVAILABLE:
        return

    if hit:
        _metrics["cache_hits"].inc()
    else:
        _metrics["cache_misses"].inc()

    # Update ratio
    hits = float(_metrics["cache_hits"]._value.get())
    misses = float(_metrics["cache_misses"]._value.get())
    total = hits + misses
    if total > 0:
        _metrics["cache_hit_ratio"].set(hits / total)


def record_retrain(triggered: bool, in_progress: bool = False):
    """Record retrain event."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()

    if not PROMETHEUS_AVAILABLE:
        return

    if triggered:
        _metrics["retrain_triggered"].inc()
    _metrics["retrain_in_progress"].set(1 if in_progress else 0)


def record_kafka_published(topic: str):
    """Record a Kafka message published."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["kafka_published"].labels(topic=topic).inc()


def record_kafka_publish_error(topic: str):
    """Record a Kafka publish failure."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["kafka_publish_errors"].labels(topic=topic).inc()


def record_kafka_consumer_processed(topic: str):
    """Record a Kafka consumer message processed."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["kafka_consumer_processed"].labels(topic=topic).inc()


def set_kafka_consumer_lag(topic: str, partition: int, lag: int):
    """Set consumer lag gauge for a topic-partition."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["kafka_consumer_lag"].labels(topic=topic, partition=str(partition)).set(max(0, lag))


def set_models_loaded(count: int):
    """Set the number of currently loaded models."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()

    if not PROMETHEUS_AVAILABLE:
        return

    _metrics["models_loaded"].set(max(0, count))


def record_training_run(experiment: str, status: str = "success"):
    """Record a completed MLflow training run."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["training_runs_total"].labels(experiment=experiment, status=status).inc()


def set_active_runs(count: int):
    """Set the number of currently active MLflow runs."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["active_runs"].set(max(0, count))


def set_mlflow_experiment_count(count: int):
    """Set the total number of MLflow experiments."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["mlflow_experiments"].set(max(0, count))


def record_model_registered(model_name: str, stage: str):
    """Record a model registered in MLflow model registry."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["models_registered"].labels(model_name=model_name, stage=stage).set(1)


def record_training_duration(experiment: str, run: str, seconds: float):
    """Record training duration for an MLflow run."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["training_duration_seconds"].labels(experiment=experiment, run=run).set(seconds)


def record_artifact_size(model_name: str, bytes_size: int):
    """Record the size of a logged model artifact."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["artifact_size_bytes"].labels(model_name=model_name).set(max(0, bytes_size))


def set_data_quality_metrics(critical_failures: int, checks_passed: int):
    """Set latest data quality metric gauges."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["dq_critical_failures"].set(max(0, int(critical_failures)))
    _metrics["dq_checks_passed"].set(max(0, int(checks_passed)))


def sync_mlflow_registry(registry_models: dict[str, list[dict]]):
    """
    Refresh MLflow registry gauge labels from a registry snapshot.

    Expected structure:
      {
        "model_name": [
          {"version": "1", "stage": "Staging", ...},
          ...
        ]
      }
    """
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return

    counts: dict[tuple[str, str], int] = {}
    for model_name, versions in (registry_models or {}).items():
        for version in versions or []:
            stage = str(version.get("stage") or "None")
            key = (str(model_name), stage)
            counts[key] = counts.get(key, 0) + 1

    gauge = _metrics["models_registered"]
    try:
        gauge.clear()
    except Exception:
        # Older prometheus-client versions may not support clear().
        pass

    for (model_name, stage), count in counts.items():
        gauge.labels(model_name=model_name, stage=stage).set(count)


# ─── Prometheus /metrics Endpoint Handler ────────────────────────────────────────

def handle_metrics(registry=DEFAULT_REGISTRY) -> tuple[bytes, str]:
    """
    WSGI handler for /metrics endpoint.
    Returns (body, content_type).
    """
    if not PROMETHEUS_AVAILABLE:
        return b"# prometheus-client not installed", "text/plain"

    return generate_latest(registry), CONTENT_TYPE_LATEST


# ─── PrometheusMiddleware for FastAPI ────────────────────────────────────────────

if PROMETHEUS_AVAILABLE:
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request
    from starlette.responses import Response

    class PrometheusMiddleware(BaseHTTPMiddleware):
        """FastAPI middleware that records HTTP request metrics."""

        async def dispatch(self, request: Request, call_next):
            # Skip /metrics endpoint to avoid recursion
            if request.url.path == "/metrics":
                return await call_next(request)

            method = request.method
            endpoint = request.url.path
            t0 = time.perf_counter()

            try:
                response = await call_next(request)
                status = response.status_code
            except Exception:
                status = 500
                raise
            finally:
                duration = time.perf_counter() - t0

                global _metrics
                if _metrics is None:
                    _metrics = get_metrics()

                _metrics["http_requests_total"].labels(
                    method=method, endpoint=endpoint, status=str(status)
                ).inc()
                _metrics["http_request_duration"].labels(
                    method=method, endpoint=endpoint
                ).observe(duration)

            return response
