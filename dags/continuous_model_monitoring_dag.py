"""
Airflow DAG — continuous model monitoring and automatic retraining.

Runs every 5 minutes:
  1. Refresh unified monitoring snapshot from the ML Engine
  2. Evaluate drift, accuracy, latency, and model freshness state
  3. Enforce data-quality gate before any retrain
  4. Trigger incremental retrain when drift thresholds require it
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pendulum
from airflow.decorators import dag, task
from airflow.exceptions import AirflowException

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_ENGINE_ROOT = PROJECT_ROOT / "ml-engine"
if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))


@dag(
    dag_id="continuous_model_monitoring",
    schedule=os.environ.get("MODEL_MONITOR_SCHEDULE", "*/5 * * * *"),
    start_date=pendulum.datetime(2026, 4, 5, tz="UTC"),
    catchup=False,
    tags=["mlops", "monitoring", "retrain"],
    doc_md="""
    ## Continuous Model Monitoring DAG

    This DAG is the closed operational loop for production model health:

    1. Pull `/monitoring/status` from the ML Engine
    2. Sync Prometheus-visible monitoring state and MLflow freshness
    3. Check whether drift recommends retraining
    4. Enforce the Great Expectations data-quality gate
    5. Trigger incremental retraining when all gates pass

    Latency breaches are recorded and alerted via Prometheus, but they do not
    auto-retrain the model because latency regressions are often infrastructure
    issues rather than model-quality issues.
    """,
)
def continuous_model_monitoring():
    @task(task_id="collect_monitoring_snapshot")
    def collect_monitoring_snapshot():
        import httpx

        url = os.environ.get("ML_ENGINE_URL", "http://ml-engine:8001")
        symbol = os.environ.get("MODEL_MONITOR_SYMBOL", "MNQ")
        response = httpx.get(
            f"{url}/monitoring/status",
            params={"symbol": symbol, "sync_metrics": "true"},
            timeout=120.0,
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("ok", False):
            raise AirflowException(f"Monitoring snapshot failed: {payload}")
        return payload

    @task(task_id="validate_data_quality_gate")
    def validate_data_quality_gate(snapshot: dict):
        if not snapshot.get("retrain", {}).get("recommended", False):
            return {"status": "skipped", "reason": "Retrain not recommended"}

        from data_quality.validation_pipeline import run_full_validation

        db_path = os.environ.get(
            "DQ_DB_PATH",
            str(ML_ENGINE_ROOT / "data" / "trading_data.db"),
        )
        report = run_full_validation(db_path=db_path, block=False)
        if not report.get("passed", False):
            failed_suites = [
                name
                for name, suite in report.get("suites", {}).items()
                if not suite.get("passed", False)
            ]
            raise AirflowException(
                "Data quality gate failed before automatic retrain. "
                f"critical_failures={report.get('critical_failures', 0)}, "
                f"failed_suites={failed_suites}"
            )
        return report

    @task(task_id="trigger_retrain")
    def trigger_retrain(snapshot: dict, dq_report: dict):
        import httpx

        if not snapshot.get("retrain", {}).get("recommended", False):
            return {
                "status": "skipped",
                "reason": "Monitoring thresholds do not currently require retraining",
                "latency_breached": snapshot.get("sla", {}).get("predict_p95_breached", False),
            }

        if dq_report.get("status") == "skipped":
            return {
                "status": "skipped",
                "reason": "Data quality gate skipped because retrain was not recommended",
            }

        url = os.environ.get("ML_ENGINE_URL", "http://ml-engine:8001")
        symbol = snapshot.get("symbol") or os.environ.get("MODEL_MONITOR_SYMBOL", "MNQ")
        response = httpx.post(
            f"{url}/feedback/retrain",
            json={
                "trigger": "drift",
                "symbol": symbol,
                "training_mode": "incremental",
                "auto_retrain_on_drift": True,
            },
            timeout=900.0,
        )
        response.raise_for_status()
        return response.json()

    @task(task_id="report")
    def report(snapshot: dict, retrain_result: dict):
        summary = {
            "generated_at": snapshot.get("generated_at"),
            "drift_status": snapshot.get("drift", {}).get("overall_status"),
            "should_retrain": snapshot.get("drift", {}).get("should_retrain", False),
            "predict_p95_ms": snapshot.get("sla", {}).get("predict", {}).get("p95_ms"),
            "predict_p95_breached": snapshot.get("sla", {}).get("predict_p95_breached", False),
            "production_model_count": snapshot.get("mlflow", {}).get("registry", {}).get("production_model_count", 0),
            "new_trades_since_last_training": snapshot.get("retrain", {}).get("new_trades_since_last_training", 0),
            "retrain_result": retrain_result,
        }
        print(summary)
        return summary

    snapshot = collect_monitoring_snapshot()
    dq_gate = validate_data_quality_gate(snapshot)
    retrain = trigger_retrain(snapshot, dq_gate)
    report(snapshot, retrain)


continuous_model_monitoring()
