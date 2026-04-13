# Performance Rules

| Metric | Target | Enforced |
|--------|--------|----------|
| ML Consensus latency | < 200ms | Hard limit |
| BFF → ML Engine | < 5s timeout | Circuit breaker |
| BFF → News | < 3s timeout | Circuit breaker |
| Circuit breaker | 5 failures / 30s | Auto-open |
| Cache TTL (consensus) | 60s | Redis or in-memory |
| Cache TTL (regime) | 300s | Redis or in-memory |

## General Rules
- No blocking operations on the main thread in React
- All external calls are concurrent in BFF (Promise.all)
- ML predictions: cache with Redis (TTL per endpoint type)
- Heavy ML operations: thread pool or worker process, never block main thread
- React renders: use `React.memo` + `useMemo` + `useCallback` aggressively
- No inline styles — CSS classes only
- Images and heavy assets lazy-loaded with `React.lazy()`
- Candle data loading: max 10k rows per request, paginate larger queries
- Model inference: lazy-load models, unload after 5 min inactivity
- Feature computation: precompute on load, cache per symbol/timeframe
