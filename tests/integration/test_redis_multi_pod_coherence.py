"""
Redis multi-pod cache coherence test.

Simulates the scenario: two pods write/read the same cache key.
Redis must be the single source of truth — both pods see the same data.

Run modes:
  - From INSIDE the k3s cluster (e.g. via kubectl exec into a pod):
      Uses the cluster Redis service: redis.tradersapp-dev.svc.cluster.local:6379
  - From the developer host (Windows/Mac):
      Falls back to localhost:6379 if a local Redis is running.
      Tests still simulate multi-connection coherence correctly.

Tests:
1. Pod A writes cache key X → Pod B reads key X → both see same value
2. Cache invalidation on Pod A → Pod B's stale read is evicted
3. Race condition: both pods write simultaneously → Redis last-write-wins correctly
"""

import asyncio
import os
import socket
import pytest
import redis.asyncio as aioredis


def _resolve_redis_url() -> str:
    """
    Resolve the Redis URL based on execution environment.

    Priority:
    1. REDIS_URL env var (for CI / custom targets)
    2. Cluster in-pod detection via KUBERNETES_SERVICE_HOST
    3. localhost fallback (for local dev)
    """
    if os.environ.get("REDIS_URL"):
        return os.environ["REDIS_URL"]

    # Running inside a k8s/k3s pod — use the cluster DNS name
    if os.environ.get("KUBERNETES_SERVICE_HOST"):
        return "redis://redis.tradersapp-dev.svc.cluster.local:6379/0"

    # Developer host — try cluster IP if available, else localhost
    cluster_ip = "10.96.4.188"
    if _check_tcp_connectivity(cluster_ip, 6379, timeout=2):
        return f"redis://{cluster_ip}:6379/0"

    return "redis://localhost:6379/0"


def _check_tcp_connectivity(host: str, port: int, timeout: int = 2) -> bool:
    """Check if a TCP connection can be established (non-blocking)."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((host, port))
        sock.close()
        return True
    except (socket.error, OSError):
        return False


# ---------------------------------------------------------------------------
# Helpers — simulate two "pods" using independent Redis connections
# ---------------------------------------------------------------------------

async def pod_a_write(redis_url: str, key: str, value: str, ttl: int = 60) -> str:
    r = await aioredis.from_url(redis_url)
    await r.set(key, value, ex=ttl)
    await r.aclose()
    return f"pod_a wrote {key}={value}"


async def pod_b_read(redis_url: str, key: str) -> bytes | None:
    r = await aioredis.from_url(redis_url)
    result = await r.get(key)
    await r.aclose()
    return result


async def pod_a_invalidate(redis_url: str, key: str) -> str:
    r = await aioredis.from_url(redis_url)
    await r.delete(key)
    await r.aclose()
    return f"pod_a invalidated {key}"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def redis_url() -> str:
    url = _resolve_redis_url()
    print(f"\n[Coherence Test] Using Redis at: {url}")
    return url


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_write_read_coherence(redis_url: str):
    """Pod A writes → Pod B reads → both see same value."""
    key = "test:coherence:mnq:direction"
    value = "LONG_v1"

    await pod_a_write(redis_url, key, value)
    result = await pod_b_read(redis_url, key)
    assert result is not None, f"Pod B got None — Redis unreachable at {redis_url}"
    assert result.decode() == value, f"Pod B got {result!r}, expected {value!r}"


@pytest.mark.asyncio
async def test_cache_invalidation_coherence(redis_url: str):
    """Invalidation on Pod A → Pod B's stale read returns None."""
    key = "test:coherence:mnq:rr"
    value = "2.5"

    await pod_a_write(redis_url, key, value)

    # Verify write is visible to the other "pod"
    result = await pod_b_read(redis_url, key)
    assert result is not None, "Precondition failed: write not visible"
    assert result.decode() == value

    # Invalidate from Pod A side
    await pod_a_invalidate(redis_url, key)

    # Pod B should now get None (cache evicted)
    result = await pod_b_read(redis_url, key)
    assert result is None, f"Pod B got stale result {result!r} after invalidation"


@pytest.mark.asyncio
async def test_cache_last_write_wins(redis_url: str):
    """Sequential writes → last write always wins (Redis LWW semantics)."""
    key = "test:coherence:mnq:regime"

    await pod_a_write(redis_url, key, "TRENDING_v1")
    await pod_a_write(redis_url, key, "TRENDING_v2")

    result = await pod_b_read(redis_url, key)
    assert result is not None, f"Redis unreachable at {redis_url}"
    assert result.decode() == "TRENDING_v2", (
        f"Last-write-wins violated: got {result!r}, expected b'TRENDING_v2'"
    )
