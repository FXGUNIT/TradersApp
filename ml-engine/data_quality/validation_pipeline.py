"""
Data Quality Validation Pipeline — runs Great Expectations suites against TradersApp data.

Usage:
  python -m ml_engine.data_quality.validation_pipeline
  python -m ml_engine.data_quality.validation_pipeline --candles --trades --sessions

Environment:
  DQ_DB_PATH: SQLite database path (default: ml_engine/data/trading_data.db)
  DQ_ALERT_WEBHOOK: Slack/Discord webhook URL for alerts (optional)
  DQ_BLOCK_ON_CRITICAL: Block pipeline if critical expectation fails (default: true)
"""

from __future__ import annotations

import os
import sys
import json
import time
import argparse
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

import pandas as pd

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml_engine.data_quality.expectations.candle_expectations import get_candle_suite
from ml_engine.data_quality.expectations.trade_expectations import get_trade_suite

DB_PATH = os.environ.get("DQ_DB_PATH", str(PROJECT_ROOT / "ml-engine" / "data" / "trading_data.db"))
BLOCK_ON_CRITICAL = os.environ.get("DQ_BLOCK_ON_CRITICAL", "true").lower() == "true"


def _send_alert(message: str, severity: str = "critical"):
    """
    Send alert on critical failures.
    Currently: print + webhook if configured.
    """
    webhook_url = os.environ.get("DQ_ALERT_WEBHOOK")
    timestamp = datetime.now(timezone.utc).isoformat()
    alert_text = f"[{severity.upper()}] [{timestamp}] TradersApp Data Quality: {message}"

    print(f"[ALERT] {alert_text}")

    if webhook_url:
        try:
            import urllib.request
            payload = json.dumps({"text": alert_text}).encode()
            req = urllib.request.Request(
                webhook_url,
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception as e:
            print(f"[ALERT] Could not send webhook: {e}")


def validate_candles(db_path: str = DB_PATH, days: int = 30) -> dict:
    """
    Validate candle data from SQLite.

    Returns validation report dict.
    """
    conn = sqlite3.connect(db_path)
    try:
        cutoff = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=days)
        df = pd.read_sql_query(
            """
            SELECT * FROM candles_5min
            WHERE timestamp >= ?
            ORDER BY timestamp ASC
            """,
            conn,
            params=(cutoff.isoformat(),),
            parse_dates=["timestamp"],
        )
    finally:
        conn.close()

    if df.empty:
        return {
            "suite": "candle_expectations",
            "passed": True,
            "message": "No candles in last 30 days — skipping",
            "n_rows": 0,
        }

    suite = get_candle_suite()
    result = suite.validate(df)
    result["n_rows"] = len(df)

    # Fire alert on critical failure
    if not result["passed"]:
        failures = [r["name"] for r in result["results"] if r["status"] == "fail"]
        _send_alert(f"Candle data quality FAILED: {failures}")

    return result


def validate_trades(db_path: str = DB_PATH, days: int = 90) -> dict:
    """Validate trade log data from SQLite."""
    conn = sqlite3.connect(db_path)
    try:
        cutoff = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=days)
        df = pd.read_sql_query(
            """
            SELECT * FROM trade_log
            WHERE entry_time >= ?
            ORDER BY entry_time ASC
            """,
            conn,
            params=(cutoff.isoformat(),),
            parse_dates=["entry_time", "exit_time"],
        )
    finally:
        conn.close()

    if df.empty:
        return {
            "suite": "trade_expectations",
            "passed": True,
            "message": "No trades in last 90 days — skipping",
            "n_rows": 0,
        }

    suite = get_trade_suite()
    result = suite.validate(df)
    result["n_rows"] = len(df)

    if not result["passed"]:
        failures = [r["name"] for r in result["results"] if r["status"] == "fail"]
        _send_alert(f"Trade data quality FAILED: {failures}")

    return result


