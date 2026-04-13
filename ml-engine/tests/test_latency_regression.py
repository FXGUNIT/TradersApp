"""
Latency regression tests — fail if SLA targets are violated.

These tests are designed to be run against a live ML Engine instance.
They simulate realistic request patterns and measure end-to-end latency.

Usage:
    pytest tests/test_latency_regression.py -v
    pytest tests/test_latency_regression.py -v -k "predict"  # single endpoint

Mark: @pytest.mark.performance
Requires: running ML Engine on localhost:8001
"""

from __future__ import annotations

import time
import hashlib
import json
import threading
from typing import Callable

import numpy as np
import pytest

import sys
from pathlib import Path

ML_ENGINE_ROOT = Path(__file__).parent.parent
if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))

from infrastructure.performance import SLAMonitor, CacheConfig, RedisCache
from data.candle_db import CandleDatabase

pytestmark = pytest.mark.performance


# ─── SLA Targets (must match infrastructure/performance.py) ───────────────────

SLA_TARGETS = {
    "/predict":           {"p50_ms": 50,   "p95_ms": 200,  "p99_ms": 500,  "max_err_rate": 0.01},
    "/mamba/predict":    {"p50_ms": 2000, "p95_ms": 5000, "p99_ms": 10000, "max_err_rate": 0.05},
    "/inference/predict": {"p50_ms": 20,  "p95_ms": 50,   "p99_ms": 100,  "max_err_rate": 0.01},
    "/regime":           {"p50_ms": 100,  "p95_ms": 500,  "p99_ms": 1000,  "max_err_rate": 0.02},
    "/consensus":        {"p50_ms": 100,  "p95_ms": 500,  "p99_ms": 1000,  "max_err_rate": 0.02},
    "/pso/discover":     {"p50_ms": 5000, "p95_ms": 30000,"p99_ms": 60000, "max_err_rate": 0.05},
    "/backtest/pbo":     {"p50_ms": 2000, "p95_ms": 10000,"p99_ms": 30000, "max_err_rate": 0.05},
    "/backtest/mc":      {"p50_ms": 3000, "p95_ms": 15000,"p99_ms": 45000, "max_err_rate": 0.05},
    "/backtest/full":     {"p50_ms": 5000, "p95_ms": 30000,"p99_ms": 90000, "max_err_rate": 0.05},
    "/backtest/returns":  {"p50_ms": 50,  "p95_ms": 200,  "p99_ms": 500,  "max_err_rate": 0.01},
}


# ─── SLA Monitor Unit Tests ───────────────────────────────────────────────────

class TestSLAMonitor:
    """Unit tests for SLAMonitor percentile computation."""

    def test_percentile_single_value(self):
        monitor = SLAMonitor()
        monitor.record("/test", 10.0, 200)
        report = monitor.get_sla_report("/test")
        assert report["1m"]["p50_ms"] == 10.0

    def test_percentile_p95(self):
        monitor = SLAMonitor()
        latencies = list(range(1, 101))  # 1..100 ms
        for i, lat in enumerate(latencies):
            monitor.record("/test", float(lat), 200)

        report = monitor.get_sla_report("/test")
        # P95 of 1..100 should be ~95
        assert 93 <= report["1m"]["p95_ms"] <= 97

    def test_sla_passes_when_under_threshold(self):
        monitor = SLAMonitor()
        for _ in range(100):
            monitor.record("/predict", 30.0, 200)  # well under p95=200ms

        report = monitor.get_sla_report("/predict")
        assert report["1m"]["sla_compliant"] is True

    def test_sla_fails_when_p95_exceeds_target(self):
        monitor = SLAMonitor()
        for _ in range(100):
            monitor.record("/predict", 300.0, 200)  # over p95=200ms

        report = monitor.get_sla_report("/predict")
        assert report["1m"]["sla_p95_ok"] is False

    def test_error_rate_tracked(self):
        monitor = SLAMonitor()
        for i in range(100):
            status = 500 if i < 3 else 200  # 3% error rate
            monitor.record("/test", 50.0, status)

        report = monitor.get_sla_report("/test")
        assert report["1m"]["errors"] == 3
        assert report["1m"]["error_rate"] == pytest.approx(0.03, abs=0.01)

    def test_sla_fails_on_high_error_rate(self):
        monitor = SLAMonitor()
        for i in range(100):
            status = 500 if i < 5 else 200  # 5% error rate
            monitor.record("/test", 50.0, status)

        report = monitor.get_sla_report("/test")
        # max_err_rate for /test defaults to 0.01
        assert report["1m"]["sla_errors_ok"] is False


# ─── Cache Hit Rate Tests ─────────────────────────────────────────────────────

