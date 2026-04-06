#!/usr/bin/env python3
"""
Benchmark script for ML Engine Redis cache performance.

Measures:
1. Cache hit latency (Redis + local LRU)
2. Cache miss latency (fallback computation)
3. Stampede protection behavior under concurrent load
4. Throughput (req/sec) with various cache hit rates

Usage:
    python scripts/benchmark_cache.py
    python scripts/benchmark_cache.py --warm-cache   # pre-populate cache
    python scripts/benchmark_cache.py --redis-host localhost --redis-port 6379
"""

import argparse
import time
import json
import hashlib
import threading
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field

# Add ml-engine to path
import sys
from pathlib import Path

ML_ENGINE_ROOT = Path(__file__).parent.parent / "ml-engine"
if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))

from infrastructure.performance import RedisCache, CacheConfig, get_sla_monitor


@dataclass
class BenchmarkResult:
    name: str
    n_requests: int
    cache_hits: int = 0
    cache_misses: int = 0
    latencies_ms: list = field(default_factory=list)
    errors: int = 0

    @property
    def hit_rate(self) -> float:
        total = self.cache_hits + self.cache_misses
        return self.cache_hits / total if total > 0 else 0.0

    @property
    def p50_ms(self) -> float:
        if not self.latencies_ms:
            return 0.0
        return statistics.median(self.latencies_ms)

    @property
    def p95_ms(self) -> float:
        if not self.latencies_ms:
            return 0.0
        sorted_lat = sorted(self.latencies_ms)
        idx = int(len(sorted_lat) * 0.95)
        return sorted_lat[min(idx, len(sorted_lat) - 1)]

    @property
    def p99_ms(self) -> float:
        if not self.latencies_ms:
            return 0.0
        sorted_lat = sorted(self.latencies_ms)
        idx = int(len(sorted_lat) * 0.99)
        return sorted_lat[min(idx, len(sorted_lat) - 1)]

    def __str__(self) -> str:
        return (
            f"[{self.name}]\n"
            f"  Requests:      {self.n_requests}\n"
            f"  Hit rate:      {self.hit_rate:.1%}\n"
            f"  P50 latency:  {self.p50_ms:.3f}ms\n"
            f"  P95 latency:  {self.p95_ms:.3f}ms\n"
            f"  P99 latency:  {self.p99_ms:.3f}ms\n"
            f"  Errors:        {self.errors}\n"
        )


def benchmark_cache_get(cache: RedisCache, n: int, cache_hit: bool) -> BenchmarkResult:
    """Benchmark cache.get() for hit vs miss."""
    name = "cache_hit" if cache_hit else "cache_miss"

    # Set a key for hit testing
    test_key = cache._make_key("benchmark", {"scenario": name})

    if cache_hit:
        cache.set(test_key, {"data": list(range(1000))}, ttl=60)
    else:
        # Ensure key doesn't exist — use a unique key per run
        test_key = cache._make_key("benchmark_miss", {"run": time.time_ns()})

    latencies = []
    hits = 0
    misses = 0

    for _ in range(n):
        start = time.perf_counter()
        result = cache.get(test_key)
        elapsed_ms = (time.perf_counter() - start) * 1000
        latencies.append(elapsed_ms)

        if result is not None:
            hits += 1
        else:
            misses += 1

    return BenchmarkResult(
        name=name,
        n_requests=n,
        cache_hits=hits,
        cache_misses=misses,
        latencies_ms=latencies,
    )


