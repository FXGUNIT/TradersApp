"""
Airflow DAG — Data Quality Validation Pipeline.

Schedule: Daily at 06:30 UTC (before market open)
Tasks:
  1. validate_candles     — Great Expectations on 5-min OHLCV candles
  2. validate_trades      — Great Expectations on trade_log
  3. validate_sessions    — Great Expectations on session_aggregates
  4. check_results        — Gate: block downstream if any critical expectation fails
  5. alert_on_failure    — Send alert via webhook on critical failure

Usage:
  1. Install Airflow: pip install apache-airflow
  2. Place this file in $AIRFLOW_HOME/dags/
  3. Set environment: export AIRFLOW_HOME=$(pwd)/airflow
  4. airflow db init && airflow webserver -p 8080 &
  5. airflow scheduler &

Environment variables:
  AIRFLOW__CORE__DAGS_FOLDER: path to this file (default: ./dags)
  DQ_DB_PATH: SQLite database path
  DQ_ALERT_WEBHOOK: Slack/Discord webhook for alerts
"""

from __future__ import annotations

import os
import sys
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from airflow import DAG
from airflow.decorators import task, dag
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.utils.task_group import TaskGroup
from airflow.utils.dates import days_ago

# ─── Default Arguments ──────────────────────────────────────────────────────────

default_args = {
    "owner": "ml-engine",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=15),
    "tags": ["data-quality", "great-expectations", "ml-engine"],
}

# ─── DAG ───────────────────────────────────────────────────────────────────────

