#!/usr/bin/env python3
"""
Read-only cache coherence checker for TODO 53.

What it does:
  1. Calls POST /cache/invalidate
  2. Repeats the target read endpoint sequentially and compares normalized
     responses
  3. Invalidates again and repeats the read concurrently across multiple
     workers

The checker is self-contained and configurable via BASE_URL.

Usage:
  python scripts/k8s/check-cache-coherence.py
  BASE_URL=http://localhost:8001 python scripts/k8s/check-cache-coherence.py
  python scripts/k8s/check-cache-coherence.py --base-url http://ml-engine:8001
  python scripts/k8s/check-cache-coherence.py --concurrency 8 --reads 6
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib import error, request


DEFAULT_BASE_URL = os.getenv("BASE_URL", "http://localhost:8001")
DEFAULT_INVALIDATE_PATH = "/cache/invalidate"
DEFAULT_READ_PATH = "/predict"
DEFAULT_TIMEOUT = 15.0


@dataclass(frozen=True)
class CheckResult:
    index: int
    status: int
    data: dict[str, Any] | None
    error: str | None = None


def build_payload() -> dict[str, Any]:
    """Build a deterministic request payload for the ML Engine read endpoint."""
    candles = []
    base = 18_500.0
    now = datetime.now(timezone.utc).timestamp()
    for i in range(20):
        open_price = base + (i % 5 - 2)
        close_price = open_price + (i % 3 - 1)
        high_price = max(open_price, close_price) + 1
        low_price = min(open_price, close_price) - 1
        candles.append(
            {
                "symbol": "MNQ",
                "timestamp": f"{(now - (20 - i) * 300):.0f}",
                "open": round(open_price, 2),
                "high": round(high_price, 2),
                "low": round(low_price, 2),
                "close": round(close_price, 2),
                "volume": 5_000 + i * 100,
            }
        )
        base = close_price

    return {
        "symbol": "MNQ",
        "candles": candles,
        "trades": [
            {
                "symbol": "MNQ",
                "direction": "LONG",
                "entry_time": now - 600,
                "exit_time": now - 100,
                "pnl_ticks": 5.0,
                "pnl_dollars": 25.0,
                "result": "win",
            }
        ],
        "session_id": 1,
        "mathEngineSnapshot": {
            "amdPhase": "ACCUMULATION",
            "vrRegime": "NORMAL",
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only cache coherence checker after /cache/invalidate."
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help="Base service URL (default: BASE_URL env var or http://localhost:8001)",
    )
    parser.add_argument(
        "--invalidate-path",
        default=DEFAULT_INVALIDATE_PATH,
        help="Cache invalidation path (default: /cache/invalidate)",
    )
    parser.add_argument(
        "--read-path",
        default=DEFAULT_READ_PATH,
        help="Endpoint to verify for coherence (default: /predict)",
    )
    parser.add_argument(
        "--reads",
        type=int,
        default=4,
        help="Number of sequential reads after invalidation (default: 4)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=6,
        help="Number of concurrent reads after the second invalidation (default: 6)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT,
        help="HTTP timeout in seconds per request (default: 15)",
    )
    parser.add_argument(
        "--settle-seconds",
        type=float,
        default=0.4,
        help="Delay after cache invalidation before reads (default: 0.4)",
    )
    return parser.parse_args()


def log(message: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")


def normalize_response(data: Any) -> Any:
    """Remove volatile transport/cache metadata and return a comparable object."""
    volatile_keys = {
        "request_id",
        "_latency_ms",
        "_cached",
        "_cache_age_ms",
        "cache_age_ms",
        "latency_ms",
        "generated_at",
        "served_at",
        "trace_id",
        "span_id",
    }

    if isinstance(data, dict):
        normalized: dict[str, Any] = {}
        for key in sorted(data):
            if key in volatile_keys:
                continue
            if key == "timing":
                continue
            normalized[key] = normalize_response(data[key])
        return normalized
    if isinstance(data, list):
        return [normalize_response(item) for item in data]
    return data


def http_json(base_url: str, method: str, path: str, payload: dict[str, Any] | None = None, timeout: float = DEFAULT_TIMEOUT) -> tuple[int, str]:
    url = base_url.rstrip("/") + path
    headers = {}
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")

    req = request.Request(url, data=body, headers=headers, method=method.upper())
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def json_or_error(body: str) -> tuple[dict[str, Any] | None, str | None]:
    try:
        return json.loads(body), None
    except Exception as exc:  # pragma: no cover - operational guard
        return None, f"response was not valid JSON: {exc}"


def ensure_ok(label: str, status: int, body: str) -> dict[str, Any]:
    if status < 200 or status >= 300:
        raise RuntimeError(f"{label} failed: HTTP {status} {body}")

    data, parse_error = json_or_error(body)
    if parse_error:
        raise RuntimeError(f"{label} failed: {parse_error}")
    assert data is not None
    return data


def invalidate_cache(base_url: str, path: str, timeout: float) -> None:
    status, body = http_json(base_url, "POST", path, payload={"pattern": "*"}, timeout=timeout)
    ensure_ok("cache invalidation", status, body)


def fetch_once(
    index: int,
    base_url: str,
    path: str,
    payload: dict[str, Any],
    timeout: float,
) -> CheckResult:
    try:
        status, body = http_json(base_url, "POST", path, payload=payload, timeout=timeout)
        data = ensure_ok(f"read #{index}", status, body)
        return CheckResult(index=index, status=status, data=data)
    except Exception as exc:  # pragma: no cover - operational guard
        return CheckResult(index=index, status=0, data=None, error=str(exc))


def signature(data: dict[str, Any]) -> str:
    return json.dumps(normalize_response(data), sort_keys=True, separators=(",", ":"))


def assert_coherent(results: list[CheckResult], phase: str) -> None:
    failures = [r for r in results if r.error]
    if failures:
        messages = "\n".join(f"  #{r.index}: {r.error}" for r in failures)
        raise RuntimeError(f"{phase} produced request failures:\n{messages}")

    if not results:
        raise RuntimeError(f"{phase} produced no responses")

    assert results[0].data is not None
    reference = signature(results[0].data)

    for result in results[1:]:
        assert result.data is not None
        current = signature(result.data)
        if current != reference:
            raise RuntimeError(
                f"{phase} incoherence detected at read #{result.index}\n"
                f"Reference: {reference}\n"
                f"Current:   {current}"
            )

    log(f"PASS: {phase} coherent across {len(results)} reads")


def run_sequential_reads(base_url: str, path: str, payload: dict[str, Any], reads: int, timeout: float) -> list[CheckResult]:
    results: list[CheckResult] = []
    for index in range(reads):
        result = fetch_once(index=index, base_url=base_url, path=path, payload=payload, timeout=timeout)
        results.append(result)
    return results


def run_concurrent_reads(
    base_url: str,
    path: str,
    payload: dict[str, Any],
    concurrency: int,
    timeout: float,
) -> list[CheckResult]:
    results: list[CheckResult] = []
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [
            executor.submit(fetch_once, index, base_url, path, payload, timeout)
            for index in range(concurrency)
        ]
        for future in as_completed(futures):
            results.append(future.result())
    return sorted(results, key=lambda item: item.index)


def main() -> int:
    args = parse_args()
    base_url = args.base_url.rstrip("/")
    payload = build_payload()

    log(f"Base URL: {base_url}")
    log(f"Invalidate path: {args.invalidate_path}")
    log(f"Read path: {args.read_path}")
    log("Mode: read-only HTTP checks only")

    health_status, health_body = http_json(base_url, "GET", "/health", timeout=args.timeout)
    if health_status != 200:
        raise RuntimeError(f"health check failed: HTTP {health_status} {health_body}")
    log("PASS: /health is reachable")

    log("Invalidating cache for sequential phase")
    invalidate_cache(base_url, args.invalidate_path, args.timeout)
    time.sleep(args.settle_seconds)

    sequential = run_sequential_reads(base_url, args.read_path, payload, args.reads, args.timeout)
    assert_coherent(sequential, "Sequential reads")
    if sequential[0].data is not None and sequential[0].data.get("_cached") is True:
        raise RuntimeError("First post-invalidation response was already cached")
    log("PASS: first post-invalidation response was fresh")

    log("Invalidating cache for concurrent phase")
    invalidate_cache(base_url, args.invalidate_path, args.timeout)
    time.sleep(args.settle_seconds)

    concurrent = run_concurrent_reads(
        base_url,
        args.read_path,
        payload,
        args.concurrency,
        args.timeout,
    )
    assert_coherent(concurrent, "Concurrent reads")

    log("Result: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
