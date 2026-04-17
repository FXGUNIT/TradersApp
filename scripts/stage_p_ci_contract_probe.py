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
SECRET_ALTERNATIVE_GROUPS = [
    frozenset({"KUBE_CONFIG", "KUBECONFIG_B64"}),
]
PRODUCTION_DEPLOY_REQUIRED_SECRETS = {"INFISICAL_TOKEN"}
PRODUCTION_DEPLOY_OPTIONAL_SECRETS = {"VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"}
PRODUCTION_DEPLOY_REQUIRED_SECRET_ALTERNATIVES = [
    frozenset({"KUBE_CONFIG", "KUBECONFIG_B64"}),
]


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


def format_any_of_requirement(group: list[str]) -> str:
    return "any_of(" + ",".join(group) + ")"


def compute_missing_secrets_with_alternatives(
    required: set[str],
    available: set[str],
    alternative_groups: list[frozenset[str]],
) -> tuple[list[str], list[list[str]]]:
    missing = {name for name in required if name not in available}
    missing_alternatives: list[list[str]] = []

    for group in alternative_groups:
        required_in_group = required.intersection(group)
        if not required_in_group:
            continue
        if available.intersection(group):
            missing.difference_update(group)
            continue
        missing.difference_update(group)
        missing_alternatives.append(sorted(group))

    missing_alternatives.sort()
    return sorted(missing), missing_alternatives


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


def gh_api_json(gh_path: str, endpoint: str, timeout: int = 20) -> dict[str, Any]:
    code, out, err = run_cmd([gh_path, "api", endpoint], timeout=timeout)
    cleaned_out = out.strip()
    cleaned_err = err.strip()
    if code != 0:
        return {
            "ok": False,
            "status_code": code,
            "data": None,
            "error": cleaned_err or cleaned_out or "gh api failed",
        }
    if not cleaned_out:
        return {
            "ok": False,
            "status_code": code,
            "data": None,
            "error": "gh api returned empty output",
        }
    try:
        payload = json.loads(cleaned_out)
    except json.JSONDecodeError as exc:
        return {
            "ok": False,
            "status_code": code,
            "data": None,
            "error": f"gh api returned non-JSON output: {exc}",
        }
    return {
        "ok": True,
        "status_code": code,
        "data": payload,
        "error": None,
    }


def gh_run_json(gh_path: str, repo: str, run_id: str) -> dict[str, Any]:
    code, out, err = run_cmd(
        [gh_path, "run", "view", run_id, "--repo", repo, "--json", "jobs,conclusion,status,displayTitle,startedAt,updatedAt"],
        timeout=30,
    )
    cleaned_out = out.strip()
    cleaned_err = err.strip()
    if code != 0:
        return {
            "ok": False,
            "status_code": code,
            "data": None,
            "error": cleaned_err or cleaned_out or "gh run view failed",
        }
    if not cleaned_out:
        return {
            "ok": False,
            "status_code": code,
            "data": None,
            "error": "gh run view returned empty output",
        }
    try:
        payload = json.loads(cleaned_out)
    except json.JSONDecodeError as exc:
        return {
            "ok": False,
            "status_code": code,
            "data": None,
            "error": f"gh run view returned non-JSON output: {exc}",
        }
    return {
        "ok": True,
        "status_code": code,
        "data": payload,
        "error": None,
    }


