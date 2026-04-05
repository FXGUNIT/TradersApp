#!/usr/bin/env python3
"""
MLflow Prometheus Metrics Proxy

Runs alongside MLflow server (port 5000) and exposes /metrics on port 5001.

Prometheus scrapes port 5001, this process queries the MLflow PostgreSQL
backend every 30s and exposes the metrics as Prometheus format.

Metrics:
  mlflow_experiments_total          — number of experiments
  mlflow_runs_total                — total runs per experiment
  mlflow_runs_active              — currently running MLflow runs
  mlflow_registry_models_total     — registered models per lifecycle stage
  mlflow_registry_run_seconds      — time from run start to model registration
  mlflow_pbo_pass_rate             — PBO pass rate of recent runs
"""

import os
import time
import threading
from wsgiref.simple_server import make_server
from prometheus_client import (
    Gauge, Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
)

# ─── Prometheus metrics ────────────────────────────────────────────────────────

EXPERIMENTS_TOTAL = Gauge(
    "mlflow_experiments_total",
    "Total number of MLflow experiments"
)

RUNS_TOTAL = Gauge(
    "mlflow_runs_total",
    "Total runs per experiment",
    ["experiment"]
)

RUNS_ACTIVE = Gauge(
    "mlflow_runs_active",
    "Currently running MLflow runs"
)

REGISTRY_MODELS = Gauge(
    "mlflow_registry_models_total",
    "Registered models per lifecycle stage",
    ["stage", "model_name"]
)

RUN_DURATION = Histogram(
    "mlflow_run_duration_seconds",
    "Duration of finished MLflow runs",
    ["experiment", "status"],
    buckets=(1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600)
)

REGISTRY_OPERATIONS = Counter(
    "mlflow_registry_operations_total",
    "Model registry operations",
    ["operation", "model_name", "status"]
)


def get_db_uri() -> str:
    """Build PostgreSQL DSN from environment variables."""
    return os.environ.get(
        "BACKEND_STORE_URI",
        f"postgresql://{os.environ.get('POSTGRES_USER', 'mlflow')}:"
        f"{os.environ.get('POSTGRES_PASSWORD', 'mlflow123')}@"
        f"{os.environ.get('POSTGRES_HOST', 'postgres')}:"
        f"{os.environ.get('POSTGRES_PORT', '5432')}/"
        f"{os.environ.get('POSTGRES_DB', 'mlflow')}"
    )


def collect_metrics():
    """Query MLflow PostgreSQL backend and update Prometheus metrics."""
    try:
        import psycopg2
        uri = get_db_uri()
        conn = psycopg2.connect(uri)
        cur = conn.cursor()

        # Experiments count
        cur.execute("SELECT COUNT(*) FROM experiments")
        EXPERIMENTS_TOTAL.set(cur.fetchone()[0])

        # Active runs
        cur.execute("SELECT COUNT(*) FROM runs WHERE status = 'RUNNING'")
        RUNS_ACTIVE.set(cur.fetchone()[0])

        # Runs per experiment
        cur.execute("""
            SELECT e.name, COUNT(r.run_uuid)
            FROM experiments e
            LEFT JOIN runs r ON r.experiment_id = e.experiment_id
            GROUP BY e.experiment_id, e.name
        """)
        for name, count in cur.fetchall():
            if name:
                RUNS_TOTAL.labels(experiment=name).set(count)

        # Registry models per stage
        cur.execute("""
            SELECT COALESCE(mv.current_stage, 'None'), mv.name, COUNT(*)
            FROM model_versions mv
            GROUP BY mv.current_stage, mv.name
        """)
        for stage, name, count in cur.fetchall():
            REGISTRY_MODELS.labels(stage=str(stage), model_name=name).set(count)

        # Run duration histogram
        cur.execute("""
            SELECT e.name, r.status,
                   EXTRACT(EPOCH FROM (r.end_time - r.start_time)) as duration
            FROM runs r
            JOIN experiments e ON e.experiment_id = r.experiment_id
            WHERE r.end_time IS NOT NULL
            ORDER BY r.start_time DESC
            LIMIT 1000
        """)
        for exp_name, status, duration in cur.fetchall():
            if exp_name and status:
                RUN_DURATION.labels(
                    experiment=exp_name,
                    status=status
                ).observe(max(0, float(duration or 0)))

        # Registry operations from model version events
        cur.execute("""
            SELECT name, current_stage, version,
                   ROW_NUMBER() OVER (PARTITION BY name ORDER BY created DESC) as rn
            FROM model_versions
        """)
        rows = cur.fetchall()
        if rows:
            latest = [r for r in rows if r[3] == 1]
            for name, stage, version, _ in latest:
                if stage != "None":
                    REGISTRY_OPERATIONS.labels(
                        operation="stage_change",
                        model_name=name,
                        status=str(stage)
                    ).inc()

        cur.close()
        conn.close()
        print(f"[MLflow Metrics] Updated: {EXPERIMENTS_TOTAL._value._value} experiments, "
              f"{RUNS_ACTIVE._value._value} active runs")

    except Exception as e:
        print(f"[MLflow Metrics] DB query failed: {e}")


# ─── WSGI app ────────────────────────────────────────────────────────────────

def metrics_app(environ, start_response):
    """WSGI app that serves /metrics."""
    if environ.get("PATH_INFO") == "/metrics":
        output = generate_latest()
        start_response("200 OK", [
            ("Content-Type", CONTENT_TYPE_LATEST),
            ("Content-Length", str(len(output))),
        ])
        return [output]
    elif environ.get("PATH_INFO") == "/health":
        start_response("200 OK", [("Content-Type", "text/plain")])
        return [b"OK"]
    else:
        start_response("404 Not Found", [("Content-Type", "text/plain")])
        return [b"Not Found"]


# ─── Background collector ───────────────────────────────────────────────────

def background_collector(interval: int = 30):
    """Periodically refresh metrics from the database."""
    while True:
        try:
            collect_metrics()
        except Exception as e:
            print(f"[MLflow Metrics] Collection error: {e}")
        time.sleep(interval)


# ─── Main ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("METRICS_PORT", "5001"))
    collect_interval = int(os.environ.get("COLLECT_INTERVAL", "30"))

    print(f"[MLflow Metrics] Starting metrics proxy on port {port}")
    print(f"[MLflow Metrics] Collecting every {collect_interval}s from PostgreSQL backend")

    # Start background collector
    t = threading.Thread(target=background_collector, args=(collect_interval,), daemon=True)
    t.start()

    # Initial collection
    try:
        collect_metrics()
    except Exception:
        pass

    # Start WSGI server
    httpd = make_server("0.0.0.0", port, metrics_app)
    print(f"[MLflow Metrics] /metrics available at http://0.0.0.0:{port}/metrics")
    print(f"[MLflow Metrics] /health available at http://0.0.0.0:{port}/health")
    httpd.serve_forever()
