# ADR-003: Circuit Breaker Pattern for ML Engine

**Status:** Accepted
**Date:** 2026-04-02
**Author:** FXGUNIT

## Context

The BFF (Backend-for-Frontend) calls the ML Engine for every consensus prediction. If the ML Engine is unavailable (crash, overload, network partition):
- BFF waits 30s for timeout before returning error
- All concurrent requests pile up waiting
- Frontend shows loading spinner indefinitely
- cascading failure: waiting threads exhaust server resources

## Decision

Implement circuit breakers at two layers:

### Layer 1: BFF (Node.js) — `consensusEngine.mjs`
In-memory circuit breaker wrapping ML Engine calls:
- **CLOSED → OPEN:** After 5 failures in any 30s window
- **OPEN → HALF_OPEN:** After 30s recovery timeout
- **HALF_OPEN → CLOSED:** After 3 successful test requests
- **OPEN state:** Immediately return NEUTRAL fallback (no timeout wait)

Fallback response when OPEN:
```json
{
  "ok": false,
  "source": "circuit_breaker_fallback",
  "circuit_breaker": { "state": "OPEN", "failure_count": 5 },
  "signal": "NEUTRAL",
  "confidence": 0.5,
  "model_freshness": "circuit_breaker_open"
}
```

### Layer 2: ML Engine (Python) — `infrastructure/performance.py`
`CircuitBreaker` class with context manager:
- Can wrap any external call (future: news APIs, database)
- Exposes `get_circuit_breaker(name)` factory
- Thread-safe via `threading.Lock`

### SLA Endpoints
- `GET /sla` — P50/P95/P99 latency, error rate, uptime per rolling window
- `GET /cache/stats` — Redis cache hit/miss statistics
- BFF exposes `getMlCircuitStatus()` and `getMlSlaReport()`

## Consequences

### Positive
- Fail-fast: circuit OPEN in < 1s vs 30s timeout
- NEUTRAL fallback preserves safety: no false signals during outage
- Circuit state exposed in API responses (diagnostic transparency)
- Thread-safe implementation for async Python environments

### Negative
- In-memory circuit breaker is per-BFF-process (no cluster-wide coordination)
- False positives possible: transient network blip opens circuit
- Half-open testing still sends requests to potentially failing service

### Neutral
- Circuit breaker does NOT replace retry logic — they serve different purposes
- Future: consider using Redis to share circuit state across BFF instances
