#!/usr/bin/env python3
"""Verify public Contabo runtime-edge deployment readiness and optional load envelope.

This script is the repo-side verification harness for the active Contabo
production path. It performs:

1. DNS resolution for the public hosts
2. TLS handshakes for the public hosts
3. HTTP probes for the runtime edge, BFF, and ML Engine hosts
4. Optional k6 load execution against low-blast-radius public routes

Outputs:
- JSON report under .artifacts/contabo/
- Optional k6 summary/log artifacts under .artifacts/k6-slo-*/
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import ssl
import subprocess
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FRONTEND_HOST = "173.249.18.14.sslip.io"
DEFAULT_BFF_HOST = "bff.173.249.18.14.sslip.io"
DEFAULT_API_HOST = "api.173.249.18.14.sslip.io"
DEFAULT_TIMEOUT_SECONDS = 15.0


@dataclass
class CheckResult:
    ok: bool
    detail: str
    data: dict[str, Any]


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def now_utc_iso() -> str:
    return now_utc().isoformat()


def artifact_stamp() -> str:
    return now_utc().strftime("%Y%m%dT%H%M%SZ")


def normalize_base_url(value: str) -> str:
    return value.rstrip("/")


def build_sample_candles(count: int = 20) -> list[dict[str, Any]]:
    candles: list[dict[str, Any]] = []
    base_price = 18500.0
    base_time = datetime(2026, 4, 21, 9, 30, tzinfo=timezone.utc)

    for index in range(count):
        open_price = base_price + index * 2.0
        close_price = open_price + 1.0
        candles.append(
            {
                "symbol": "MNQ",
                "timestamp": (base_time + timedelta(minutes=index * 5)).isoformat().replace("+00:00", "Z"),
                "open": round(open_price, 2),
                "high": round(close_price + 1.0, 2),
                "low": round(open_price - 1.0, 2),
                "close": round(close_price, 2),
                "volume": 4200 + index * 20,
            }
        )

    return candles


def resolve_dns(host: str) -> CheckResult:
    try:
        info = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        return CheckResult(ok=False, detail=f"DNS resolution failed: {exc}", data={})

    addrs = sorted({entry[4][0] for entry in info if entry and entry[4]})
    if not addrs:
        return CheckResult(ok=False, detail="No resolved addresses returned", data={})
    return CheckResult(
        ok=True,
        detail=f"Resolved {len(addrs)} address(es)",
        data={"addresses": addrs},
    )


def tls_probe(host: str, port: int = 443, timeout: float = 10.0) -> CheckResult:
    context = ssl.create_default_context()
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            with context.wrap_socket(sock, server_hostname=host) as tls_sock:
                cert = tls_sock.getpeercert()
                cipher = tls_sock.cipher()
    except Exception as exc:  # noqa: BLE001
        return CheckResult(ok=False, detail=f"TLS handshake failed: {exc}", data={})

    cert_data = {
        "subject": cert.get("subject"),
        "issuer": cert.get("issuer"),
        "not_before": cert.get("notBefore"),
        "not_after": cert.get("notAfter"),
        "subject_alt_name": cert.get("subjectAltName"),
        "version": cert.get("version"),
        "serial_number": cert.get("serialNumber"),
    }
    return CheckResult(
        ok=True,
        detail="TLS handshake succeeded",
        data={"cipher": cipher, "certificate": cert_data},
    )


def _request(
    url: str,
    *,
    method: str = "GET",
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> tuple[int, str, bytes]:
    req = Request(url=url, method=method, data=body)
    for key, value in (headers or {}).items():
        req.add_header(key, value)

    with urlopen(req, timeout=timeout) as resp:
        status = int(getattr(resp, "status", 0) or resp.getcode())
        final_url = getattr(resp, "url", url)
        raw = resp.read()
    return status, final_url, raw


def http_probe(
    url: str,
    *,
    method: str = "GET",
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ok_statuses: set[int] | None = None,
    expect_json: bool = False,
    require_json_ok: bool = False,
) -> CheckResult:
    try:
        status, final_url, raw = _request(
            url,
            method=method,
            body=body,
            headers=headers,
            timeout=timeout,
        )
    except HTTPError as exc:
        return CheckResult(
            ok=False,
            detail=f"HTTP error {exc.code}: {exc.reason}",
            data={"status": exc.code, "reason": str(exc.reason)},
        )
    except URLError as exc:
        return CheckResult(
            ok=False,
            detail=f"URL error: {exc.reason}",
            data={"reason": str(exc.reason)},
        )
    except Exception as exc:  # noqa: BLE001
        return CheckResult(ok=False, detail=f"Request failed: {exc}", data={"error": str(exc)})

    ok_statuses = ok_statuses or set(range(200, 400))
    ok = status in ok_statuses
    detail = f"HTTP status {status}"
    if final_url != url:
        detail += f" (redirected to {final_url})"

    payload: dict[str, Any] = {"status": status, "final_url": final_url}
    text = raw.decode("utf-8", errors="replace")

    if expect_json:
        try:
            body_json = json.loads(text or "{}")
        except json.JSONDecodeError as exc:
            return CheckResult(
                ok=False,
                detail=f"Invalid JSON response: {exc}",
                data={"status": status, "final_url": final_url, "body_preview": text[:500]},
            )

        payload["json_keys"] = sorted(body_json.keys()) if isinstance(body_json, dict) else None
        payload["json_ok"] = body_json.get("ok") if isinstance(body_json, dict) else None
        if require_json_ok and isinstance(body_json, dict):
            ok = ok and body_json.get("ok") is not False
            if body_json.get("ok") is False:
                detail += " (payload ok=false)"
        if isinstance(body_json, dict):
            payload["body_preview"] = {k: body_json[k] for k in list(body_json)[:6]}
        else:
            payload["body_preview"] = text[:500]
    else:
        payload["body_preview"] = text[:500]

    return CheckResult(ok=ok, detail=detail, data=payload)


def json_get_probe(url: str, *, timeout: float = DEFAULT_TIMEOUT_SECONDS, require_json_ok: bool = True) -> CheckResult:
    return http_probe(url, timeout=timeout, expect_json=True, require_json_ok=require_json_ok)


def json_post_probe(
    url: str,
    payload: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    require_json_ok: bool = False,
) -> CheckResult:
    body = json.dumps(payload).encode("utf-8")
    return http_probe(
        url,
        method="POST",
        body=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        timeout=timeout,
        expect_json=True,
        require_json_ok=require_json_ok,
    )


def build_predict_payload() -> dict[str, Any]:
    return {
        "symbol": "MNQ",
        "candles": build_sample_candles(),
        "trades": [],
        "session_id": 1,
        "math_engine_snapshot": {
            "amdPhase": "ACCUMULATION",
            "vrRegime": "NORMAL",
        },
    }


def parse_k6_summary(summary_path: Path) -> dict[str, Any]:
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    metrics = summary.get("metrics", {})

    def values_for(metric_name: str) -> dict[str, Any]:
        metric = metrics.get(metric_name) or {}
        values = metric.get("values")
        if isinstance(values, dict) and values:
            return values
        if isinstance(metric, dict):
            return metric
        return {}

    def rate_value(metric_name: str) -> float:
        values = values_for(metric_name)
        if "rate" in values:
            return float(values.get("rate", 0.0))
        if "value" in values:
            return float(values.get("value", 0.0))
        return 0.0

    load_summary = {
        "http_req_duration_ms": {
            "p95": values_for("http_req_duration").get("p(95)"),
            "p99": values_for("http_req_duration").get("p(99)"),
        },
        "http_req_failed_pct": round(rate_value("http_req_failed") * 100, 4),
        "custom_metrics": {},
    }

    for metric_name, metric_data in metrics.items():
        if metric_name.endswith("_latency_ms"):
            load_summary["custom_metrics"][metric_name] = {
                "p95": values_for(metric_name).get("p(95)"),
                "p99": values_for(metric_name).get("p(99)"),
            }
        elif metric_name.endswith("_fail_rate") or metric_name.endswith("_rate"):
            load_summary["custom_metrics"][metric_name] = {
                "rate_pct": round(rate_value(metric_name) * 100, 4),
            }

    return load_summary


def run_k6_suite(
    *,
    stamp: str,
    k6_bin: str,
    tradersapp_base_url: str,
    bff_base_url: str,
    ml_base_url: str,
) -> CheckResult:
    output_dir = REPO_ROOT / ".artifacts" / f"k6-slo-{stamp}"
    output_dir.mkdir(parents=True, exist_ok=True)

    summary_path = output_dir / "summary-contabo-public-edge.json"
    log_path = output_dir / "k6-contabo-public-edge.log"

    command = [
        k6_bin,
        "run",
        "tests/load/k6/contabo-public-edge.js",
        "--summary-export",
        str(summary_path),
    ]
    env = os.environ.copy()
    env.update(
        {
            "TRADERSAPP_BASE_URL": tradersapp_base_url,
            "BFF_BASE_URL": bff_base_url,
            "ML_BASE_URL": ml_base_url,
        }
    )

    try:
        completed = subprocess.run(
            command,
            cwd=REPO_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return CheckResult(
            ok=False,
            detail=f"k6 binary not found: {k6_bin}",
            data={"command": command},
        )
    except Exception as exc:  # noqa: BLE001
        return CheckResult(
            ok=False,
            detail=f"k6 run failed to start: {exc}",
            data={"command": command},
        )

    combined_output = (completed.stdout or "") + ("\n" if completed.stdout and completed.stderr else "") + (completed.stderr or "")
    log_path.write_text(combined_output, encoding="utf-8")

    data: dict[str, Any] = {
        "command": command,
        "exit_code": completed.returncode,
        "summary_path": str(summary_path.relative_to(REPO_ROOT)) if summary_path.exists() else None,
        "log_path": str(log_path.relative_to(REPO_ROOT)),
        "targets": {
            "tradersapp_base_url": tradersapp_base_url,
            "bff_base_url": bff_base_url,
            "ml_base_url": ml_base_url,
        },
    }

    summary_exists = summary_path.exists()
    thresholds_passed = completed.returncode == 0
    ok = summary_exists  # success = envelope captured; threshold breaches are recorded separately
    if thresholds_passed:
        detail = "k6 public-edge run completed"
    elif summary_exists:
        detail = f"k6 public-edge run recorded with threshold breaches (exit code {completed.returncode})"
    else:
        detail = f"k6 exited with code {completed.returncode}"

    if summary_path.exists():
        data["summary"] = parse_k6_summary(summary_path)
    else:
        data["summary_missing"] = True
    data["thresholds_passed"] = thresholds_passed

    return CheckResult(ok=ok, detail=detail, data=data)


def default_output_path() -> Path:
    return REPO_ROOT / ".artifacts" / "contabo" / f"public-readiness-{artifact_stamp()}.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify public Contabo deployment readiness.")
    parser.add_argument("--frontend-host", default=DEFAULT_FRONTEND_HOST, help="Frontend public host")
    parser.add_argument("--bff-host", default=DEFAULT_BFF_HOST, help="BFF public host")
    parser.add_argument("--api-host", default=DEFAULT_API_HOST, help="ML Engine public host")
    parser.add_argument(
        "--output",
        type=Path,
        default=default_output_path(),
        help="JSON report output path",
    )
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_SECONDS, help="HTTP timeout in seconds")
    parser.add_argument("--with-k6", action="store_true", help="Run the public-edge k6 suite after probes")
    parser.add_argument("--k6-bin", default=os.environ.get("K6_BIN", "k6"), help="k6 executable path")
    parser.add_argument("--print-json", action="store_true", help="Print the full JSON report")
    return parser.parse_args()


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    frontend_base_url = normalize_base_url(f"https://{args.frontend_host}")
    bff_base_url = normalize_base_url(f"https://{args.bff_host}")
    api_base_url = normalize_base_url(f"https://{args.api_host}")
    hosts = [args.frontend_host, args.bff_host, args.api_host]
    sample_candles = build_sample_candles()

    host_checks: dict[str, Any] = {}
    for host in hosts:
        dns = resolve_dns(host)
        tls = tls_probe(host, timeout=min(args.timeout, 10.0)) if dns.ok else CheckResult(
            ok=False,
            detail="Skipped: DNS failed",
            data={},
        )
        host_checks[host] = {
            "dns": asdict(dns),
            "tls": asdict(tls),
        }

    consensus_query = urlencode(
        {
            "session": "1",
            "symbol": "MNQ",
            "candles": json.dumps(sample_candles, separators=(",", ":")),
            "mathEngine": json.dumps(
                {
                    "amdPhase": "ACCUMULATION",
                    "vrRegime": "NORMAL",
                },
                separators=(",", ":"),
            ),
        }
    )
    endpoints = {
        "frontend_home": http_probe(f"{frontend_base_url}/", timeout=args.timeout),
        "frontend_edge_health": http_probe(f"{frontend_base_url}/edge-health", timeout=args.timeout),
        "bff_health": json_get_probe(f"{bff_base_url}/health", timeout=args.timeout, require_json_ok=True),
        "bff_ml_health": json_get_probe(f"{bff_base_url}/ml/health", timeout=args.timeout, require_json_ok=True),
        "bff_breaking_news": json_get_probe(
            f"{bff_base_url}/news/breaking?max=5",
            timeout=args.timeout,
            require_json_ok=True,
        ),
        "bff_consensus": json_get_probe(
            f"{bff_base_url}/ml/consensus?{consensus_query}",
            timeout=args.timeout,
            require_json_ok=True,
        ),
        "api_health": json_get_probe(f"{api_base_url}/health", timeout=args.timeout, require_json_ok=False),
        "api_predict": json_post_probe(
            f"{api_base_url}/predict",
            build_predict_payload(),
            timeout=max(args.timeout, 30.0),
            require_json_ok=False,
        ),
    }

    report = {
        "generated_at_utc": now_utc_iso(),
        "public_hosts": hosts,
        "hosts": host_checks,
        "targets": {
            "frontend_base_url": frontend_base_url,
            "bff_base_url": bff_base_url,
            "api_base_url": api_base_url,
        },
        "endpoints": {name: asdict(result) for name, result in endpoints.items()},
    }

    dns_ok = all(host_checks[host]["dns"]["ok"] for host in hosts)
    tls_ok = all(host_checks[host]["tls"]["ok"] for host in hosts)
    frontend_ok = endpoints["frontend_home"].ok and endpoints["frontend_edge_health"].ok
    bff_ok = endpoints["bff_health"].ok and endpoints["bff_ml_health"].ok
    ml_ok = endpoints["api_health"].ok and endpoints["api_predict"].ok
    deep_ok = endpoints["bff_breaking_news"].ok and endpoints["bff_consensus"].ok
    public_chain_ok = frontend_ok and bff_ok and ml_ok

    task_status: dict[str, Any] = {
        "contabo_dns_complete": {"ok": dns_ok},
        "contabo_tls_integrity": {"ok": tls_ok},
        "contabo_frontend_ready": {"ok": frontend_ok},
        "contabo_bff_ready": {"ok": bff_ok},
        "contabo_ml_ready": {"ok": ml_ok},
        "contabo_deep_route_ready": {"ok": deep_ok},
        "contabo_public_chain_ready": {"ok": public_chain_ok},
    }

    if args.with_k6:
        stamp = artifact_stamp()
        load_result = run_k6_suite(
            stamp=stamp,
            k6_bin=args.k6_bin,
            tradersapp_base_url=frontend_base_url,
            bff_base_url=bff_base_url,
            ml_base_url=api_base_url,
        )
        report["load_test"] = asdict(load_result)
        task_status["contabo_public_load_envelope_recorded"] = {
            "ok": load_result.ok,
            "thresholds_passed": load_result.data.get("thresholds_passed"),
        }
    else:
        report["load_test"] = {
            "ok": False,
            "detail": "Skipped: run with --with-k6 to capture the first public load envelope",
            "data": {},
        }
        task_status["contabo_public_load_envelope_recorded"] = {
            "ok": False,
            "note": "Run with --with-k6 after public DNS and health are live",
        }

    report["task_status"] = task_status
    return report


def main() -> int:
    args = parse_args()
    report = build_report(args)

    output_path: Path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    summary = report["task_status"]
    failed = [name for name, state in summary.items() if not state.get("ok")]
    print(f"Contabo public deployment report written: {output_path}")
    print(f"Checks passed: {len(summary) - len(failed)}/{len(summary)}")
    if failed:
        print("Failed or blocked:", ", ".join(failed))

    if args.print_json:
        print(json.dumps(report, indent=2))

    hard_failure_keys = {
        "contabo_dns_complete",
        "contabo_tls_integrity",
        "contabo_frontend_ready",
        "contabo_bff_ready",
        "contabo_ml_ready",
        "contabo_deep_route_ready",
        "contabo_public_chain_ready",
    }
    if args.with_k6:
        hard_failure_keys.add("contabo_public_load_envelope_recorded")

    hard_failures = [
        name
        for name, state in summary.items()
        if name in hard_failure_keys and not state.get("ok")
    ]
    return 1 if hard_failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