@dag(
    dag_id="data_quality_pipeline",
    description="Great Expectations data quality validation — candles, trades, sessions",
    schedule="30 6 * * *",       # Daily at 06:30 UTC (pre-market)
    start_date=days_ago(1),
    catchup=False,
    max_active_runs=1,
    tags=["data-quality", "great-expectations", "ml-engine"],
    default_args=default_args,
)
def data_quality_dag():
    """
    Data Quality Pipeline DAG.

    Validates all TradersApp data sources using Great Expectations-style
    expectation suites. Blocks the ML pipeline if critical data quality
    issues are detected.
    """

    # ── Load config from env ─────────────────────────────────────────────────

    db_path = os.environ.get("DQ_DB_PATH", str(PROJECT_ROOT / "ml-engine" / "data" / "trading_data.db"))
    alert_webhook = os.environ.get("DQ_ALERT_WEBHOOK", "")
    block_on_critical = os.environ.get("DQ_BLOCK_ON_CRITICAL", "true").lower() == "true"

    # ── Task 1: Validate Candles ────────────────────────────────────────────

    @task(task_id="validate_candles")
    def validate_candles_task(**context):
        from ml_engine.data_quality.validation_pipeline import validate_candles

        result = validate_candles(db_path=db_path, days=30)

        # Push result to XCom for downstream tasks
        context["ti"].xcom_push(key="candles_result", value=result)

        passed = result.get("passed", False)
        n_rows = result.get("n_rows", 0)
        failures = result.get("critical_failures", 0)

        print(f"[DQ] Candles: {'PASS' if passed else 'FAIL'} — {n_rows} rows, {failures} critical failures")

        return json.dumps(result)

    # ── Task 2: Validate Trades ─────────────────────────────────────────────

    @task(task_id="validate_trades")
    def validate_trades_task(**context):
        from ml_engine.data_quality.validation_pipeline import validate_trades

        result = validate_trades(db_path=db_path, days=90)

        context["ti"].xcom_push(key="trades_result", value=result)

        passed = result.get("passed", False)
        n_rows = result.get("n_rows", 0)
        failures = result.get("critical_failures", 0)

        print(f"[DQ] Trades: {'PASS' if passed else 'FAIL'} — {n_rows} rows, {failures} critical failures")

        return json.dumps(result)

    # ── Task 3: Validate Sessions ────────────────────────────────────────────

    @task(task_id="validate_sessions")
    def validate_sessions_task(**context):
        from ml_engine.data_quality.validation_pipeline import validate_sessions

        result = validate_sessions(db_path=db_path, days=90)

        context["ti"].xcom_push(key="sessions_result", value=result)

        passed = result.get("passed", False)
        n_rows = result.get("n_rows", 0)
        failures = result.get("critical_failures", 0)

        print(f"[DQ] Sessions: {'PASS' if passed else 'FAIL'} — {n_rows} rows, {failures} critical failures")

        return json.dumps(result)

    # ── Task 4: Check Results Gate ──────────────────────────────────────────

    @task(task_id="check_results_gate")
    def check_results_gate(**context):
        """Evaluate all suite results. Fail if any critical check failed."""
        ti = context["ti"]

        candles_raw = ti.xcom_pull(task_ids="validate_candles", key="candles_result")
        trades_raw = ti.xcom_pull(task_ids="validate_trades", key="trades_result")
        sessions_raw = ti.xcom_pull(task_ids="validate_sessions", key="sessions_result")

        try:
            candles = json.loads(candles_raw) if candles_raw else {}
            trades = json.loads(trades_raw) if trades_raw else {}
            sessions = json.loads(sessions_raw) if sessions_raw else {}
        except json.JSONDecodeError:
            raise ValueError("Failed to parse validation results from XCom")

        results = {"candles": candles, "trades": trades, "sessions": sessions}
        all_passed = all(r.get("passed", False) for r in results.values())
        critical_total = sum(r.get("critical_failures", 0) for r in results.values())

        print(f"[DQ] Gate: all_passed={all_passed}, critical_failures={critical_total}")

        # Push gate result
        gate_result = {
            "all_passed": all_passed,
            "critical_failures": critical_total,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        context["ti"].xcom_push(key="gate_result", value=gate_result)

        if not all_passed and block_on_critical:
            raise ValueError(
                f"Data quality gate FAILED: {critical_total} critical failures. "
                f"Pipeline blocked. Results: {results}"
            )

        return all_passed

    # ── Task 5: Alert on Failure ─────────────────────────────────────────────

    @task(task_id="alert_on_failure")
    def alert_on_failure(**context):
        """Send alert to webhook if data quality failed."""
        if not alert_webhook:
            print("[DQ] No webhook configured — skipping alert")
            return

        ti = context["ti"]
        gate_raw = ti.xcom_pull(task_ids="check_results_gate", key="gate_result")
        candles_raw = ti.xcom_pull(task_ids="validate_candles", key="candles_result")
        trades_raw = ti.xcom_pull(task_ids="validate_trades", key="trades_result")
        sessions_raw = ti.xcom_pull(task_ids="validate_sessions", key="sessions_result")

        try:
            gate = gate_raw if isinstance(gate_raw, dict) else json.loads(gate_raw) if gate_raw else {}
            candles = json.loads(candles_raw) if candles_raw else {}
            trades = json.loads(trades_raw) if trades_raw else {}
            sessions = json.loads(sessions_raw) if sessions_raw else {}
        except (json.JSONDecodeError, TypeError):
            gate = {}
            candles = {}
            trades = {}
            sessions = {}

        if gate.get("all_passed", True):
            return "No alert needed"

        failures = gate.get("critical_failures", 0)
        message = (
            f":warning: *Data Quality FAILED* — {failures} critical failures\n"
            f"• Candles: {'✅ PASS' if candles.get('passed') else '❌ FAIL'} ({candles.get('n_rows', 0)} rows)\n"
            f"• Trades: {'✅ PASS' if trades.get('passed') else '❌ FAIL'} ({trades.get('n_rows', 0)} rows)\n"
            f"• Sessions: {'✅ PASS' if sessions.get('passed') else '❌ FAIL'} ({sessions.get('n_rows', 0)} rows)\n"
            f"Timestamp: {datetime.now(timezone.utc).isoformat()}"
        )

        try:
            import urllib.request
            payload = json.dumps({"text": message}).encode()
            req = urllib.request.Request(
                alert_webhook,
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(req, timeout=10)
            print(f"[DQ] Alert sent to webhook")
        except Exception as e:
            print(f"[DQ] Failed to send alert: {e}")

        return message

    # ── Task 6: Log Results to MLflow ──────────────────────────────────────

    @task(task_id="log_to_mlflow")
    def log_to_mlflow(**context):
        """Log data quality metrics to MLflow for tracking over time."""
        try:
            import mlflow
            mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", "http://localhost:5000"))
            mlflow.set_experiment("data_quality")

            ti = context["ti"]
            candles_raw = ti.xcom_pull(task_ids="validate_candles", key="candles_result")
            trades_raw = ti.xcom_pull(task_ids="validate_trades", key="trades_result")
            sessions_raw = ti.xcom_pull(task_ids="validate_sessions", key="sessions_result")

            candles = json.loads(candles_raw) if candles_raw else {}
            trades = json.loads(trades_raw) if trades_raw else {}
            sessions = json.loads(sessions_raw) if sessions_raw else {}

            with mlflow.start_run(run_name=f"dq_{datetime.now(timezone.utc).strftime('%Y%m%d')}"):
                # Log per-suite metrics
                for suite_name, result in [("candles", candles), ("trades", trades), ("sessions", sessions)]:
                    mlflow.log_param(f"{suite_name}_passed", result.get("passed", False))
                    mlflow.log_param(f"{suite_name}_n_rows", result.get("n_rows", 0))
                    mlflow.log_param(f"{suite_name}_critical_failures", result.get("critical_failures", 0))
                    mlflow.log_param(f"{suite_name}_checks_passed", result.get("checks_passed", 0))
                    mlflow.log_param(f"{suite_name}_checks_failed", result.get("checks_failed", 0))

            print("[DQ] Data quality metrics logged to MLflow")
        except Exception as e:
            print(f"[DQ] MLflow logging skipped: {e}")

    # ── DAG Graph ────────────────────────────────────────────────────────────

    # Run all validations concurrently
    c = validate_candles_task()
    t = validate_trades_task()
    s = validate_sessions_task()

    # Gate depends on all three
    gate = check_results_gate()

    # Alert always runs (after gate)
    alert = alert_on_failure()

    # MLflow logging always runs
    mlflow_log = log_to_mlflow()

    # DAG dependencies
    c >> gate
    t >> gate
    s >> gate
    gate >> alert
    gate >> mlflow_log


# Instantiate DAG
dag_instance = data_quality_dag()
