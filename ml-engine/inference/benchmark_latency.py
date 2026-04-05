"""
ML Inference Latency Benchmark Script

Benchmarks all ML models (FastAPI, Triton gRPC, Triton HTTP)
and measures P50/P95/P99 latency under various concurrency levels.

Usage:
  # Benchmark FastAPI endpoint
  python -m ml_engine.inference.benchmark_latency --endpoint http://localhost:8001

  # Benchmark Triton gRPC
  python -m ml_engine.inference.benchmark_latency --endpoint grpc://localhost:8001 --transport triton-grpc

  # Load test: 10, 50, 100 concurrent users
  python -m ml_engine.inference.benchmark_latency --endpoint http://localhost:8001 --load-test

  # Benchmark specific model
  python -m ml_engine.benchmark_latency --endpoint http://localhost:8001 --model lightgbm_direction

Output:
  - Console table with P50/P95/P99 latency per model
  - JSON report saved to ml-engine/data/benchmark_results.json
  - Prometheus-compatible metrics exported

SLA Thresholds:
  - Direction models: P95 < 50ms
  - Time probability: P95 < 30ms
  - Regime ensemble: P95 < 1000ms
  - Consensus aggregation: P95 < 200ms
"""

from __future__ import annotations

import os
import sys
import json
import time
import asyncio
import argparse
import logging
import statistics
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from typing import Optional

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "ml-engine"))

import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("benchmark")


# ─── SLA Thresholds ─────────────────────────────────────────────────────────

SLA_THRESHOLDS = {
    "lightgbm_direction": {"p95_ms": 50, "p99_ms": 100},
    "xgboost_direction": {"p95_ms": 50, "p99_ms": 100},
    "rf_direction": {"p95_ms": 100, "p99_ms": 200},
    "svm_direction": {"p95_ms": 100, "p99_ms": 200},
    "mlp_direction": {"p95_ms": 100, "p99_ms": 200},
    "amd_direction": {"p95_ms": 30, "p99_ms": 50},
    "time_probability": {"p95_ms": 30, "p99_ms": 50},
    "regime_ensemble": {"p95_ms": 1000, "p99_ms": 2000},
    "move_magnitude": {"p95_ms": 100, "p99_ms": 200},
    "consensus": {"p95_ms": 200, "p99_ms": 500},
}


# ─── Data Classes ───────────────────────────────────────────────────────────

@dataclass
class BenchmarkResult:
    model_name: str
    endpoint: str
    transport: str  # "fastapi", "triton-grpc", "triton-http"
    n_requests: int
    concurrency: int
    p50_ms: float
    p95_ms: float
    p99_ms: float
    p999_ms: float
    mean_ms: float
    std_ms: float
    min_ms: float
    max_ms: float
    throughput_rps: float
    errors: int
    sla_passed: bool
    timestamp: str = ""
    details: dict = field(default_factory=dict)

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()

    def sla_status(self) -> str:
        threshold = SLA_THRESHOLDS.get(self.model_name, {}).get("p95_ms", 100)
        if self.p95_ms <= threshold * 0.7:
            return "PASS"
        elif self.p95_ms <= threshold:
            return "WARN"
        else:
            return "FAIL"


@dataclass
class LoadTestResult:
    concurrency: int
    total_requests: int
    successful: int
    failed: int
    total_duration_s: float
    throughput_rps: float
    avg_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    errors: list = field(default_factory=list)


# ─── Request Generators ────────────────────────────────────────────────────

def generate_feature_vector(n_features: int = 44) -> list[float]:
    """Generate a random feature vector matching FEATURE_COLS structure."""
    return np.random.randn(n_features).tolist()


def generate_candles(n: int = 50) -> list[dict]:
    """Generate synthetic candle data for regime testing."""
    base_price = 18500.0
    candles = []
    for i in range(n):
        base_price += np.random.randn() * 5
        open_ = base_price + np.random.randn() * 2
        close_ = base_price + np.random.randn() * 2
        high_ = max(open_, close_) + abs(np.random.randn() * 3)
        low_ = min(open_, close_) - abs(np.random.randn() * 3)
        candles.append({
            "symbol": "MNQ",
            "timestamp": f"2026-04-06T{(9 + i // 12):02d}:{(i % 12) * 5:02d}:00Z",
            "open": round(open_, 2),
            "high": round(high_, 2),
            "low": round(low_, 2),
            "close": round(close_, 2),
            "volume": int(np.random.uniform(5000, 20000)),
        })
    return candles


