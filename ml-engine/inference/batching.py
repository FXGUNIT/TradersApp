"""
Request Batching Layer — aggregates ML inference requests before sending to Triton.

Batching is the single most impactful optimization for GPU inference throughput.
Key techniques:
  1. Static batching: pad to max_batch_size, wait for batch to fill
  2. Dynamic batching: Triton handles this natively via config.pbtx
  3. Micro-batching: single requests forwarded immediately (latency-sensitive path)

This module provides:
  - InferenceBatcher: Thread-safe request queue with configurable batch window
  - MicroBatchClient: Wraps TritonInferenceClient, forwards single requests immediately
  - BatchMetrics: Tracks batch utilization, queue depth, latency per batch size

Target: < 50ms p99 at batch_size=1, < 100ms p99 at batch_size=32.

Usage:
  from ml_engine.inference.batching import InferenceBatcher
  batcher = InferenceBatcher(triton_client, max_batch_size=64, max_wait_ms=5)
  result = await batcher.predict(features, model_name="lightgbm_direction")
"""

from __future__ import annotations

import asyncio
import sys
import time
import threading
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import tritonclient.grpc as grpcclient
    import tritonclient.http as httpclient
    TRITON_AVAILABLE = True
except ImportError:
    TRITON_AVAILABLE = False


# ─── Data Structures ────────────────────────────────────────────────────────────

@dataclass
class InferenceRequest:
    """A single inference request awaiting batching."""
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    features: list[list[float]] | list[dict] = field(default_factory=list)
    model_name: str = "lightgbm_direction"
    return_dict: bool = True
    future: asyncio.Future | None = None
    enqueued_at: float = field(default_factory=time.perf_counter)
    priority: int = 0  # Higher = more urgent


@dataclass
class Batch:
    """A batch of requests ready for a single Triton inference call."""
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    requests: list[InferenceRequest] = field(default_factory=list)
    created_at: float = field(default_factory=time.perf_counter)
    max_wait_ms: float = 5.0


@dataclass
class BatchMetrics:
    """Metrics for batch utilization monitoring."""
    total_requests: int = 0
    total_batches: int = 0
    batch_size_histogram: dict[int, int] = field(default_factory=dict)  # size → count
    avg_batch_size: float = 0.0
    max_batch_size_hit: int = 0  # How many times max_batch_size was reached
    queue_depth_samples: list[int] = field(default_factory=list)
    batch_latency_ms: list[float] = field(default_factory=list)  # time to form + send batch
    inference_latency_ms: list[float] = field(default_factory=list)  # Triton round-trip
    dropped_requests: int = 0

    def record_batch(self, size: int, batch_latency: float, inference_latency: float):
        self.total_requests += size
        self.total_batches += 1
        self.batch_size_histogram[size] = self.batch_size_histogram.get(size, 0) + 1
        self.avg_batch_size = self.total_requests / max(self.total_batches, 1)
        self.batch_latency_ms.append(batch_latency)
        self.inference_latency_ms.append(inference_latency)

    def record_queue_depth(self, depth: int):
        self.queue_depth_samples.append(depth)

    def summary(self) -> dict:
        import statistics
        bl = self.batch_latency_ms
        il = self.inference_latency_ms
        qd = self.queue_depth_samples
        return {
            "total_requests": self.total_requests,
            "total_batches": self.total_batches,
            "avg_batch_size": round(self.avg_batch_size, 2),
            "max_batch_size_hit": self.max_batch_size_hit,
            "batch_latency_p50_ms": round(statistics.median(bl), 2) if bl else 0,
            "batch_latency_p99_ms": round(sorted(bl)[int(len(bl) * 0.99)] if len(bl) > 10 else (bl[-1] if bl else 0), 2),
            "inference_latency_p50_ms": round(statistics.median(il), 2) if il else 0,
            "inference_latency_p99_ms": round(sorted(il)[int(len(il) * 0.99)] if len(il) > 10 else (il[-1] if il else 0), 2),
            "queue_depth_p50": round(statistics.median(qd), 1) if qd else 0,
            "queue_depth_p99": round(sorted(qd)[int(len(qd) * 0.99)] if len(qd) > 10 else (qd[-1] if qd else 0), 1),
            "dropped_requests": self.dropped_requests,
            "batch_utilization_pct": round(
                self.avg_batch_size / 64 * 100, 1
            ) if self.avg_batch_size > 0 else 0,
        }


