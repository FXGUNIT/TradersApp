# ADR-002: Redis Cache with In-Memory LRU Fallback

**ADR ID:** ADR-002
**Title:** Redis Cache with In-Memory LRU Fallback
**Status:** Accepted
**Date:** 2026-04-02
**Author:** FXGUNIT

## Context

The ML Engine serves predictions via `/predict` and regime analysis via `/regime`. During live trading:
- The same candle sequence may be requested multiple times (user refresh, multiple frontend panels)
- Regime analysis changes slowly — 60s TTL is acceptable
- Prediction latency must be < 50ms P95 per SLA targets
- Redis may not be available in all environments (local dev, some CI runners)

## Decision

Implement a **two-tier caching strategy** in `ml-engine/infrastructure/performance.py`:

### Tier 1: Redis (Primary)
- **Purpose:** Production cache with distributed sharing
- **TTL:** 10s for predictions, 60s for regime
- **Compression:** Values compressed with zlib before storage

### Tier 2: In-Memory LRU (Fallback)
- **Purpose:** Works when Redis unavailable
- **Same TTL semantics** as Redis tier
- **Graceful degradation:** Silently falls back on Redis connection failure

### Key Design Decisions

**Cache Key Strategy:**
```python
# SHA-256 hash of last 20 candles (stable, deterministic)
cache_key = hashlib.sha256(
    json.dumps(candles[-20:], sort_keys=True).encode()
).hexdigest()
```

**Request Coalescing:**
```python
# Concurrent identical requests share one computation
async def get_or_compute(key, async_fn, ttl):
    if key in pending_futures:
        return await pending_futures[key]
    future = asyncio.Future()
    pending_futures[key] = future
    try:
        result = await async_fn()
        await cache.set(key, result, ttl)
        future.set_result(result)
    finally:
        del pending_futures[key]
    return result
```

**API:**
```python
@cached_endpoint(ttl=10, key_prefix="predict")
async def predict(candles, features, regime):
    ...

@cached_endpoint(ttl=60, key_prefix="regime")
async def regime_analysis(candles):
    ...
```

## Consequences

### Positive
- **Sub-millisecond cache hits** for repeated requests
- **No thundering herd:** Concurrent identical requests coalesce into one
- **Works in all environments:** Redis optional
- **SLA monitoring integrated:** Every request records P50/P95/P99 latency

### Negative
- **In-memory LRU is per-process:** No cross-instance sharing
- **10s TTL may return stale predictions** during fast regime transitions
- **Redis connection timeout (500ms)** may cause delays on network issues

### Neutral
- BFF does NOT cache (keeps BFF stateless per CLAUDE.md rule #1)
- Frontend caching handled separately by React Query

## Alternatives Considered

### Redis-Only Caching
- **Pros:** Simple, single implementation
- **Cons:** Fails completely when Redis unavailable
- **Why rejected:** Need graceful degradation for local dev and CI

### LocalStorage/Cache API (Browser)
- **Pros:** No server infrastructure needed
- **Cons:** Security risk exposing ML predictions, no server-side control
- **Why rejected:** Not appropriate for server-side ML predictions

### Memcached
- **Pros:** Battle-tested, simple protocol
- **Cons:** No native Python async support, separate infrastructure
- **Why rejected:** Redis has better async Python support and additional features

## References

- [Redis Documentation](https://redis.io/docs/)
- [Redis TTL Best Practices](https://redis.io/docs/manual/keyspace-notifications/)
- [Python asyncio caching patterns](https://docs.python.org/3/library/asyncio-queue.html)
- Related ADRs: [ADR-015 Keycloak](ADR-015-keycloak-sso.md) (Redis for session storage)