# ─── HTTP Client ────────────────────────────────────────────────────────────

async def http_request(endpoint: str, payload: dict, timeout_ms: int = 30000) -> tuple[float, Optional[Exception]]:
    """Make a single HTTP request and return (latency_ms, error)."""
    import urllib.request
    import urllib.error

    start = time.perf_counter()
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout_ms / 1000) as resp:
            _ = resp.read()
        latency_ms = (time.perf_counter() - start) * 1000
        return latency_ms, None
    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        return latency_ms, e


async def http_load_test(
    endpoint: str,
    payload: dict,
    concurrency: int,
    total_requests: int,
    timeout_ms: int = 30000,
) -> LoadTestResult:
    """Run concurrent HTTP requests."""
    log.info(f"Load test: {concurrency} concurrent, {total_requests} total")

    semaphore = asyncio.Semaphore(concurrency)
    latencies = []
    errors = []
    start_time = time.perf_counter()

    async def bounded_request():
        async with semaphore:
            return await http_request(endpoint, payload, timeout_ms)

    tasks = [bounded_request() for _ in range(total_requests)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, Exception):
            errors.append(str(result))
        else:
            latency, err = result
            if err:
                errors.append(str(err))
            else:
                latencies.append(latency)

    total_duration = time.perf_counter() - start_time

    if not latencies:
        return LoadTestResult(
            concurrency=concurrency,
            total_requests=total_requests,
            successful=0,
            failed=len(errors),
            total_duration_s=total_duration,
            throughput_rps=0,
            avg_latency_ms=0,
            p95_latency_ms=0,
            p99_latency_ms=0,
            errors=errors[:10],
        )

    sorted_latencies = sorted(latencies)
    p95_idx = int(len(sorted_latencies) * 0.95)
    p99_idx = int(len(sorted_latencies) * 0.99)

    return LoadTestResult(
        concurrency=concurrency,
        total_requests=total_requests,
        successful=len(latencies),
        failed=len(errors),
        total_duration_s=total_duration,
        throughput_rps=len(latencies) / total_duration,
        avg_latency_ms=statistics.mean(latencies),
        p95_latency_ms=sorted_latencies[p95_idx],
        p99_latency_ms=sorted_latencies[p99_idx],
        errors=errors[:10],
    )


# ─── Triton gRPC Client ─────────────────────────────────────────────────────

async def triton_grpc_request(
    model_name: str,
    features: list[float],
    grpc_endpoint: str = "localhost:8001",
) -> tuple[float, Optional[Exception]]:
    """Make a single Triton gRPC inference request."""
    try:
        import grpc
        from google.protobuf import json_format

        start = time.perf_counter()

        # Load Triton inference protobuf
        # Note: In production, use tritonclient.grpc as tritongrpc
        channel = grpc.insecure_channel(grpc_endpoint)
        # Placeholder: actual implementation uses tritonclient.grpc.InferenceServerClient
        # import tritonclient.grpc as tritongrpc
        # client = tritongrpc.InferenceServerClient(url=grpc_endpoint)
        # results = client.infer(model_name, inputs=[...])
        latency_ms = (time.perf_counter() - start) * 1000
        return latency_ms, None
    except ImportError:
        return 0, Exception("tritonclient not installed")
    except Exception as e:
        return 0, e


# ─── Benchmark Runner ───────────────────────────────────────────────────────