# ─── Batch Formation ────────────────────────────────────────────────────────────

class InferenceBatcher:
    """
    Thread-safe request batcher that aggregates inference requests.

    Two modes:
      - LATENCY-SENSITIVE: single requests forwarded immediately (max_wait_ms=0)
      - THROUGHPUT-OPTIMIZED: wait up to max_wait_ms for batch to fill

    For trading signals (latency-sensitive): use max_wait_ms=2-5ms
    For batch training jobs: use max_wait_ms=20-50ms
    """

    def __init__(
        self,
        triton_client,  # TritonInferenceClient instance
        max_batch_size: int = 64,
        max_wait_ms: float = 5.0,
        enable_micro_batching: bool = True,
    ):
        self._client = triton_client
        self._max_batch_size = max_batch_size
        self._max_wait_ms = max_wait_ms
        self._enable_micro = enable_micro_batching

        # Per-model queues
        self._queues: dict[str, list[InferenceRequest]] = defaultdict(list)
        self._lock = threading.Lock()
        self._metrics = BatchMetrics()
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="batcher")

        # Background batch dispatcher
        self._running = True
        self._dispatcher_thread = threading.Thread(target=self._dispatch_loop, daemon=True)
        self._dispatcher_thread.start()

    def predict(
        self,
        features: list[list[float]] | list[dict],
        model_name: str = "lightgbm_direction",
        return_dict: bool = True,
        priority: int = 0,
    ) -> dict:
        """
        Submit a request for batching. Blocking call.

        Returns the result dict with added batch metadata:
          {..., batch_size, queue_wait_ms, total_ms}
        """
        req = InferenceRequest(
            features=features,
            model_name=model_name,
            return_dict=return_dict,
            priority=priority,
        )

        # Micro-batch: forward immediately if single request and latency-sensitive
        if self._enable_micro and len(features) == 1:
            t0 = time.perf_counter()
            result = self._client.predict(
                features=features,
                model_name=model_name,
                return_dict=return_dict,
            )
            result["batch_size"] = 1
            result["queue_wait_ms"] = 0.0
            result["inference_ms"] = result.get("inference_ms", 0)
            result["total_ms"] = round((time.perf_counter() - t0) * 1000, 2)
            result["batching_source"] = "micro"
            return result

        # Queue the request
        loop = asyncio.new_event_loop()
        try:
            future = loop.run_until_complete(self._enqueue_and_wait(req))
        finally:
            loop.close()

        result = future.result()
        result["batch_size"] = len(req.features)
        result["queue_wait_ms"] = round((time.perf_counter() - req.enqueued_at) * 1000, 2)
        result["batching_source"] = "batch"
        return result

    async def _enqueue_and_wait(self, req: InferenceRequest) -> dict:
        """Add request to queue and wait for result."""
        loop = asyncio.get_event_loop()
        req.future = loop.create_future()

        with self._lock:
            self._queues[req.model_name].append(req)

        # Check if batch is now full — trigger immediate dispatch
        if len(self._queues[req.model_name]) >= self._max_batch_size:
            self._dispatch_sync(req.model_name)

        # Wait for result with timeout
        try:
            return await asyncio.wait_for(req.future, timeout=5.0)
        except asyncio.TimeoutError:
            self._metrics.dropped_requests += 1
            return {"error": "batch_timeout", "signal": "NEUTRAL", "confidence": 0.0}

    def _dispatch_loop(self):
        """Background thread: dispatches batches on interval."""
        while self._running:
            time.sleep(self._max_wait_ms / 1000.0)  # Wait one batch window

            with self._lock:
                for model_name in list(self._queues.keys()):
                    if self._queues[model_name]:
                        self._dispatch_sync(model_name)

    def _dispatch_sync(self, model_name: str):
        """Dispatch a batch synchronously (called with lock held)."""
        queue = self._queues.get(model_name, [])
        if not queue:
            return

        # Form batch
        batch = queue[: self._max_batch_size]
        self._queues[model_name] = queue[self._max_batch_size:]

        if len(batch) == self._max_batch_size:
            self._metrics.max_batch_size_hit += 1

        # Track queue depth
        self._metrics.record_queue_depth(len(self._queues.get(model_name, [])))

        # Run inference in thread pool
        self._executor.submit(self._process_batch, batch)

    def _process_batch(self, batch: list[InferenceRequest]):
        """Send a batch to Triton and resolve futures."""
        if not batch:
            return

        batch_t0 = time.perf_counter()

        # Flatten all features into single batch
        all_features = []
        for req in batch:
            all_features.extend(req.features)

        model_name = batch[0].model_name

        try:
            inf_t0 = time.perf_counter()
            result = self._client.predict(
                features=all_features,
                model_name=model_name,
                return_dict=True,
            )
            inference_ms = (time.perf_counter() - inf_t0) * 1000
            batch_latency_ms = (time.perf_counter() - batch_t0) * 1000

            self._metrics.record_batch(len(batch), batch_latency_ms, inference_ms)

            # Split results back to individual requests
            idx = 0
            for req in batch:
                n = len(req.features)
                if n == 1 and isinstance(result, dict) and "predictions" in result:
                    sub = result["predictions"][idx]
                elif n == 1:
                    sub = result
                else:
                    sub = result  # Multi-sample request: return full batch result

                if req.future and not req.future.done():
                    req.future.set_result(sub)

                idx += n

        except Exception as exc:
            for req in batch:
                if req.future and not req.future.done():
                    req.future.set_exception(exc)

    def get_metrics(self) -> dict:
        """Return current batch metrics."""
        return self._metrics.summary()

    def shutdown(self):
        """Stop the batcher and drain pending requests."""
        self._running = False
        self._executor.shutdown(wait=True)


