"""
Data quality validation pipeline with Great Expectations + native checks.

This module is designed to be executed by:
- Airflow DAGs (scheduled / orchestrated)
- ML training pre-flight gates (before model fitting)
- local CLI validation
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

ML_ENGINE_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ML_ENGINE_ROOT.parent
if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))

from data_quality.expectations.candle_expectations import get_candle_suite
from data_quality.expectations.trade_expectations import get_trade_suite

DEFAULT_DB_PATH = os.environ.get(
    "DQ_DB_PATH",
    str(ML_ENGINE_ROOT / "data" / "trading_data.db"),
)
BLOCK_ON_CRITICAL = os.environ.get("DQ_BLOCK_ON_CRITICAL", "true").lower() == "true"
REQUIRE_GX = os.environ.get("DQ_REQUIRE_GX", "true").lower() == "true"


def _send_alert(message: str, severity: str = "critical") -> None:
    webhook_url = os.environ.get("DQ_ALERT_WEBHOOK", "").strip()
    timestamp = datetime.now(timezone.utc).isoformat()
    text = f"[{severity.upper()}] [{timestamp}] TradersApp Data Quality: {message}"
    print(f"[DQ ALERT] {text}")

    if not webhook_url:
        return

    try:
        import urllib.request

        payload = json.dumps({"text": text}).encode("utf-8")
        request = urllib.request.Request(
            webhook_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(request, timeout=8).read()
    except Exception as exc:
        print(f"[DQ ALERT] webhook delivery failed: {exc}")


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, dict):
        return bool(value.get("success", False))
    return bool(getattr(value, "success", False))


def _gx_result(name: str, outcome: Any, severity: str = "critical") -> dict:
    ok = _to_bool(outcome)
    status = "pass" if ok else "fail"
    message = "passed" if ok else "failed"
    return {
        "name": name,
        "status": status,
        "message": f"Great Expectations {message}",
        "severity": severity,
    }


def _build_gx_validator(df: pd.DataFrame):
    import great_expectations as gx  # type: ignore

    if hasattr(gx, "from_pandas"):
        return gx.from_pandas(df)

    dataset_module = getattr(gx, "dataset", None)
    if dataset_module is not None and hasattr(dataset_module, "PandasDataset"):
        return dataset_module.PandasDataset(df)

    raise RuntimeError("Unsupported Great Expectations API: expected from_pandas/PandasDataset")


def _run_gx_candle_checks(df: pd.DataFrame) -> dict:
    validator = _build_gx_validator(df)
    results = [
        _gx_result("gx_timestamp_exists", validator.expect_column_to_exist("timestamp")),
        _gx_result("gx_open_exists", validator.expect_column_to_exist("open")),
        _gx_result("gx_high_exists", validator.expect_column_to_exist("high")),
        _gx_result("gx_low_exists", validator.expect_column_to_exist("low")),
        _gx_result("gx_close_exists", validator.expect_column_to_exist("close")),
        _gx_result("gx_volume_exists", validator.expect_column_to_exist("volume")),
        _gx_result("gx_open_not_null", validator.expect_column_values_to_not_be_null("open")),
        _gx_result("gx_high_not_null", validator.expect_column_values_to_not_be_null("high")),
        _gx_result("gx_low_not_null", validator.expect_column_values_to_not_be_null("low")),
        _gx_result("gx_close_not_null", validator.expect_column_values_to_not_be_null("close")),
        _gx_result("gx_volume_not_null", validator.expect_column_values_to_not_be_null("volume")),
        _gx_result("gx_timestamp_unique", validator.expect_column_values_to_be_unique("timestamp")),
        _gx_result(
            "gx_volume_range",
            validator.expect_column_values_to_be_between("volume", min_value=1),
        ),
    ]
    return _gx_report("gx_candle_expectations", results)


def _run_gx_trade_checks(df: pd.DataFrame) -> dict:
    validator = _build_gx_validator(df)
    results = [
        _gx_result("gx_entry_time_exists", validator.expect_column_to_exist("entry_time")),
        _gx_result("gx_direction_exists", validator.expect_column_to_exist("direction")),
        _gx_result("gx_result_exists", validator.expect_column_to_exist("result")),
        _gx_result("gx_pnl_ticks_exists", validator.expect_column_to_exist("pnl_ticks")),
        _gx_result("gx_pnl_dollars_exists", validator.expect_column_to_exist("pnl_dollars")),
        _gx_result(
            "gx_entry_time_not_null",
            validator.expect_column_values_to_not_be_null("entry_time"),
        ),
        _gx_result(
            "gx_direction_valid",
            validator.expect_column_values_to_be_in_set(
                "direction",
                value_set=["long", "short", "LONG", "SHORT"],
            ),
        ),
        _gx_result(
            "gx_result_valid",
            validator.expect_column_values_to_be_in_set(
                "result",
                value_set=["win", "loss", "breakeven", "open", "WIN", "LOSS", "BREAKEVEN", "OPEN"],
            ),
        ),
    ]
    return _gx_report("gx_trade_expectations", results)


def _run_gx_session_checks(df: pd.DataFrame) -> dict:
    validator = _build_gx_validator(df)
    results = [
        _gx_result("gx_trade_date_exists", validator.expect_column_to_exist("trade_date")),
        _gx_result("gx_symbol_exists", validator.expect_column_to_exist("symbol")),
        _gx_result("gx_direction_exists", validator.expect_column_to_exist("direction")),
        _gx_result(
            "gx_trade_date_not_null",
            validator.expect_column_values_to_not_be_null("trade_date"),
        ),
        _gx_result(
            "gx_direction_valid",
            validator.expect_column_values_to_be_in_set(
                "direction",
                value_set=["LONG", "SHORT", "long", "short"],
            ),
        ),
    ]
    if "gap_pct" in df.columns:
        results.append(
            _gx_result(
                "gx_gap_pct_range",
                validator.expect_column_values_to_be_between("gap_pct", min_value=-0.10, max_value=0.10),
                severity="warning",
            )
        )
    return _gx_report("gx_session_expectations", results)


def _gx_report(suite: str, checks: list[dict]) -> dict:
    critical_failures = sum(1 for row in checks if row["status"] == "fail" and row["severity"] == "critical")
    warning_failures = sum(1 for row in checks if row["status"] == "fail" and row["severity"] == "warning")
    checks_passed = sum(1 for row in checks if row["status"] == "pass")
    checks_failed = sum(1 for row in checks if row["status"] == "fail")
    return {
        "suite": suite,
        "passed": critical_failures == 0,
        "critical_failures": critical_failures,
        "warning_failures": warning_failures,
        "checks_passed": checks_passed,
        "checks_failed": checks_failed,
        "checks_warned": 0,
        "total_checks": len(checks),
        "results": checks,
    }


def _merge_reports(primary: dict, secondary: dict, n_rows: int) -> dict:
    merged_results = list(primary.get("results", [])) + list(secondary.get("results", []))
    merged = {
        "suite": f"{primary.get('suite')}+{secondary.get('suite')}",
        "passed": bool(primary.get("passed", False) and secondary.get("passed", False)),
        "critical_failures": int(primary.get("critical_failures", 0)) + int(secondary.get("critical_failures", 0)),
        "warning_failures": int(primary.get("warning_failures", 0)) + int(secondary.get("warning_failures", 0)),
        "checks_passed": int(primary.get("checks_passed", 0)) + int(secondary.get("checks_passed", 0)),
        "checks_failed": int(primary.get("checks_failed", 0)) + int(secondary.get("checks_failed", 0)),
        "checks_warned": int(primary.get("checks_warned", 0)) + int(secondary.get("checks_warned", 0)),
        "total_checks": len(merged_results),
        "results": merged_results,
        "n_rows": int(n_rows),
    }
    return merged


def _gx_or_policy_failure(suite_name: str, exc: Exception | None) -> dict:
    if REQUIRE_GX:
        message = "Great Expectations is required but unavailable"
        if exc is not None:
            message = f"{message}: {exc}"
        return {
            "suite": f"{suite_name}_gx_policy",
            "passed": False,
            "critical_failures": 1,
            "warning_failures": 0,
            "checks_passed": 0,
            "checks_failed": 1,
            "checks_warned": 0,
            "total_checks": 1,
            "results": [
                {
                    "name": "gx_required",
                    "status": "fail",
                    "message": message,
                    "severity": "critical",
                }
            ],
        }

    return {
        "suite": f"{suite_name}_gx_optional",
        "passed": True,
        "critical_failures": 0,
        "warning_failures": 0,
        "checks_passed": 0,
        "checks_failed": 0,
        "checks_warned": 1,
        "total_checks": 1,
        "results": [
            {
                "name": "gx_optional",
                "status": "warn",
                "message": f"Great Expectations not installed: {exc}" if exc else "Great Expectations not installed",
                "severity": "warning",
            }
        ],
    }


def _read_sql(db_path: str, query: str, params: tuple[Any, ...], parse_dates: list[str]) -> pd.DataFrame:
    conn = sqlite3.connect(db_path)
    try:
        return pd.read_sql_query(query, conn, params=params, parse_dates=parse_dates)
    finally:
        conn.close()


def validate_candles(db_path: str = DEFAULT_DB_PATH, days: int = 30) -> dict:
    cutoff = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=days)
    df = _read_sql(
        db_path,
        """
        SELECT * FROM candles_5min
        WHERE timestamp >= ?
        ORDER BY timestamp ASC
        """,
        (cutoff.isoformat(),),
        ["timestamp"],
    )

    if df.empty:
        return {
            "suite": "candle_expectations",
            "passed": False,
            "critical_failures": 1,
            "warning_failures": 0,
            "checks_passed": 0,
            "checks_failed": 1,
            "checks_warned": 0,
            "total_checks": 1,
            "results": [
                {"name": "dataset_not_empty", "status": "fail", "message": "No candle rows found", "severity": "critical"}
            ],
            "n_rows": 0,
        }

    native = get_candle_suite().validate(df)
    try:
        gx_report = _run_gx_candle_checks(df)
    except Exception as exc:
        gx_report = _gx_or_policy_failure("candle_expectations", exc)

    merged = _merge_reports(native, gx_report, len(df))
    if not merged["passed"]:
        failed = [row["name"] for row in merged["results"] if row["status"] == "fail"]
        _send_alert(f"Candle validation failed ({merged['critical_failures']} critical): {failed}")
    return merged


def validate_trades(db_path: str = DEFAULT_DB_PATH, days: int = 90) -> dict:
    cutoff = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=days)
    df = _read_sql(
        db_path,
        """
        SELECT * FROM trade_log
        WHERE entry_time >= ?
        ORDER BY entry_time ASC
        """,
        (cutoff.isoformat(),),
        ["entry_time", "exit_time"],
    )

    if df.empty:
        return {
            "suite": "trade_expectations",
            "passed": False,
            "critical_failures": 1,
            "warning_failures": 0,
            "checks_passed": 0,
            "checks_failed": 1,
            "checks_warned": 0,
            "total_checks": 1,
            "results": [
                {"name": "dataset_not_empty", "status": "fail", "message": "No trade rows found", "severity": "critical"}
            ],
            "n_rows": 0,
        }

    native = get_trade_suite().validate(df)
    try:
        gx_report = _run_gx_trade_checks(df)
    except Exception as exc:
        gx_report = _gx_or_policy_failure("trade_expectations", exc)

    merged = _merge_reports(native, gx_report, len(df))
    if not merged["passed"]:
        failed = [row["name"] for row in merged["results"] if row["status"] == "fail"]
        _send_alert(f"Trade validation failed ({merged['critical_failures']} critical): {failed}")
    return merged


def validate_sessions(db_path: str = DEFAULT_DB_PATH, days: int = 90) -> dict:
    cutoff = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=days)
    df = _read_sql(
        db_path,
        """
        SELECT * FROM session_aggregates
        WHERE date(trade_date) >= date(?)
        ORDER BY trade_date ASC
        """,
        (cutoff.isoformat(),),
        ["trade_date"],
    )

    if df.empty:
        return {
            "suite": "session_expectations",
            "passed": False,
            "critical_failures": 1,
            "warning_failures": 0,
            "checks_passed": 0,
            "checks_failed": 1,
            "checks_warned": 0,
            "total_checks": 1,
            "results": [
                {"name": "dataset_not_empty", "status": "fail", "message": "No session rows found", "severity": "critical"}
            ],
            "n_rows": 0,
        }

    required_columns = ("trade_date", "symbol", "direction", "gap_pct", "session_range", "range_vs_atr")
    results: list[dict] = []
    critical_failures = 0
    warning_failures = 0

    def check(name: str, condition: bool, message: str, severity: str = "critical") -> None:
        nonlocal critical_failures, warning_failures
        if condition:
            results.append({"name": name, "status": "pass", "message": "passed", "severity": "info"})
            return
        results.append({"name": name, "status": "fail", "message": message, "severity": severity})
        if severity == "critical":
            critical_failures += 1
        else:
            warning_failures += 1

    missing = [col for col in required_columns if col not in df.columns]
    check("required_columns", not missing, f"Missing columns: {missing}", "critical")

    if "direction" in df.columns:
        valid_direction = df["direction"].astype(str).str.upper().isin({"LONG", "SHORT"})
        check("direction_values", bool(valid_direction.all()), "Found invalid direction values", "critical")
    if "gap_pct" in df.columns:
        gap_ok = pd.to_numeric(df["gap_pct"], errors="coerce").between(-0.10, 0.10)
        check("gap_pct_range", bool(gap_ok.fillna(False).all()), "gap_pct outside [-0.10, 0.10]", "warning")
    if "session_range" in df.columns:
        session_ok = pd.to_numeric(df["session_range"], errors="coerce") > 0
        check("session_range_positive", bool(session_ok.fillna(False).all()), "session_range must be > 0", "critical")
    if "range_vs_atr" in df.columns:
        ratio_ok = pd.to_numeric(df["range_vs_atr"], errors="coerce").between(0, 5)
        check("range_vs_atr_sanity", bool(ratio_ok.fillna(False).all()), "range_vs_atr outside [0, 5]", "warning")

    native = {
        "suite": "session_expectations",
        "passed": critical_failures == 0,
        "critical_failures": critical_failures,
        "warning_failures": warning_failures,
        "checks_passed": sum(1 for row in results if row["status"] == "pass"),
        "checks_failed": sum(1 for row in results if row["status"] == "fail"),
        "checks_warned": 0,
        "total_checks": len(results),
        "results": results,
    }

    try:
        gx_report = _run_gx_session_checks(df)
    except Exception as exc:
        gx_report = _gx_or_policy_failure("session_expectations", exc)

    merged = _merge_reports(native, gx_report, len(df))
    if not merged["passed"]:
        failed = [row["name"] for row in merged["results"] if row["status"] == "fail"]
        _send_alert(f"Session validation failed ({merged['critical_failures']} critical): {failed}")
    return merged


def _record_prometheus_dq_metrics(report: dict) -> None:
    try:
        from infrastructure.prometheus_exporter import set_data_quality_metrics
    except Exception:
        return

    suites = report.get("suites", {})
    checks_passed = sum(int(s.get("checks_passed", 0)) for s in suites.values())
    set_data_quality_metrics(
        critical_failures=int(report.get("critical_failures", 0)),
        checks_passed=int(checks_passed),
    )


def run_full_validation(
    db_path: str = DEFAULT_DB_PATH,
    block: bool = BLOCK_ON_CRITICAL,
    candles_days: int | None = None,
    trades_days: int | None = None,
    sessions_days: int | None = None,
) -> dict:
    started = time.time()
    default_days = int(os.environ.get("DQ_VALIDATE_DAYS", "90"))
    candles_window = int(candles_days if candles_days is not None else default_days)
    trades_window = int(trades_days if trades_days is not None else default_days)
    sessions_window = int(sessions_days if sessions_days is not None else default_days)

    suites = {
        "candles": validate_candles(db_path=db_path, days=candles_window),
        "trades": validate_trades(db_path=db_path, days=trades_window),
        "sessions": validate_sessions(db_path=db_path, days=sessions_window),
    }
    overall_passed = all(suite.get("passed", False) for suite in suites.values())
    critical = sum(int(suite.get("critical_failures", 0)) for suite in suites.values())
    warning = sum(int(suite.get("warning_failures", 0)) for suite in suites.values())

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "db_path": db_path,
        "passed": overall_passed,
        "critical_failures": critical,
        "warning_failures": warning,
        "duration_ms": round((time.time() - started) * 1000, 1),
        "suites": suites,
    }
    _record_prometheus_dq_metrics(report)

    if not overall_passed:
        failed_suites = [name for name, suite in suites.items() if not suite.get("passed", False)]
        _send_alert(f"Data quality gate failed. Failed suites: {failed_suites}")
        if block:
            raise ValueError(
                f"Data quality gate blocked pipeline: {critical} critical failures in suites {failed_suites}"
            )
    return report


def print_report(report: dict) -> None:
    print("=" * 72)
    print(f"Data Quality Report | {report.get('timestamp')}")
    print(f"Duration: {report.get('duration_ms')} ms")
    print("=" * 72)
    status = "PASS" if report.get("passed") else "FAIL"
    print(f"Overall: {status}")
    print(f"Critical failures: {report.get('critical_failures', 0)}")
    print(f"Warning failures: {report.get('warning_failures', 0)}")

    for suite_name, suite in report.get("suites", {}).items():
        suite_status = "PASS" if suite.get("passed") else "FAIL"
        print(f"\n[{suite_name}] {suite_status} | rows={suite.get('n_rows', 0)}")
        for row in suite.get("results", []):
            print(f" - {row.get('status', '?').upper():4} {row.get('name')}: {row.get('message')}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run data quality validation pipeline")
    parser.add_argument("--db-path", type=str, default=DEFAULT_DB_PATH, help="Path to SQLite trading DB")
    parser.add_argument("--json", action="store_true", help="Print JSON output")
    parser.add_argument("--no-block", action="store_true", help="Do not exit non-zero on failure")
    args = parser.parse_args()

    block = not args.no_block and BLOCK_ON_CRITICAL
    try:
        report = run_full_validation(db_path=args.db_path, block=block)
    except Exception as exc:
        if args.json:
            print(json.dumps({"passed": False, "error": str(exc)}, indent=2))
        else:
            print(f"Data quality pipeline failed: {exc}")
        raise

    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        print_report(report)


if __name__ == "__main__":
    main()
