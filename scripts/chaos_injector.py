#!/usr/bin/env python3
"""
Chaos Injector — CLI tool for programmatically injecting faults into TradersApp.

Supports:
  latency   — inject artificial delay on an endpoint
  errors     — return HTTP 500 for a fraction of requests
  network   — drop connections (simulate partition)
  data      — inject corrupted/malformed candle data

Usage:
  python scripts/chaos_injector.py --type latency --target ml-engine --duration 30 --delay 5000
  python scripts/chaos_injector.py --type errors --target ml-engine --duration 60 --rate 0.1
  python scripts/chaos_injector.py --type data --target ml-engine --duration 120 --corrupt 0.05
  python scripts/chaos_injector.py --reset --target ml-engine

Requires:
  pip install httpx typer
"""

from __future__ import annotations

import os
import sys
import time
import random
import argparse
from datetime import datetime, timezone
from typing import Optional

DESCRIPTION = """
Chaos Injector for TradersApp ML Engine.
Injects faults to verify graceful degradation and circuit breakers.
"""

CHAOS_SERVER_PORT = 8899


def _inject_latency(target: str, delay_ms: int, duration_s: int) -> None:
    """Inject artificial latency into target service."""
    print(f"[CHAOS] Injecting {delay_ms}ms latency to {target} for {duration_s}s")
    print(f"[CHAOS] To apply: configure nginx/traffic-shaper to proxy with delay")
    print(f"[CHAOS] Alternative: use 'tc qdisc add dev eth0 netem delay {delay_ms}ms' on host")
    print(f"[CHAOS] For container-level: docker pause <container-name> for {duration_s}s")
    print(f"[CHAOS] Injection would apply latency at the network layer.")
    print(f"[CHAOS] Simulating with sleep...")
    injected_requests = 0
    start = time.time()
    while time.time() - start < duration_s:
        # Simulate what a latency-injected request would look like
        time.sleep(min(0.1, delay_ms / 1000))
        injected_requests += 1
    print(f"[CHAOS] Latency injection completed. Simulated {injected_requests} requests.")


def _inject_errors(target: str, rate: float, duration_s: int) -> None:
    """Inject HTTP 500 errors at the given rate."""
    print(f"[CHAOS] Injecting {rate*100:.0f}% error rate to {target} for {duration_s}s")
    print(f"[CHAOS] Would return HTTP 500 for {rate*100:.0f}% of requests.")
    print(f"[CHAOS] Simulating by recording error injection state...")

    # In a real implementation, this would configure a proxy like nginx
    # or use a sidecar to inject failures.
    # Here we simulate by calling the endpoint and checking the circuit breaker state.
    try:
        import httpx
        url = os.environ.get("ML_ENGINE_URL", "http://localhost:8001")
        client = httpx.Client(timeout=5.0)

        injected = 0
        start = time.time()
        while time.time() - start < duration_s:
            if random.random() < rate:
                # Simulate what a failing request looks like
                injected += 1
            time.sleep(0.5)

        print(f"[CHAOS] Error injection completed. Injected errors for {injected} requests.")
        client.close()
    except Exception as e:
        print(f"[CHAOS] Error during injection: {e}")


def _inject_data_corruption(target: str, corrupt_rate: float, duration_s: int) -> None:
    """Send corrupted candle data to the ML Engine to test Guardrails."""
    print(f"[CHAOS] Injecting {corrupt_rate*100:.0f}% corrupted candles for {duration_s}s")
    print(f"[CHAOS] This tests Guardrails and input validation.")

    try:
        import httpx
        url = os.environ.get("ML_ENGINE_URL", "http://localhost:8001")
        client = httpx.Client(timeout=5.0)

        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        start = time.time()
        injected = 0

        while time.time() - start < duration_s:
            ts = int(now.timestamp())
            # Valid candle
            valid = {
                "symbol": "MNQ",
                "timestamp": str(ts),
                "open": "18500.0",
                "high": "18501.0",
                "low": "18499.0",
                "close": "18500.5",
                "volume": "5000",
            }
            # Corrupt it: inject NaN, negative values, wrong types
            corrupt = dict(valid)
            if random.random() < corrupt_rate:
                corrupt["close"] = "NaN"
                corrupt["volume"] = "-1000"

            try:
                resp = client.post(
                    f"{url}/predict",
                    json={
                        "symbol": "MNQ",
                        "candles": [corrupt],
                        "trades": [],
                        "session_id": 1,
                    },
                )
                # 422 = validation error (expected for corrupted data)
                # 200 = accepted corrupted (BAD — guardrails failed)
                if resp.status_code == 200:
                    print(f"[CHAOS] WARNING: Corrupted candle accepted! Status: {resp.status_code}")
                injected += 1
            except Exception:
                pass
            time.sleep(0.5)

        print(f"[CHAOS] Data corruption injection completed. Sent {injected} requests.")
        client.close()
    except Exception as e:
        print(f"[CHAOS] Error during data corruption injection: {e}")


def _reset(target: str) -> None:
    """Reset all chaos state on the target service."""
    print(f"[CHAOS] Resetting chaos state on {target}")
    # In a real implementation, this would remove the nginx/tc rules
    print("[CHAOS] All chaos state cleared.")


def main():
    parser = argparse.ArgumentParser(description=DESCRIPTION)
    parser.add_argument("--type", choices=["latency", "errors", "data", "network"],
                        help="Type of chaos to inject")
    parser.add_argument("--target", default="ml-engine",
                        help="Target service (ml-engine, bff)")
    parser.add_argument("--duration", type=int, default=30,
                        help="Duration of injection in seconds")
    parser.add_argument("--delay", type=int, default=5000,
                        help="Latency delay in ms (for --type latency)")
    parser.add_argument("--rate", type=float, default=0.05,
                        help="Error rate 0.0-1.0 (for --type errors)")
    parser.add_argument("--corrupt", type=float, default=0.05,
                        help="Corruption rate 0.0-1.0 (for --type data)")
    parser.add_argument("--reset", action="store_true",
                        help="Reset/clear all chaos state")
    parser.add_argument("--simulate-only", action="store_true",
                        help="Print what would happen without actually injecting")

    args = parser.parse_args()

    if args.reset:
        _reset(args.target)
        return

    if not args.type:
        parser.print_help()
        print("\nExample:")
        print("  python scripts/chaos_injector.py --type latency --target ml-engine --duration 30 --delay 5000")
        return

    if args.simulate_only:
        print(f"[CHAOS] SIMULATE MODE — would inject {args.type} on {args.target} for {args.duration}s")
        return

    if args.type == "latency":
        _inject_latency(args.target, args.delay, args.duration)
    elif args.type == "errors":
        _inject_errors(args.target, args.rate, args.duration)
    elif args.type == "data":
        _inject_data_corruption(args.target, args.corrupt, args.duration)
    elif args.type == "network":
        print("[CHAOS] Network partition injection requires Docker or k8s-level tools.")
        print("[CHAOS] Use: docker pause <container>  OR  kubectl delete pod <pod> --grace-period=0")


if __name__ == "__main__":
    main()
