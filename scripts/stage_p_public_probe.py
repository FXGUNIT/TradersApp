#!/usr/bin/env python3
"""Legacy Stage P public endpoint probe for free sslip.io / OCI flows.

This script performs deterministic checks for:
1) DNS resolution
2) TLS handshake and cert retrieval
3) HTTPS endpoint availability

It writes a timestamped JSON report for use in Stage P proof artifacts.

The active canonical public frontend is now https://tradergunit.pages.dev/.
"""

from __future__ import annotations

import argparse
import json
import socket
import ssl
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


FRONTEND_HOST = "173.249.18.14.sslip.io"
BFF_HOST = "bff.173.249.18.14.sslip.io"
ML_HOST = "api.173.249.18.14.sslip.io"
STAGING_HOST = "tradergunit.pages.dev"
REQUIRED_HOSTS = [FRONTEND_HOST, BFF_HOST, ML_HOST, STAGING_HOST]


@dataclass
class CheckResult:
    ok: bool
    detail: str
    data: dict[str, Any]


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def resolve_dns(host: str) -> CheckResult:
    try:
        info = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        return CheckResult(ok=False, detail=f"DNS resolution failed: {exc}", data={})

    addrs: list[str] = sorted({entry[4][0] for entry in info if entry and entry[4]})
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


def http_probe(url: str, timeout: float = 15.0) -> CheckResult:
    req = Request(url=url, method="GET")
    try:
        with urlopen(req, timeout=timeout) as resp:
            status = int(getattr(resp, "status", 0) or resp.getcode())
            final_url = getattr(resp, "url", url)
        ok = 200 <= status < 400
        detail = f"HTTP status {status}"
        if final_url != url:
            detail += f" (redirected to {final_url})"
        return CheckResult(ok=ok, detail=detail, data={"status": status, "final_url": final_url})
    except HTTPError as exc:
        return CheckResult(
            ok=False,
            detail=f"HTTP error {exc.code}: {exc.reason}",
            data={"status": exc.code, "reason": str(exc.reason)},
        )
    except URLError as exc:
        return CheckResult(ok=False, detail=f"URL error: {exc.reason}", data={"reason": str(exc.reason)})
    except Exception as exc:  # noqa: BLE001
        return CheckResult(ok=False, detail=f"Request failed: {exc}", data={"error": str(exc)})


def build_report() -> dict[str, Any]:
    hosts: dict[str, Any] = {}

    for host in REQUIRED_HOSTS:
        dns = resolve_dns(host)
        tls = tls_probe(host) if dns.ok else CheckResult(ok=False, detail="Skipped: DNS failed", data={})
        hosts[host] = {
            "dns": asdict(dns),
            "tls": asdict(tls),
        }

    endpoints = {
        "frontend_home": http_probe(f"https://{FRONTEND_HOST}/"),
        "frontend_health": http_probe(f"https://{FRONTEND_HOST}/health"),
        "bff_health": http_probe(f"https://{BFF_HOST}/health"),
        "ml_health": http_probe(f"https://{ML_HOST}/health"),
        "staging_home": http_probe(f"https://{STAGING_HOST}/"),
    }

    report = {
        "generated_at_utc": now_utc_iso(),
        "required_hosts": REQUIRED_HOSTS,
        "hosts": hosts,
        "endpoints": {name: asdict(result) for name, result in endpoints.items()},
    }

    dns_ok = all(hosts[h]["dns"]["ok"] for h in REQUIRED_HOSTS)
    tls_ok = all(hosts[h]["tls"]["ok"] for h in REQUIRED_HOSTS)
    p04_ok = endpoints["frontend_home"].ok and endpoints["frontend_health"].ok
    p05_ok = endpoints["bff_health"].ok
    p06_ok = endpoints["ml_health"].ok
    p07_ok = p04_ok and p05_ok and p06_ok

    report["task_status"] = {
        "P02_dns_complete": {"ok": dns_ok},
        "P03_tls_integrity": {"ok": tls_ok},
        "P04_frontend_public_deploy": {"ok": p04_ok},
        "P05_bff_public_deploy": {"ok": p05_ok},
        "P06_ml_public_deploy": {"ok": p06_ok},
        "P07_end_to_end_public_chain": {"ok": p07_ok},
        "P10_24x7_monitoring_ready": {"ok": False, "note": "Requires validated alert routing credentials"},
        "P11_observability_runtime_validation": {
            "ok": False,
            "note": "Requires live dashboard and telemetry backend access",
        },
    }

    return report


def default_output_path() -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return Path(".artifacts") / "stage-p" / f"public-readiness-{stamp}.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Probe public readiness for Stage P.")
    parser.add_argument(
        "--output",
        type=Path,
        default=default_output_path(),
        help="Path to write the JSON report (default: .artifacts/stage-p/public-readiness-<timestamp>.json)",
    )
    parser.add_argument(
        "--print-json",
        action="store_true",
        help="Print the full JSON report to stdout after writing.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report()

    output_path: Path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    summary = report["task_status"]
    failed = [name for name, state in summary.items() if not state.get("ok")]
    print(f"Stage P probe report written: {output_path}")
    print(f"Checks passed: {len(summary) - len(failed)}/{len(summary)}")
    if failed:
        print("Failed or blocked:", ", ".join(failed))

    if args.print_json:
        print(json.dumps(report, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