def gh_latest_ci(gh_path: str, repo: str) -> dict[str, Any]:
    fields = "databaseId,conclusion,status,displayTitle,headBranch,event,createdAt,updatedAt"
    code, out, err = run_cmd(
        [gh_path, "run", "list", "--repo", repo, "--workflow", "ci.yml", "--limit", "1", "--json", fields],
        timeout=30,
    )
    cleaned_out = out.strip()
    cleaned_err = err.strip()
    if code != 0:
        return {
            "ok": False,
            "status_code": code,
            "data": None,
            "error": cleaned_err or cleaned_out or "gh run list failed",
        }
    if not cleaned_out:
        return {
            "ok": False,
            "status_code": code,
            "data": None,
            "error": "gh run list returned empty output",
        }
    try:
        runs = json.loads(cleaned_out)
    except json.JSONDecodeError as exc:
        return {
            "ok": False,
            "status_code": code,
            "data": None,
            "error": f"gh run list returned non-JSON output: {exc}",
        }
    if not runs:
        return {
            "ok": False,
            "status_code": code,
            "data": None,
            "error": "No ci.yml workflow runs returned",
        }
    latest = runs[0]
    run_id = str(latest.get("databaseId", ""))
    if run_id:
        details_result = gh_run_json(gh_path, repo, run_id)
        if details_result.get("ok") and isinstance((details_result.get("data") or {}).get("jobs"), list):
            deploy_job = None
            for job in details_result["data"]["jobs"]:
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
        elif not details_result.get("ok"):
            latest["deploy_production_job_error"] = details_result.get("error")
    return {
        "ok": True,
        "status_code": code,
        "data": latest,
        "error": None,
    }


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

    explicit_required_secrets_set = {s for s in all_secrets if s not in IMPLICIT_GITHUB_SECRETS}
    production_required_secret_set = set(PRODUCTION_DEPLOY_REQUIRED_SECRETS)
    for group in PRODUCTION_DEPLOY_REQUIRED_SECRET_ALTERNATIVES:
        production_required_secret_set.update(group)

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
    missing_repo_secret_alternatives: list[list[str]] = []
    missing_repo_secret_requirements: list[str] = []
    missing_repo_vars: list[str] = []
    deploy_missing_required_secrets: list[str] = []
    deploy_missing_required_secret_alternatives: list[list[str]] = []
    deploy_missing_required_secret_requirements: list[str] = []
    deploy_missing_optional_secrets: list[str] = []
    deploy_ready = False
    live_contract_available = False
    if (not args.skip_live) and gh_path and repo:
        live["enabled"] = True
        live["repo"] = repo
        live["gh_path"] = gh_path

        secrets_result = gh_api_json(gh_path, f"repos/{repo}/actions/secrets")
        vars_result = gh_api_json(gh_path, f"repos/{repo}/actions/variables")

        live["api_calls"] = {
            "actions_secrets": {
                "ok": bool(secrets_result.get("ok")),
                "status_code": secrets_result.get("status_code"),
                "error": secrets_result.get("error"),
            },
            "actions_variables": {
                "ok": bool(vars_result.get("ok")),
                "status_code": vars_result.get("status_code"),
                "error": vars_result.get("error"),
            },
        }

        if secrets_result.get("ok") and vars_result.get("ok"):
            live_contract_available = True
            secrets_payload = secrets_result.get("data") or {}
            vars_payload = vars_result.get("data") or {}
            repo_secrets = sorted(
                {
                    str(item.get("name"))
                    for item in secrets_payload.get("secrets", [])
                    if isinstance(item, dict) and item.get("name")
                }
            )
            repo_vars = sorted(
                {
                    str(item.get("name"))
                    for item in vars_payload.get("variables", [])
                    if isinstance(item, dict) and item.get("name")
                }
            )
            live["repo_actions_contract"] = {
                "secrets_count": int(secrets_payload.get("total_count", len(repo_secrets))),
                "variables_count": int(vars_payload.get("total_count", len(repo_vars))),
                "secrets": repo_secrets,
                "variables": repo_vars,
            }

            repo_secret_set = set(repo_secrets)
            missing_repo_secrets, missing_repo_secret_alternatives = compute_missing_secrets_with_alternatives(
                required=explicit_required_secrets_set,
                available=repo_secret_set,
                alternative_groups=SECRET_ALTERNATIVE_GROUPS,
            )
            missing_repo_secret_requirements = [
                *missing_repo_secrets,
                *[format_any_of_requirement(group) for group in missing_repo_secret_alternatives],
            ]
            missing_repo_vars = sorted(v for v in all_vars if v not in set(repo_vars))

            deploy_missing_required_secrets, deploy_missing_required_secret_alternatives = (
                compute_missing_secrets_with_alternatives(
                    required=production_required_secret_set,
                    available=repo_secret_set,
                    alternative_groups=PRODUCTION_DEPLOY_REQUIRED_SECRET_ALTERNATIVES,
                )
            )
            deploy_missing_required_secret_requirements = [
                *deploy_missing_required_secrets,
                *[
                    format_any_of_requirement(group)
                    for group in deploy_missing_required_secret_alternatives
                ],
            ]
            deploy_missing_optional_secrets = sorted(
                s for s in PRODUCTION_DEPLOY_OPTIONAL_SECRETS if s not in repo_secret_set
            )
            deploy_ready = len(deploy_missing_required_secret_requirements) == 0

            live["contract_gap"] = {
                "available": True,
                "missing_secrets": missing_repo_secret_requirements,
                "missing_variables": missing_repo_vars,
                "missing_secret_alternatives": missing_repo_secret_alternatives,
            }
            live["deploy_production_contract"] = {
                "required_secrets": sorted(PRODUCTION_DEPLOY_REQUIRED_SECRETS),
                "required_secret_alternatives": [
                    sorted(group) for group in PRODUCTION_DEPLOY_REQUIRED_SECRET_ALTERNATIVES
                ],
                "optional_secrets": sorted(PRODUCTION_DEPLOY_OPTIONAL_SECRETS),
                "ready": deploy_ready,
                "missing_required_secret_requirements": deploy_missing_required_secret_requirements,
                "missing_optional_secrets": deploy_missing_optional_secrets,
            }
        else:
            live["repo_actions_contract"] = None
            live["contract_gap"] = {
                "available": False,
                "missing_secrets": None,
                "missing_variables": None,
                "reason": "Live GitHub Actions secrets/variables contract unavailable due to API failure",
            }
            live["deploy_production_contract"] = {
                "required_secrets": sorted(PRODUCTION_DEPLOY_REQUIRED_SECRETS),
                "required_secret_alternatives": [
                    sorted(group) for group in PRODUCTION_DEPLOY_REQUIRED_SECRET_ALTERNATIVES
                ],
                "optional_secrets": sorted(PRODUCTION_DEPLOY_OPTIONAL_SECRETS),
                "ready": None,
                "missing_required_secret_requirements": None,
                "missing_optional_secrets": None,
            }

        latest_ci_result = gh_latest_ci(gh_path, repo)
        live["latest_ci"] = latest_ci_result.get("data") if latest_ci_result.get("ok") else None
        if not latest_ci_result.get("ok"):
            live["latest_ci_error"] = latest_ci_result.get("error")

    explicit_required_secrets = sorted(explicit_required_secrets_set)

    summary = {
        "required_secrets_count": len(all_secrets),
        "required_explicit_secrets_count": len(explicit_required_secrets),
        "required_variables_count": len(all_vars),
        "missing_local_cli_tools": sorted(
            [name for name, state in cli_status.items() if not state["available"]]
        ),
        "live_contract_available": live_contract_available,
        "missing_repo_secrets_count": (
            len(missing_repo_secret_requirements) if live_contract_available else None
        ),
        "missing_repo_variables_count": (len(missing_repo_vars) if live_contract_available else None),
        "deploy_production_ready": (deploy_ready if live_contract_available else None),
        "deploy_production_missing_required_count": (
            len(deploy_missing_required_secret_requirements) if live_contract_available else None
        ),
        "deploy_production_missing_optional_count": (
            len(deploy_missing_optional_secrets) if live_contract_available else None
        ),
    }

    report = {
        "generated_at_utc": now_utc_iso(),
        "workflows": workflow_refs,
        "required_contract": {
            "secrets": sorted(all_secrets),
            "explicit_secrets": explicit_required_secrets,
            "variables": sorted(all_vars),
            "secret_alternatives": [sorted(group) for group in SECRET_ALTERNATIVE_GROUPS],
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
        if summary["live_contract_available"]:
            print(f"Missing repo secrets: {summary['missing_repo_secrets_count']}")
            print(f"Missing repo variables: {summary['missing_repo_variables_count']}")
            print(f"Deploy production ready: {summary['deploy_production_ready']}")
        else:
            print("Missing repo secrets: unavailable (live contract check failed)")
            print("Missing repo variables: unavailable (live contract check failed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
