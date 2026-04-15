#!/usr/bin/env python3
"""Stage P CI contract probe for production deploy prerequisites.

This script extracts required GitHub workflow secrets/vars and checks local
CLI tool availability needed to verify and operate deploy workflows.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WORKFLOW_PATHS = [
    Path(".github/workflows/ci.yml"),
    Path(".github/workflows/infisical-sync.yml"),
    Path(".github/workflows/monitor.yml"),
]
SECRET_PATTERN = re.compile(r"secrets\.([A-Z0-9_]+)")
VAR_PATTERN = re.compile(r"vars\.([A-Z0-9_]+)")


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def default_output_path() -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return Path(".artifacts") / "stage-p" / f"ci-contract-{stamp}.json"


def extract_references(path: Path) -> dict[str, set[str]]:
    text = path.read_text(encoding="utf-8")
    secrets = set(SECRET_PATTERN.findall(text))
    variables = set(VAR_PATTERN.findall(text))
    return {"secrets": secrets, "variables": variables}


def command_version(cmd: str) -> dict[str, Any]:
    exe = shutil.which(cmd)
    if not exe:
        return {"available": False, "path": None, "version": None}

    version_text = None
    for args in ([cmd, "--version"], [cmd, "-V"], [cmd, "version"]):
        try:
            completed = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
            )
            output = (completed.stdout or completed.stderr or "").strip()
            if output:
                version_text = output.splitlines()[0][:240]
                break
        except Exception:  # noqa: BLE001
            continue

    return {"available": True, "path": exe, "version": version_text}


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe Stage P CI contract prerequisites.")
    parser.add_argument(
        "--output",
        type=Path,
        default=default_output_path(),
        help="Path to write the JSON report.",
    )
    args = parser.parse_args()

    workflow_refs: dict[str, dict[str, list[str]]] = {}
    all_secrets: set[str] = set()
    all_vars: set[str] = set()

    for wf_path in WORKFLOW_PATHS:
        refs = extract_references(wf_path)
        all_secrets.update(refs["secrets"])
        all_vars.update(refs["variables"])
        workflow_refs[str(wf_path)] = {
            "secrets": sorted(refs["secrets"]),
            "variables": sorted(refs["variables"]),
        }

    cli_status = {
        "gh": command_version("gh"),
        "vercel": command_version("vercel"),
        "railway": command_version("railway"),
        "infisical": command_version("infisical"),
    }

    summary = {
        "required_secrets_count": len(all_secrets),
        "required_variables_count": len(all_vars),
        "missing_local_cli_tools": sorted(
            [name for name, state in cli_status.items() if not state["available"]]
        ),
    }

    report = {
        "generated_at_utc": now_utc_iso(),
        "workflows": workflow_refs,
        "required_contract": {
            "secrets": sorted(all_secrets),
            "variables": sorted(all_vars),
        },
        "local_cli_status": cli_status,
        "summary": summary,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Stage P CI contract report written: {args.output}")
    print(f"Required secrets: {summary['required_secrets_count']}")
    print(f"Required variables: {summary['required_variables_count']}")
    if summary["missing_local_cli_tools"]:
        print("Missing local CLIs:", ", ".join(summary["missing_local_cli_tools"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
