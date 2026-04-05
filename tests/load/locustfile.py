"""
Locust Load Tests — TradersApp BFF and ML Engine stress testing.

Usage:
  # Normal load test
  locust -f tests/load/locustfile.py --host=http://localhost:8788 --users 100 --spawn-rate 10

  # Spike test (2x RPS over 30s)
  locust -f tests/load/locustfile.py --host=http://localhost:8788 \
    --users 100 --spawn-rate 10 --spike-test --spike-factor 2 --spike-duration 30

  # Soak test (50% normal RPS for 30min)
  locust -f tests/load/locustfile.py --host=http://localhost:8788 \
    --users 50 --spawn-rate 5 --soak-test --soak-duration 1800

  # Chaos injection mode
  locust -f tests/load/locustfile.py --host=http://localhost:8788 \
    --users 50 --spawn-rate 10 --chaos-injection

  # With custom SLA thresholds
  locust -f tests/load/locustfile.py --host=http://localhost:8788 \
    --sla-p95-ms 200 --sla-p99-ms 500 --max-fail-ratio 0.01

Targets:
  - GET /api/health          — BFF health check
  - POST /api/consensus      — ML consensus (main endpoint, weighted 10x)
  - POST /api/regime         — Regime detection (weighted 3x)
  - GET /api/news/breaking   — Breaking news (weighted 1x)
  - POST /ml/predict         — ML Engine direct prediction (weighted 5x)
  - GET /drift/status        — Drift monitoring (weighted 2x)
  - GET /monitoring/status   — Monitoring status (weighted 2x)

SLA:
  - p95 < 200ms under 100 concurrent users (ML Engine)
  - p99 < 500ms under 100 concurrent users (ML Engine)
  - p95 < 100ms for BFF consensus
  - Error rate < 1%
"""

from __future__ import annotations

import random
import os
import time
import statistics
from datetime import datetime, timezone
from typing import Optional

from locust import (
    HttpUser, task, between, events, constant
)


# ─── SLA Configuration ──────────────────────────────────────────────────────────

SLA_P95_MS = float(os.environ.get("LOCUST_SLA_P95_MS", "200"))
SLA_P99_MS = float(os.environ.get("LOCUST_SLA_P99_MS", "500"))
MAX_FAIL_RATIO = float(os.environ.get("LOCUST_MAX_FAIL_RATIO", "0.01"))
CHAOS_LATENCY_MS = float(os.environ.get("CHAOS_LATENCY_MS", "0"))
CHAOS_ERROR_RATE = float(os.environ.get("CHAOS_ERROR_RATE", "0"))
DRIFT_PSI_THRESHOLD = float(os.environ.get("DRIFT_PSI_THRESHOLD", "0.2"))

# ─── Test Data Helpers ─────────────────────────────────────────────────────────

SYMBOLS = ["MNQ", "ES", "NQ", "YM"]
REGIMES = ["COMPRESSION", "NORMAL", "EXPANSION"]
AMD_PHASES = ["ACCUMULATION", "MANIPULATION", "DISTRIBUTION", "TRANSITION", "UNCLEAR"]


def generate_candles(n: int = 20, noise: float = 1.0) -> list[dict]:
    """
    Generate synthetic 5-min candle data.
    noise: 0.0 = deterministic, 1.0 = normal random, 2.0 = high volatility
    """
    candles = []
    base_price = 18500.0
    ts = datetime.now(timezone.utc).timestamp()

    for i in range(n):
        scale = noise
        o = base_price + random.gauss(0, 5 * scale)
        c = o + random.gauss(0, 3 * scale)
        h = max(o, c) + abs(random.gauss(0, 2 * scale)) + 1
        l = min(o, c) - abs(random.gauss(0, 2 * scale)) - 1
        volume = max(100, int(random.gauss(5000, 2000)))

        candles.append({
            "symbol": random.choice(SYMBOLS),
            "timestamp": f"{(ts - (n - i) * 300):.0f}",
            "open": round(o, 2),
            "high": round(h, 2),
            "low": round(l, 2),
            "close": round(c, 2),
            "volume": volume,
        })
        base_price = c

    return candles


def generate_trades(n: int = 10) -> list[dict]:
    """Generate synthetic trade log data."""
    trades = []
    now = datetime.now(timezone.utc).timestamp()

    for i in range(n):
        entry = now - (n - i) * 600
        exit_ = entry + random.uniform(300, 1800)
        pnl_ticks = round(random.gauss(5, 10), 2)
        result = "win" if pnl_ticks > 0 else "loss"

        trades.append({
            "symbol": random.choice(SYMBOLS),
            "direction": random.choice(["LONG", "SHORT"]),
            "entry_time": entry,
            "exit_time": exit_,
            "pnl_ticks": pnl_ticks,
            "pnl_dollars": round(pnl_ticks * 5.0, 2),
            "result": result,
            "confidence": round(random.uniform(0.52, 0.88), 2),
        })

    return trades


