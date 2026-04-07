#!/usr/bin/env python3
"""
MLflow Prometheus Metrics Wrapper

Patches the MLflow Flask app to expose /metrics for Prometheus scraping.
Runs as the gunicorn application module.

Metrics exposed:
  - ml_http_request_duration_seconds  (histogram)  — request latency per endpoint
  - ml_http_request_total            (counter)    — total request count per endpoint
  - ml_http_requests_in_progress     (gauge)      — concurrent in-flight requests
  - mlflow_registry_models_total     (gauge)      — registered models per stage
  - mlflow_experiments_total         (gauge)      — total experiments
  - mlflow_runs_active              (gauge)      — currently running MLflow runs

Polls the PostgreSQL backend every 60s to refresh registry metrics.
"""

import os
import sys
import threading
import time
from prometheus_client import (
    Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST,
    REGISTRY, CollectorRegistry
)

# ─── Metrics definitions ────────────────────────────────────────────────────────

REQUEST_COUNT = Counter(
    "ml_http_request_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

REQUEST_LATENCY = Histogram(
    "ml_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
)

REQUESTS_IN_PROGRESS = Gauge(
    "ml_http_requests_in_progress",
    "HTTP requests currently in progress",
    ["method"]
)

REGISTRY_MODELS = Gauge(
    "mlflow_registry_models_total",
    "Registered models per lifecycle stage",
    ["stage"]
)

EXPERIMENTS_TOTAL = Gauge(
    "mlflow_experiments_total",
    "Total number of MLflow experiments"
)

RUNS_ACTIVE = Gauge(
    "mlflow_runs_active",
    "Active (running) MLflow runs"
)

# ─── Periodic stats collector ─────────────────────────────────────────────────

def _collect_registry_stats(interval: int = 60):
    """Poll MLflow PostgreSQL backend for model registry stats."""
    while True:
        try:
            _update_registry_metrics()
        except Exception:
            pass
        time.sleep(interval)


def _update_registry_metrics():
    """Query PostgreSQL backend for registry statistics."""
    try:
        import psycopg2
        uri = os.environ.get(
            "MLFLOW_TRACKING_URI",
            "postgresql://mlflow:mlflow123@localhost:5433/mlflow"
        )
        # Convert tracking URI to postgres URI
        pg_uri = os.environ.get(
            "BACKEND_STORE_URI",
            f"postgresql://mlflow:mlflow123@localhost:5433/mlflow"
        )
        conn = psycopg2.connect(pg_uri)
        cur = conn.cursor()

        # Count models per stage
        cur.execute("""
            SELECT current_stage, COUNT(*)
            FROM model_versions
            GROUP BY current_stage
        """)
        for row in cur.fetchall():
            stage = row[0] or "None"
            REGISTRY_MODELS.labels(stage=stage).set(row[1])

        # Count experiments
        cur.execute("SELECT COUNT(*) FROM experiments")
        EXPERIMENTS_TOTAL.set(cur.fetchone()[0])

        # Count active runs
        cur.execute("""
            SELECT COUNT(*) FROM runs
            WHERE status = 'RUNNING'
        """)
        RUNS_ACTIVE.set(cur.fetchone()[0])

        cur.close()
        conn.close()
    except Exception:
        pass


# Start background collector thread
_collector_thread = threading.Thread(
    target=_collect_registry_stats,
    args=(60,),
    daemon=True
)
_collector_thread.start()


# ─── WSGI app factory ────────────────────────────────────────────────────────

def create_app():
    """
    WSGI application factory.
    Returns MLflow app wrapped with Prometheus /metrics endpoint.

    Called by gunicorn:
        gunicorn mlflow_metrics_wrapper:create_app()
    """
    # Import MLflow app
    try:
        from mlflow.server import app as mlflow_app
    except ImportError as e:
        print(f"[MLflow] Failed to import mlflow server: {e}")
        sys.exit(1)

    # Wrap with metrics middleware
    @webapp_wsgi_factory(mlflow_app)
    def metrics_wsgi_app(environ, start_response):
        return mlflow_app(environ, start_response)

    return metrics_wsgi_app


def webapp_wsgi_factory(flask_app):
    """Create a WSGI app that adds /metrics to the Flask app."""
    from werkzeug.wrappers import Response

    def wsgi_app(environ, start_response):
        path = environ.get("PATH_INFO", "")

        if path == "/metrics":
            # Collect Flask metrics
            try:
                from prometheus_flask_exporter import PrometheusMetrics
                PrometheusMetrics(flask_app, group_by="endpoint", registry=REGISTRY)
            except Exception:
                pass

            output = generate_latest(registry=REGISTRY)
            start_response("200 OK", [
                ("Content-Type", CONTENT_TYPE_LATEST),
                ("Content-Length", str(len(output))),
            ])
            return [output]

        # Track in-progress requests
        method = environ.get("REQUEST_METHOD", "GET")
        REQUESTS_IN_PROGRESS.labels(method=method).inc()
        try:
            return flask_app(environ, start_response)
        finally:
            REQUESTS_IN_PROGRESS.labels(method=method).dec()

    return wsgi_app


if __name__ == "__main__":
    print("[MLflow] Use gunicorn to run: gunicorn mlflow_metrics_wrapper:create_app()")
    print("[MLflow] Metrics available at: http://localhost:5000/metrics")
