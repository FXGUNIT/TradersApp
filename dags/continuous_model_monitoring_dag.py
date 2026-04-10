"""
Airflow DAG — continuous model monitoring and automatic retraining.

Runs every 5 minutes:
  1. Refresh unified monitoring snapshot from the ML Engine
  2. Evaluate drift, accuracy, latency, and model freshness state
  3. Enforce data-quality gate before any retrain
  4. Trigger incremental retrain when drift thresholds require it
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import timedelta
from pathlib import Path

import pendulum
from airflow.decorators import dag, task
from airflow.exceptions import AirflowException

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_ENGINE_ROOT = PROJECT_ROOT / "ml-engine"
if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))


# ─── Distributed Lock Helpers ─────────────────────────────────────────────────────

def _acquire_distributed_lock(lock_name: str, ttl_seconds: int = 600) -> bool:
    """
    Attempt to acquire a Redis-based distributed lock.
    Returns True if lock acquired, False if already held by another process.
    """
    try:
        import redis
        r = redis.Redis.from_url(
            os.environ.get("REDIS_URL", "redis://host.docker.internal:6379/0"),
            decode_responses=True,
        )
        acquired = r.set(lock_name, f"locked:{os.getpid()}", nx=True, ex=ttl_seconds)
        return bool(acquired)
    except Exception:
        # If Redis unavailable, fall back to PID-file lock on filesystem
        lock_dir = Path("/tmp/tradersapp-locks")
        lock_dir.mkdir(exist_ok=True)
        lock_file = lock_dir / f"{lock_name}.lock"
        try:
            import fcntl
            fd = os.open(str(lock_file), os.O_CREAT | os.O_WRONLY | os.O_EXCL)
            os.close(fd)
            return True
        except FileExistsError:
            return False
        except Exception:
            # Last resort: proceed without lock (might cause redundant retrain)
            return True


def _release_distributed_lock(lock_name: str) -> None:
    """Release a distributed lock."""
    try:
        import redis
        r = redis.Redis.from_url(
            os.environ.get("REDIS_URL", "redis://host.docker.internal:6379/0"),
            decode_responses=True,
        )
        r.delete(lock_name)
    except Exception:
        pass


def _write_report_artifact(snapshot: dict, retrain_result: dict) -> dict:
    """Write the final monitoring report as a JSON artifact for auditability."""
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

    # Write to MinIO / local artifact path
    artifact_path = os.environ.get(
        "MONITORING_REPORT_PATH",
        str(PROJECT_ROOT / "monitoring-reports"),
    )
    os.makedirs(artifact_path, exist_ok=True)

    report_file = os.path.join(artifact_path, f"report-{int(time.time())}.json")
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, default=str)

    return summary


# ─── Slack Callback Helpers ─────────────────────────────────────────────────────

def _slack_notify(
    text: str,
    blocks: list | None = None,
    channel: str | None = None,
) -> None:
    """Send a Slack notification via webhook."""
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        return
    import httpx
    payload = {"text": text}
    if blocks:
        payload["blocks"] = blocks
    try:
        resp = httpx.post(webhook_url, json=payload, timeout=10.0)
        resp.raise_for_status()
    except Exception as exc:
        print(f"[DAG] Slack notification failed: {exc}")


def _on_dag_failure(context: dict) -> None:
    """Airflow on_failure_callback: fires when any task in the DAG fails."""
    dag_id = context.get("dag", {}).get("dag_id", "unknown")
    run_id = context.get("run_id", "unknown")
    task_id = context.get("task_instance", {}).get("task_id", "unknown")
    exception = str(context.get("exception", ""))
    exec_date = context.get("execution_date", "")

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":x: *DAG Failure: {dag_id}*",
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Run:* `{run_id}`"},
                {"type": "mrkdwn", "text": f"*Task:* `{task_id}`"},
                {"type": "mrkdwn", "text": f"*Executed at:* {exec_date}"},
            ],
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Error:* ```{exception[:500]}```",
            },
        },
    ]
    _slack_notify(f":x: DAG failure: {dag_id} / {task_id}", blocks=blocks)


def _on_dag_success(context: dict) -> None:
    """Airflow on_success_callback: fires when all tasks complete successfully."""
    dag_id = context.get("dag", {}).get("dag_id", "unknown")
    run_id = context.get("run_id", "unknown")
    exec_date = context.get("execution_date", "")

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":white_check_mark: *DAG Success: {dag_id}*",
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Run:* `{run_id}`"},
                {"type": "mrkdwn", "text": f"*Executed at:* {exec_date}"},
            ],
        },
    ]
    _slack_notify(f":white_check_mark: DAG success: {dag_id}", blocks=blocks)


def _on_task_retry(context: dict) -> None:
    """Airflow on_retry_callback: fires when a task is retried."""
    task_id = context.get("task_instance", {}).get("task_id", "unknown")
    dag_id = context.get("dag", {}).get("dag_id", "unknown")
    run_id = context.get("run_id", "unknown")
    try_number = context.get("task_instance", {}).get("try_number", 1)
    _slack_notify(
        f":warning: Task retry: {dag_id}/{task_id} (attempt {try_number}) — run {run_id}"
    )


# ─── DAG Definition ────────────────────────────────────────────────────────────

LOCK_NAME = "continuous_model_monitoring:retrain_lock"
REPORT_LOCK_NAME = "continuous_model_monitoring:report_lock"


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

    **Distributed Lock:** A Redis lock prevents concurrent retrain DAG runs.
    **Retries:** `collect_monitoring_snapshot` retries up to 3 times with 2-minute backoff.
    **Callbacks:** Slack notifications on DAG failure, success, and task retry.
    **Artifact:** A JSON report is written to the configured artifact path on completion.

    Latency breaches are recorded and alerted via Prometheus, but they do not
    auto-retrain the model because latency regressions are often infrastructure
    issues rather than model-quality issues.
    """,
    on_failure_callback=_on_dag_failure,
    on_success_callback=_on_dag_success,
    sla_miss_callback=_on_dag_failure,
)
def continuous_model_monitoring():
    @task(
        task_id="collect_monitoring_snapshot",
        retries=3,
        retry_delay=timedelta(minutes=2),
        retry_exponential_backoff=True,
        max_retry_delay=timedelta(minutes=10),
        on_retry_callback=_on_task_retry,
    )
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

        # Verify DB path exists before calling DQ gate
        db_path = os.environ.get(
            "DQ_DB_PATH",
            str(ML_ENGINE_ROOT / "data" / "trading_data.db"),
        )
        if not os.path.exists(db_path):
            raise AirflowException(f"DQ database not found at: {db_path}")

        from data_quality.validation_pipeline import run_full_validation

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

        # Acquire distributed lock to prevent concurrent retrains
        if not _acquire_distributed_lock(LOCK_NAME, ttl_seconds=900):
            return {
                "status": "skipped",
                "reason": "Another retrain is already in progress (distributed lock held)",
            }

        try:
            url = os.environ.get("ML_ENGINE_URL", "http://ml-engine:8001")
            symbol = snapshot.get("symbol") or os.environ.get("MODEL_MONITOR_SYMBOL", "MNQ")
            timeout = int(os.environ.get("ML_RETRAIN_TIMEOUT", "900"))

            response = httpx.post(
                f"{url}/feedback/retrain",
                json={
                    "trigger": "drift",
                    "symbol": symbol,
                    "training_mode": "incremental",
                    "auto_retrain_on_drift": True,
                },
                timeout=float(timeout),
            )
            response.raise_for_status()
            result = response.json()

            # Emit Prometheus metrics for retrain events
            try:
                from infrastructure.prometheus_exporter import record_retrain_result
                record_retrain_result(
                    success=result.get("ok", False),
                    duration_seconds=result.get("duration_seconds", 0.0),
                    completed_at=time.time(),
                )
            except Exception:
                pass  # Non-critical: metrics emission should not fail the DAG

            return result
        finally:
            _release_distributed_lock(LOCK_NAME)

    @task(task_id="report")
    def report(snapshot: dict, retrain_result: dict):
        summary = _write_report_artifact(snapshot, retrain_result)
        print(summary)

        # Emit retrain triggered/skipped counter
        try:
            from infrastructure.prometheus_exporter import record_retrain
            record_retrain(
                triggered=retrain_result.get("status") != "skipped",
            )
        except Exception:
            pass

        return summary

    snapshot = collect_monitoring_snapshot()
    dq_gate = validate_data_quality_gate(snapshot)
    retrain = trigger_retrain(snapshot, dq_gate)
    report(snapshot, retrain)


continuous_model_monitoring()