def validate_sessions(db_path: str = DB_PATH, days: int = 90) -> dict:
    """Validate session aggregate data from SQLite."""
    conn = sqlite3.connect(db_path)
    try:
        cutoff = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=days)
        df = pd.read_sql_query(
            """
            SELECT * FROM session_aggregates
            WHERE trade_date >= ?
            ORDER BY trade_date ASC
            """,
            conn,
            params=(cutoff.isoformat(),),
            parse_dates=["trade_date"],
        )
    finally:
        conn.close()

    if df.empty:
        return {
            "suite": "session_expectations",
            "passed": True,
            "message": "No sessions in last 90 days — skipping",
            "n_rows": 0,
        }

    # Session expectations
    results = []
    critical_failures = 0

    def _check(name: str, condition: bool, message: str, severity: str = "critical"):
        results.append({"name": name, "status": "fail" if not condition else "pass", "message": message})
        if not condition and severity == "critical":
            critical_failures += 1

    # Required columns
    required = ["trade_date", "symbol", "direction", "gap_pct", "session_range", "range_vs_atr"]
    missing = [c for c in required if c not in df.columns]
    _check("required_columns", len(missing) == 0, f"Missing: {missing}" if missing else "OK", "critical")

    # Direction values
    if "direction" in df.columns:
        valid = df["direction"].isin(["LONG", "SHORT"])
        bad = (~valid).sum()
        _check("direction_values", bad == 0, f"{bad} invalid direction values", "critical")

    # Gap pct range
    if "gap_pct" in df.columns:
        oor = (~df["gap_pct"].between(-0.05, 0.05)).sum()
        _check("gap_pct_range", oor == 0, f"{oor} rows with |gap_pct| > 5%", "warning")

    # Session range > 0
    if "session_range" in df.columns:
        bad = (df["session_range"] <= 0).sum()
        _check("session_range_positive", bad == 0, f"{bad} rows with session_range <= 0", "critical")

    # range_vs_atr sanity
    if "range_vs_atr" in df.columns:
        bad = (~df["range_vs_atr"].between(0, 5)).sum()
        _check("range_vs_atr_sanity", bad == 0, f"{bad} rows with range_vs_atr outside [0, 5]", "warning")

    critical_passed = critical_failures == 0
    if not critical_passed:
        _send_alert("Session data quality FAILED")

    return {
        "suite": "session_expectations",
        "passed": critical_passed,
        "critical_failures": critical_failures,
        "checks_passed": sum(1 for r in results if r["status"] == "pass"),
        "checks_failed": sum(1 for r in results if r["status"] == "fail"),
        "total_checks": len(results),
        "results": results,
        "n_rows": len(df),
    }


def run_full_validation(
    db_path: str = DB_PATH,
    block: bool = BLOCK_ON_CRITICAL,
) -> dict:
    """
    Run all data quality checks.
    Returns dict with per-suite results + overall pass/fail.
    """
    t0 = time.time()
    results = {}

    # Run all suites
    results["candles"] = validate_candles(db_path)
    results["trades"] = validate_trades(db_path)
    results["sessions"] = validate_sessions(db_path)

    # Determine overall pass/fail
    all_passed = all(r.get("passed", False) for r in results.values())
    critical_failures = sum(r.get("critical_failures", 0) for r in results.values())

    overall = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "db_path": db_path,
        "passed": all_passed,
        "critical_failures": critical_failures,
        "duration_ms": round((time.time() - t0) * 1000, 1),
        "suites": results,
    }

    if not all_passed:
        _send_alert(
            f"Data quality check FAILED — {critical_failures} critical failures across "
            f"{sum(1 for r in results.values() if not r.get('passed', False))} suites"
        )

    return overall


def print_report(report: dict):
    """Pretty-print validation report."""
    print(f"\n{'='*60}")
    print(f"Data Quality Report — {report['timestamp']}")
    print(f"Duration: {report['duration_ms']}ms")
    print(f"{'='*60}")

    overall = "✅ PASS" if report["passed"] else "❌ FAIL"
    print(f"\nOverall: {overall} ({report['critical_failures']} critical failures)")

    for suite_name, result in report["suites"].items():
        status = "✅" if result.get("passed", False) else "❌"
        n = result.get("n_rows", 0)
        print(f"\n  {status} {suite_name} ({n} rows)")
        for r in result.get("results", []):
            icon = {"pass": "  ✓", "fail": "  ✗", "warn": "  ⚠"}.get(r["status"], "  ?")
            sev = f"[{r.get('severity', 'info')}]" if r.get("severity") != "info" else ""
            print(f"      {icon} {r['name']} {sev}: {r['message']}")

    print()


# ─── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Data quality validation pipeline")
    parser.add_argument("--candles", action="store_true", help="Validate candles only")
    parser.add_argument("--trades", action="store_true", help="Validate trades only")
    parser.add_argument("--sessions", action="store_true", help="Validate sessions only")
    parser.add_argument("--all", action="store_true", help="Run all validations")
    parser.add_argument("--db-path", type=str, default=DB_PATH, help="SQLite database path")
    parser.add_argument("--days", type=int, default=30, help="Days of data to validate")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    # Default: run all
    run_all = args.all or not (args.candles or args.trades or args.sessions)

    if run_all or args.candles:
        candles = validate_candles(args.db_path, args.days)
    else:
        candles = None

    if run_all or args.trades:
        trades = validate_trades(args.db_path, args.days)
    else:
        trades = None

    if run_all or args.sessions:
        sessions = validate_sessions(args.db_path, args.days)
    else:
        sessions = None

    results = {k: v for k, v in [("candles", candles), ("trades", trades), ("sessions", sessions)] if v is not None}

    all_passed = all(r.get("passed", False) for r in results.values())
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "db_path": args.db_path,
        "passed": all_passed,
        "suites": results,
    }

    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        print_report(report)

    if not all_passed and BLOCK_ON_CRITICAL:
        sys.exit(1)


if __name__ == "__main__":
    main()
