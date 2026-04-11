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
  - Override: set REDIS_URL env var to any target.

Tests:
1. Pod A writes cache key X → Pod B reads key X → both see same value
2. Cache invalidation on Pod A → Pod B's stale read is evicted
3. Sequential writes → Redis last-write-wins correctly
"""

import os
import socket
import pytest
import redis.asyncio as aioredis
import redis as sync_redis


# ---------------------------------------------------------------------------
# Redis URL resolution
# ---------------------------------------------------------------------------

def _resolve_redis_url() -> str:
    """
    Resolve the Redis URL based on execution environment.

    Priority:
    1. REDIS_URL env var (CI / custom targets)
    2. KUBERNETES_SERVICE_HOST set → cluster DNS name
    3. TCP probe cluster IP (10.96.4.188) → use it
    4. Fallback to localhost:6379
    """
    if os.environ.get("REDIS_URL"):
        return os.environ["REDIS_URL"]

    if os.environ.get("KUBERNETES_SERVICE_HOST"):
        return "redis://redis.tradersapp-dev.svc.cluster.local:6379/0"

    if _check_tcp_connectivity("10.96.4.188", 6379, timeout=2):
        return "redis://10.96.4.188:6379/0"

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
# Pre-flight check — fail fast with a clear message if Redis is unreachable
# ---------------------------------------------------------------------------

_resolve_redis_url()  # force resolution so KUBERNETES_SERVICE_HOST is checked

_redis_url = os.environ.get("REDIS_URL") or (
    "redis://redis.tradersapp-dev.svc.cluster.local:6379/0"
    if os.environ.get("KUBERNETES_SERVICE_HOST")
    else "redis://10.96.4.188:6379/0"
    if _check_tcp_connectivity("10.96.4.188", 6379, timeout=2)
    else "redis://localhost:6379/0"
)

try:
    _r = sync_redis.Redis.from_url(_redis_url, socket_connect_timeout=3)
    _r.ping()
    _r.close()
    print(f"\n[Redis Preflight] OK — {_redis_url}")
except Exception as exc:
    pytest.exit(
        f"\n[Redis Preflight] UNREACHABLE at {_redis_url}: {exc}\n"
        "To run these tests:\n"
        "  Inside cluster : kubectl exec -it <pod> -n tradersapp-dev -- "
            "python -m pytest tests/integration/test_redis_multi_pod_coherence.py -v\n"
        "  On dev host    : Start local Redis on port 6379, then re-run\n"
        "  Override URL   : REDIS_URL=redis://<host>:6379/0 pytest ...",
        returncode=1,
    )


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
    url = _redis_url
    print(f"\n[Coherence Test] Redis URL: {url}")
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
