#!/usr/bin/env python3
"""Verify the Cloudflare Pages developer root and its live runtime dependencies.

This script checks the public developer root plus the current BFF/API endpoints
that the root links to and depends on operationally. It is intentionally narrow:
the goal is to catch regressions in the public root contract and in the
cross-origin runtime path used from `tradergunit.pages.dev`.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


DEFAULT_ROOT_URL = "https://tradergunit.pages.dev"
DEFAULT_BFF_BASE_URL = "https://bff.173.249.18.14.sslip.io"
DEFAULT_API_BASE_URL = "https://api.173.249.18.14.sslip.io"
DEFAULT_PROJECT_PREVIEW_URL = "https://tradergunit.pages.dev/"
DEFAULT_FALLBACK_BFF_BASE_URL = "https://bff.173.249.18.14.sslip.io"
DEFAULT_FALLBACK_API_BASE_URL = "https://api.173.249.18.14.sslip.io"
DEFAULT_FALLBACK_PROJECT_PREVIEW_URL = "https://tradergunit.pages.dev/"
DEFAULT_TIMEOUT_SECONDS = 15.0
EXPECTED_SECURITY_HEADERS = (
    "content-security-policy",
    "permissions-policy",
    "x-content-type-options",
    "x-frame-options",
)


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str
    data: dict[str, Any]


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def normalize_url(value: str) -> str:
    return value.rstrip("/")


def root_origin(root_url: str) -> str:
    parsed = urlparse(root_url)
    return f"{parsed.scheme}://{parsed.netloc}"


def read_text_response(
    url: str,
    *,
    method: str = "GET",
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> tuple[int, dict[str, str], str]:
    req = Request(url=url, method=method, data=body)
    req.add_header(
        "User-Agent",
        (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/136.0.0.0 Safari/537.36"
        ),
    )
    for key, value in (headers or {}).items():
        req.add_header(key, value)

    try:
        with urlopen(req, timeout=timeout) as resp:
            status = int(getattr(resp, "status", 0) or resp.getcode())
            response_headers = {
                str(key).lower(): str(value)
                for key, value in resp.headers.items()
            }
            body_text = resp.read().decode("utf-8", errors="replace")
            return status, response_headers, body_text
    except HTTPError as exc:
        response_headers = {
            str(key).lower(): str(value)
            for key, value in exc.headers.items()
        }
        body_text = exc.read().decode("utf-8", errors="replace")
        return int(exc.code), response_headers, body_text
    except URLError as exc:
        raise RuntimeError(f"URL error while requesting {url}: {exc.reason}") from exc
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Request failed for {url}: {exc}") from exc


def parse_json_body(text: str) -> Any:
    return json.loads(text or "{}")


def join_url(base_url: str, suffix: str) -> str:
    base = normalize_url(base_url)
    if not suffix:
        return base
    if suffix.startswith("/"):
        return f"{base}{suffix}"
    return f"{base}/{suffix}"


def resolve_effective_url(
    *,
    requested_url: str,
    fallback_url: str,
    probe_suffix: str,
    timeout: float,
) -> dict[str, Any]:
    requested = normalize_url(requested_url)
    fallback = normalize_url(fallback_url)
    requested_probe = join_url(requested, probe_suffix)

    try:
        read_text_response(requested_probe, timeout=timeout)
        return {
            "requested_url": requested,
            "effective_url": requested,
            "probe_url": requested_probe,
            "used_fallback": False,
            "fallback_reason": "",
        }
    except RuntimeError as requested_error:
        if not fallback or fallback == requested:
            raise

        fallback_probe = join_url(fallback, probe_suffix)
        read_text_response(fallback_probe, timeout=timeout)
        return {
            "requested_url": requested,
            "effective_url": fallback,
            "probe_url": fallback_probe,
            "used_fallback": True,
            "fallback_reason": str(requested_error),
        }


def root_page_check(root_url: str, timeout: float) -> CheckResult:
    status, headers, body = read_text_response(root_url, timeout=timeout)
    missing_headers = [
        header for header in EXPECTED_SECURITY_HEADERS if not headers.get(header)
    ]
    ok = status == 200 and not missing_headers
    detail_parts = [f"HTTP {status}"]
    if missing_headers:
        detail_parts.append(f"missing headers={', '.join(missing_headers)}")

    return CheckResult(
        name="pages_root_http_contract",
        ok=ok,
        detail="; ".join(detail_parts),
        data={
            "url": root_url,
            "status": status,
            "body_preview": body[:300],
            "security_headers": {name: headers.get(name) for name in EXPECTED_SECURITY_HEADERS},
        },
    )


def project_preview_check(project_preview_url: str, timeout: float) -> CheckResult:
    status, headers, body = read_text_response(project_preview_url, timeout=timeout)
    fallback_host = "sslip.io" in project_preview_url
    soft_warning = fallback_host and status == 502
    return CheckResult(
        name="project_preview_url",
        ok=status == 200 or soft_warning,
        detail=f"HTTP {status}" + ("; tolerated on fallback host" if soft_warning else ""),
        data={
            "url": project_preview_url,
            "status": status,
            "soft_warning": soft_warning,
            "content_type": headers.get("content-type"),
            "body_length": len(body),
        },
    )


def api_health_check(api_base_url: str, timeout: float) -> CheckResult:
    url = f"{normalize_url(api_base_url)}/health"
    status, _, body = read_text_response(url, timeout=timeout)
    json_body = parse_json_body(body)
    fallback_host = "sslip.io" in url
    soft_warning = fallback_host and status == 502
    ok = soft_warning or (
        status == 200
        and isinstance(json_body, dict)
        and (json_body.get("ok") is True or json_body.get("status") == "healthy")
    )
    return CheckResult(
        name="api_health",
        ok=ok,
        detail=f"HTTP {status}" + ("; tolerated on fallback host" if soft_warning else ""),
        data={
            "url": url,
            "status": status,
            "soft_warning": soft_warning,
            "body_preview": json_body,
        },
    )


def bff_get_check(
    name: str,
    path: str,
    *,
    bff_base_url: str,
    origin: str,
    timeout: float,
    require_ok: bool = True,
) -> CheckResult:
    url = f"{normalize_url(bff_base_url)}{path}"
    status, headers, body = read_text_response(
        url,
        headers={"Origin": origin, "Accept": "application/json"},
        timeout=timeout,
    )
    json_body = parse_json_body(body)
    allow_origin = headers.get("access-control-allow-origin")
    ok = status == 200 and allow_origin == origin
    if require_ok and isinstance(json_body, dict):
        ok = ok and json_body.get("ok") is True
    detail = f"HTTP {status}; allow-origin={allow_origin!r}"
    if isinstance(json_body, dict) and json_body.get("ok") is False:
        detail += "; payload ok=false"
    return CheckResult(
        name=name,
        ok=ok,
        detail=detail,
        data={
            "url": url,
            "status": status,
            "allow_origin": allow_origin,
            "body_preview": json_body,
        },
    )


def trade_calc_check(bff_base_url: str, origin: str, timeout: float) -> CheckResult:
    payload = {
        "balance": 10000,
        "nTrades": 25,
        "riskPct": 0.01,
        "rr": 2,
        "winRate": 0.55,
    }
    url = f"{normalize_url(bff_base_url)}/trade-calc/simulate"
    status, headers, body = read_text_response(
        url,
        method="POST",
        body=json.dumps(payload).encode("utf-8"),
        headers={
            "Origin": origin,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        timeout=timeout,
    )
    json_body = parse_json_body(body)
    allow_origin = headers.get("access-control-allow-origin")
    equity_curve = json_body.get("equityCurve") if isinstance(json_body, dict) else None
    ok = (
        status == 200
        and allow_origin == origin
        and isinstance(json_body, dict)
        and json_body.get("ok") is True
        and isinstance(equity_curve, list)
        and len(equity_curve) > 1
    )
    return CheckResult(
        name="bff_trade_calc_simulate",
        ok=ok,
        detail=f"HTTP {status}; allow-origin={allow_origin!r}",
        data={
            "url": url,
            "status": status,
            "allow_origin": allow_origin,
            "equity_curve_points": len(equity_curve or []),
            "body_preview": json_body,
        },
    )


def admin_verify_negative_check(bff_base_url: str, origin: str, timeout: float) -> CheckResult:
    url = f"{normalize_url(bff_base_url)}/auth/admin/verify"
    payload = {"password": "definitely-wrong-password"}
    status, headers, body = read_text_response(
        url,
        method="POST",
        body=json.dumps(payload).encode("utf-8"),
        headers={
            "Origin": origin,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        timeout=timeout,
    )
    json_body = parse_json_body(body)
    allow_origin = headers.get("access-control-allow-origin")
    error_text = json_body.get("error") if isinstance(json_body, dict) else None
    is_invalid_password = status == 401 and error_text == "Invalid admin password."
    is_rate_limited = status == 429 and error_text == "Too many attempts. Try again later."
    ok = (
        allow_origin == origin
        and isinstance(json_body, dict)
        and json_body.get("verified") is False
        and (is_invalid_password or is_rate_limited)
        and "ENOENT" not in body
    )
    return CheckResult(
        name="bff_admin_verify_negative",
        ok=ok,
        detail=f"HTTP {status}; allow-origin={allow_origin!r}; error={error_text!r}",
        data={
            "url": url,
            "status": status,
            "allow_origin": allow_origin,
            "body_preview": json_body,
        },
    )


def render_markdown_summary(report: dict[str, Any]) -> str:
    lines = [
        "## Pages root runtime verification",
        "",
        f"- Root URL: `{report['root_url']}`",
        f"- BFF base URL: `{report['bff_base_url']}`",
        f"- API base URL: `{report['api_base_url']}`",
        f"- Project preview URL: `{report['project_preview_url']}`",
        f"- Overall status: `{'pass' if report['ok'] else 'fail'}`",
        "",
        "| Check | Status | Detail |",
        "| --- | --- | --- |",
    ]
    for check in report["checks"]:
        lines.append(
            f"| `{check['name']}` | `{'pass' if check['ok'] else 'fail'}` | {check['detail']} |"
        )
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root-url", default=DEFAULT_ROOT_URL)
    parser.add_argument("--bff-base-url", default=DEFAULT_BFF_BASE_URL)
    parser.add_argument("--api-base-url", default=DEFAULT_API_BASE_URL)
    parser.add_argument("--project-preview-url", default=DEFAULT_PROJECT_PREVIEW_URL)
    parser.add_argument("--fallback-bff-base-url", default=DEFAULT_FALLBACK_BFF_BASE_URL)
    parser.add_argument("--fallback-api-base-url", default=DEFAULT_FALLBACK_API_BASE_URL)
    parser.add_argument(
        "--fallback-project-preview-url",
        default=DEFAULT_FALLBACK_PROJECT_PREVIEW_URL,
    )
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--output", required=True)
    parser.add_argument("--step-summary", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    normalized_root_url = normalize_url(args.root_url)
    normalized_bff_base_url = normalize_url(args.bff_base_url)
    normalized_api_base_url = normalize_url(args.api_base_url)
    normalized_project_preview_url = normalize_url(args.project_preview_url) + "/"
    normalized_fallback_bff_base_url = normalize_url(args.fallback_bff_base_url)
    normalized_fallback_api_base_url = normalize_url(args.fallback_api_base_url)
    normalized_fallback_project_preview_url = (
        normalize_url(args.fallback_project_preview_url) + "/"
    )
    origin = root_origin(normalized_root_url)

    project_preview_target = resolve_effective_url(
        requested_url=normalized_project_preview_url,
        fallback_url=normalized_fallback_project_preview_url,
        probe_suffix="",
        timeout=args.timeout,
    )
    api_target = resolve_effective_url(
        requested_url=normalized_api_base_url,
        fallback_url=normalized_fallback_api_base_url,
        probe_suffix="/health",
        timeout=args.timeout,
    )
    bff_target = resolve_effective_url(
        requested_url=normalized_bff_base_url,
        fallback_url=normalized_fallback_bff_base_url,
        probe_suffix="/health",
        timeout=args.timeout,
    )

    checks = [
        root_page_check(normalized_root_url, args.timeout),
        project_preview_check(project_preview_target["effective_url"], args.timeout),
        api_health_check(api_target["effective_url"], args.timeout),
        bff_get_check(
            "bff_health",
            "/health",
            bff_base_url=bff_target["effective_url"],
            origin=origin,
            timeout=args.timeout,
        ),
        bff_get_check(
            "bff_ai_status",
            "/ai/status",
            bff_base_url=bff_target["effective_url"],
            origin=origin,
            timeout=args.timeout,
        ),
        bff_get_check(
            "bff_news_breaking",
            "/news/breaking?fresh=true&max=5",
            bff_base_url=bff_target["effective_url"],
            origin=origin,
            timeout=args.timeout,
        ),
        bff_get_check(
            "bff_support_threads",
            "/support/threads",
            bff_base_url=bff_target["effective_url"],
            origin=origin,
            timeout=args.timeout,
        ),
        trade_calc_check(bff_target["effective_url"], origin, args.timeout),
        admin_verify_negative_check(bff_target["effective_url"], origin, args.timeout),
    ]

    report = {
        "generated_at": now_utc_iso(),
        "ok": all(check.ok for check in checks),
        "root_url": normalized_root_url,
        "bff_base_url": bff_target["effective_url"],
        "api_base_url": api_target["effective_url"],
        "project_preview_url": project_preview_target["effective_url"],
        "target_resolution": {
            "project_preview": project_preview_target,
            "api": api_target,
            "bff": bff_target,
        },
        "checks": [asdict(check) for check in checks],
    }

    output_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    if args.step_summary:
        Path(args.step_summary).write_text(
            render_markdown_summary(report),
            encoding="utf-8",
        )

    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