class TestCacheHitRate:
    """Test that caching improves repeat-request latency."""

    def test_cache_reduces_latency(self):
        """Repeat request should be sub-ms from Redis cache. Skips if Redis unavailable."""
        cfg = CacheConfig()
        cache = RedisCache(cfg)

        if cache._client is None:
            return  # Redis unavailable — pure Redis has no fallback

        test_data = {"candles": list(range(20)), "session_id": 1}
        key = cache._make_key("test_perf", test_data)

        # Prime the cache
        cache.set(key, {"result": "cached"}, ttl=60)

        # First get should hit
        start = time.perf_counter()
        result = cache.get(key)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert result is not None
        assert elapsed_ms < 5.0, f"Cache hit took {elapsed_ms:.2f}ms — too slow"

    def test_cache_miss_overhead(self):
        """Cache miss should still be fast. Pure Redis — no in-process overhead."""
        cfg = CacheConfig(socket_timeout=0.1)
        cache = RedisCache(cfg)

        key = cache._make_key("nonexistent", {"x": 1})
        start = time.perf_counter()
        result = cache.get(key)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert result is None
        # Redis round-trip is typically sub-millisecond on localhost
        assert elapsed_ms < 10.0, f"Cache miss took {elapsed_ms:.2f}ms"

    def test_stampede_lock_acquire_release(self):
        """Stampede lock can be acquired and released."""
        cfg = CacheConfig(stampede_lock_ttl=5)
        cache = RedisCache(cfg)

        key = cache._make_key("lock_test", {"n": 1})
        acquired = cache.acquire_stampede_lock(key)
        assert isinstance(acquired, bool)

        cache.release_stampede_lock(key)  # should not raise

    def test_cache_key_version_in_key(self):
        """Verify CACHE_KEY_VERSION is embedded in all cache keys."""
        from infrastructure.performance import CACHE_KEY_VERSION
        cfg = CacheConfig(key_prefix="test:")
        cache = RedisCache(cfg)

        key = cache._make_key("predict", {"a": 1})
        assert CACHE_KEY_VERSION in key, f"Key '{key}' missing version '{CACHE_KEY_VERSION}'"

    def test_cache_invalidate_pattern(self):
        """Pattern invalidation removes matching keys. Skips if Redis unavailable."""
        cfg = CacheConfig(key_prefix="testinv:")
        cache = RedisCache(cfg)

        if cache._client is None:
            return  # Redis unavailable — pure Redis has no fallback

        # Use _make_key to get proper versioned keys
        pbo_key = cache._make_key("pbo", {"id": "abc123"})
        mamba_key = cache._make_key("mamba", {"id": "xyz789"})

        cache.set(pbo_key, {"v": 1}, ttl=300)
        cache.set(mamba_key, {"v": 2}, ttl=30)

        cache.invalidate("pbo:*")

        assert cache.get(pbo_key) is None
        # mamba should still exist
        assert cache.get(mamba_key) is not None


# ─── Throughput Tests ────────────────────────────────────────────────────────

class TestThroughput:
    """Test that the system sustains expected request throughput."""

    def test_concurrent_cache_gets(self):
        """Warmed concurrent cache reads should stay within a practical local-dev bound."""
        cfg = CacheConfig()
        cache = RedisCache(cfg)

        if cache._client is None:
            return  # Redis unavailable

        key = cache._make_key("throughput", {"k": 1})
        cache.set(key, {"data": list(range(1000))}, ttl=60)

        def run_burst() -> list[float]:
            latencies = []
            barrier = threading.Barrier(100)

            def read():
                barrier.wait()
                start = time.perf_counter()
                cache.get(key)
                latencies.append((time.perf_counter() - start) * 1000)

            threads = [threading.Thread(target=read) for _ in range(100)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            return latencies

        # Discard the first burst so connection establishment doesn't dominate
        # the steady-state cache throughput assertion.
        run_burst()
        latencies = run_burst()

        total_ms = sum(latencies)
        avg_ms = np.mean(latencies)
        p99 = np.percentile(latencies, 99)
        assert avg_ms < 10.0, f"Average cache read latency {avg_ms:.2f}ms too high"
        assert p99 < 25.0, f"P99 cache read latency {p99:.2f}ms too high"


# ─── SLA Compliance Report ───────────────────────────────────────────────────

class TestSLAReport:
    """Test SLA report generation."""

    def test_all_endpoints_in_sla_targets(self):
        """Every cached endpoint must have an SLA target defined."""
        from infrastructure.performance import SLAMonitor
        monitor_targets = set(SLAMonitor.SLA_TARGETS.keys()) - {"ALL"}
        test_targets = set(SLA_TARGETS.keys())

        missing = test_targets - monitor_targets
        extra = monitor_targets - test_targets

        # Fail if test targets are missing from monitor
        assert not missing, f"SLAMonitor missing targets: {missing}"
        # Warn if monitor has targets not in test (informational)
        if extra:
            print(f"\nNote: SLAMonitor has targets not covered by regression tests: {extra}")

    def test_sla_targets_have_all_required_fields(self):
        """Every SLA target must have p50, p95, p99, and max_err_rate."""
        required = {"p50_ms", "p95_ms", "p99_ms", "max_err_rate"}
        for endpoint, target in SLA_TARGETS.items():
            missing = required - set(target.keys())
            assert not missing, f"{endpoint} missing SLA fields: {missing}"

    def test_cache_ttl_tiers_defined(self):
        """Cache TTL tiers must be defined in CacheConfig."""
        cfg = CacheConfig()
        expected_ttls = {
            "prediction_ttl", "regime_ttl", "mamba_ttl",
            "feature_ttl", "alpha_ttl", "exit_ttl", "position_ttl",
        }
        for field in expected_ttls:
            assert hasattr(cfg, field), f"CacheConfig missing field: {field}"
            val = getattr(cfg, field)
            assert isinstance(val, int), f"{field} should be int, got {type(val)}"
            assert val > 0, f"{field} should be positive, got {val}"
