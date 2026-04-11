# PostgreSQL Production Cutover Runbook

**Status:** Stub — needs implementation

## Overview

Procedures for cutting over the TradersApp ML Engine from SQLite to production PostgreSQL with zero-downtime and rollback capability.

## Pre-Cutover Checklist

### Infrastructure
- [ ] PostgreSQL instance provisioned and accessible
- [ ] Network ACL allows ML Engine pod access
- [ ] `DATABASE_URL` secret deployed to cluster
- [ ] PgBouncer or connection pooler in place
- [ ] Backup of existing data confirmed

### Validation
- [ ] PostgreSQL schema matches SQLite schema (see `ml-engine/data/schema.sql`)
- [ ] Indexes created per `schema.sql`
- [ ] Connection pool size tuned (max 20 connections per replica)
- [ ] Read replica available for read-heavy queries

## Data Migration

```bash
# Export SQLite data
python -m ml_engine.data.export_sqlite --output /tmp/sqlite_export.parquet

# Import to PostgreSQL
python -m ml_engine.data.import_postgres \
  --input /tmp/sqlite_export.parquet \
  --database-url "$DATABASE_URL"
```

## Cutover Steps

1. Enable dual-write mode in ML Engine (SQLite + PostgreSQL)
2. Run live migration for 24h, verify data parity
3. Read from PostgreSQL, write to both (shadow mode)
4. Read/write exclusively from PostgreSQL
5. Disable SQLite writes

## Rollback Procedure

If PostgreSQL cutover fails:
1. Set `DATABASE_URL` back to SQLite path
2. Restart ML Engine pods
3. Re-import from last known-good backup

## See Also

- `docs/POSTGRES_CUTOVER_PLAN.md` — planning document
- `docs/IDEMPOTENCY_SERVICE.md` — data consistency guarantees
