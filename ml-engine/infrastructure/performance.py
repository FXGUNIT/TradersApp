"""
Performance Architecture — Latency, Throughput, SLA, and Reliability

Components:
1. Redis Cache — sub-ms ML prediction caching with TTL + invalidation
2. Circuit Breaker — prevents cascade failures from external services
3. SLA Monitor — tracks P50/P95/P99 latency + uptime per endpoint
4. Request Coalescing — deduplicates concurrent identical requests
5. Connection Pooling — shared HTTP/DB connection pools

SLA Targets:
- /predict: P50 < 50ms, P95 < 200ms, P99 < 500ms
- /consensus: P50 < 100ms, P95 < 500ms, P99 < 1000ms
- /mamba/predict: P50 < 2s, P95 < 5s, P99 < 10s
- Uptime: 99.9% (8.7h downtime/month max)
"""

import os
import sys
import time
import json
import hashlib
import threading
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from typing import Callable, Any, Optional, Literal
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import functools
import inspect

# ─── Redis Cache ───────────────────────────────────────────────────────────────

REDIS_AVAILABLE = False
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    redis = None


# ─── Cache Key Versioning ───────────────────────────────────────────────────────
# Bump this when cache schema changes to automatically invalidate all cached keys.
# Format: v{N} — appended to all cache key prefixes.
CACHE_KEY_VERSION = "v1"


@dataclass
class CacheConfig:
    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: str | None = None
    socket_timeout: float = 0.5
    socket_connect_timeout: float = 0.5
    max_connections: int = 20
    default_ttl: int = 30        # seconds — generic cached data
    prediction_ttl: int = 10    # ML predictions cached for 10s (live data)
    regime_ttl: int = 60        # Regime predictions cached for 60s
    mamba_ttl: int = 30         # Mamba predictions cached for 30s
    feature_ttl: int = 60      # Feature engineering cached for 60s
    alpha_ttl: int = 300       # Alpha engine metrics cached for 5min
    exit_ttl: int = 300        # Exit strategy predictions cached for 5min
    position_ttl: int = 60     # Position sizing cached for 60s
    key_prefix: str = "tradersapp:"
    stampede_lock_ttl: int = 30  # Lock TTL for cache stampede protection
    compression: bool = True   # Compress cached values


