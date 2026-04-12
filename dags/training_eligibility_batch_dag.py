"""
Airflow DAG — Nightly training eligibility batch preparation.

Runs every night to snapshot which user-originated trades are now eligible for model training.
Admin data is always included; user data is only included once days_used >= 10.
"""

import os
import sys
from pathlib import Path

import pendulum
from airflow.decorators import dag, task

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_ENGINE_ROOT = PROJECT_ROOT / "ml-engine"
if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))


@dag(
    dag_id="training_eligibility_batch",
    schedule=os.environ.get("TRAINING_ELIGIBILITY_BATCH_SCHEDULE", "0 1 * * *"),
    start_date=pendulum.datetime(2026, 4, 12, tz="UTC"),
    catchup=False,
    tags=["ml", "training-batch", "eligibility"],
)
def training_eligibility_batch():
    @task(task_id="prepare_training_batch")
    def prepare_training_batch():
        import httpx

        url = os.environ.get("ML_ENGINE_URL", "http://ml-engine:8001")
        resp = httpx.post(
            f"{url}/feedback/prepare-training-batch",
            params={"symbol": "MNQ", "batch_type": "nightly_eligibility"},
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()

    @task(task_id="report")
    def report(batch_result: dict):
        print("=== TRAINING ELIGIBILITY BATCH REPORT ===")
        print(batch_result)
        return batch_result

    report(prepare_training_batch())


training_eligibility_batch()