def benchmark_concurrent_reads(cache: RedisCache, n_threads: int, n_requests: int) -> BenchmarkResult:
    """Simulate concurrent cache reads."""
    test_key = cache._make_key("concurrent", {"threaded": True})
    cache.set(test_key, {"data": list(range(100))}, ttl=300)

    latencies = []
    errors = []
    barrier = threading.Barrier(n_threads)

    def read():
        barrier.wait()  # synchronize thread start
        for _ in range(n_requests // n_threads):
            start = time.perf_counter()
            cache.get(test_key)
            elapsed_ms = (time.perf_counter() - start) * 1000
            latencies.append(elapsed_ms)

    threads = [threading.Thread(target=read) for _ in range(n_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    return BenchmarkResult(
        name=f"concurrent_{n_threads}threads",
        n_requests=n_requests,
        cache_hits=n_requests,
        cache_misses=0,
        latencies_ms=latencies,
        errors=len(errors),
    )


def benchmark_stampede_protection(cache: RedisCache, n_workers: int) -> dict:
    """
    Simulate cache stampede: n_workers all miss the cache simultaneously,
    only one should do the work, others should wait.
    """
    # Use a unique key to ensure cache miss
    unique_key = cache._make_key("stampede_test", {"id": time.time_ns()})

    results = {"workers_completed": 0, "errors": 0, "lock_acquired_by": None}
    results_lock = threading.Lock()
    compute_times = []
    compute_times_lock = threading.Lock()

    def worker(worker_id: int):
        # First, all workers try to get (they all miss)
        cached = cache.get(unique_key)
        if cached is not None:
            with results_lock:
                results["workers_completed"] += 1
            return

        # All workers try to acquire the stampede lock
        lock_acquired = cache.acquire_stampede_lock(unique_key)

        if lock_acquired:
            # This worker is the "leader" — it computes
            with results_lock:
                results["lock_acquired_by"] = worker_id

            start = time.perf_counter()
            # Simulate expensive computation
            time.sleep(0.1)
            compute_ms = (time.perf_counter() - start) * 1000

            with compute_times_lock:
                compute_times.append(compute_ms)

            # Cache the result
            cache.set(unique_key, {"computed": True}, ttl=30)
            cache.release_stampede_lock(unique_key)

        # Waiting workers should poll and get the cached result
        start = time.perf_counter()
        for _ in range(50):  # max 5s wait
            cached = cache.get(unique_key)
            if cached is not None:
                break
            time.sleep(0.1)
        wait_ms = (time.perf_counter() - start) * 1000

        with results_lock:
            results["workers_completed"] += 1

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(n_workers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Cleanup
    try:
        cache.release_stampede_lock(unique_key)
    except Exception:
        pass

    return results


def benchmark_throughput(cache: RedisCache, n_requests: int, n_threads: int) -> BenchmarkResult:
    """Benchmark requests/second throughput."""
    test_key = cache._make_key("throughput", {"batch": True})
    cache.set(test_key, {"payload": list(range(500))}, ttl=300)

    latencies = []
    errors = []
    errors_lock = threading.Lock()
    latencies_lock = threading.Lock()

    def batch_reads(batch_size: int):
        for _ in range(batch_size):
            start = time.perf_counter()
            try:
                cache.get(test_key)
            except Exception as e:
                with errors_lock:
                    errors.append(str(e))
            elapsed = (time.perf_counter() - start) * 1000
            with latencies_lock:
                latencies.append(elapsed)

    per_thread = n_requests // n_threads
    start_time = time.perf_counter()
    threads = [threading.Thread(target=batch_reads, args=(per_thread,)) for _ in range(n_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    wall_ms = (time.perf_counter() - start_time) * 1000

    return BenchmarkResult(
        name=f"throughput_{n_threads}threads_{n_requests}req",
        n_requests=n_requests,
        cache_hits=n_requests,
        cache_misses=0,
        latencies_ms=latencies,
        errors=len(errors),
    )


def print_banner(text: str):
    print(f"\n{'=' * 60}")
    print(f"  {text}")
    print(f"{'=' * 60}")


def main():
    parser = argparse.ArgumentParser(description="Benchmark ML Engine Redis cache")
    parser.add_argument("--redis-host", default="localhost")
    parser.add_argument("--redis-port", type=int, default=6379)
    parser.add_argument("--n-warmup", type=int, default=100, help="Warmup iterations")
    parser.add_argument("--n-benchmark", type=int, default=1000, help="Benchmark iterations")
    parser.add_argument("--n-threads", type=int, default=10, help="Concurrent threads")
    args = parser.parse_args()

    cfg = CacheConfig(host=args.redis_host, port=args.redis_port)
    cache = RedisCache(cfg)

    print_banner("ML Engine Cache Benchmark")
    print(f"Redis:      {args.redis_host}:{args.redis_port}")
    print(f"Connected:  {cache._client is not None}")
    print(f"Warmup:      {args.n_warmup}")
    print(f"Benchmark:  {args.n_benchmark} requests")
    print(f"Threads:    {args.n_threads}")

    # ── Warmup ────────────────────────────────────────────────────────────────
    print_banner("Warmup")
    warmup_key = cache._make_key("warmup", {"n": 0})
    cache.set(warmup_key, {"warmup": True}, ttl=60)
    for i in range(args.n_warmup):
        cache.set(warmup_key, {"warmup": i}, ttl=60)
        cache.get(warmup_key)
    print(f"  Done: {args.n_warmup} warmup iterations")

    # ── Benchmark 1: Cache hit ──────────────────────────────────────────────
    print_banner("Benchmark 1: Cache Hit")
    r_hit = benchmark_cache_get(cache, args.n_benchmark, cache_hit=True)
    print(r_hit)

    # ── Benchmark 2: Cache miss ─────────────────────────────────────────────
    print_banner("Benchmark 2: Cache Miss")
    r_miss = benchmark_cache_get(cache, args.n_benchmark, cache_hit=False)
    print(r_miss)

    # ── Benchmark 3: Concurrent reads ───────────────────────────────────────
    print_banner(f"Benchmark 3: Concurrent Reads ({args.n_threads} threads)")
    r_concurrent = benchmark_concurrent_reads(cache, args.n_threads, args.n_benchmark)
    print(r_concurrent)

    # ── Benchmark 4: Throughput ─────────────────────────────────────────────
    print_banner(f"Benchmark 4: Throughput ({args.n_threads} threads, {args.n_benchmark} requests)")
    r_throughput = benchmark_throughput(cache, args.n_benchmark, args.n_threads)
    print(r_throughput)
    req_per_sec = args.n_benchmark / (sum(r_throughput.latencies_ms) / 1000 / args.n_threads)
    print(f"  Effective throughput: ~{req_per_sec:.0f} req/sec")

    # ── Benchmark 5: Stampede protection ──────────────────────────────────
    print_banner(f"Benchmark 5: Stampede Protection ({args.n_threads} workers)")
    stampede = benchmark_stampede_protection(cache, args.n_threads)
    print(f"  Workers completed: {stampede['workers_completed']}/{args.n_threads}")
    print(f"  Lock acquired by:  worker-{stampede['lock_acquired_by']}")
    print(f"  Leader compute:    {stampede.get('leader_compute_ms', 'N/A')}")

    # ── Summary ─────────────────────────────────────────────────────────────
    print_banner("Summary")
    print(f"  Cache hit P50:     {r_hit.p50_ms:.4f}ms")
    print(f"  Cache miss P50:    {r_miss.p50_ms:.4f}ms")
    print(f"  Speedup (hit/miss): {r_miss.p50_ms / r_hit.p50_ms:.1f}x faster")
    print(f"  Redis available:   {cache._client is not None}")
    print(f"  Cache hit rate:    {r_hit.hit_rate:.1%}")
    print(f"  Stats: {cache.get_stats()}")


if __name__ == "__main__":
    main()
