from __future__ import annotations

import argparse
import json
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_PAYLOAD = {
    "symbol": "MNQ",
    "candles": [
        {"symbol": "MNQ", "timestamp": "1712500000", "open": 18500.0, "high": 18505.0, "low": 18498.0, "close": 18503.0, "volume": 4200},
        {"symbol": "MNQ", "timestamp": "1712500300", "open": 18503.0, "high": 18508.5, "low": 18501.5, "close": 18507.0, "volume": 4350},
        {"symbol": "MNQ", "timestamp": "1712500600", "open": 18507.0, "high": 18512.0, "low": 18506.5, "close": 18510.5, "volume": 4510},
    ],
    "trades": [],
    "session_id": 1,
    "mathEngineSnapshot": {"amdPhase": "ACCUMULATION", "vrRegime": "NORMAL"},
}


def http_request(url: str, payload: dict | None = None, timeout: float = 10.0) -> tuple[int, str]:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method="POST" if payload is not None else "GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8", errors="replace")
        return response.status, body


def wait_for_health(url: str, timeout_seconds: int) -> None:
    deadline = time.time() + timeout_seconds
    last_error = "unknown"
    while time.time() < deadline:
        try:
            status, _ = http_request(url, timeout=3.0)
            if status == 200:
                return
            last_error = f"HTTP {status}"
        except Exception as exc:  # pragma: no cover - operational helper
            last_error = str(exc)
        time.sleep(2)
    raise RuntimeError(f"Timed out waiting for health at {url}: {last_error}")


def timed_post(url: str, payload: dict, timeout: float = 20.0) -> tuple[float, int, str]:
    started = time.perf_counter()
    status, body = http_request(url, payload=payload, timeout=timeout)
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    return elapsed_ms, status, body


def start_port_forward(namespace: str, service: str, local_port: int, remote_port: int) -> subprocess.Popen[str]:
    return subprocess.Popen(
        [
            "kubectl",
            "-n",
            namespace,
            "port-forward",
            f"svc/{service}",
            f"{local_port}:{remote_port}",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark cold-start and warm-request latency for TradersApp services.")
    parser.add_argument("--namespace", default="tradersapp-dev", help="Kubernetes namespace to target")
    parser.add_argument("--deployment", default="ml-engine", help="Deployment to restart before measuring")
    parser.add_argument("--service", default="ml-engine", help="Service name to port-forward if --base-url is omitted")
    parser.add_argument("--base-url", default="", help="Existing base URL to benchmark (skips port-forward)")
    parser.add_argument("--health-path", default="/health", help="Health path to poll before measuring")
    parser.add_argument("--endpoint", default="/predict", help="POST endpoint to benchmark")
    parser.add_argument("--local-port", type=int, default=8001, help="Local port for port-forward")
    parser.add_argument("--remote-port", type=int, default=8001, help="Remote service port for port-forward")
    parser.add_argument("--warm-requests", type=int, default=5, help="Number of warm requests after the first cold request")
    parser.add_argument("--timeout", type=int, default=180, help="Seconds to wait for rollout and health recovery")
    parser.add_argument("--max-cold-ms", type=float, default=2000.0, help="Fail if cold-start latency exceeds this threshold")
    parser.add_argument("--max-warm-p95-ms", type=float, default=500.0, help="Fail if warm-request p95 exceeds this threshold")
    parser.add_argument("--skip-restart", action="store_true", help="Measure current state without restarting the deployment")
    parser.add_argument("--output", default="", help="Optional path to write the JSON summary")
    args = parser.parse_args()

    if not args.skip_restart:
        subprocess.run(
            ["kubectl", "-n", args.namespace, "rollout", "restart", f"deployment/{args.deployment}"],
            check=True,
        )
        subprocess.run(
            ["kubectl", "-n", args.namespace, "rollout", "status", f"deployment/{args.deployment}", f"--timeout={args.timeout}s"],
            check=True,
        )

    port_forward = None
    try:
        base_url = args.base_url.rstrip("/")
        if not base_url:
            port_forward = start_port_forward(args.namespace, args.service, args.local_port, args.remote_port)
            base_url = f"http://127.0.0.1:{args.local_port}"

        wait_for_health(f"{base_url}{args.health_path}", args.timeout)

        cold_ms, cold_status, cold_body = timed_post(f"{base_url}{args.endpoint}", DEFAULT_PAYLOAD)
        warm_latencies: list[float] = []
        for _ in range(args.warm_requests):
            elapsed_ms, status, _ = timed_post(f"{base_url}{args.endpoint}", DEFAULT_PAYLOAD)
            if status != 200:
                raise RuntimeError(f"Warm request returned HTTP {status}")
            warm_latencies.append(elapsed_ms)

        warm_p95 = max(warm_latencies) if len(warm_latencies) < 2 else statistics.quantiles(warm_latencies, n=20)[18]
        summary = {
            "deployment": args.deployment,
            "service": args.service,
            "endpoint": args.endpoint,
            "cold_request_ms": round(cold_ms, 2),
            "cold_status": cold_status,
            "warm_request_ms": [round(value, 2) for value in warm_latencies],
            "warm_avg_ms": round(statistics.mean(warm_latencies), 2) if warm_latencies else 0.0,
            "warm_p95_ms": round(warm_p95, 2) if warm_latencies else 0.0,
            "max_cold_ms": args.max_cold_ms,
            "max_warm_p95_ms": args.max_warm_p95_ms,
            "pass": cold_status == 200 and cold_ms <= args.max_cold_ms and warm_p95 <= args.max_warm_p95_ms,
        }

        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print(json.dumps(summary, indent=2))

        if cold_status != 200:
            print(cold_body, file=sys.stderr)
            return 1
        if cold_ms > args.max_cold_ms or warm_p95 > args.max_warm_p95_ms:
            return 1
        return 0
    except urllib.error.HTTPError as exc:
        print(f"HTTP error during benchmark: {exc}", file=sys.stderr)
        return 1
    finally:
        if port_forward is not None:
            port_forward.terminate()
            try:
                port_forward.wait(timeout=5)
            except subprocess.TimeoutExpired:
                port_forward.kill()
                port_forward.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
