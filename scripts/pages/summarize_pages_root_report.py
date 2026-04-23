#!/usr/bin/env python3
"""Render a human-readable summary from a Pages-root verification report."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Summarize a Pages-root verification report.")
    parser.add_argument("--input", type=Path, required=True, help="Path to verification JSON")
    parser.add_argument("--browser-input", type=Path, required=True, help="Path to browser JSON")
    parser.add_argument("--markdown-out", type=Path, help="Optional markdown summary output path")
    parser.add_argument("--step-summary", type=Path, help="Optional GitHub step summary path")
    parser.add_argument("--github-output", type=Path, help="Optional GitHub output file path")
    return parser.parse_args()


def write_outputs(path: Path | None, outputs: dict[str, str]) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        for key, value in outputs.items():
            handle.write(f"{key}={value}\n")


def summarize_missing_reports(report_path: Path, browser_path: Path) -> tuple[str, dict[str, str]]:
    missing = []
    if not report_path.exists():
        missing.append(str(report_path))
    if not browser_path.exists():
        missing.append(str(browser_path))

    markdown = "\n".join(
        [
            "## Pages root verification summary",
            "",
            f"- Missing report files: `{', '.join(missing)}`",
            "- Overall status: `error`",
        ]
    )
    outputs = {
        "report_found": "false" if not report_path.exists() else "true",
        "browser_report_found": "false" if not browser_path.exists() else "true",
        "overall_status": "error",
        "failed_checks": "report_missing",
        "browser_contract_ok": "false",
        "fallback_used": "false",
        "runtime_fallback_hosts": "false",
    }
    return markdown, outputs


def build_markdown(report: dict, browser: dict) -> tuple[str, dict[str, str]]:
    checks = report.get("checks") or []
    failed_checks = [check["name"] for check in checks if not check.get("ok")]
    browser_ok = bool(browser.get("ok"))
    target_resolution = report.get("target_resolution") or {}
    fallback_used = any(
        bool(target.get("used_fallback"))
        for target in target_resolution.values()
        if isinstance(target, dict)
    )
    runtime_fallback_hosts = any(
        "sslip.io" in str(target.get("requested_url", "")) or
        "sslip.io" in str(target.get("effective_url", ""))
        for target in target_resolution.values()
        if isinstance(target, dict)
    )

    overall_status = "success"
    if failed_checks or not browser_ok:
        overall_status = "error"
    elif fallback_used or runtime_fallback_hosts:
        overall_status = "warning"

    lines = [
        "## Pages root verification summary",
        "",
        f"- Root URL: `{report.get('root_url', 'n/a')}`",
        f"- Frontend preview: `{report.get('project_preview_url', 'n/a')}`",
        f"- BFF base URL: `{report.get('bff_base_url', 'n/a')}`",
        f"- API base URL: `{report.get('api_base_url', 'n/a')}`",
        f"- Browser contract: `{'pass' if browser_ok else 'fail'}`",
        f"- Overall status: `{overall_status}`",
    ]

    if failed_checks:
        lines.append(f"- Failed checks: `{', '.join(failed_checks)}`")
    else:
        lines.append("- Failed checks: `none`")

    lines.append(f"- Fallback used: `{'true' if fallback_used else 'false'}`")
    lines.append(f"- Runtime fallback hosts: `{'true' if runtime_fallback_hosts else 'false'}`")

    lines.extend(
        [
            "",
            "| Check | Status | Detail |",
            "| --- | --- | --- |",
        ]
    )
    lines.append(
        f"| `browser_rendered_landing_page` | `{'pass' if browser_ok else 'fail'}` | "
        f"{browser.get('h1') or browser.get('error') or 'no detail'} |"
    )
    for check in checks:
        lines.append(
            f"| `{check['name']}` | `{'pass' if check.get('ok') else 'fail'}` | {check.get('detail', '')} |"
        )

    lines.extend(
        [
            "",
            "| Target | Requested | Effective | Fallback |",
            "| --- | --- | --- | --- |",
        ]
    )
    for key in ("project_preview", "bff", "api"):
        target = target_resolution.get(key) or {}
        lines.append(
            f"| `{key}` | `{target.get('requested_url', 'n/a')}` | "
            f"`{target.get('effective_url', 'n/a')}` | "
            f"`{str(bool(target.get('used_fallback'))).lower()}` |"
        )

    outputs = {
        "report_found": "true",
        "browser_report_found": "true",
        "overall_status": overall_status,
        "failed_checks": ",".join(failed_checks) if failed_checks else "none",
        "browser_contract_ok": "true" if browser_ok else "false",
        "fallback_used": "true" if fallback_used else "false",
        "runtime_fallback_hosts": "true" if runtime_fallback_hosts else "false",
    }
    return "\n".join(lines), outputs


def main() -> int:
    args = parse_args()

    if not args.input.exists() or not args.browser_input.exists():
        markdown, outputs = summarize_missing_reports(args.input, args.browser_input)
    else:
        report = json.loads(args.input.read_text(encoding="utf-8"))
        browser = json.loads(args.browser_input.read_text(encoding="utf-8"))
        markdown, outputs = build_markdown(report, browser)

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