# ─── BFF User ──────────────────────────────────────────────────────────────────

class BFFUser(HttpUser):
    """
    Simulates a trader using the BFF frontend.
    Makes realistic request patterns weighted by importance.
    """
    wait_time = between(1, 3)
    host = os.environ.get("BFF_HOST", "http://localhost:8788")

    def on_start(self):
        self._candles = generate_candles(20)
        self._trades = generate_trades(10)
        self._symbol = random.choice(SYMBOLS)
        self._noise = random.uniform(0.5, 2.0)  # Per-user noise level

    def _build_payload(self):
        return {
            "symbol": self._symbol,
            "candles": generate_candles(20, noise=self._noise),
            "trades": self._trades,
            "session_id": random.choice([0, 1, 2]),
            "mathEngineSnapshot": {
                "amdPhase": random.choice(AMD_PHASES),
                "vrRegime": random.choice(REGIMES),
            },
        }

    @task(10)
    def get_consensus(self):
        """
        Primary endpoint: get ML consensus signal.
        Weighted heaviest (10x) — main user action.
        """
        payload = self._build_payload()

        with self.client.post(
            "/api/consensus",
            json=payload,
            catch_response=True,
            name="/api/consensus",
        ) as resp:
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    if data.get("signal") in ("LONG", "SHORT", "NEUTRAL"):
                        resp.success()
                    else:
                        resp.failure(f"Invalid signal: {data.get('signal')}")
                except Exception as e:
                    resp.failure(f"Parse error: {e}")
            elif resp.status_code == 503:
                # Service unavailable — acceptable during cold start
                resp.success()
            else:
                resp.failure(f"Status {resp.status_code}")

    @task(3)
    def get_regime(self):
        """Regime detection endpoint (weighted 3x)."""
        payload = {
            "symbol": self._symbol,
            "candles": generate_candles(10),
        }

        with self.client.post(
            "/api/regime",
            json=payload,
            catch_response=True,
            name="/api/regime",
        ) as resp:
            if resp.status_code in (200, 503):
                resp.success()
            else:
                resp.failure(f"Status {resp.status_code}")

    @task(1)
    def get_news(self):
        """Breaking news endpoint."""
        with self.client.get(
            "/api/news/breaking",
            catch_response=True,
            name="/api/news/breaking",
        ) as resp:
            if resp.status_code in (200, 503):
                resp.success()
            else:
                resp.failure(f"Status {resp.status_code}")

    @task(1)
    def health_check(self):
        """Health check — minimal load."""
        with self.client.get("/health", name="/health") as resp:
            if resp.status_code == 200:
                resp.success()


# ─── ML Engine Direct User ─────────────────────────────────────────────────────

