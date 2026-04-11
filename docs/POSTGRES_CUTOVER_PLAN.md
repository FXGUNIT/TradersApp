# PostgreSQL Cutover Plan — ml-engine

**Stage C: Database and persistent state**  
**Audit date:** 2025-01-27  
**Status:** C01–C04 complete, C05 N/A (dev data only)

---

## C01 — SQLite Usage Audit

All SQLite read/write paths in `ml-engine/` audited via grep on pattern
`sqlite|candle_db|CandleDatabase|DATABASE_URL|\.db`.

Files examined:

- `ml-engine/_lifespan.py`
- `ml-engine/training/trainer.py`
- `ml-engine/kafka/consumer.py`
- `ml-engine/features/feature_lineage.py`
- `ml-engine/scripts/migrate_to_postgres.py`
- `ml-engine/scripts/dvc_ingest.py`, `dvc_train.py`, `dvc_evaluate.py`, `dvc_features.py`
- `ml-engine/tests/conftest.py`, `test_data_quality_sessions.py`, `test_data_quality_pipeline.py`

---

## C02 — Classification

### MUST MOVE — Runtime-critical, blocks multi-pod scaling

| File                  | Usage                                                                      | Action                           | Code change?                     |
| --------------------- | -------------------------------------------------------------------------- | -------------------------------- | -------------------------------- |
| `_lifespan.py`        | `CandleDatabase(db_path=config.DB_PATH, database_url=config.DATABASE_URL)` | Set `DATABASE_URL` in k8s secret | **None** — dual-backend already  |
| `training/trainer.py` | `CandleDatabase(db_path=..., database_url=config.DATABASE_URL)`            | Set `DATABASE_URL` in k8s secret | **None** — dual-backend already  |
| `kafka/consumer.py`   | `CandleDatabase()` at 3 callsites (reads env via `__init__`)               | Set `DATABASE_URL` in k8s secret | **None** — env read is automatic |

**Key insight:** All three runtime consumers already use the `CandleDatabase` facade which reads `DATABASE_URL` from env as the first priority. **Zero code changes required** for production PostgreSQL cutover — only env var injection needed.

When `DATABASE_URL` is set in `ml-engine-secrets`, these files automatically use PostgreSQL.

To enforce PostgreSQL in production, also set `REQUIRE_DATABASE_URL=true` (currently `false` for dev).

### MAY STAY — Separate concern, not trading data

| File                          | Usage                                                      | Classification         | Reason                                                                                           |
| ----------------------------- | ---------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `features/feature_lineage.py` | Raw `sqlite3.connect(self.db_path)` → `feature_lineage.db` | **May stay as SQLite** | Separate catalog DB for feature metadata; not trading-critical; not multi-writer; single pod use |
| `scripts/dvc_ingest.py`       | `CandleDatabase(str(db_path))`                             | **May stay dev-only**  | DVC pipeline — local training only, not in prod containers                                       |
| `scripts/dvc_train.py`        | `CandleDatabase(str(db_path))`                             | **May stay dev-only**  | Same                                                                                             |
| `scripts/dvc_evaluate.py`     | `CandleDatabase(config.DB_PATH)`                           | **May stay dev-only**  | Same                                                                                             |
| `scripts/dvc_features.py`     | `CandleDatabase(config.DB_PATH)`                           | **May stay dev-only**  | Same                                                                                             |

`feature_lineage.py` note: If ml-engine scales to multiple pods, `feature_lineage.db` will diverge across pods. For multi-pod safety, migrate to a `feature_lineage` table in the main PostgreSQL database. Track as tech debt in Stage E.

### KEEP — Correct patterns, no change needed

| File                                  | Usage                                               | Classification                        |
| ------------------------------------- | --------------------------------------------------- | ------------------------------------- |
| `scripts/migrate_to_postgres.py`      | Reads SQLite → writes PostgreSQL                    | **Keep** — this IS the migration tool |
| `tests/conftest.py`                   | `CandleDatabase(tmp_db_path)` via temp file fixture | **Keep** — correct test pattern       |
| `tests/test_data_quality_sessions.py` | `sqlite3.connect(str(path))` — temp file fixture    | **Keep**                              |
| `tests/test_data_quality_pipeline.py` | `sqlite3.connect(db_path)` — temp file fixture      | **Keep**                              |

---

## C03 — PostgreSQL Schema Status

### Canonical schema: `ml-engine/data/schema_postgres.sql`

Used by `PostgresBackend._init_schema()` in `candle_db.py`. Applied automatically on first connection.

**Tables in `schema_postgres.sql`:**