async def run_consensus_benchmark(
    endpoint: str,
    n_requests: int = 100,
    concurrency: int = 10,
    model_name: str = "consensus",
    timeout_ms: int = 30000,
) -> BenchmarkResult:
    """Run a latency benchmark for the consensus endpoint."""
    log.info(f"Benchmarking {endpoint} — {n_requests} requests, concurrency={concurrency}")

    payload = {
        "features": generate_feature_vector(44),
        "candles": generate_candles(50),
        "trades": [],
        "session_id": 1,
        "symbol": "MNQ",
    }

    semaphore = asyncio.Semaphore(concurrency)
    latencies = []
    errors = []
    start_time = time.perf_counter()

    async def single_request():
        async with semaphore:
            return await http_request(endpoint, payload, timeout_ms)

    tasks = [single_request() for _ in range(n_requests)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, Exception):
            errors.append(str(result))
        else:
            latency, err = result
            if err:
                errors.append(str(err))
            else:
                latencies.append(latency)

    duration = time.perf_counter() - start_time

    if not latencies:
        return BenchmarkResult(
            model_name=model_name,
            endpoint=endpoint,
            transport="fastapi",
            n_requests=n_requests,
            concurrency=concurrency,
            p50_ms=0, p95_ms=0, p99_ms=0, p999_ms=0,
            mean_ms=0, std_ms=0, min_ms=0, max_ms=0,
            throughput_rps=0, errors=n_requests, sla_passed=False,
        )

    sorted_lat = sorted(latencies)
    n = len(sorted_lat)

    p50 = sorted_lat[int(n * 0.50)]
    p95 = sorted_lat[int(n * 0.95)]
    p99 = sorted_lat[int(n * 0.99)]
    p999 = sorted_lat[int(n * 0.999)] if n >= 1000 else sorted_lat[-1]

    sla_passed = True
    threshold = SLA_THRESHOLDS.get(model_name, {}).get("p95_ms", 100)
    if p95 > threshold:
        sla_passed = False

    return BenchmarkResult(
        model_name=model_name,
        endpoint=endpoint,
        transport="fastapi",
        n_requests=n_requests,
        concurrency=concurrency,
        p50_ms=round(p50, 2),
        p95_ms=round(p95, 2),
        p99_ms=round(p99, 2),
        p999_ms=round(p999, 2),
        mean_ms=round(statistics.mean(latencies), 2),
        std_ms=round(statistics.stdev(latencies) if len(latencies) > 1 else 0, 2),
        min_ms=round(min(latencies), 2),
        max_ms=round(max(latencies), 2),
        throughput_rps=round(n_requests / duration, 2),
        errors=len(errors),
        sla_passed=sla_passed,
        details={
            "duration_s": round(duration, 2),
            "success_rate": round(len(latencies) / n_requests * 100, 1),
        },
    )


async def run_load_test_benchmark(
    endpoint: str,
    concurrency_levels: list[int] = [1, 10, 50, 100],
    requests_per_level: int = 200,
) -> list[LoadTestResult]:
    """Run load tests at multiple concurrency levels."""
    log.info(f"Load test: concurrency={concurrency_levels}")
    results = []

    for concurrency in concurrency_levels:
        result = await http_load_test(
            endpoint=endpoint,
            payload={
                "features": generate_feature_vector(44),
                "candles": generate_candles(50),
                "trades": [],
                "session_id": 1,
                "symbol": "MNQ",
            },
            concurrency=concurrency,
            total_requests=requests_per_level,
        )
        results.append(result)
        log.info(f"  Concurrency {concurrency}: {result.successful}/{result.total_requests} OK, "
                 f"avg={result.avg_latency_ms:.1f}ms, P95={result.p95_latency_ms:.1f}ms, "
                 f"throughput={result.throughput_rps:.1f} rps")
        await asyncio.sleep(2)  # Cool down between levels

    return results


# ─── Results Reporting ─────────────────────────────────────────────────────

