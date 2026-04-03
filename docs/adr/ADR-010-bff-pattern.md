# ADR-010: BFF Pattern for Frontend-Backend Integration

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

**BFF Services (`bff/services/`):**
- `consensusEngine.mjs` — ML Engine client with circuit breaker
- `newsService.mjs` — Finnhub + NewsAPI aggregation
- `breakingNewsService.mjs` — Breaking news detection + ML self-training trigger
- `security.mjs` — Rate limiting, HSTS, Helmet

**BFF Routes (`bff/routes/`):**
- One route file per domain (consensus, news, admin, terminal, etc.)
- Each route calls one or more BFF services concurrently via `Promise.all`

## Consequences

### Positive
- API keys stay server-side (never exposed to browser)
- Single network hop from frontend (no chatty multi-service calls)
- Centralized resilience (circuit breakers, timeouts, fallbacks)
- Easy to add new ML models without touching frontend

### Negative
- BFF is another service to deploy and monitor
- BFF → ML Engine latency adds ~50ms (mitigated by caching)
- Single BFF per frontend (no per-user customization in this version)

### Neutral
- BFF is intentionally thin — no business logic, only orchestration
- ML Engine is the source of truth for all trading decisions
- Frontend and BFF can scale independently (future: multiple BFF instances behind load balancer)
