#!/usr/bin/env python3
"""
Native DQ Pipeline Runner -- runs the full data quality pipeline without Docker/Airflow.

Usage:
    python scripts/run_dq_pipeline.py                          # Run against default DB
    python scripts/run_dq_pipeline.py --db data/trading_data.db
    python scripts/run_dq_pipeline.py --block                  # Raise on critical failures
    python scripts/run_dq_pipeline.py --no-gx                  # Skip Great Expectations checks
    python scripts/run_dq_pipeline.py --schedule 30           # Run every 30 minutes

Environment variables (override CLI args):
    DQ_DB_PATH           Path to the SQLite trading database
    DQ_BLOCK_ON_CRITICAL "true" to raise on critical failures (blocks downstream)
    DQ_REQUIRE_GX        "true" to fail if Great Expectations is unavailable
    MLFLOW_TRACKING_URI   MLflow server URI (default: http://localhost:5000)
    DQ_ALERT_WEBHOOK      Slack/Teams webhook URL for failure alerts

Airflow equivalent (when Docker is available):
    docker compose -f docker-compose.airflow.yml -p airflow-stack up -d
    # Then trigger: airflow dags trigger data_quality_pipeline

Exit codes:
    0  -- All suites passed (or warnings only)
    1  -- Critical failures detected
    2  -- Database not found or other runtime error
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_ENGINE_ROOT = PROJECT_ROOT / "ml-engine"
DQ_DB_PATH = ML_ENGINE_ROOT / "data" / "trading_data.db"

if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))


def _print_suite_summary(name: str, suite: dict) -> None:
    status = "PASS" if suite["passed"] else "FAIL"
    crit = suite.get("critical_failures", 0)
    warn = suite.get("warning_failures", 0)
    passed = suite.get("checks_passed", 0)
    failed = suite.get("checks_failed", 0)
    warned = suite.get("checks_warned", 0)
    total = suite.get("total_checks", 0)
    print(f"  [{status}] {name:<20}  crit={crit:<3} warn={warn:<3}  checks: {passed} passed / {failed} failed / {warned} warned / {total} total")


def _print_report(report: dict) -> None:
    banner = "=" * 70
    print(f"\n{banner}")
    print("  DATA QUALITY PIPELINE -- FULL REPORT")
    print(banner)
    print(f"  Generated: {report.get('timestamp', 'N/A')}")
    print(f"  Duration:  {report.get('duration_ms', 'N/A')} ms")
    print(f"  Overall:   {'PASS' if report['passed'] else 'FAIL'}")
    print(f"  Critical:  {report.get('critical_failures', 0)}")
    print(f"  Warnings: {report.get('warning_failures', 0)}")
    print()

    for suite_name, suite in report.get("suites", {}).items():
        _print_suite_summary(suite_name, suite)

    print()

    # Show failures and warnings in detail
    for suite_name, suite in report.get("suites", {}).items():
        for result in suite.get("results", []):
            if result["status"] in ("fail", "warn"):
                icon = "FAIL" if result["status"] == "fail" else "WARN"
                print(f"  [{icon}] {suite_name}/{result['name']}: {result['message']}")

    print(banner)

    # JSON output path
    report_path = PROJECT_ROOT / "airflow" / "reports" / f"dq_report_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\n  Full report saved: {report_path}")


def _send_alert(report: dict) -> None:
    webhook = os.environ.get("DQ_ALERT_WEBHOOK", "").strip()
    if not webhook:
        return

    failed_suites = [
        name for name, suite in report.get("suites", {}).items()
        if not suite.get("passed", False)
    ]
    text = (
        "*Data Quality Pipeline Failed*\n"
        f"Critical failures: {report.get('critical_failures', 0)}\n"
        f"Warning failures: {report.get('warning_failures', 0)}\n"
        f"Failed suites: {', '.join(failed_suites) if failed_suites else 'none'}"
    )
    try:
        import urllib.request
        payload = json.dumps({"text": text}).encode("utf-8")
        req = urllib.request.Request(
            webhook, data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=8)
        print(f"\n  Alert sent to webhook.")
    except Exception as exc:
        print(f"\n  Alert webhook failed: {exc}")


def _log_to_mlflow(report: dict) -> None:
    """Log metrics to MLflow in a background thread (non-blocking, 5s timeout)."""
    import threading

    def _mlflow_log() -> None:
        try:
            import mlflow
        except ImportError:
            print("  MLflow not installed -- skipping.")
            return
        try:
            tracking_uri = os.environ.get("MLFLOW_TRACKING_URI", "http://localhost:5000")
            mlflow.set_tracking_uri(tracking_uri)
            mlflow.set_experiment("data_quality")

            with mlflow.start_run(run_name=f"dq_native_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}"):
                mlflow.log_param("dq_passed", bool(report.get("passed", False)))
                mlflow.log_param("dq_critical_failures", float(report.get("critical_failures", 0)))
                mlflow.log_param("dq_warning_failures", float(report.get("warning_failures", 0)))

                for suite_name, suite in report.get("suites", {}).items():
                    mlflow.log_param(f"{suite_name}_passed", bool(suite.get("passed", False)))
                    mlflow.log_metric(f"{suite_name}_critical_failures", float(suite.get("critical_failures", 0)))
                    mlflow.log_metric(f"{suite_name}_checks_passed", float(suite.get("checks_passed", 0)))
                    mlflow.log_metric(f"{suite_name}_checks_failed", float(suite.get("checks_failed", 0)))

                mlflow.log_text(
                    json.dumps(report, indent=2, default=str),
                    "data_quality_report.json",
                )
            print("  MLflow: logged successfully.")
        except Exception as exc:
            print(f"  MLflow: logging failed (non-blocking): {exc}")

    thread = threading.Thread(target=_mlflow_log, daemon=True)
    thread.start()
    thread.join(timeout=5)  # Don't block if MLflow server is slow/unavailable


def run_validation(db_path: Path, block: bool) -> dict:
    # Set env vars BEFORE import so module-level REQUIRE_GX is read correctly
    if not block:
        os.environ["DQ_BLOCK_ON_CRITICAL"] = "false"

    from data_quality.validation_pipeline import run_full_validation

    if not db_path.exists():
        print(f"ERROR: Database not found: {db_path}")
        sys.exit(2)

    print(f"Validating database: {db_path}")
    print(f"Block on critical:   {block}")
    print()

    block_env = os.environ.get("DQ_BLOCK_ON_CRITICAL", "false").lower() == "true"
    actual_block = block or block_env

    report = run_full_validation(
        db_path=str(db_path),
        block=actual_block,
    )
    return report


def run_scheduled(interval_minutes: int, db_path: Path, block: bool) -> None:
    print(f"Running in scheduled mode -- interval: {interval_minutes} minutes")
    print("Press Ctrl+C to stop.\n")
    while True:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        print(f"[{ts}] Starting validation run...")
        try:
            report = run_validation(db_path, block=False)
            _print_report(report)
            _log_to_mlflow(report)
            if not report["passed"]:
                _send_alert(report)
                if block:
                    sys.exit(1)
        except Exception as exc:
            print(f"ERROR during validation: {exc}")
            sys.exit(2)
        print(f"\nSleeping {interval_minutes} minutes until next run...\n")
        time.sleep(interval_minutes * 60)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the TradersApp data quality pipeline natively (no Docker/Airflow required).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--db", dest="db_path", type=Path,
        default=Path(os.environ.get("DQ_DB_PATH", str(DQ_DB_PATH))),
        help="Path to trading_data.db (default: ml-engine/data/trading_data.db)",
    )
    parser.add_argument(
        "--block", action="store_true",
        help="Exit with code 1 on critical failures (blocks downstream workflows)",
    )
    parser.add_argument(
        "--no-gx", action="store_true",
        help="Continue even if Great Expectations is not installed (sets DQ_REQUIRE_GX=false)",
    )
    parser.add_argument(
        "--schedule", type=int, metavar="MINUTES",
        help="Run on a repeating schedule (every N minutes). Ctrl+C to stop.",
    )
    parser.add_argument(
        "--json", dest="json_output", type=Path,
        help="Save full report as JSON to this path",
    )
    args = parser.parse_args()

    # DQ_REQUIRE_GX is read from env var by validation_pipeline.py at import time
    if args.no_gx:
        os.environ["DQ_REQUIRE_GX"] = "false"

    if args.schedule:
        run_scheduled(args.schedule, args.db_path, args.block)
    else:
        report = run_validation(args.db_path, args.block)
        _print_report(report)

        if not report["passed"]:
            _send_alert(report)
            _log_to_mlflow(report)
            if args.block:
                print(f"\nFATAL: {report.get('critical_failures', 0)} critical failures. Exiting with code 1.")
                sys.exit(1)

        if args.json_output:
            with open(args.json_output, "w", encoding="utf-8") as f:
                json.dump(report, f, indent=2, default=str)
            print(f"Report saved to {args.json_output}")
        else:
            _log_to_mlflow(report)


if __name__ == "__main__":
    main()