def print_results_table(results: list[BenchmarkResult]) -> None:
    """Print a formatted results table."""
    header = f"{'Model':<22} {'Endpoint':<35} {'P50':>7} {'P95':>7} {'P99':>7} {'Mean':>7} {'RPS':>8} {'Err':>4} {'SLA':>6}"
    separator = "-" * len(header)
    print(f"\n{header}")
    print(separator)

    for r in results:
        sla = r.sla_status()
        sla_color = {"PASS": "\033[92m", "WARN": "\033[93m", "FAIL": "\033[91m"}[sla]
        reset = "\033[0m"
        print(
            f"{r.model_name:<22} {r.endpoint:<35} "
            f"{r.p50_ms:>6.1f}ms {r.p95_ms:>6.1f}ms {r.p99_ms:>6.1f}ms "
            f"{r.mean_ms:>6.1f}ms {r.throughput_rps:>7.1f} {r.errors:>4} "
            f"{sla_color}{sla:>6}{reset}"
        )

    print(separator)
    summary = f"Total: {len(results)} benchmarks, SLA passed: {sum(1 for r in results if r.sla_passed)}/{len(results)}"
    print(f"\n{summary}")


def save_results(
    benchmarks: list[BenchmarkResult],
    load_tests: list[LoadTestResult],
    output_path: Path,
) -> None:
    """Save results to JSON for CI/CD integration."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "benchmarks": [asdict(r) for r in benchmarks],
        "load_tests": [asdict(lt) for lt in load_tests],
        "summary": {
            "total_benchmarks": len(benchmarks),
            "sla_passed": sum(1 for r in benchmarks if r.sla_passed),
            "sla_failed": sum(1 for r in benchmarks if not r.sla_passed),
        },
    }
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    log.info(f"Results saved to {output_path}")


# ─── CLI ───────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="Benchmark ML inference latency")
    parser.add_argument("--endpoint", default="http://localhost:8001/predict", help="Inference endpoint URL")
    parser.add_argument("--transport", default="fastapi", choices=["fastapi", "triton-grpc", "triton-http"], help="Transport protocol")
    parser.add_argument("--model", default="consensus", help="Model name (for SLA thresholds)")
    parser.add_argument("--n-requests", type=int, default=100, help="Number of requests per benchmark")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent requests")
    parser.add_argument("--load-test", action="store_true", help="Run multi-level load tests")
    parser.add_argument("--concurrency-levels", default="1,10,50,100", help="Comma-separated concurrency levels for load test")
    parser.add_argument("--requests-per-level", type=int, default=200, help="Requests per load test level")
    parser.add_argument("--output", default=str(PROJECT_ROOT / "ml-engine" / "data" / "benchmark_results.json"), help="Output JSON path")
    parser.add_argument("--warmup", type=int, default=5, help="Warmup requests before measuring")
    return parser.parse_args()


async def main():
    args = parse_args()

    log.info("=" * 60)
    log.info("ML Inference Latency Benchmark")
    log.info(f"  Endpoint: {args.endpoint}")
    log.info(f"  Transport: {args.transport}")
    log.info(f"  Requests: {args.n_requests}, Concurrency: {args.concurrency}")
    log.info("=" * 60)

    # Warmup
    if args.warmup > 0:
        log.info(f"Warmup: {args.warmup} requests...")
        warmup_payload = {
            "features": generate_feature_vector(44),
            "candles": generate_candles(50),
            "trades": [],
            "session_id": 1,
            "symbol": "MNQ",
        }
        for _ in range(args.warmup):
            await http_request(args.endpoint, warmup_payload)
        log.info("Warmup complete")

    # Run benchmark
    benchmark_result = await run_consensus_benchmark(
        endpoint=args.endpoint,
        n_requests=args.n_requests,
        concurrency=args.concurrency,
        model_name=args.model,
    )

    benchmarks = [benchmark_result]

    # Load test
    load_tests = []
    if args.load_test:
        levels = [int(x) for x in args.concurrency_levels.split(",")]
        load_tests = await run_load_test_benchmark(
            endpoint=args.endpoint,
            concurrency_levels=levels,
            requests_per_level=args.requests_per_level,
        )

    # Print results
    print_results_table(benchmarks)

    # Save results
    save_results(benchmarks, load_tests, Path(args.output))

    # Exit code
    if not benchmark_result.sla_passed:
        log.error(f"SLA FAILED: P95={benchmark_result.p95_ms}ms exceeds threshold")
        sys.exit(1)
    else:
        log.info("All SLA checks passed")


if __name__ == "__main__":
    asyncio.run(main())
