"""
Airflow DAG — Weekly Retrain Feedback Loop

Triggers every Saturday at 22:00 UTC:
  1. Process closed trades (match to signals → compute outcomes)
    2. Prepare the latest eligible training batch snapshot
  2. Check drift status (DriftMonitor.check_all)
  3. Retrain if warranted (retrain pipeline with trigger='scheduled')

Run manually:
  airflow dags trigger feedback_retrain_loop

Requires:
  - ML Engine API running at ML_ENGINE_URL (default: http://ml-engine:8001)
  - PostgreSQL for MLflow backend (set in MLFLOW_TRACKING_URI)
  - trade_log populated with closed trades
"""

import sys
from pathlib import Path
import os

import pendulum
from airflow.decorators import dag, task
from airflow.exceptions import AirflowException

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_ENGINE_ROOT = PROJECT_ROOT / "ml-engine"
if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))


@dag(
    dag_id="feedback_retrain_loop",
    schedule=os.environ.get("FEEDBACK_RETRAIN_SCHEDULE", "0 22 * * 6"),
    start_date=pendulum.datetime(2026, 4, 6, tz="UTC"),
    catchup=False,
    tags=["ml", "feedback", "retrain"],
    doc_md="""
    ## Closed-Loop Retrain DAG

    Weekly pipeline that:
    1. **Process trades**: Match closed trades to logged consensus signals
    2. **Check drift**: Run DriftMonitor.check_all() for feature/concept/regime drift
    3. **Retrain**: If drift confirmed or scheduled → run incremental training

    ### Safety Guards
    - Max 2 retrains per day (prevent runaway loops)
    - Min 20 new trades required before retraining
    - Drift must be "alert" or "critical" (not just "warning") for auto-retrain

    ### Environment Variables
    - `ML_ENGINE_URL`: ML Engine base URL (default: http://ml-engine:8001)
    - `MLFLOW_TRACKING_URI`: MLflow server URI
    """,
)
def feedback_retrain_loop():
    """
    Weekly closed-loop retrain pipeline.

    Call the ML Engine feedback endpoints to:
      1. Process all unmatched closed trades
      2. Run drift detection
      3. Execute retrain if warranted
    """

    @task(task_id="process_trades")
    def process_trades(**context):
        import httpx
        import os
        url = os.environ.get("ML_ENGINE_URL", "http://ml-engine:8001")
        resp = httpx.post(
            f"{url}/feedback/process-trades",
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()

    @task(task_id="prepare_training_batch")
    def prepare_training_batch(**context):
        import httpx
        url = os.environ.get("ML_ENGINE_URL", "http://ml-engine:8001")
        resp = httpx.post(
            f"{url}/feedback/prepare-training-batch",
            params={"symbol": "MNQ", "batch_type": "weekly_retrain"},
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()

    @task(task_id="check_drift")
    def check_drift(**context):
        import httpx
        import os
        url = os.environ.get("ML_ENGINE_URL", "http://ml-engine:8001")
        resp = httpx.post(
            f"{url}/drift/detect",
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()

    @task(task_id="run_retrain")
    def run_retrain(**context):
        import httpx
        import os
        url = os.environ.get("ML_ENGINE_URL", "http://ml-engine:8001")

        # Check if retrain is needed
        drift_result = context["ti"].xcom_pull(task_ids="check_drift")

        if drift_result and not drift_result.get("should_retrain"):
            return {
                "status": "skipped",
                "reason": "No retrain warranted per drift check",
                "drift_status": drift_result.get("overall_status"),
            }

        resp = httpx.post(
            f"{url}/feedback/retrain",
            json={"trigger": "scheduled", "symbol": "MNQ"},
            timeout=600.0,  # 10 min timeout for training
        )
        resp.raise_for_status()
        return resp.json()

    @task(task_id="validate_data_quality_gate")
    def validate_data_quality_gate(**context):
        import os
        from data_quality.validation_pipeline import run_full_validation

        db_path = os.environ.get(
            "DQ_DB_PATH",
            str(ML_ENGINE_ROOT / "data" / "trading_data.db"),
        )
        report = run_full_validation(db_path=db_path, block=False)
        if not report.get("passed", False):
            failed_suites = [
                name for name, suite in report.get("suites", {}).items()
                if not suite.get("passed", False)
            ]
            raise AirflowException(
                "Data quality gate failed before retrain. "
                f"critical_failures={report.get('critical_failures', 0)}, "
                f"failed_suites={failed_suites}"
            )
        return report

    @task(task_id="report")
    def report(results: dict, **context):
        import json
        ti = context["ti"]

        process_result = ti.xcom_pull(task_ids="process_trades")
        batch_result = ti.xcom_pull(task_ids="prepare_training_batch")
        drift_result = ti.xcom_pull(task_ids="check_drift")
        retrain_result = ti.xcom_pull(task_ids="run_retrain")

        summary = {
            "dag_run_id": context["run_id"],
            "process_trades": process_result,
            "training_batch": batch_result,
            "drift_status": drift_result.get("overall_status") if drift_result else "unknown",
            "should_retrain": drift_result.get("should_retrain") if drift_result else False,
            "retrain": retrain_result,
        }

        print("=== FEEDBACK LOOP REPORT ===")
        print(json.dumps(summary, indent=2))
        return summary

    # Task flow
    dq = validate_data_quality_gate()
    pr = process_trades()
    tb = prepare_training_batch()
    dd = check_drift()
    rr = run_retrain()
    summary = report(rr)
    dq >> pr >> tb >> dd >> rr >> summary


feedback_retrain_loop()