| Table                | SQLite equivalent | Status                                                                                  |
| -------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `candles_5min`       | ✓                 | ✓ Complete parity                                                                       |
| `session_aggregates` | ✓                 | ✓ Complete parity                                                                       |
| `trade_log`          | ✓                 | ✓ Complete parity                                                                       |
| `model_registry`     | ✓                 | ✓ Complete parity                                                                       |
| `feature_importance` | ✓                 | ✓ Complete parity                                                                       |
| `training_log`       | ✓                 | ✓ Complete parity                                                                       |
| `signal_log`         | ✓                 | ✓ Complete parity + added `idx_signal_regime` + JSONB for `votes_json`/`consensus_json` |
| `signal_outcome`     | ✓                 | ✓ Complete parity                                                                       |

**All 8 tables have full PostgreSQL equivalents. Schema is production-ready.**

### Schema improvements in PostgreSQL vs SQLite:

- `INTEGER` → `BIGSERIAL` (scalable IDs)
- `TEXT` timestamps → `TIMESTAMPTZ` (timezone-aware)
- `TEXT` JSON columns → `JSONB` in `signal_log` (faster `@>` queries + GIN indexing)
- Extra index: `idx_signal_regime` on `signal_log(regime, signal_time DESC)`
- `UNIQUE(model_name)` enforced at DB level not just application level

### Issue found (C04): Migration script schema drift

`migrate_to_postgres.py` has an embedded `SCHEMA_SQL` that diverges from `schema_postgres.sql`:

- Missing tables: `signal_log`, `signal_outcome`
- Different `model_registry` columns (TimescaleDB-targeted version)
- Different `training_log` columns
- TimescaleDB-specific: `CREATE EXTENSION timescaledb`, `candles_1hour` continuous aggregate

**Fix applied in C04**: Migration script updated to load from `schema_postgres.sql` directly and add `signal_log`/`signal_outcome` to the migration table list.

---

## C04 — Migration Script

Script: `ml-engine/scripts/migrate_to_postgres.py`

### What it does:

1. Reads from `ml-engine/trading_data.db` (SQLite source)
2. Creates schema in PostgreSQL target (now using `schema_postgres.sql`)
3. Migrates data table by table in batches (10k candles, 5k trades, etc.)
4. Supports `--verify` mode (row count check without migrating)

### Running the migration:

```bash
# From project root
export DATABASE_URL="postgresql://user:pass@postgres:5432/trading"

# Full migration
python ml-engine/scripts/migrate_to_postgres.py \
  --source ml-engine/trading_data.db \
  --target-url $DATABASE_URL

# Verify only (no data written)
python ml-engine/scripts/migrate_to_postgres.py \
  --verify \
  --target-url $DATABASE_URL
```

### Tables migrated (in dependency order):

1. `candles_5min` — batch 10,000
2. `session_aggregates` — batch 1,000
3. `trade_log` — batch 5,000
4. `model_registry` — batch 100
5. `training_log` — batch 100
6. `feature_importance` — batch 5,000
7. `signal_log` — batch 5,000 _(added in C04 fix)_
8. `signal_outcome` — batch 5,000 _(added in C04 fix)_

All use `ON CONFLICT DO NOTHING` — idempotent, safe to re-run.

---

## C05 — Data Backfill Status

**`ml-engine/trading_data.db` found: 112 KB** — dev/test data only (no production trades).

Production data backfill strategy:

1. Load NinjaTrader CSVs via `ml-engine/scripts/load_ninjatrader_csv.py` against PostgreSQL `DATABASE_URL`
2. Optional: run `migrate_to_postgres.py` to move any accumulated dev SQLite data

No blocking production data exists. **C05 is N/A for initial production deployment.**

---

## Production Cutover Checklist

Prerequisites before enabling PostgreSQL in k8s:

- [ ] PostgreSQL pod running and healthy: `kubectl get pod -n tradersapp-dev -l app=mlflow-postgres`
- [ ] `DATABASE_URL` set in `ml-engine-secrets` (format: `postgresql://user:pass@host:5432/db`)
- [ ] `REQUIRE_DATABASE_URL=true` set in `ml-engine-secrets` (fail-fast guard)
- [ ] `ml-engine` pod restarted after secret update
- [ ] Schema applied: verify via `kubectl exec -it <ml-engine-pod> -- python -c "from data.candle_db import CandleDatabase; db = CandleDatabase(); print(db.backend_type)"` → should print `postgresql`
- [ ] Optional: run migration script to backfill dev data

---

## Tech Debt (Stage E)

- `feature_lineage.py` uses standalone `feature_lineage.db`. Safe for single-pod but will diverge under multi-pod deployment. Migrate to a `feature_lineage` table in the main PostgreSQL database in Stage E.
