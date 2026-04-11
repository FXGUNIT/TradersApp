#!/usr/bin/env python3
"""
Parse k6 summary JSON outputs and enforce SLO thresholds.

Exit codes:
  0  — All SLOs passed
  1  — One or more SLOs breached (CI gate fails)

Environment variables:
  CI_K6_SLA_P95_MS   Max p95 latency in ms (default 200)
  CI_K6_SLA_P99_MS   Max p99 latency in ms (default 500)
  CI_K6_MAX_FAIL_PCT Max failure rate as a percentage 0-100 (default 1.0)
"""

from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
RESULTS_DIR = REPO_ROOT / ".artifacts"
DEFAULT_P95_MS = 200
DEFAULT_P99_MS = 500
DEFAULT_FAIL_PCT = 1.0


def load_env() -> tuple[float, float, float]:
    p95 = float(os.environ.get("CI_K6_SLA_P95_MS", str(DEFAULT_P95_MS)))
    p99 = float(os.environ.get("CI_K6_SLA_P99_MS", str(DEFAULT_P99_MS)))
    fail_pct = float(os.environ.get("CI_K6_MAX_FAIL_PCT", str(DEFAULT_FAIL_PCT)))
    return p95, p99, fail_pct


def find_summary_files() -> list[Path]:
    if not RESULTS_DIR.is_dir():
        return []
    return sorted(RESULTS_DIR.glob("k6-slo-*/summary-*.json"))


def extract_metric(d: dict, key: str) -> Optional[dict]:
    """Return the values dict for a metric, or None."""
    m = d.get("metrics", {})
    # Try exact key first
    if key in m:
        return m[key]
    # Try with "_ms" suffix
    if f"{key}_ms" in m:
        return m[f"{key}_ms"]
    return None


def parse_p(d: dict, p_key: str, default: float = math.nan) -> float:
    vals = extract_metric(d, p_key)
    if vals is None:
        return default
    v = vals.get("values", {})
    return v.get(p_key, v.get(p_key.replace("p(", "p(").replace(")", ")").replace("p(95)", "p(95)"), default))


def parse_fail_rate(d: dict, fail_key: str) -> float:
    vals = extract_metric(d, fail_key)
    if vals is None:
        return 0.0
    return (vals.get("values") or {}).get("rate", 0.0)


def parse_http_req_failed(d: dict) -> float:
    m = d.get("metrics", {})
    fail_metric = m.get("http_req_failed")
    if fail_metric:
        return (fail_metric.get("values") or {}).get("rate", 0.0)
    return 0.0


def scenario_from_filename(path: Path) -> str:
    return path.stem.replace("summary-", "")


def check_scenario(
    path: Path,
    sla_p95: float,
    sla_p99: float,
    sla_fail: float,
) -> tuple[bool, dict]:
    """
    Returns (passed, row) where row has keys:
      scenario, p95, p99, fail_rate, p95_pass, p99_pass, fail_pass
    """
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return False, {"scenario": scenario_from_filename(path), "error": str(exc)}

    scenario = scenario_from_filename(path)

    # Latency metric key for this scenario
    latency_key = f"{scenario}_latency_ms"

    p95 = parse_p(d, "p(95)", latency_key)
    p99 = parse_p(d, "p(99)", latency_key)

    # Failure rates — try scenario-specific, then generic http_req_failed
    fail_rate = parse_fail_rate(d, f"{scenario}_fail_rate")
    if fail_rate == 0.0:
        fail_rate = parse_http_req_failed(d)

    # Fallback: compute from http_req_duration if still missing
    if math.isnan(p95):
        generic = d.get("metrics", {}).get("http_req_duration", {})
        vals = generic.get("values", {})
        p95 = vals.get("p(95)", 0.0)
        p99 = vals.get("p(99)", 0.0)

    p95_pass = p95 <= sla_p95
    p99_pass = p99 <= sla_p99
    fail_pass = fail_rate * 100 <= sla_fail

    row = {
        "scenario": scenario,
        "p95": p95,
        "p99": p99,
        "fail_rate": fail_rate * 100,
        "p95_pass": p95_pass,
        "p99_pass": p99_pass,
        "fail_pass": fail_pass,
    }
    all_pass = p95_pass and p99_pass and fail_pass
    return all_pass, row


def print_summary(rows: list[dict], sla_p95: float, sla_p99: float, sla_fail: float) -> None:
    header = (
        f"{'Scenario':<12}  {'p95(ms)':>9}  {'p99(ms)':>9}  "
        f"{'Fail(%)':>8}  {'p95<=SLO':>9}  {'p99<=SLO':>9}  {'fail<=SLO':>9}"
    )
    sep = "-" * len(header)
    print()
    print("k6 SLO Results")
    print(sep)
    print(header)
    print(sep)
    for row in rows:
        if "error" in row:
            print(f"  {row['scenario']:<12}  ERROR: {row['error']}")
            continue
        p95_s = f"{row['p95']:>8.1f}ms"
        p99_s = f"{row['p99']:>8.1f}ms"
        fail_s = f"{row['fail_rate']:>7.3f}%"
        p95_flag = "  PASS  " if row["p95_pass"] else "  FAIL  "
        p99_flag = "  PASS  " if row["p99_pass"] else "  FAIL  "
        fail_flag = "  PASS  " if row["fail_pass"] else "  FAIL  "
        print(f"  {row['scenario']:<12}  {p95_s}  {p99_s}  {fail_s}  {p95_flag}  {p99_flag}  {fail_flag}")
    print(sep)
    print(f"  SLA thresholds: p95 < {sla_p95:.0f}ms  p99 < {sla_p99:.0f}ms  fail < {sla_fail:.2f}%")
    print()


def main() -> int:
    sla_p95, sla_p99, sla_fail = load_env()
    files = find_summary_files()

    if not files:
        print(
            f"WARNING: No k6 summary JSON files found under {RESULTS_DIR} — "
            "skipping SLO gate (no load test artifacts).",
            file=sys.stderr,
        )
        return 0

    rows = []
    all_passed = True

    for path in files:
        passed, row = check_scenario(path, sla_p95, sla_p99, sla_fail)
        rows.append(row)
        if not passed:
            all_passed = False

    print_summary(rows, sla_p95, sla_p99, sla_fail)

    if all_passed:
        print("RESULT: PASS — All k6 SLO thresholds met.")
        return 0
    else:
        failed = [r["scenario"] for r in rows if not (
            r.get("p95_pass", False) and r.get("p99_pass", False) and r.get("fail_pass", False)
        )]
        print(f"RESULT: FAIL — SLO breached in: {', '.join(failed)}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())