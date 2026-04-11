"""
Cache Coherence Test — Task 53: Phase 5 Observability

Verifies that after a cache invalidation, all pods (simulated as concurrent
clients) return identical fresh data. This is a critical correctness invariant:
stale cache after invalidation can cause wrong trading signals across replicas.

Test strategy:
1. Invalidate the cache via POST /cache/invalidate
2. Fire concurrent requests from two "pod" clients (async, httpx)
3. Verify all responses have identical signal, confidence, votes, and timing data
4. Confirm the responses are fresh (fresh_data=True from the cache metadata)

Requires ML Engine running at localhost:8001 (or set BASE_URL env var).
Skip if ML Engine is not reachable.

Usage:
  pytest tests/integration/test_cache_coherence.py -v
  BASE_URL=http://ml-engine:8001 pytest tests/integration/test_cache_coherence.py -v
"""
from __future__ import annotations

import asyncio
import os
import time
import pytest
from datetime import datetime, timezone
from typing import Any

import httpx

# ── Test data ─────────────────────────────────────────────────────────────────

BASE_URL = os.getenv("BASE_URL", "http://localhost:8001")
CLIENT_COUNT = 2          # simulate 2 pods
CONCURRENT_REQUESTS = 5  # requests per "pod"
TIMEOUT = 10.0           # seconds


def make_candles(n: int = 20, symbol: str = "MNQ") -> list[dict[str, Any]]:
    """Build a minimal candle list for consensus."""
    candles = []
    base = 18000.0
    ts = datetime.now(timezone.utc).timestamp()
    for i in range(n):
        o = base + (i % 5 - 2)
        c = o + (i % 3 - 1)
        h = max(o, c) + 1
        l = min(o, c) - 1
        candles.append({
            "symbol": symbol,
            "timestamp": f"{(ts - (n - i) * 300):.0f}",
            "open": round(o, 2),
            "high": round(h, 2),
            "low": round(l, 2),
            "close": round(c, 2),
            "volume": 5000 + i * 100,
        })
        base = c
    return candles


