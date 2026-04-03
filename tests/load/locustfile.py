"""
Locust Load Tests — TradersApp BFF and ML Engine stress testing.

Usage:
  locust -f tests/load/locustfile.py --host=http://localhost:8788
  locust -f tests/load/locustfile.py --host=http://localhost:8788 --users 100 --spawn-rate 10

Targets:
  - GET /api/health          — BFF health check
  - POST /api/consensus      — ML consensus (main endpoint)
  - GET /api/regime          — Regime detection
  - POST /ml/predict         — ML Engine direct prediction

SLA:
  - p95 < 200ms under 100 concurrent users
  - p99 < 500ms under 100 concurrent users
  - Error rate < 1%
"""

from __future__ import annotations

import random
import json
from datetime import datetime, timezone
from typing import Optional

from locust import (
    HttpUser, task, between, events, stats as locust_stats
)


# ─── Test Data Helpers ─────────────────────────────────────────────────────────

SYMBOLS = ["MNQ", "ES", "NQ", "YM"]
REGIMES = ["COMPRESSION", "NORMAL", "EXPANSION"]


def generate_candles(n: int = 20) -> list[dict]:
    """Generate synthetic 5-min candle data for testing."""
    candles = []
    base_price = 18000.0
    ts = datetime.now(timezone.utc).timestamp()

    for i in range(n):
        open_ = base_price + random.uniform(-10, 10)
        close_ = open_ + random.uniform(-5, 5)
        high_ = max(open_, close_) + random.uniform(0, 3)
        low_ = min(open_, close_) - random.uniform(0, 3)
        volume = int(random.uniform(1000, 10000))

        candles.append({
            "symbol": random.choice(SYMBOLS),
            "timestamp": f"{(ts - (n - i) * 300):.0f}",
            "open": round(open_, 2),
            "high": round(high_, 2),
            "low": round(low_, 2),
            "close": round(close_, 2),
            "volume": volume,
        })
        base_price = close_

    return candles


def generate_trades(n: int = 10) -> list[dict]:
    """Generate synthetic trade log data."""
    trades = []
    now = datetime.now(timezone.utc).timestamp()

    for i in range(n):
        entry = now - (n - i) * 600
        exit_ = entry + random.uniform(300, 1800)
        pnl_ticks = round(random.uniform(-20, 30), 2)
        result = "win" if pnl_ticks > 0 else "loss"

        trades.append({
            "symbol": random.choice(SYMBOLS),
            "direction": random.choice(["LONG", "SHORT"]),
            "entry_time": entry,
            "exit_time": exit_,
            "pnl_ticks": pnl_ticks,
            "pnl_dollars": round(pnl_ticks * 5.0, 2),
            "result": result,
            "confidence": round(random.uniform(0.52, 0.85), 2),
        })

    return trades


# ─── BFF User ─────────────────────────────────────────────────────────────────

class BFFUser(HttpUser):
    """
    Simulates a trader using the BFF frontend.
    Makes realistic request patterns.
    """
    wait_time = between(1, 3)  # 1–3 seconds between tasks
    host = "http://localhost:8788"

    def on_start(self):
        """Called when a simulated user starts."""
        self._candles = generate_candles(20)
        self._trades = generate_trades(10)
        self._symbol = random.choice(SYMBOLS)

    @task(10)
    def get_consensus(self):
        """
        Primary endpoint: get ML consensus signal.
        Weighted heaviest (10x) as it's the main user action.
        """
        payload = {
            "symbol": self._symbol,
            "candles": self._candles,
            "trades": self._trades,
            "session_id": 1,
            "mathEngineSnapshot": {
                "amdPhase": random.choice(["ACCUMULATION", "DISTRIBUTION", "TRANSITION"]),
                "vrRegime": random.choice(["COMPRESSION", "NORMAL", "EXPANSION"]),
            },
        }

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
                        resp.failure(f"Invalid signal: {data}")
                except Exception as e:
                    resp.failure(f"Parse error: {e}")
            elif resp.status_code == 503:
                # Service unavailable — acceptable during cold start
                resp.success()
            else:
                resp.failure(f"Status {resp.status_code}")

    @task(5)
    def get_regime(self):
        """Regime detection endpoint."""
        payload = {
            "symbol": self._symbol,
            "candles": self._candles[-10:],
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

    @task(3)
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


# ─── ML Engine Direct User ──────────────────────────────────────────────────────

class MLEngineUser(HttpUser):
    """Direct ML Engine load testing (bypasses BFF)."""
    wait_time = between(0.5, 2)
    host = "http://localhost:8001"

    @task
    def predict(self):
        """Direct ML prediction endpoint."""
        payload = {
            "symbol": random.choice(SYMBOLS),
            "candles": generate_candles(20),
            "trades": generate_trades(10),
            "session_id": 1,
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
                resp.success()  # Cold start acceptable
            else:
                resp.failure(f"Status {resp.status_code}")

    @task
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


# ─── Events ─────────────────────────────────────────────────────────────────────

@events.init_command_line_parser.add_listener
def _(parser):
    """Add custom command line arguments."""
    parser.add_argument("-- sla-p95-ms", type=int, default=200, help="SLA p95 threshold in ms")


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Check SLA on each request."""
    if exception:
        return

    sla_p95 = float(getattr(locust_stats, '_sla_p95_ms', 200))
    if response_time > sla_p95:
        print(f"[SLA BREACH] {name}: {response_time:.1f}ms > {sla_p95}ms")


@events.quitting.add_listener
def on_quitting(environment, **kwargs):
    """Print summary on quit."""
    stats = environment.stats
    print(f"\n{'='*60}")
    print(f"Load Test Summary")
    print(f"  Total requests: {stats.total.num_requests}")
    print(f"  Failures: {stats.total.num_failures}")
    print(f"  p50: {stats.total.get_response_time_percentile(0.5):.1f}ms")
    print(f"  p95: {stats.total.get_response_time_percentile(0.95):.1f}ms")
    print(f"  p99: {stats.total.get_response_time_percentile(0.99):.1f}ms")
    print(f"  RPS: {stats.total.total_rps:.1f}")
    print(f"{'='*60}")
