# ADR-010: BFF Pattern for Frontend-Backend Integration

**ADR ID:** ADR-010
**Title:** BFF Pattern for Frontend-Backend Integration
**Status:** Accepted
**Date:** 2026-04-02
**Author:** FXGUNIT

## Context

The React frontend needs trading signals that require:
1. Calling the ML Engine (Python FastAPI) for consensus predictions
2. Calling news services (Finnhub, NewsAPI)
3. Calling breaking news service
4. Aggregating all responses into a unified signal

Directly calling these from the React frontend would expose API keys and leak internal architecture.

## Decision

Use the **BFF (Backend-for-Frontend)** pattern — a thin Node.js layer (`bff/`) that:
- Aggregates all backend calls
- Transforms responses into the shape the frontend needs
- Handles cross-cutting concerns (circuit breakers, timeouts, rate limiting)
- Lives on port 8788, separate from ML Engine (port 8001) and frontend (port 5173)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│                     Port 5173 (Vite)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + Bearer Token
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      BFF (Node.js)                           │
│                       Port 8788                              │
├─────────────────────────────────────────────────────────────┤
│  Services:          │  Routes:                              │
│  • consensusEngine │  • /ml/consensus                      │
│  • newsService     │  • /news/*                            │
│  • breakingNews    │  • /admin/*                           │
│  • security        │  • /terminal/*                         │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         │ ML Engine          │ News APIs          │ Redis
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  ML Engine   │    │   External   │    │    Redis    │
│  (FastAPI)   │    │     APIs     │    │   Cache     │
│  Port 8001  │    │  (Finnhub)   │    │  Port 6379  │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Service Organization

**BFF Services (`bff/services/`):**
```
services/
├── consensusEngine.mjs   # ML Engine client + circuit breaker
├── newsService.mjs       # Finnhub + NewsAPI aggregation
├── breakingNewsService.mjs # Breaking news detection
├── security.mjs          # Rate limiting, HSTS, RBAC
└── mlClients.mjs         # All ML Engine HTTP calls
```

**BFF Routes (`bff/routes/`):**
```
routes/
├── consensusRoutes.mjs   # /ml/consensus, /ml/predict
├── newsRoutes.mjs        # /news/*, /news/countdown
├── adminRoutes.mjs       # /admin/*, /admin/verify-password
└── terminalRoutes.mjs    # /terminal/*
```

### Request Aggregation Example

```javascript
// routes/consensusRoutes.mjs
app.get('/ml/consensus', async (req, res) => {
  // Fetch all data concurrently
  const [prediction, news, regime, breakingNews] = await Promise.all([
    consensusEngine.getPrediction(candles),
    newsService.getNews(symbol),
    mlClients.getRegime(candles),
    breakingNewsService.getLatest(),
  ]);

  // Aggregate into unified response
  res.json({
    signal: prediction.signal,
    confidence: prediction.confidence,
    regime: regime.current,
    news: {
      sentiment: news.sentiment,
      breaking: breakingNews.detected,
    },
  });
});
```

## Consequences

### Positive
- **API keys stay server-side:** Never exposed to browser
- **Single network hop:** Frontend makes one call, not four
- **Centralized resilience:** Circuit breakers, timeouts, fallbacks in one place
- **Easy ML extensibility:** Add models without touching frontend

### Negative
- **Additional service:** BFF must be deployed and monitored
- **Latency overhead:** BFF → ML Engine adds ~50ms (mitigated by caching)
- **Single instance assumption:** No per-user customization in this version

### Neutral
- BFF intentionally thin — no business logic, only orchestration
- ML Engine is source of truth for trading decisions
- Frontend and BFF can scale independently (future: multiple BFF instances)

## Alternatives Considered

### Direct Frontend Calls
- **Pros:** Simple, no extra service
- **Cons:** API keys exposed, multiple network calls, no aggregation
- **Why rejected:** Security risk, poor performance

### GraphQL Federation
- **Pros:** Single API, typed schema, great tooling
- **Cons:** Overkill for this use case, additional complexity
- **Why rejected:** REST is simpler for this scale

### GraphQL with Apollo Server
- **Pros:** Schema validation, client caching
- **Cons:** Additional dependencies, complexity
- **Why rejected:** BFF pattern with REST is simpler

### tRPC
- **Pros:** End-to-end type safety
- **Cons:** Requires TypeScript everywhere, tighter coupling
- **Why rejected:** JavaScript frontend preferred for this team

## References

- [Pattern: Backends for Frontends](https://docs.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends)
- [BFF with Node.js](https://samnewman.io/patterns/architectural/bff/)
- Related ADRs: [ADR-003 Circuit Breakers](ADR-003-circuit-breakers.md) (BFF implements circuit breaker), [ADR-002 Redis Caching](ADR-002-redis-caching.md) (BFF uses Redis through ML Engine)