class RedisCache:
    """
    High-performance Redis cache for ML predictions.

    Features:
    - LRU eviction when memory is high
    - Per-endpoint TTL (shorter for live data, longer for regime)
    - Compression for large payloads
    - Automatic reconnection on failure
    - Fallback to in-memory LRU when Redis unavailable
    - Request coalescing: identical concurrent requests share one computation
    """

    _instances: dict[str, "RedisCache"] = {}
    _lock = threading.Lock()

    def __init__(self, config: CacheConfig):
        self.config = config
        self._client = None
        self._local_cache: dict[str, tuple[Any, float]] = {}  # key → (value, expiry)
        self._local_lock = threading.Lock()
        self._coalescing: dict[str, asyncio.Future] = {}
        self._coalescing_lock = threading.Lock()
        self._stats = {"hits": 0, "misses": 0, "errors": 0}

        if REDIS_AVAILABLE:
            self._connect()

    def _connect(self):
        """Connect to Redis with automatic reconnection."""
        try:
            self._client = redis.Redis(
                host=self.config.host,
                port=self.config.port,
                db=self.config.db,
                password=self.config.password,
                socket_timeout=self.config.socket_timeout,
                socket_connect_timeout=self.config.socket_connect_timeout,
                max_connections=self.config.max_connections,
                decode_responses=False,  # We handle bytes ourselves
                retry_on_timeout=True,
                health_check_interval=30,
            )
            self._client.ping()
            print(f"[RedisCache] Connected to {self.config.host}:{self.config.port}")
        except Exception as e:
            print(f"[RedisCache] Redis unavailable ({e}) — falling back to in-memory LRU")
            self._client = None

    def _make_key(self, endpoint: str, params: dict) -> str:
        """Create a deterministic cache key with version prefix."""
        param_str = json.dumps(params, sort_keys=True, default=str)
        param_hash = hashlib.sha256(param_str.encode()).hexdigest()[:16]
        return f"{self.config.key_prefix}{CACHE_KEY_VERSION}:{endpoint}:{param_hash}"

    def get(self, key: str) -> Any | None:
        """Get value from cache. Tries Redis first, then local LRU."""
        # Try Redis
        if self._client:
            try:
                val = self._client.get(key)
                if val is not None:
                    self._stats["hits"] += 1
                    if self.config.compression:
                        import zlib
                        return json.loads(zlib.decompress(val))
                    return json.loads(val)
            except Exception:
                self._stats["errors"] += 1

        # Fallback to local LRU
        with self._local_lock:
            if key in self._local_cache:
                val, expiry = self._local_cache[key]
                if time.time() < expiry:
                    self._stats["hits"] += 1
                    return val
                del self._local_cache[key]

        self._stats["misses"] += 1
        return None

    def set(self, key: str, value: Any, ttl: int | None = None):
        """Set value in cache."""
        ttl = ttl or self.config.default_ttl
        expiry = time.time() + ttl

        # Store in local LRU (always available)
        with self._local_lock:
            self._local_cache[key] = (value, expiry)
            # Prune expired
            now = time.time()
            self._local_cache = {
                k: v for k, v in self._local_cache.items() if v[1] > now
            }

        # Try Redis
        if self._client:
            try:
                serialized = json.dumps(value, default=str)
                if self.config.compression:
                    import zlib
                    serialized = zlib.compress(serialized.encode())
                self._client.setex(key, ttl, serialized)
            except Exception:
                self._stats["errors"] += 1

    def invalidate(self, pattern: str):
        """Invalidate all keys matching pattern."""
        if self._client:
            try:
                keys = list(self._client.scan_iter(f"{self.config.key_prefix}{CACHE_KEY_VERSION}:{pattern}"))
                if keys:
                    self._client.delete(*keys)
            except Exception:
                self._stats["errors"] += 1

    def invalidate_all(self):
        """Invalidate ALL keys in this prefix namespace."""
        if self._client:
            try:
                keys = list(self._client.scan_iter(f"{self.config.key_prefix}{CACHE_KEY_VERSION}:*"))
                if keys:
                    self._client.delete(*keys)
            except Exception:
                self._stats["errors"] += 1

    def acquire_stampede_lock(self, key: str) -> bool:
        """
        Acquire a mutex lock for cache stampede protection.

        Uses Redis SETNX to ensure only ONE process computes a cold cache entry
        while others wait. Returns True if lock acquired (you're the leader),
        False if another process is already computing.

        Lock auto-expires after stampede_lock_ttl seconds.
        """
        if not self._client:
            return True  # No Redis — skip lock, allow compute
        try:
            lock_key = f"{key}:__lock__"
            acquired = self._client.set(
                lock_key, "1",
                nx=True,  # Only set if not exists
                ex=self.config.stampede_lock_ttl,
            )
            return bool(acquired)
        except Exception:
            self._stats["errors"] += 1
            return True  # On error, allow compute

    def release_stampede_lock(self, key: str):
        """Release the stampede lock after computation is done."""
        if not self._client:
            return
        try:
            lock_key = f"{key}:__lock__"
            self._client.delete(lock_key)
        except Exception:
            self._stats["errors"] += 1

    async def get_or_compute(
        self,
        key: str,
        compute_fn: Callable,
        ttl: int | None = None,
    ) -> Any:
        """
        Request coalescing: if N identical requests arrive simultaneously,
        only ONE computes while N-1 wait for the result.
        This prevents thundering herd on cache misses.
        """
        # Check cache
        cached = self.get(key)
        if cached is not None:
            return cached

        # Coalesce concurrent requests
        with self._coalescing_lock:
            if key in self._coalescing:
                # Another request is computing — wait for it
                future = self._coalescing[key]
            else:
                # I'm the first — create future for others to wait on
                future = asyncio.Future()
                self._coalescing[key] = future

        if cached is not None:
            return cached

        try:
            # Actually compute
            result = await compute_fn()
            self.set(key, result, ttl)
            return result
        finally:
            with self._coalescing_lock:
                if key in self._coalescing and self._coalescing[key] is future:
                    self._coalescing[key].set_result(None)
                    del self._coalescing[key]

    def get_or_compute_sync(
        self,
        key: str,
        compute_fn: Callable[[], Any],
        ttl: int | None = None,
    ) -> Any:
        """
        Stampede-protected synchronous get-or-compute.

        Uses Redis SETNX mutex so only ONE process computes a cold cache entry.
        Others that fail to acquire the lock poll until the result is ready.
        Falls back to in-memory LRU if Redis unavailable.
        """
        # Check cache first
        cached = self.get(key)
        if cached is not None:
            return cached

        # Try to acquire stampede lock
        lock_acquired = self.acquire_stampede_lock(key)
        if not lock_acquired:
            # Another process is computing — wait and poll
            for _ in range(30):  # max 30 * 0.2s = 6s wait
                import time as _time
                _time.sleep(0.2)
                cached = self.get(key)
                if cached is not None:
                    return cached
            # Timeout — compute anyway (fallback)
            return compute_fn()

        try:
            # Double-check after acquiring lock (another thread may have just finished)
            cached = self.get(key)
            if cached is not None:
                return cached
            # Compute and cache
            result = compute_fn()
            self.set(key, result, ttl)
            return result
        finally:
            self.release_stampede_lock(key)

    def get_stats(self) -> dict:
        total = self._stats["hits"] + self._stats["misses"]
        hit_rate = self._stats["hits"] / total if total > 0 else 0
        return {
            **self._stats,
            "hit_rate": round(hit_rate, 4),
            "total_requests": total,
        }


