#!/usr/bin/env python3
"""Stage P CI contract probe for production deploy prerequisites.

This script:
1) Extracts required GitHub workflow secrets/vars from local workflow files.
2) Checks local CLI availability (gh/vercel/railway/infisical).
3) Optionally queries live GitHub repo Actions secrets/variables and latest CI run
   metadata when gh auth is available.
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
IMPLICIT_GITHUB_SECRETS = {"GITHUB_TOKEN"}


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


def command_version(cmd: str, override_path: str | None = None) -> dict[str, Any]:
    exe = override_path or shutil.which(cmd)
    if not exe:
        return {"available": False, "path": None, "version": None}

    version_text = None
    for args in ([exe, "--version"], [exe, "-V"], [exe, "version"]):
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


def resolve_gh_path(explicit: str | None = None) -> str | None:
    if explicit:
        p = Path(explicit)
        if p.exists():
            return str(p)
        return None

    from_path = shutil.which("gh")
    if from_path:
        return from_path

    portable = Path.home() / ".local" / "gh" / "bin" / "gh.exe"
    if portable.exists():
        return str(portable)

    return None


def run_cmd(args: list[str], timeout: int = 20) -> tuple[int, str, str]:
    completed = subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    return completed.returncode, (completed.stdout or ""), (completed.stderr or "")


def resolve_repo(explicit_repo: str | None = None) -> str | None:
    if explicit_repo:
        return explicit_repo
    code, out, _err = run_cmd(["git", "config", "--get", "remote.origin.url"], timeout=8)
    if code != 0:
        return None
    origin = out.strip()
    m = re.search(r"github\.com[:/](?P<owner>[^/]+)/(?P<name>[^/.]+)(?:\.git)?$", origin)
    if not m:
        return None
    return f"{m.group('owner')}/{m.group('name')}"


def gh_api_json(gh_path: str, endpoint: str, timeout: int = 20) -> dict[str, Any] | None:
    code, out, _err = run_cmd([gh_path, "api", endpoint], timeout=timeout)
    if code != 0:
        return None
    out = out.strip()
    if not out:
        return None
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return None


def gh_run_json(gh_path: str, repo: str, run_id: str) -> dict[str, Any] | None:
    code, out, _err = run_cmd(
        [gh_path, "run", "view", run_id, "--repo", repo, "--json", "jobs,conclusion,status,displayTitle,startedAt,updatedAt"],
        timeout=30,
    )
    if code != 0 or not out.strip():
        return None
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return None


def gh_latest_ci(gh_path: str, repo: str) -> dict[str, Any] | None:
    fields = "databaseId,conclusion,status,displayTitle,headBranch,event,createdAt,updatedAt"
    code, out, _err = run_cmd(
        [gh_path, "run", "list", "--repo", repo, "--workflow", "ci.yml", "--limit", "1", "--json", fields],
        timeout=30,
    )
    if code != 0 or not out.strip():
        return None
    try:
        runs = json.loads(out)
    except json.JSONDecodeError:
        return None
    if not runs:
        return None
    latest = runs[0]
    run_id = str(latest.get("databaseId", ""))
    if run_id:
        details = gh_run_json(gh_path, repo, run_id)
        if details and isinstance(details.get("jobs"), list):
            deploy_job = None
            for job in details["jobs"]:
                name = str(job.get("name", "")).lower()
                if name == "deploy production":
                    deploy_job = {
                        "name": job.get("name"),
                        "status": job.get("status"),
                        "conclusion": job.get("conclusion"),
                        "url": job.get("url"),
                    }
                    break
            latest["deploy_production_job"] = deploy_job
    return latest


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe Stage P CI contract prerequisites.")
    parser.add_argument(
        "--output",
        type=Path,
        default=default_output_path(),
        help="Path to write the JSON report.",
    )
    parser.add_argument(
        "--repo",
        default=None,
        help="GitHub repo slug owner/name (default: derived from origin).",
    )
    parser.add_argument(
        "--gh-path",
        default=None,
        help="Explicit path to gh executable (default: PATH, then ~/.local/gh/bin/gh.exe).",
    )
    parser.add_argument(
        "--skip-live",
        action="store_true",
        help="Skip live GitHub API checks.",
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

    gh_path = resolve_gh_path(args.gh_path)
    cli_status = {
        "gh": command_version("gh", gh_path),
        "vercel": command_version("vercel"),
        "railway": command_version("railway"),
        "infisical": command_version("infisical"),
    }

    repo = resolve_repo(args.repo)
    live: dict[str, Any] = {"enabled": False}
    missing_repo_secrets: list[str] = []
    missing_repo_vars: list[str] = []
    if (not args.skip_live) and gh_path and repo:
        live["enabled"] = True
        live["repo"] = repo
        live["gh_path"] = gh_path

        secrets_payload = gh_api_json(gh_path, f"repos/{repo}/actions/secrets")
        vars_payload = gh_api_json(gh_path, f"repos/{repo}/actions/variables")

        repo_secrets = sorted(
            {
                str(item.get("name"))
                for item in (secrets_payload or {}).get("secrets", [])
                if isinstance(item, dict) and item.get("name")
            }
        )
        repo_vars = sorted(
            {
                str(item.get("name"))
                for item in (vars_payload or {}).get("variables", [])
                if isinstance(item, dict) and item.get("name")
            }
        )
        live["repo_actions_contract"] = {
            "secrets_count": int((secrets_payload or {}).get("total_count", len(repo_secrets))),
            "variables_count": int((vars_payload or {}).get("total_count", len(repo_vars))),
            "secrets": repo_secrets,
            "variables": repo_vars,
        }

        missing_repo_secrets = sorted(
            s for s in all_secrets if (s not in IMPLICIT_GITHUB_SECRETS and s not in set(repo_secrets))
        )
        missing_repo_vars = sorted(v for v in all_vars if v not in set(repo_vars))
        live["contract_gap"] = {
            "missing_secrets": missing_repo_secrets,
            "missing_variables": missing_repo_vars,
        }
        live["latest_ci"] = gh_latest_ci(gh_path, repo)

    explicit_required_secrets = sorted(s for s in all_secrets if s not in IMPLICIT_GITHUB_SECRETS)

    summary = {
        "required_secrets_count": len(all_secrets),
        "required_explicit_secrets_count": len(explicit_required_secrets),
        "required_variables_count": len(all_vars),
        "missing_local_cli_tools": sorted(
            [name for name, state in cli_status.items() if not state["available"]]
        ),
        "missing_repo_secrets_count": len(missing_repo_secrets),
        "missing_repo_variables_count": len(missing_repo_vars),
    }

    report = {
        "generated_at_utc": now_utc_iso(),
        "workflows": workflow_refs,
        "required_contract": {
            "secrets": sorted(all_secrets),
            "explicit_secrets": explicit_required_secrets,
            "variables": sorted(all_vars),
        },
        "local_cli_status": cli_status,
        "live_checks": live,
        "summary": summary,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Stage P CI contract report written: {args.output}")
    print(f"Required secrets: {summary['required_secrets_count']}")
    print(f"Required variables: {summary['required_variables_count']}")
    if summary["missing_local_cli_tools"]:
        print("Missing local CLIs:", ", ".join(summary["missing_local_cli_tools"]))
    if live.get("enabled"):
        print(f"Missing repo secrets: {summary['missing_repo_secrets_count']}")
        print(f"Missing repo variables: {summary['missing_repo_variables_count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
