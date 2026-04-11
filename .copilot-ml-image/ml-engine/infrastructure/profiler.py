"""
Performance Profiler — latency breakdown and CPU profiling for ML Engine.

Provides:
1. Endpoint profiling middleware (cProfile per-request)
2. Decorator @profile_endpoint for profiling specific functions
3. Optional Pyroscope integration (set PYROSCOPE_ENDPOINT env var)
4. Periodic profiling snapshot saved to disk for offline analysis

Usage:
    # Enable cProfile profiling (saves to profiles/)
    PYROSCOPE_ENABLED=true python -m uvicorn main:app --port 8001

    # Enable Pyroscope (sends to Pyroscope server)
    PYROSCOPE_ENDPOINT=http://localhost:4040 python -m uvicorn main:app --port 8001

    # Profile specific function
    from infrastructure.profiler import profile_function
    @profile_function("my expensive calc")
    def my_func(): ...
"""

from __future__ import annotations

import os
import sys
import time
import cProfile
import pstats
import io
import threading
import functools
import tracemalloc
from pathlib import Path
from typing import Callable, Any
from datetime import datetime

# ─── Configuration ────────────────────────────────────────────────────────────

PYROSCOPE_AVAILABLE = False
try:
    import pyroscope
    PYROSCOPE_AVAILABLE = True
except ImportError:
    pyroscope = None


PROFILER_ENABLED = os.getenv("PROFILER_ENABLED", "false").lower() in ("true", "1", "yes")
PYROSCOPE_ENDPOINT = os.getenv("PYROSCOPE_ENDPOINT", "")
PYROSCOPE_APP_NAME = os.getenv("PYROSCOPE_APP_NAME", "tradersapp-ml-engine")
PROFILE_DIR = Path(os.getenv("PROFILE_DIR", "profiles"))
PROFILE_THRESHOLD_MS = float(os.getenv("PROFILE_THRESHOLD_MS", "100"))  # profile if > 100ms

# Create profile output directory only when profiling is enabled (requires writable fs)
if PROFILER_ENABLED:
    PROFILE_DIR.mkdir(exist_ok=True)


# ─── Pyroscope Init ────────────────────────────────────────────────────────────

def _init_pyroscope():
    """Initialize Pyroscope if configured and available."""
    if not PYROSCOPE_AVAILABLE or not PYROSCOPE_ENDPOINT:
        return
    try:
        pyroscope.configure(
            application_name=PYROSCOPE_APP_NAME,
            server_address=PYROSCOPE_ENDPOINT,
            sample_rate=100,  # 100 Hz
            detect_subprocesses=False,
            logging_level=0,
        )
        print(f"[Profiler] Pyroscope enabled → {PYROSCOPE_ENDPOINT}")
    except Exception as e:
        print(f"[Profiler] Pyroscope init failed: {e}")


# ─── cProfile-based Profiler ─────────────────────────────────────────────────

class EndpointProfiler:
    """
    Per-request profiler using cProfile.
    Saves profiles for slow requests (> PROFILE_THRESHOLD_MS) to disk.
    """

    _profiler: cProfile.Profile | None = None
    _lock = threading.Lock()

    def __init__(self, endpoint: str, threshold_ms: float = PROFILE_THRESHOLD_MS):
        self.endpoint = endpoint
        self.threshold_ms = threshold_ms
        self.start_time = 0.0
        self.profiler: cProfile.Profile | None = None

    def __enter__(self):
        self.start_time = time.perf_counter()
        if PROFILER_ENABLED:
            self.profiler = cProfile.Profile()
            self.profiler.enable()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        elapsed_ms = (time.perf_counter() - self.start_time) * 1000

        if self.profiler is not None:
            self.profiler.disable()

            # Only save if above threshold
            if elapsed_ms > self.threshold_ms:
                self._save_profile(elapsed_ms)

        # Tag Pyroscope frame
        if PYROSCOPE_AVAILABLE and PYROSCOPE_ENDPOINT:
            try:
                frame_label = f"{self.endpoint}"
                # pyroscope adds a frame label — just a no-op if not in a span
            except Exception:
                pass

    def _save_profile(self, elapsed_ms: float):
        """Save cProfile stats to disk for offline analysis."""
        try:
            import os as _os
            ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            filename = PROFILE_DIR / f"{self.endpoint.lstrip('/').replace('/', '_')}_{ts}.prof"
            self.profiler.dump_stats(str(filename))

            # Also generate a summary
            s = io.StringIO()
            stats = pstats.Stats(self.profiler, stream=s)
            stats.sort_stats("cumulative")
            stats.print_stats(20)
            summary = s.getvalue()

            summary_file = PROFILE_DIR / f"{self.endpoint.lstrip('/').replace('/', '_')}_{ts}_summary.txt"
            summary_file.write_text(
                f"Endpoint: {self.endpoint}\n"
                f"Duration: {elapsed_ms:.1f}ms\n"
                f"Threshold: {self.threshold_ms}ms\n"
                f"Profile: {filename}\n\n"
                f"{summary[:3000]}"
            )
            print(f"[Profiler] Slow request saved: {summary_file.name} ({elapsed_ms:.0f}ms)")
        except Exception as e:
            print(f"[Profiler] Failed to save profile: {e}")