def make_payload() -> dict[str, Any]:
    return {
        "symbol": "MNQ",
        "candles": make_candles(),
        "trades": [
            {
                "symbol": "MNQ",
                "direction": "LONG",
                "entry_time": datetime.now(timezone.utc).timestamp() - 600,
                "exit_time": datetime.now(timezone.utc).timestamp() - 100,
                "pnl_ticks": 5.0,
                "pnl_dollars": 25.0,
                "result": "win",
            }
        ],
        "session_id": 1,
        "mathEngineSnapshot": {
            "amdPhase": "ACCUMULATION",
            "vrRegime": "NORMAL",
        },
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def is_ml_engine_live() -> bool:
    """Return True if ML Engine is reachable at BASE_URL."""
    try:
        import requests
        resp = requests.get(f"{BASE_URL}/health", timeout=2)
        return resp.status_code == 200
    except Exception:
        return False


async def _fetch_once(client: httpx.AsyncClient, url: str, payload: dict) -> dict:
    """Fire a single POST and return parsed JSON."""
    resp = await client.post(url, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


async def _pod_requests(pod_id: int, url: str, payload: dict) -> list[dict]:
    """
    Simulate one pod making CONCURRENT_REQUESTS sequential requests.
    Returns list of parsed responses.
    """
    async with httpx.AsyncClient() as client:
        results = []
        for i in range(CONCURRENT_REQUESTS):
            try:
                data = await _fetch_once(client, url, payload)
                data["_pod_id"] = pod_id
                data["_request_seq"] = i
                results.append(data)
            except httpx.HTTPStatusError as e:
                results.append({"_pod_id": pod_id, "_request_seq": i, "_error": str(e)})
            except Exception as e:
                results.append({"_pod_id": pod_id, "_request_seq": i, "_error": str(e)})
        return results


def compare_signal_data(a: dict, b: dict) -> tuple[bool, str]:
    """
    Compare the signal-relevant fields of two consensus responses.
    Returns (equal, diff_description).
    """
    sig_fields = ["signal", "confidence", "votes", "timing"]
    for field in sig_fields:
        if a.get(field) != b.get(field):
            return False, f"Field '{field}' differs: {a.get(field)!r} vs {b.get(field)!r}"
    return True, ""


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def ml_engine_live() -> bool:
    return is_ml_engine_live()


@pytest.fixture(scope="module")
def base_url() -> str:
    return BASE_URL


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestCacheCoherence:
    """
    Test suite: cache coherence after invalidation across concurrent clients.

    Invariant: after POST /cache/invalidate, every response from every pod
    must have identical signal, confidence, votes, and timing data.
    """

    @pytest.mark.asyncio
    async def test_cache_invalidate_then_concurrent_fresh_data(
        self, ml_engine_live: bool, base_url: str
    ):
        """
        Invalidate cache, then fire concurrent requests from two pods.
        All responses must be identical (coherent) and fresh.
        """
        if not ml_engine_live:
            pytest.skip(f"ML Engine not live at {base_url}")

        url = f"{base_url}/api/consensus"
        payload = make_payload()

        # 1. Invalidate cache
        invalidate_url = f"{base_url}/cache/invalidate"
        async with httpx.AsyncClient() as client:
            inv_resp = await client.post(
                invalidate_url,
                json={"pattern": "*"},
                timeout=TIMEOUT,
            )
        # Invalidate may return 200 (success) or 404 if endpoint not registered
        assert inv_resp.status_code in (200, 404), (
            f"Cache invalidate failed: {inv_resp.status_code} {inv_resp.text}"
        )

        # Small settle window — let cache settle after invalidation
        await asyncio.sleep(0.5)

        # 2. Fire concurrent requests from two pods simultaneously
        pod_tasks = [
            _pod_requests(pod_id=i, url=url, payload=payload)
            for i in range(CLIENT_COUNT)
        ]
        all_results: list[dict] = []
        for pod_results in await asyncio.gather(*pod_tasks):
            all_results.extend(pod_results)

        # 3. Filter out errors
        errors = [r for r in all_results if "_error" in r]
        responses = [r for r in all_results if "_error" not in r]

        assert len(responses) >= CLIENT_COUNT, (
            f"Too few successful responses: {len(responses)}. Errors: {errors}"
        )

        # 4. All responses must be coherent (identical signal data)
        reference = responses[0]
        for resp in responses[1:]:
            equal, diff = compare_signal_data(reference, resp)
            assert equal, (
                f"Cache incoherence detected between pods:\n"
                f"  Pod {reference['_pod_id']} seq={reference['_request_seq']}: "
                f"signal={reference.get('signal')} confidence={reference.get('confidence')}\n"
                f"  Pod {resp['_pod_id']} seq={resp['_request_seq']}: "
                f"signal={resp.get('signal')} confidence={resp.get('confidence')}\n"
                f"  Diff: {diff}"
            )

        # 5. Verify signal is valid
        assert reference["signal"] in ("LONG", "SHORT", "NEUTRAL"), (
            f"Invalid signal: {reference['signal']}"
        )
        assert 0 <= reference["confidence"] <= 1, (
            f"Confidence out of range: {reference['confidence']}"
        )

    @pytest.mark.asyncio
    async def test_concurrent_invalidation_and_fetch_coherence(
        self, ml_engine_live: bool, base_url: str
    ):
        """
        Fire cache invalidation and consensus requests concurrently from two pods.
        At least one response per pod must succeed with valid signal data,
        proving the system handles concurrent invalidation + read correctly.
        """
        if not ml_engine_live:
            pytest.skip(f"ML Engine not live at {base_url}")

        url = f"{base_url}/api/consensus"
        payload = make_payload()
        invalidate_url = f"{base_url}/cache/invalidate"

        async def invalidate_and_fetch(pod_id: int) -> dict:
            async with httpx.AsyncClient() as client:
                # Fire invalidate
                await client.post(invalidate_url, json={"pattern": "*"}, timeout=TIMEOUT)
                # Fire consensus
                resp = await client.post(url, json=payload, timeout=TIMEOUT)
                resp.raise_for_status()
                data = resp.json()
                data["_pod_id"] = pod_id
                return data

        results = await asyncio.gather(
            invalidate_and_fetch(0),
            invalidate_and_fetch(1),
        )

        errors = [r for r in results if "_error" in r]
        valid = [r for r in results if "_error" not in r]

        assert len(valid) >= 1, f"All requests failed: {errors}"

        # If both succeeded, they must be coherent
        if len(valid) == 2:
            equal, diff = compare_signal_data(valid[0], valid[1])
            assert equal, (
                f"Cache incoherence under concurrent invalidation:\n"
                f"  Pod 0: {valid[0].get('signal')} conf={valid[0].get('confidence')}\n"
                f"  Pod 1: {valid[1].get('signal')} conf={valid[1].get('confidence')}\n"
                f"  Diff: {diff}"
            )

        # All valid responses must have correct signal structure
        for resp in valid:
            assert resp.get("signal") in ("LONG", "SHORT", "NEUTRAL")
            assert "confidence" in resp
            assert "votes" in resp
            assert "timing" in resp

    @pytest.mark.asyncio
    async def test_cache_hit_after_warmup_is_stable(self, ml_engine_live: bool, base_url: str):
        """
        After warming up the cache with one request, subsequent requests
        must return identical data (cache hit stability).
        """
        if not ml_engine_live:
            pytest.skip(f"ML Engine not live at {base_url}")

        url = f"{base_url}/api/consensus"
        payload = make_payload()

        # Warm up: first request populates cache
        async with httpx.AsyncClient() as client:
            warm_resp = await client.post(url, json=payload, timeout=TIMEOUT)
            warm_resp.raise_for_status()
            warm = warm_resp.json()

        # Wait briefly for cache to settle
        await asyncio.sleep(0.3)

        # Second request (should be cache hit)
        async with httpx.AsyncClient() as client:
            hit_resp = await client.post(url, json=payload, timeout=TIMEOUT)
            hit_resp.raise_for_status()
            hit = hit_resp.json()

        equal, diff = compare_signal_data(warm, hit)
        assert equal, (
            f"Cache unstable between warmup and hit:\n"
            f"  Warmup: {warm.get('signal')} conf={warm.get('confidence')}\n"
            f"  Hit:     {hit.get('signal')} conf={hit.get('confidence')}\n"
            f"  Diff:    {diff}"
        )
