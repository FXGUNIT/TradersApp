#!/usr/bin/env python3
"""Render a human-readable summary from a Contabo public verification report."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


HARD_FAILURE_KEYS = {
    "contabo_dns_complete",
    "contabo_tls_integrity",
    "contabo_frontend_ready",
    "contabo_bff_ready",
    "contabo_ml_ready",
    "contabo_deep_route_ready",
    "contabo_public_chain_ready",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Summarize a Contabo public verification report.")
    parser.add_argument("--input", type=Path, required=True, help="Path to public-readiness JSON")
    parser.add_argument("--markdown-out", type=Path, help="Optional markdown summary output path")
    parser.add_argument("--step-summary", type=Path, help="Optional GitHub step summary path to append to")
    parser.add_argument("--github-output", type=Path, help="Optional GitHub output file path")
    return parser.parse_args()


def write_outputs(path: Path | None, outputs: dict[str, str]) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        for key, value in outputs.items():
            handle.write(f"{key}={value}\n")


def summarize_missing_report(input_path: Path) -> tuple[str, dict[str, str]]:
    markdown = "\n".join(
        [
            "## Contabo verification summary",
            "",
            f"- Report file missing: `{input_path}`",
            "- Overall status: `error`",
        ]
    )
    outputs = {
        "report_found": "false",
        "overall_status": "error",
        "hard_failures": "true",
        "failed_checks": "report_missing",
        "load_thresholds_state": "missing",
        "load_recorded": "false",
    }
    return markdown, outputs


def build_markdown(report: dict) -> tuple[str, dict[str, str]]:
    task_status = report.get("task_status") or {}
    failed_checks = [name for name, state in task_status.items() if not state.get("ok")]
    hard_failures = [name for name in failed_checks if name in HARD_FAILURE_KEYS]

    load_test = report.get("load_test") or {}
    load_detail = load_test.get("detail", "Not run")
    load_ok = bool(load_test.get("ok"))
    load_thresholds_passed = (load_test.get("data") or {}).get("thresholds_passed")
    if load_thresholds_passed is True:
        load_thresholds_state = "pass"
    elif load_thresholds_passed is False:
        load_thresholds_state = "fail"
    elif load_ok:
        load_thresholds_state = "unknown"
    else:
        load_thresholds_state = "not_run"

    overall_status = "success"
    if hard_failures:
        overall_status = "error"
    elif load_thresholds_state == "fail":
        overall_status = "warning"

    lines = [
        "## Contabo verification summary",
        "",
        f"- Generated at: `{report.get('generated_at_utc', 'unknown')}`",
        f"- Frontend: `{(report.get('targets') or {}).get('frontend_base_url', 'n/a')}`",
        f"- BFF: `{(report.get('targets') or {}).get('bff_base_url', 'n/a')}`",
        f"- API: `{(report.get('targets') or {}).get('api_base_url', 'n/a')}`",
        f"- Overall status: `{overall_status}`",
    ]

    if failed_checks:
        lines.append(f"- Failed or blocked checks: `{', '.join(failed_checks)}`")
    else:
        lines.append("- Failed or blocked checks: `none`")

    lines.extend(
        [
            "",
            "| Check | Status |",
            "|---|---|",
        ]
    )
    for name in sorted(task_status):
        status = "PASS" if task_status[name].get("ok") else "FAIL"
        lines.append(f"| `{name}` | `{status}` |")

    lines.extend(
        [
            "",
            "### Load envelope",
            "",
            f"- Result: `{load_detail}`",
            f"- Envelope recorded: `{str(load_ok).lower()}`",
            f"- Thresholds: `{load_thresholds_state}`",
        ]
    )

    summary = (load_test.get("data") or {}).get("summary") or {}
    duration = summary.get("http_req_duration_ms") or {}
    if duration:
        lines.append(
            f"- HTTP duration p95/p99: `{duration.get('p95')}` / `{duration.get('p99')}` ms"
        )
    if "http_req_failed_pct" in summary:
        lines.append(f"- HTTP fail rate: `{summary['http_req_failed_pct']}`%")

    custom_metrics = summary.get("custom_metrics") or {}
    if custom_metrics:
        lines.extend(
            [
                "",
                "| Metric | Summary |",
                "|---|---|",
            ]
        )
        for metric_name in sorted(custom_metrics):
            metric = custom_metrics[metric_name]
            if "rate_pct" in metric:
                metric_summary = f"rate `{metric['rate_pct']}`%"
            else:
                metric_summary = f"p95 `{metric.get('p95')}` ms · p99 `{metric.get('p99')}` ms"
            lines.append(f"| `{metric_name}` | {metric_summary} |")

    outputs = {
        "report_found": "true",
        "overall_status": overall_status,
        "hard_failures": "true" if hard_failures else "false",
        "failed_checks": ",".join(failed_checks) if failed_checks else "none",
        "load_thresholds_state": load_thresholds_state,
        "load_recorded": "true" if load_ok else "false",
    }
    return "\n".join(lines), outputs


def main() -> int:
    args = parse_args()

    if not args.input.exists():
        markdown, outputs = summarize_missing_report(args.input)
    else:
        report = json.loads(args.input.read_text(encoding="utf-8"))
        markdown, outputs = build_markdown(report)

    if args.markdown_out:
        args.markdown_out.parent.mkdir(parents=True, exist_ok=True)
        args.markdown_out.write_text(markdown + "\n", encoding="utf-8")

    if args.step_summary:
        args.step_summary.parent.mkdir(parents=True, exist_ok=True)
        with args.step_summary.open("a", encoding="utf-8") as handle:
            handle.write(markdown)
            handle.write("\n")

    write_outputs(args.github_output, outputs)
    print(markdown)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