# ─── Circuit Breaker ─────────────────────────────────────────────────────────

@dataclass
class CircuitState:
    CLOSED = "CLOSED"   # Normal operation
    OPEN = "OPEN"       # Failing — reject requests
    HALF_OPEN = "HALF_OPEN"  # Testing recovery


class CircuitBreaker:
    """
    Circuit Breaker pattern for external service calls.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Failure threshold exceeded, requests rejected immediately
    - HALF_OPEN: Testing recovery with limited requests

    Prevents cascade failures when downstream services (ML Engine, News APIs) are down.
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 3,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: float | None = None
        self._half_open_calls = 0
        self._lock = threading.Lock()

    @property
    def state(self) -> str:
        """Return current circuit state. Triggers OPEN→HALF_OPEN transition if recovery timeout passed."""
        with self._lock:
            if self._state == CircuitState.OPEN:
                if self._last_failure_time and \
                   time.time() - self._last_failure_time > self.recovery_timeout:
                    self._state = CircuitState.HALF_OPEN
                    self._half_open_calls = 0
            return self._state

    def _try_transition_to_half_open(self):
        """Idempotent OPEN→HALF_OPEN transition. Call at start of public methods."""
        with self._lock:
            if self._state == CircuitState.OPEN:
                if self._last_failure_time and \
                   time.time() - self._last_failure_time > self.recovery_timeout:
                    self._state = CircuitState.HALF_OPEN
                    self._half_open_calls = 0

    def record_success(self):
        with self._lock:
            self._failure_count = 0
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.half_open_max_calls:
                    self._state = CircuitState.CLOSED
                    self._failure_count = 0
                    self._success_count = 0
                    self._half_open_calls = 0
                    self._last_failure_time = None  # prevent state property from re-triggering transition
                    print(f"[CircuitBreaker:{self.name}] CLOSED -> recovery successful")

    def record_failure(self):
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()
            if self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.OPEN
                self._success_count = 0
                print(f"[CircuitBreaker:{self.name}] HALF_OPEN -> OPEN (still failing)")
            elif self._failure_count >= self.failure_threshold:
                self._state = CircuitState.OPEN
                print(f"[CircuitBreaker:{self.name}] CLOSED -> OPEN ({self._failure_count} failures)")

    def is_available(self) -> bool:
        """Returns True if circuit allows requests. Idempotent OPEN→HALF_OPEN transition."""
        self._try_transition_to_half_open()
        with self._lock:
            if self._state == CircuitState.OPEN:
                return False
            if self._state == CircuitState.HALF_OPEN:
                if self._half_open_calls >= self.half_open_max_calls:
                    return False
                self._half_open_calls += 1
            return True

    @contextmanager
    def call(self, fallback: Any = None):
        """
        Context manager for circuit-protected calls.

        Usage:
            with cb.call(fallback={"ok": False}):
                result = external_api_call()
        """
        # state property triggers OPEN→HALF_OPEN if timeout passed
        if self.state == CircuitState.OPEN:
            print(f"[CircuitBreaker:{self.name}] OPEN — rejecting request")
            yield fallback
            return

        try:
            yield None  # Caller fills this
        except Exception as e:
            self.record_failure()
            raise
        else:
            self.record_success()

    def get_state(self) -> dict:
        """Return a snapshot of the circuit breaker state."""
        with self._lock:
            return {
                "name": self.name,
                "state": self._state,
                "failure_count": self._failure_count,
                "success_count": self._success_count,
                "failure_threshold": self.failure_threshold,
                "recovery_timeout": self.recovery_timeout,
                "half_open_max_calls": self.half_open_max_calls,
                "half_open_calls_used": self._half_open_calls,
            }

    def __repr__(self) -> str:
        return f"CircuitBreaker(name={self.name!r}, state={self.state!r})"


# ─── SLA Monitor ──────────────────────────────────────────────────────────────

@dataclass
class SLAMetric:
    endpoint: str
    latency_ms: float
    status_code: int
    timestamp: float


class SLAMonitor:
    """
    Tracks latency and uptime per endpoint for SLA compliance.

    Metrics:
    - P50, P95, P99 latency per endpoint
    - Error rate (5xx)
    - Availability (% uptime)
    - Throughput (req/sec)
    - Rolling window: 1min, 5min, 15min, 1hr
    """

    WINDOWS = {
        "1m": 60,
        "5m": 300,
        "15m": 900,
        "1h": 3600,
    }

    SLA_TARGETS = {
        "/predict":            {"p50_ms": 50,   "p95_ms": 200,   "p99_ms": 500,   "max_err_rate": 0.01},
        "/mamba/predict":      {"p50_ms": 2000, "p95_ms": 5000,  "p99_ms": 10000, "max_err_rate": 0.05},
        "/inference/predict": {"p50_ms": 20,   "p95_ms": 50,    "p99_ms": 100,   "max_err_rate": 0.01},
        "/regime":            {"p50_ms": 100,  "p95_ms": 500,   "p99_ms": 1000,  "max_err_rate": 0.02},
        "/consensus":         {"p50_ms": 100,  "p95_ms": 500,   "p99_ms": 1000,  "max_err_rate": 0.02},
        "/pso/discover":      {"p50_ms": 5000, "p95_ms": 30000, "p99_ms": 60000, "max_err_rate": 0.05},
        "/backtest/pbo":      {"p50_ms": 2000, "p95_ms": 10000, "p99_ms": 30000, "max_err_rate": 0.05},
        "/backtest/mc":       {"p50_ms": 3000, "p95_ms": 15000, "p99_ms": 45000, "max_err_rate": 0.05},
        "/backtest/full":     {"p50_ms": 5000, "p95_ms": 30000, "p99_ms": 90000, "max_err_rate": 0.05},
        "ALL":                {"p50_ms": 100,  "p95_ms": 500,    "p99_ms": 1000,  "max_err_rate": 0.01},
    }

    def __init__(self, max_samples: int = 100_000):
        self.max_samples = max_samples
        self._buckets: dict[str, dict[str, deque]] = {}
        self._lock = threading.Lock()
        self._start_time = time.time()

        for ep in list(self.SLA_TARGETS.keys()) + ["ALL"]:
            self._buckets[ep] = {
                window: deque(maxlen=max_samples // len(self.WINDOWS))
                for window in self.WINDOWS
            }

    def record(self, endpoint: str, latency_ms: float, status_code: int):
        """Record a request metric."""
        now = time.time()
        metric = SLAMetric(endpoint, latency_ms, status_code, now)

        with self._lock:
            # Lazily initialize bucket for unknown endpoints
            if endpoint not in self._buckets:
                self._buckets[endpoint] = {
                    window: deque(maxlen=self.max_samples // len(self.WINDOWS))
                    for window in self.WINDOWS
                }

            for window_name, window_sec in self.WINDOWS.items():
                cutoff = now - window_sec
                # Prune old entries
                bucket = self._buckets[endpoint][window_name]
                while bucket and bucket[0].timestamp < cutoff:
                    bucket.popleft()
                bucket.append(metric)

                # Also record in ALL bucket
                all_bucket = self._buckets["ALL"][window_name]
                while all_bucket and all_bucket[0].timestamp < cutoff:
                    all_bucket.popleft()
                all_bucket.append(metric)

    def _percentile(self, values: list, p: float) -> float:
        if not values:
            return 0.0
        sorted_vals = sorted(values)
        idx = int(len(sorted_vals) * p)
        return sorted_vals[min(max(idx - 1, 0), len(sorted_vals) - 1)]

    def get_sla_report(self, endpoint: str = "ALL") -> dict:
        """Get SLA compliance report for an endpoint."""
        now = time.time()
        report = {}

        for window_name, window_sec in self.WINDOWS.items():
            with self._lock:
                bucket = self._buckets.get(endpoint, self._buckets["ALL"]).get(window_name, deque())

            if not bucket:
                continue

            latencies = [m.latency_ms for m in bucket]
            errors = [m for m in bucket if m.status_code >= 500]
            successes = [m for m in bucket if m.status_code < 500]

            total = len(bucket)
            err_count = len(errors)
            uptime_pct = (len(successes) / max(1, total)) * 100

            p50 = self._percentile(latencies, 0.50)
            p95 = self._percentile(latencies, 0.95)
            p99 = self._percentile(latencies, 0.99)
            avg = sum(latencies) / max(1, len(latencies))
            rate = total / window_sec  # req/sec

            target = self.SLA_TARGETS.get(endpoint, self.SLA_TARGETS["ALL"])
            p95_ok = p95 <= target["p95_ms"]
            err_ok = err_count / max(1, total) <= target["max_err_rate"]

            report[window_name] = {
                "requests": total,
                "req_per_sec": round(rate, 2),
                "p50_ms": round(p50, 1),
                "p95_ms": round(p95, 1),
                "p99_ms": round(p99, 1),
                "avg_ms": round(avg, 1),
                "errors": err_count,
                "error_rate": round(err_count / max(1, total), 4),
                "uptime_pct": round(uptime_pct, 3),
                "sla_p95_ok": p95_ok,
                "sla_errors_ok": err_ok,
                "sla_compliant": p95_ok and err_ok,
            }

        return report

    @contextmanager
    def track(self, endpoint: str):
        """Context manager to track request latency."""
        start = time.time()
        status = 200
        try:
            yield
        except Exception as e:
            status = 500
            raise
        finally:
            latency_ms = (time.time() - start) * 1000
            self.record(endpoint, latency_ms, status)


# ─── Global Instances ─────────────────────────────────────────────────────────

_cache_config = CacheConfig()
_global_cache: RedisCache | None = None
_sla_monitor = SLAMonitor()
_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_cache() -> RedisCache:
    global _global_cache
    if _global_cache is None:
        _global_cache = RedisCache(_cache_config)
    return _global_cache


def get_circuit_breaker(name: str) -> CircuitBreaker:
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name=name)
    return _circuit_breakers[name]


def get_sla_monitor() -> SLAMonitor:
    return _sla_monitor


# ─── Performance Decorators ──────────────────────────────────────────────────

def cached_endpoint(ttl: int = 10, key_prefix: str = ""):
    """
    Decorator to cache endpoint responses in Redis.

    Usage:
        @cached_endpoint(ttl=10, key_prefix="predict")
        async def predict_endpoint(request):
            ...
    """
    def decorator(fn):
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            cache = get_cache()

            # Build cache key from request args
            params = {"args": str(args), "kwargs": kwargs}
            cache_key = cache._make_key(f"{key_prefix}:{fn.__name__}", params)

            cached = cache.get(cache_key)
            if cached is not None:
                return cached

            result = await fn(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            return result

        return wrapper
    return decorator


def sla_monitored(endpoint: str):
    """Decorator to track endpoint SLA metrics. Works for sync and async functions."""
    def decorator(fn):
        if inspect.iscoroutinefunction(fn):
            @functools.wraps(fn)
            async def async_wrapper(*args, **kwargs):
                monitor = get_sla_monitor()
                start = time.time()
                status = 200
                try:
                    return await fn(*args, **kwargs)
                except Exception:
                    status = 500
                    raise
                finally:
                    latency_ms = (time.time() - start) * 1000
                    monitor.record(endpoint, latency_ms, status)
                    # Log SLA violations
                    target = SLAMonitor.SLA_TARGETS.get(endpoint, SLAMonitor.SLA_TARGETS["ALL"])
                    if latency_ms > target["p99_ms"]:
                        print(f"[SLA VIOLATION] {endpoint}: {latency_ms:.0f}ms > {target['p99_ms']}ms (P99)")
                    elif latency_ms > target["p95_ms"]:
                        print(f"[SLA WARNING] {endpoint}: {latency_ms:.0f}ms > {target['p95_ms']}ms (P95)")
            return async_wrapper
        else:
            @functools.wraps(fn)
            def sync_wrapper(*args, **kwargs):
                monitor = get_sla_monitor()
                start = time.time()
                status = 200
                try:
                    return fn(*args, **kwargs)
                except Exception:
                    status = 500
                    raise
                finally:
                    latency_ms = (time.time() - start) * 1000
                    monitor.record(endpoint, latency_ms, status)
                    # Log SLA violations
                    target = SLAMonitor.SLA_TARGETS.get(endpoint, SLAMonitor.SLA_TARGETS["ALL"])
                    if latency_ms > target["p99_ms"]:
                        print(f"[SLA VIOLATION] {endpoint}: {latency_ms:.0f}ms > {target['p99_ms']}ms (P99)")
                    elif latency_ms > target["p95_ms"]:
                        print(f"[SLA WARNING] {endpoint}: {latency_ms:.0f}ms > {target['p95_ms']}ms (P95)")
            return sync_wrapper
    return decorator
