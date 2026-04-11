# ADR-003: Circuit Breaker Pattern for ML Engine

**ADR ID:** ADR-003
**Title:** Circuit Breaker Pattern for ML Engine
**Status:** Accepted
**Date:** 2026-04-02
**Author:** FXGUNIT

## Context

The BFF (Backend-for-Frontend) calls the ML Engine for every consensus prediction. If the ML Engine is unavailable (crash, overload, network partition):
- BFF waits 30s for timeout before returning error
- All concurrent requests pile up waiting
- Frontend shows loading spinner indefinitely
- Cascading failure: waiting threads exhaust server resources

## Decision

Implement circuit breakers at **two layers**:

### Layer 1: BFF (Node.js) — `consensusEngine.mjs`

In-memory circuit breaker wrapping ML Engine calls:

| State | Transition |
|-------|------------|
| CLOSED → OPEN | After 5 failures in any 30s window |
| OPEN → HALF_OPEN | After 30s recovery timeout |
| HALF_OPEN → CLOSED | After 3 successful test requests |
| OPEN → remains OPEN | Until recovery timeout |

**Implementation:**
```javascript
class CircuitBreaker {
  constructor({ failureThreshold = 5, recoveryTimeout = 30000 }) {
    this.state = 'CLOSED';
    this.failures = [];
    this.lastFailureTime = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        return this.fallback();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      return this.fallback();
    }
  }
}
```

**Fallback Response (OPEN state):**
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

Thread-safe `CircuitBreaker` class as context manager:

```python
with CircuitBreaker("external-api") as cb:
    result = await call_external_api()
```

### SLA Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /sla` | P50/P95/P99 latency, error rate, uptime |
| `GET /cache/stats` | Redis cache hit/miss statistics |
| `GET /health` | Basic health check |

## Consequences

### Positive
- **Fail-fast:** Circuit OPEN in < 1s vs 30s timeout
- **NEUTRAL fallback preserves safety:** No false signals during outage
- **Diagnostic transparency:** Circuit state exposed in API responses
- **Thread-safe implementation** for async Python environments

### Negative
- **Per-process state:** In-memory breaker not shared across BFF instances
- **False positives possible:** Transient network blip opens circuit
- **Half-open testing still risky:** May send requests to failing service

### Neutral
- Circuit breaker does NOT replace retry logic — different purposes
- Future: Consider Redis for cluster-wide circuit state sharing

## Alternatives Considered

### Timeout Only
- **Pros:** Simple to implement
- **Cons:** Requests still pile up during outage, resource exhaustion
- **Why rejected:** Doesn't prevent cascading failures

### Retry with Exponential Backoff
- **Pros:** Handles transient failures well
- **Cons:** Still blocks during extended outages
- **Why rejected:** Doesn't prevent resource exhaustion

### Bulkhead Pattern
- **Pros:** Isolates failures to specific consumers
- **Cons:** Complex implementation, doesn't provide fallback
- **Why rejected:** Adds complexity without fallback mechanism

### Polly (.NET) / Resilience4j (Java)
- **Pros:** Battle-tested libraries
- **Cons:** Language-specific, adds dependencies
- **Why rejected:** Custom implementation matches our minimal dependencies

## References

- [Martin Fowler - Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Microsoft - Circuit Breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
- Related ADRs: [ADR-002 Redis Caching](ADR-002-redis-caching.md) (cache provides fallback data), [ADR-013 Testing](ADR-013-testing-strategy.md) (chaos tests validate circuit breaker)