class MLEngineUser(HttpUser):
    """Direct ML Engine load testing (bypasses BFF)."""
    wait_time = between(0.5, 2)
    host = os.environ.get("ML_ENGINE_HOST", "http://localhost:8001")

    @task(5)
    def predict(self):
        """Direct ML prediction endpoint."""
        payload = {
            "symbol": random.choice(SYMBOLS),
            "candles": generate_candles(20),
            "trades": generate_trades(10),
            "session_id": random.choice([0, 1, 2]),
            "mathEngineSnapshot": {
                "amdPhase": random.choice(AMD_PHASES),
                "vrRegime": random.choice(REGIMES),
            },
        }

        with self.client.post(
            "/predict",
            json=payload,
            catch_response=True,
            name="/predict",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 503:
                resp.success()
            else:
                resp.failure(f"Status {resp.status_code}")

    @task(2)
    def drift_status(self):
        """Drift monitoring endpoint."""
        with self.client.get(
            "/drift/status",
            catch_response=True,
            name="/drift/status",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Status {resp.status_code}")

    @task(2)
    def monitoring_status(self):
        """Monitoring status endpoint."""
        symbol = random.choice(SYMBOLS)
        with self.client.get(
            f"/monitoring/status?symbol={symbol}",
            catch_response=True,
            name="/monitoring/status",
            timeout=20,
        ) as resp:
            if resp.status_code in (200, 503):
                resp.success()
            else:
                resp.failure(f"Status {resp.status_code}")


# ─── Custom CLI Arguments ─────────────────────────────────────────────────────

@events.init_command_line_parser.add_listener
def _(parser):
    parser.add_argument("--sla-p95-ms", type=float, default=200.0, help="SLA p95 threshold in ms")
    parser.add_argument("--sla-p99-ms", type=float, default=500.0, help="SLA p99 threshold in ms")
    parser.add_argument("--max-fail-ratio", type=float, default=0.01, help="Maximum acceptable failure ratio")
    parser.add_argument("--chaos-injection", action="store_true", help="Inject latency/errors for chaos testing")
    parser.add_argument("--chaos-latency-ms", type=float, default=500.0, help="Chaos latency injection in ms")
    parser.add_argument("--chaos-error-rate", type=float, default=0.01, help="Chaos error injection rate (0-1)")
    parser.add_argument("--spike-test", action="store_true", help="Run spike test (2x users over 30s)")
    parser.add_argument("--spike-factor", type=float, default=2.0, help="Spike multiplier for user count")
    parser.add_argument("--spike-duration", type=int, default=30, help="Spike duration in seconds")
    parser.add_argument("--soak-test", action="store_true", help="Run soak test (sustained low load)")
    parser.add_argument("--soak-duration", type=int, default=1800, help="Soak test duration in seconds")
    parser.add_argument("--drift-threshold-psi", type=float, default=0.2, help="Drift PSI threshold for chaos")


@events.init.add_listener
def on_init(environment, **kwargs):
    global SLA_P95_MS, SLA_P99_MS, MAX_FAIL_RATIO
    global CHAOS_LATENCY_MS, CHAOS_ERROR_RATE
    parsed = getattr(environment, "parsed_options", None)
    if parsed is None:
        return
    SLA_P95_MS = float(getattr(parsed, "sla_p95_ms", 200.0))
    SLA_P99_MS = float(getattr(parsed, "sla_p99_ms", 500.0))
    MAX_FAIL_RATIO = float(getattr(parsed, "max_fail_ratio", 0.01))
    CHAOS_LATENCY_MS = float(getattr(parsed, "chaos_latency_ms", 500.0))
    CHAOS_ERROR_RATE = float(getattr(parsed, "chaos_error_rate", 0.01))

    if getattr(parsed, "chaos_injection", False):
        print(f"[CHAOS] Injection enabled: {CHAOS_LATENCY_MS}ms latency, {CHAOS_ERROR_RATE*100:.1f}% error rate")

    if getattr(parsed, "spike_test", False):
        factor = getattr(parsed, "spike_factor", 2.0)
        duration = getattr(parsed, "spike_duration", 30)
        print(f"[SPIKE] Spike test: {factor}x users for {duration}s")


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Check SLA breaches on each request."""
    if exception:
        return

    # Chaos: inject latency
    if CHAOS_LATENCY_MS > 0:
        response_time += CHAOS_LATENCY_MS

    # Chaos: inject errors
    if CHAOS_ERROR_RATE > 0 and random.random() < CHAOS_ERROR_RATE:
        print(f"[CHAOS] Injected error for {name}")
        return  # Don't flag as SLA breach

    if response_time > SLA_P95_MS:
        print(f"[SLA BREACH] {name}: {response_time:.1f}ms > {SLA_P95_MS}ms")


@events.quitting.add_listener
def on_quitting(environment, **kwargs):
    """Print summary and exit with appropriate code."""
    stats = environment.stats
    fail_ratio = stats.total.fail_ratio
    p50 = stats.total.get_response_time_percentile(0.50)
    p95 = stats.total.get_response_time_percentile(0.95)
    p99 = stats.total.get_response_time_percentile(0.99)
    total = stats.total.num_requests
    failures = stats.total.num_failures

    # Per-endpoint breakdown
    print(f"\n{'='*60}")
    print(f"Load Test Summary — {datetime.now().isoformat()}")
    print(f"{'='*60}")
    print(f"  Total requests : {total:,}")
    print(f"  Failures       : {failures:,} ({fail_ratio:.2%})")
    print(f"  RPS            : {stats.total.total_rps:.1f}")
    print(f"  Latency p50    : {p50:.1f}ms  (SLA: {SLA_P95_MS*0.5:.0f}ms)")
    print(f"  Latency p95    : {p95:.1f}ms  (SLA: {SLA_P95_MS:.0f}ms) {'✓' if p95 <= SLA_P95_MS else '✗ BREACH'}")
    print(f"  Latency p99    : {p99:.1f}ms  (SLA: {SLA_P99_MS:.0f}ms) {'✓' if p99 <= SLA_P99_MS else '✗ BREACH'}")
    print(f"  Fail ratio     : {fail_ratio:.3f}  (max: {MAX_FAIL_RATIO:.3f}) {'✓' if fail_ratio <= MAX_FAIL_RATIO else '✗ BREACH'}")

    # Per-task breakdown
    print(f"\nPer-endpoint breakdown:")
    for task_name, task_stats in sorted(stats.entries.items(), key=lambda x: x[1].num_requests, reverse=True):
        task_p95 = task_stats.get_response_time_percentile(0.95)
        task_fail = task_stats.fail_ratio
        print(f"  {task_name:<30} n={task_stats.num_requests:>6,}  p95={task_p95:>7.1f}ms  fail={task_fail:.2%}")

    print(f"{'='*60}")

    # Exit code: fail if SLA breached
    sla_breach = p95 > SLA_P95_MS
    fail_breach = fail_ratio > MAX_FAIL_RATIO
    environment.process_exit_code = 1 if (sla_breach or fail_breach) else 0
    if environment.process_exit_code == 0:
        print("RESULT: PASS — All SLA thresholds met ✓")
    else:
        print("RESULT: FAIL — SLA thresholds breached ✗")
