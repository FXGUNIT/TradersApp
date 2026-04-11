"""
Airflow DAG: automated data quality gate with Great Expectations.

Purpose:
- validate incoming datasets on schedule
- block downstream ML workflow when critical checks fail
- emit alerts and MLflow traceability metrics
"""

from __future__ import annotations

import json
import os
import sys
from datetime import timedelta
from pathlib import Path

import pendulum
from airflow.decorators import dag, task
from airflow.exceptions import AirflowException
from airflow.utils.trigger_rule import TriggerRule

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_ENGINE_ROOT = PROJECT_ROOT / "ml-engine"
if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))


@dag(
    dag_id="data_quality_pipeline",
    schedule="*/30 * * * *",
    start_date=pendulum.datetime(2026, 4, 1, tz="UTC"),
    catchup=False,
    max_active_runs=1,
    default_args={
        "owner": "ml-engine",
        "depends_on_past": False,
        "retries": 1,
        "retry_delay": timedelta(minutes=10),
    },
    tags=["data-quality", "great-expectations", "airflow", "mlops"],
    description="Validate candles/trades/sessions and enforce hard gate before ML workflows.",
)
def data_quality_pipeline():
    @task(task_id="run_data_quality_validation")
    def run_data_quality_validation() -> dict:
        from data_quality.validation_pipeline import run_full_validation

        db_path = os.environ.get(
            "DQ_DB_PATH",
            str(ML_ENGINE_ROOT / "data" / "trading_data.db"),
        )
        report = run_full_validation(db_path=db_path, block=False)
        return report

    @task(task_id="enforce_data_quality_gate")
    def enforce_data_quality_gate(report: dict) -> dict:
        if report.get("passed", False):
            return {"passed": True, "message": "Data quality gate passed"}

        failed_suites = [
            name for name, suite in report.get("suites", {}).items()
            if not suite.get("passed", False)
        ]
        raise AirflowException(
            "Data quality gate failed: "
            f"critical_failures={report.get('critical_failures', 0)}; "
            f"failed_suites={failed_suites}"
        )

    @task(task_id="log_data_quality_to_mlflow", trigger_rule=TriggerRule.ALL_DONE)
    def log_data_quality_to_mlflow(report: dict) -> str:
        try:
            import mlflow
        except Exception as exc:
            return f"mlflow_not_available: {exc}"

        tracking_uri = os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000")
        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment("data_quality")

        with mlflow.start_run(run_name=f"dq_airflow_{pendulum.now('UTC').format('YYYYMMDD_HHmmss')}"):
            mlflow.log_param("dq_passed", bool(report.get("passed", False)))
            mlflow.log_metric("dq_critical_failures", float(report.get("critical_failures", 0)))
            mlflow.log_metric("dq_warning_failures", float(report.get("warning_failures", 0)))

            suites = report.get("suites", {})
            for suite_name, suite in suites.items():
                mlflow.log_param(f"{suite_name}_passed", bool(suite.get("passed", False)))
                mlflow.log_metric(f"{suite_name}_critical_failures", float(suite.get("critical_failures", 0)))
                mlflow.log_metric(f"{suite_name}_warning_failures", float(suite.get("warning_failures", 0)))
                mlflow.log_metric(f"{suite_name}_checks_passed", float(suite.get("checks_passed", 0)))
                mlflow.log_metric(f"{suite_name}_checks_failed", float(suite.get("checks_failed", 0)))

            mlflow.log_text(json.dumps(report, indent=2, default=str), "data_quality_report.json")

        return "logged_to_mlflow"

    @task(task_id="alert_on_data_quality_failure", trigger_rule=TriggerRule.ALL_DONE)
    def alert_on_data_quality_failure(report: dict) -> str:
        if report.get("passed", False):
            return "no_alert_needed"

        webhook = os.environ.get("DQ_ALERT_WEBHOOK", "").strip()
        if not webhook:
            return "alert_skipped_no_webhook"

        failed_suites = [
            name for name, suite in report.get("suites", {}).items()
            if not suite.get("passed", False)
        ]
        text = (
            "Data quality gate failed.\n"
            f"Critical failures: {report.get('critical_failures', 0)}\n"
            f"Warning failures: {report.get('warning_failures', 0)}\n"
            f"Failed suites: {failed_suites}"
        )

        try:
            import urllib.request

            payload = json.dumps({"text": text}).encode("utf-8")
            req = urllib.request.Request(
                webhook,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=8).read()
            return "alert_sent"
        except Exception as exc:
            return f"alert_failed: {exc}"

    report = run_data_quality_validation()
    gate = enforce_data_quality_gate(report)
    log_task = log_data_quality_to_mlflow(report)
    alert_task = alert_on_data_quality_failure(report)

    report >> [gate, log_task, alert_task]


dag_instance = data_quality_pipeline()

