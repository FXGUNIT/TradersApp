# ADR-002: Redis Cache with In-Memory LRU Fallback

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

Implement a two-tier caching strategy in `ml-engine/infrastructure/performance.py`:

1. **Tier 1: Redis** — Primary cache for production. TTL: 10s (predictions), 60s (regime).
2. **Tier 2: In-memory LRU** — Fallback when Redis unavailable. Same TTL semantics.

Key design decisions:
- **Cache key:** SHA-256 hash of the last 20 candles (stable, deterministic)
- **Compression:** Values compressed with zlib before Redis storage (reduces memory)
- **Graceful degradation:** If Redis connection fails on startup, silently falls back to in-memory LRU
- **No cache stampede:** Request coalescing via asyncio.Future — concurrent identical requests share one computation

Implementation:
- `RedisCache.get_cache()` — singleton factory
- `cache.set(key, value, ttl)` / `cache.get(key)` — dual-tier API
- `cache.get_or_compute(key, async_fn, ttl)` — coalescing wrapper
- Decorators: `@cached_endpoint(ttl=10, key_prefix="predict")`

## Consequences

### Positive
- Sub-millisecond cache hits for repeated requests
- No thundering herd: concurrent identical requests coalesce into one
- Works in all environments (Redis optional)
- SLA monitoring integrated: every request records P50/P95/P99 latency

### Negative
- In-memory LRU is per-process — no cross-instance sharing
- 10s TTL may return slightly stale predictions during fast regime transitions
- Redis connection timeout (500ms) may still cause delays on network issues

### Neutral
- BFF does NOT cache (keeps BFF stateless per CLAUDE.md rule #1)
- Frontend caching is a separate concern handled by React Query