def profile_endpoint(endpoint: str, threshold_ms: float = PROFILE_THRESHOLD_MS):
    """
    Decorator to profile a FastAPI endpoint.

    Usage:
        @app.get("/predict")
        @profile_endpoint("/predict", threshold_ms=50)
        async def predict():
            ...
    """
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            with EndpointProfiler(endpoint, threshold_ms):
                return await fn(*args, **kwargs)
        return wrapper
    return decorator


# ─── Memory Profiler ──────────────────────────────────────────────────────────

class MemorySnapshot:
    """Take a memory snapshot around a function call."""

    def __init__(self, label: str = ""):
        self.label = label
        self.start_mb = 0.0
        self.peak_mb = 0.0

    def __enter__(self):
        if not tracemalloc.is_tracing():
            tracemalloc.start()
        self.start_mb = tracemalloc.get_traced_memory()[0] / 1024 / 1024
        return self

    def __exit__(self, *args):
        current, peak = tracemalloc.get_traced_memory()
        self.peak_mb = peak / 1024 / 1024
        delta = self.peak_mb - self.start_mb
        if delta > 1.0:  # Only log if > 1MB
            print(f"[Memory] {self.label}: +{delta:.1f}MB (peak {self.peak_mb:.1f}MB)")

    def get_snapshot(self) -> dict:
        """Return memory snapshot as dict."""
        current, peak = tracemalloc.get_traced_memory()
        return {
            "label": self.label,
            "current_mb": round(current / 1024 / 1024, 2),
            "peak_mb": round(peak / 1024 / 1024, 2),
        }


# ─── Latency Breakdown ────────────────────────────────────────────────────────

class LatencyBreakdown:
    """
    Break down request latency into components.
    Usage:
        with LatencyBreakdown("predict") as lb:
            lb.start("redis_fetch")
            data = cache.get(key)
            lb.end("redis_fetch")

            lb.start("model_inference")
            result = predictor.predict(data)
            lb.end("model_inference")
    """

    def __init__(self, operation: str):
        self.operation = operation
        self._starts: dict[str, float] = {}
        self._durations: dict[str, float] = {}
        self._lock = threading.Lock()

    def start(self, component: str):
        with self._lock:
            self._starts[component] = time.perf_counter()

    def end(self, component: str):
        with self._lock:
            if component in self._starts:
                elapsed = (time.perf_counter() - self._starts[component]) * 1000
                self._durations[component] = elapsed
                del self._starts[component]

    def get_report(self) -> dict:
        total = sum(self._durations.values())
        return {
            "operation": self.operation,
            "total_ms": round(total, 2),
            "components": {
                k: round(v, 3) for k, v in sorted(
                    self._durations.items(), key=lambda x: -x[1]
                )
            },
            "unaccounted_ms": None,  # total wall time - sum of components
        }


# ─── Global Initialization ────────────────────────────────────────────────────

def init_profiler():
    """Call once at app startup to initialize profiler."""
    if PYROSCOPE_AVAILABLE and PYROSCOPE_ENDPOINT:
        _init_pyroscope()
    if PROFILER_ENABLED:
        print(f"[Profiler] cProfile enabled (threshold: {PROFILE_THRESHOLD_MS}ms)")
        print(f"[Profiler] Profiles saved to: {PROFILE_DIR.absolute()}")
    if tracemalloc.is_tracing():
        tracemalloc.stop()
        tracemalloc.start()


# ─── Convenience decorator ────────────────────────────────────────────────────

def profile_function(label: str = ""):
    """
    Decorator to profile a single function with cProfile.

    Usage:
        @profile_function("expensive_calculation")
        def my_function():
            ...
    """
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def sync_wrapper(*args, **kwargs):
            pr = cProfile.Profile()
            pr.enable()
            try:
                return fn(*args, **kwargs)
            finally:
                pr.disable()
                if PROFILER_ENABLED:
                    s = io.StringIO()
                    stats = pstats.Stats(pr, stream=s)
                    stats.sort_stats("cumulative")
                    stats.print_stats(10)
                    print(f"\n[Profiler] {label or fn.__name__}:\n{s.getvalue()[:500]}")

        @functools.wraps(fn)
        async def async_wrapper(*args, **kwargs):
            pr = cProfile.Profile()
            pr.enable()
            try:
                return await fn(*args, **kwargs)
            finally:
                pr.disable()
                if PROFILER_ENABLED:
                    s = io.StringIO()
                    stats = pstats.Stats(pr, stream=s)
                    stats.sort_stats("cumulative")
                    stats.print_stats(10)
                    print(f"\n[Profiler] {label or fn.__name__}:\n{s.getvalue()[:500]}")

        import asyncio
        if asyncio.iscoroutinefunction(fn):
            return async_wrapper
        return sync_wrapper
    return decorator
