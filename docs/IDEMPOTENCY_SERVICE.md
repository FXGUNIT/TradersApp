# Idempotency Service

**Status:** Stub — needs implementation

## Purpose

Guarantees that every ML consensus signal, trade signal, and session aggregate write is idempotent — safe to retry without duplicate side effects.

## Why Idempotency Matters

- ML consensus signals drive trade decisions
- Duplicate signals cause double position sizing or duplicate stop/target orders
- Session aggregate writes accumulate over time; duplicates corrupt historical data
- Network retries are inevitable at scale

## Design

### Idempotency Key Schema

```sql
CREATE TABLE idempotency_keys (
    key         TEXT PRIMARY KEY,
    service     TEXT NOT NULL,  -- 'ml-engine', 'bff', 'telegram-bridge'
    endpoint    TEXT NOT NULL,
    response    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ
);
```

### Client Contract

Every client sends `X-Idempotency-Key: <uuid>` header on POST/PUT requests.

```
BFF → ML Engine: Always generate idempotency key per request
BFF → News API:  Use news event ID as idempotency key
Frontend → BFF:  Generate client-side UUID, store in localStorage
```

### Server Behavior

1. Check `idempotency_keys` table for key
2. If found and not expired: return cached response
3. If not found: execute request, store response with TTL (24h)
4. TTL prevents table bloat

### Idempotency TTL

| Request Type | TTL |
|-------------|-----|
| ML consensus | 60s |
| Trade signal write | 300s |
| Session aggregate | 3600s |
| News fetch | 60s |

## Implementation Notes

- Use PostgreSQL advisory locks for distributed environments
- TTL cleanup via scheduled job (`psql cron` or Airflow DAG)
- `X-Idempotency-Key` collisions across services are prevented by namespacing

## See Also

- `docs/POSTGRES_PROD_CUTOVER_RUNBOOK.md`
- `bff/services/security.mjs` — rate limiting and idempotency middleware
