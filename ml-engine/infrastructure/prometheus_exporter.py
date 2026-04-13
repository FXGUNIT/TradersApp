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
_STATUS_VALUES = {
    "ok": 0,
    "warning": 1,
    "alert": 2,
    "critical": 3,
    "error": 4,
}


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
    metrics["concept_drift_baseline_win_rate"] = Gauge(
        name="ml_concept_drift_baseline_win_rate",
        documentation="Training-time baseline win rate for concept drift monitoring",
        registry=registry,
    )
    metrics["concept_drift_current_win_rate"] = Gauge(
        name="ml_concept_drift_current_win_rate",
        documentation="Current rolling win rate for concept drift monitoring",
        registry=registry,
    )
    metrics["concept_drift_win_rate_drop_pct"] = Gauge(
        name="ml_concept_drift_win_rate_drop_pct",
        documentation="Relative win-rate degradation vs baseline",
        registry=registry,
    )
    metrics["drift_status"] = Gauge(
        name="ml_drift_status",
        documentation="Drift severity by detector: 0=ok, 1=warning, 2=alert, 3=critical, 4=error",
        labelnames=["detector"],
        registry=registry,
    )
    metrics["drift_should_retrain"] = Gauge(
        name="ml_drift_should_retrain",
        documentation="Whether the current monitoring snapshot recommends retraining",
        registry=registry,
    )
    metrics["monitoring_last_check"] = Gauge(
        name="ml_monitoring_last_check_timestamp",
        documentation="Unix timestamp of the most recent model-monitoring sync",
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
    metrics["retrain_last_success_timestamp"] = Gauge(
        name="ml_retrain_last_success_timestamp",
        documentation="Unix timestamp of the last successful retrain run",
        registry=registry,
    )
    metrics["retrain_last_failure_timestamp"] = Gauge(
        name="ml_retrain_last_failure_timestamp",
        documentation="Unix timestamp of the last failed retrain run",
        registry=registry,
    )
    metrics["retrain_last_duration_seconds"] = Gauge(
        name="ml_retrain_last_duration_seconds",
        documentation="Wall-clock duration of the last retrain run",
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
    metrics["model_stage_age_seconds"] = Gauge(
        name="ml_model_stage_age_seconds",
        documentation="Age in seconds of the newest model version in a registry stage",
        labelnames=["model_name", "stage"],
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
    metrics["dq_suite_critical_failures"] = Gauge(
        name="ml_dq_suite_critical_failures",
        documentation="Critical failures per DQ suite",
        labelnames=["suite"],
        registry=registry,
    )
    metrics["dq_suite_warnings"] = Gauge(
        name="ml_dq_suite_warnings",
        documentation="Warnings per DQ suite",
        labelnames=["suite"],
        registry=registry,
    )
    metrics["dq_suite_checks_passed"] = Gauge(
        name="ml_dq_suite_checks_passed",
        documentation="Checks passed per DQ suite",
        labelnames=["suite"],
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
    # ── Kafka Producer Circuit Breaker ──────────────────────────────────
    metrics["kafka_producer_circuit_state"] = Gauge(
        name="kafka_producer_circuit_state",
        documentation="Kafka producer circuit state: 0=closed, 1=half_open, 2=open",
        labelnames=["broker"],
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

    # ── Triton Inference Metrics ───────────────────────────────────────────
    metrics["inference_latency_seconds"] = Histogram(
        name="ml_inference_latency_seconds",
        documentation="End-to-end inference latency (batching + Triton round-trip)",
        buckets=(0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 1.0),
        registry=registry,
    )
    metrics["inference_triton_roundtrip_seconds"] = Histogram(
        name="ml_inference_triton_roundtrip_seconds",
        documentation="Triton gRPC round-trip latency",
        buckets=(0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2),
        registry=registry,
    )
    metrics["inference_batch_size"] = Histogram(
        name="ml_inference_batch_size",
        documentation="Batch size used per inference call",
        buckets=(1, 2, 4, 8, 16, 32, 64, 128),
        registry=registry,
    )
    metrics["inference_queue_depth"] = Gauge(
        name="ml_inference_queue_depth",
        documentation="Current inference request queue depth",
        registry=registry,
    )
    metrics["inference_source"] = Counter(
        name="ml_inference_source_total",
        documentation="Inference calls by source (triton, onnx_local, sklearn_local)",
        labelnames=("source",),
        registry=registry,
    )
    metrics["inference_requests_total"] = Counter(
        name="ml_inference_requests_total",
        documentation="Total inference requests",
        labelnames=("model", "symbol"),
        registry=registry,
    )
    metrics["inference_errors_total"] = Counter(
        name="ml_inference_errors_total",
        documentation="Inference errors",
        labelnames=("model", "error_type"),
        registry=registry,
    )
    metrics["triton_server_up"] = Gauge(
        name="ml_triton_server_up",
        documentation="Triton server health (1=up, 0=down)",
        registry=registry,
    )
    metrics["gpu_utilization"] = Gauge(
        name="ml_gpu_utilization_percent",
        documentation="GPU utilization percentage (0-100)",
        labelnames=["device"],
        registry=registry,
    )
    metrics["gpu_memory_used_bytes"] = Gauge(
        name="ml_gpu_memory_used_bytes",
        documentation="GPU memory used in bytes",
        labelnames=["device"],
        registry=registry,
    )
    metrics["gpu_memory_total_bytes"] = Gauge(
        name="ml_gpu_memory_total_bytes",
        documentation="Total GPU memory in bytes",
        labelnames=["device"],
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


def _status_value(status: str | None) -> int:
    return _STATUS_VALUES.get(str(status or "ok").lower(), _STATUS_VALUES["error"])


def set_monitoring_check_timestamp(timestamp: float | None = None):
    """Record the time of the latest monitoring snapshot refresh."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()

    if not PROMETHEUS_AVAILABLE:
        return

    _metrics["monitoring_last_check"].set(float(timestamp or time.time()))


def set_drift_monitoring_snapshot(drift_result: dict | None):
    """Synchronize Prometheus gauges from the latest drift-monitor snapshot."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()

    if not PROMETHEUS_AVAILABLE or not drift_result:
        return

    feature = drift_result.get("feature_drift", {}) or {}
    concept = drift_result.get("concept_drift", {}) or {}
    regime = drift_result.get("regime_drift", {}) or {}

    statuses = {
        "overall": drift_result.get("overall_status", "ok"),
        "feature": feature.get("status", "ok"),
        "concept": concept.get("status", "ok"),
        "regime": regime.get("status", "ok"),
    }
    for detector, status in statuses.items():
        _metrics["drift_status"].labels(detector=detector).set(_status_value(status))

    _metrics["drift_should_retrain"].set(
        1 if drift_result.get("should_retrain", False) else 0
    )

    psi_scores = feature.get("psi_scores", {}) or {}
    max_psi = max((float(value) for value in psi_scores.values()), default=0.0)
    _metrics["feature_drift_psi"].set(max_psi)

    baseline = concept.get("baseline_win_rate")
    current = concept.get("current_win_rate")
    drop_pct = concept.get("win_rate_drop_pct")
    if baseline is not None:
        _metrics["concept_drift_baseline_win_rate"].set(float(baseline))
    if current is not None:
        _metrics["concept_drift_current_win_rate"].set(float(current))
        _metrics["concept_drift_win_rate"].set(float(current))
    if drop_pct is not None:
        _metrics["concept_drift_win_rate_drop_pct"].set(float(drop_pct))

    set_monitoring_check_timestamp()


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


def record_retrain_result(
    success: bool,
    duration_seconds: float = 0.0,
    completed_at: float | None = None,
):
    """Persist the outcome of the latest retrain run."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()

    if not PROMETHEUS_AVAILABLE:
        return

    completed = float(completed_at or time.time())
    _metrics["retrain_in_progress"].set(0)
    _metrics["retrain_last_duration_seconds"].set(max(0.0, float(duration_seconds or 0.0)))
    if success:
        _metrics["retrain_last_success_timestamp"].set(completed)
        _metrics["model_last_trained"].set(completed)
    else:
        _metrics["retrain_last_failure_timestamp"].set(completed)


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


def set_kafka_producer_circuit_state(state: str, broker: str = "default"):
    """Set Kafka producer circuit breaker state metric (0=closed, 1=half_open, 2=open)."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    state_map = {"CLOSED": 0, "HALF_OPEN": 1, "OPEN": 2}
    value = state_map.get(state.upper() if isinstance(state, str) else str(state), 0)
    _metrics["kafka_producer_circuit_state"].labels(broker=broker).set(value)


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


def set_dq_suite_metrics(
    suite: str,
    critical_failures: int,
    warnings: int = 0,
    checks_passed: int = 0,
):
    """Set per-suite data quality metric gauges."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["dq_suite_critical_failures"].labels(suite=str(suite)).set(max(0, int(critical_failures)))
    _metrics["dq_suite_warnings"].labels(suite=str(suite)).set(max(0, int(warnings)))
    _metrics["dq_suite_checks_passed"].labels(suite=str(suite)).set(max(0, int(checks_passed)))


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
    max_stage_age: dict[tuple[str, str], float] = {}
    now = time.time()
    for model_name, versions in (registry_models or {}).items():
        for version in versions or []:
            stage = str(version.get("stage") or "None")
            key = (str(model_name), stage)
            counts[key] = counts.get(key, 0) + 1
            created_raw = version.get("created") or version.get("creation_timestamp")
            if created_raw in (None, ""):
                continue
            created = float(created_raw)
            if created > 1e12:
                created /= 1000.0
            age_seconds = max(0.0, now - created)
            previous_age = max_stage_age.get(key)
            if previous_age is None or age_seconds > previous_age:
                max_stage_age[key] = age_seconds

    gauge = _metrics["models_registered"]
    try:
        gauge.clear()
    except Exception:
        # Older prometheus-client versions may not support clear().
        pass

    age_gauge = _metrics["model_stage_age_seconds"]
    try:
        age_gauge.clear()
    except Exception:
        pass

    for (model_name, stage), count in counts.items():
        gauge.labels(model_name=model_name, stage=stage).set(count)
        if (model_name, stage) in max_stage_age:
            age_gauge.labels(model_name=model_name, stage=stage).set(
                max_stage_age[(model_name, stage)]
            )


# ─── Inference + GPU Metrics ──────────────────────────────────────────────────────

def record_inference_latency(
    latency_seconds: float,
    source: str = "triton",
    batch_size: int = 1,
):
    """Record inference latency histogram."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["inference_latency_seconds"].observe(max(0, latency_seconds))
    _metrics["inference_source"].labels(source=source).inc()
    _metrics["inference_batch_size"].observe(max(1, batch_size))


def record_triton_roundtrip(latency_seconds: float):
    """Record Triton gRPC round-trip latency."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["inference_triton_roundtrip_seconds"].observe(max(0, latency_seconds))


def set_inference_queue_depth(depth: int):
    """Set current inference queue depth gauge."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["inference_queue_depth"].set(max(0, int(depth)))


def record_inference_request(model: str, symbol: str = "MNQ"):
    """Record an inference request."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["inference_requests_total"].labels(model=model, symbol=symbol).inc()


def record_inference_error(model: str, error_type: str):
    """Record an inference error."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["inference_errors_total"].labels(model=model, error_type=error_type).inc()


def set_triton_server_up(is_up: bool):
    """Set Triton server health gauge."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return
    _metrics["triton_server_up"].set(1 if is_up else 0)


def record_gpu_metrics():
    """
    Poll GPU metrics and update Prometheus gauges.
    Call periodically (e.g., every 30s) from a background task.
    """
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return

    try:
        import pynvml  # type: ignore

        pynvml.nvmlInit()
        device_count = pynvml.nvmlDeviceGetCount()

        for i in range(min(device_count, 4)):  # Cap at 4 GPUs
            handle = pynvml.nvmlDeviceGetHandleByIndex(i)
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)

            label = f"gpu{i}"
            _metrics["gpu_utilization"].labels(device=label).set(int(util.gpu))
            _metrics["gpu_memory_used_bytes"].labels(device=label).set(int(mem_info.used))
            _metrics["gpu_memory_total_bytes"].labels(device=label).set(int(mem_info.total))

        pynvml.nvmlShutdown()

    except ImportError:
        # pynvml not installed — try torch CUDA
        try:
            import torch
            if torch.cuda.is_available():
                for i in range(torch.cuda.device_count()):
                    mem_allocated = torch.cuda.memory_allocated(i)
                    mem_reserved = torch.cuda.memory_reserved(i)
                    label = f"gpu{i}"
                    _metrics["gpu_memory_used_bytes"].labels(device=label).set(int(mem_allocated))
                    _metrics["gpu_memory_total_bytes"].labels(
                        device=label
                    ).set(int(torch.cuda.get_device_properties(i).total_memory))
        except Exception:
            pass


def get_inference_metrics_summary() -> dict:
    """Return a summary of all inference metrics for health checks."""
    global _metrics
    if _metrics is None:
        _metrics = get_metrics()
    if not PROMETHEUS_AVAILABLE:
        return {"prometheus_available": False}

    return {
        "prometheus_available": True,
        "triton_server_up": bool(_metrics["triton_server_up"]._value.get()),
        "queue_depth": int(_metrics["inference_queue_depth"]._value.get()),
    }


# ─── Prometheus /metrics Endpoint Handler ────────────────────────────────────────

def handle_metrics(registry=DEFAULT_REGISTRY) -> tuple[bytes, str]:
    """
    WSGI handler for /metrics endpoint.
    Returns (body, content_type).
    """
    if not PROMETHEUS_AVAILABLE:
        return (
            b"# HELP ml_monitoring_last_check_timestamp Placeholder monitoring timestamp.\n"
            b"# TYPE ml_monitoring_last_check_timestamp gauge\n"
            b"ml_monitoring_last_check_timestamp 0\n",
            "text/plain",
        )

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