# ─── Prometheus Integration ─────────────────────────────────────────────────────

def record_batch_metrics(metrics: dict) -> None:
    """Export batch metrics to Prometheus."""
    try:
        from infrastructure.prometheus_exporter import (
            record_inference_latency,
            PROMETHEUS_AVAILABLE,
        )
        if not PROMETHEUS_AVAILABLE or not record_inference_latency:
            return

        # Note: these would need to be added to prometheus_exporter.py
        # as set_inference_batch_size, set_inference_queue_depth, etc.
    except Exception:
        pass


# ─── High-Level Client ─────────────────────────────────────────────────────────

class BatchedInferenceClient:
    """
    Drop-in replacement for TritonInferenceClient with automatic batching.

    Usage:
      from ml_engine.inference.batching import BatchedInferenceClient
      client = BatchedInferenceClient(max_batch_size=64, max_wait_ms=5)
      result = client.predict(features=[[0.1, 0.2, ...]])
    """

    def __init__(
        self,
        triton_url: str | None = None,
        max_batch_size: int = 64,
        max_wait_ms: float = 5.0,
    ):
        from ml_engine.inference.triton_client import TritonInferenceClient
        base_client = TritonInferenceClient(url=triton_url)
        self._batcher = InferenceBatcher(
            base_client,
            max_batch_size=max_batch_size,
            max_wait_ms=max_wait_ms,
        )

    def predict(self, features: list[list[float]] | list[dict], **kwargs) -> dict:
        return self._batcher.predict(features=features, **kwargs)

    def get_metrics(self) -> dict:
        return self._batcher.get_metrics()

    def get_server_status(self) -> dict:
        return self._batcher._client.get_server_status()
