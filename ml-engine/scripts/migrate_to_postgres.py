"""
PostgreSQL + TimescaleDB Migration Script

Migrates data from SQLite WAL (ml-engine/trading_data.db) to
Neon PostgreSQL (serverless, auto-scaling, free tier 0.5GB).

Usage:
  1. Set DATABASE_URL in environment:
       export DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
       # Or via Infisical: infisical run -- python scripts/migrate_to_postgres.py

  2. Run migration:
       python scripts/migrate_to_postgres.py --source ml-engine/trading_data.db --target-url $DATABASE_URL

  3. Verify:
       python scripts/migrate_to_postgres.py --verify --target-url $DATABASE_URL

Prerequisites:
  pip install psycopg2-binary sqlalchemy pandas tqdm

Neon setup:
  1. Go to https://neon.tech → Create project
  2. Copy connection string (Connection Details → URI)
  3. Paste into Infisical as DATABASE_URL

TimescaleDB extension (optional, for hypertables):
  TimescaleDB is pre-installed on Neon — no extra setup needed.
  Enables: CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
  Then: SELECT create_hypertable('candles_5min', 'timestamp', migrate_data => FALSE);
"""
from __future__ import annotations
import argparse
import sqlite3
import os
import sys
import time
import logging
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schema — load from canonical source to avoid drift
# ---------------------------------------------------------------------------

# Path relative to this script's location: ../data/schema_postgres.sql
_SCHEMA_FILE = Path(__file__).parent.parent / "data" / "schema_postgres.sql"


def _load_schema() -> str:
    """Load canonical PostgreSQL schema from schema_postgres.sql."""
    if not _SCHEMA_FILE.exists():
        raise FileNotFoundError(
            f"Schema file not found: {_SCHEMA_FILE}\n"
            "Run from project root or ensure ml-engine/data/schema_postgres.sql exists."
        )
    return _SCHEMA_FILE.read_text(encoding="utf-8")


# Legacy inline schema retained here for reference only — NOT used at runtime.
# Canonical schema is ml-engine/data/schema_postgres.sql.
# TimescaleDB extension (Neon-specific): enable manually after migration if needed:
#   CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
#   SELECT create_hypertable('candles_5min', 'timestamp', migrate_data => TRUE);
SCHEMA_SQL_LEGACY = """
-- Enable TimescaleDB extension (Neon has it pre-installed)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ── 5-minute candle data ──────────────────────────────────────────────────
CREATE TABLE candles_5min (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL,
    symbol          TEXT        NOT NULL DEFAULT 'MNQ',
    open            NUMERIC(12, 4) NOT NULL,
    high            NUMERIC(12, 4) NOT NULL,
    low             NUMERIC(12, 4) NOT NULL,
    close           NUMERIC(12, 4) NOT NULL,
    volume          BIGINT      NOT NULL,
    tick_volume     BIGINT      DEFAULT 0,
    session_id      SMALLINT    NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(timestamp, symbol)
);

-- TimescaleDB hypertable (enables fast time-range queries + compression)
SELECT create_hypertable('candles_5min', 'timestamp',
    chunk_time_interval => INTERVAL '7 days',
    migrate_data => TRUE);

-- Compression policy (Neon: free tier compresses old chunks automatically)
ALTER TABLE candles_5min SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol'
);
SELECT add_compression_policy('candles_5min', INTERVAL '7 days');

-- Continuous aggregate: 1-hour candles (pre-computed for fast ML queries)
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1hour
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    symbol,
    FIRST(open, timestamp)    AS open,
    MAX(high)                AS high,
    MIN(low)                 AS low,
    LAST(close, timestamp)    AS close,
    SUM(volume)              AS volume,
    session_id
FROM candles_5min
GROUP BY bucket, symbol, session_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1hour',
    start_offset     => INTERVAL '3 hours',
    end_offset       => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candles_ts_desc   ON candles_5min (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candles_sess    ON candles_5min (session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candles_symbol  ON candles_5min (symbol, timestamp DESC);

-- ── Session aggregates ───────────────────────────────────────────────────
CREATE TABLE session_aggregates (
    id              BIGSERIAL PRIMARY KEY,
    trade_date      DATE        NOT NULL,
    symbol          TEXT        NOT NULL DEFAULT 'MNQ',
    session_id      SMALLINT    NOT NULL,
    session_high    NUMERIC(12, 4) NOT NULL,
    session_low     NUMERIC(12, 4) NOT NULL,
    session_open    NUMERIC(12, 4) NOT NULL,
    session_close   NUMERIC(12, 4) NOT NULL,
    session_range   NUMERIC(12, 4) NOT NULL,
    total_volume    BIGINT      NOT NULL,
    avg_volume      NUMERIC(12, 2) NOT NULL,
    volume_ratio    NUMERIC(6, 3) NOT NULL,
    avg_true_range  NUMERIC(12, 4) NOT NULL,
    realized_vol    NUMERIC(12, 6) NOT NULL,
    close_to_open   NUMERIC(10, 6) NOT NULL,
    direction       SMALLINT    NOT NULL,
    gap_pct         NUMERIC(10, 6) NOT NULL,
    range_vs_atr    NUMERIC(8, 4) NOT NULL,
    candle_count    INTEGER     NOT NULL,
    UNIQUE(trade_date, symbol, session_id)
);
CREATE INDEX IF NOT EXISTS idx_session_date ON session_aggregates (trade_date DESC);

-- ── Trade log ───────────────────────────────────────────────────────────
CREATE TABLE trade_log (
    id                  BIGSERIAL PRIMARY KEY,
    entry_time          TIMESTAMPTZ NOT NULL,
    exit_time           TIMESTAMPTZ,
    symbol              TEXT        NOT NULL DEFAULT 'MNQ',
    entry_price         NUMERIC(12, 4) NOT NULL,
    exit_price          NUMERIC(12, 4),
    direction           SMALLINT    NOT NULL,
    session_id          SMALLINT    NOT NULL,
    pnl_ticks           NUMERIC(10, 3),
    pnl_dollars         NUMERIC(12, 4),
    result              TEXT,
    target_rrr          NUMERIC(6, 3) NOT NULL,
    actual_rrr          NUMERIC(6, 3),
    rrr_met             BOOLEAN,
    amd_phase           TEXT,
    adx_entry           NUMERIC(8, 3),
    atr_entry           NUMERIC(12, 4),
    ci_entry            NUMERIC(8, 3),
    vwap_entry          NUMERIC(12, 4),
    vwap_slope_entry    NUMERIC(6, 3),
    vr_entry            NUMERIC(6, 3),
    volatility_regime   SMALLINT,
    expected_move_ticks NUMERIC(10, 3),
    actual_move_ticks   NUMERIC(10, 3),
    alpha_raw           NUMERIC(10, 4),
    holding_minutes     NUMERIC(8, 2),
    exit_type           TEXT,
    UNIQUE(entry_time, symbol)
);
CREATE INDEX IF NOT EXISTS idx_trade_session ON trade_log (session_id, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trade_result ON trade_log (result, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trade_amd    ON trade_log (amd_phase, entry_time DESC);

-- ── Model registry ──────────────────────────────────────────────────────
CREATE TABLE model_registry (
    id              BIGSERIAL PRIMARY KEY,
    model_name      TEXT        NOT NULL,
    version         INTEGER     NOT NULL,
    feature_cols    JSONB,
    trained_at      TIMESTAMPTZ DEFAULT NOW(),
    accuracy        NUMERIC(6, 4),
    cv_roc_auc_mean NUMERIC(6, 4),
    cv_roc_auc_std  NUMERIC(6, 4),
    n_samples       INTEGER,
    dataset_start   TIMESTAMPTZ,
    dataset_end     TIMESTAMPTZ,
    model_path      TEXT,
    notes           TEXT,
    UNIQUE(model_name, version)
);
CREATE INDEX IF NOT EXISTS idx_model_name ON model_registry (model_name);

-- ── Training log ───────────────────────────────────────────────────────
CREATE TABLE training_log (
    id              BIGSERIAL PRIMARY KEY,
    model_name      TEXT        NOT NULL,
    version         INTEGER,
    trained_at      TIMESTAMPTZ DEFAULT NOW(),
    duration_sec    INTEGER,
    n_samples       INTEGER,
    accuracy_before NUMERIC(6, 4),
    accuracy_after  NUMERIC(6, 4),
    improvement     NUMERIC(6, 4),
    mode            TEXT,
    notes           TEXT
);

-- ── Feature importance ──────────────────────────────────────────────────
CREATE TABLE feature_importance (
    id              BIGSERIAL PRIMARY KEY,
    model_name      TEXT        NOT NULL,
    version         INTEGER,
    feature         TEXT        NOT NULL,
    importance      NUMERIC(10, 6),
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feat_imp_model ON feature_importance (model_name, recorded_at DESC);

-- ── Refresh continuous aggregates ─────────────────────────────────────
CALL refresh_continuous_aggregate('candles_1hour', NULL, NULL);
"""


# ---------------------------------------------------------------------------
# Migration
# ---------------------------------------------------------------------------

def get_sqlite_conn(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def get_pg_conn(url: str):
    try:
        import psycopg2
        return psycopg2.connect(url)
    except ImportError:
        try:
            from sqlalchemy import create_engine
            return create_engine(url).connect()
        except ImportError:
            raise ImportError(
                "psycopg2-binary or sqlalchemy required. "
                "Install: pip install psycopg2-binary"
            )


def migrate_table(
    src_conn: sqlite3.Connection,
    dst_conn,
    table: str,
    columns: list[str],
    batch_size: int = 5000,
    vacuum_after: bool = False,
):
    """Migrate a single table from SQLite → PostgreSQL."""
    log.info(f"Migrating table: {table}")

    # Count rows
    cur = src_conn.execute(f"SELECT COUNT(*) FROM {table}")
    total = cur.fetchone()[0]
    log.info(f"  {total} rows to migrate")

    if total == 0:
        log.info(f"  Table {table} is empty — skipping")
        return

    col_list = ", ".join(columns)
    placeholders = ", ".join(["%s"] * len(columns))

    offset = 0
    migrated = 0
    while offset < total:
        rows = src_conn.execute(
            f"SELECT {col_list} FROM {table} LIMIT {batch_size} OFFSET {offset}"
        ).fetchall()
        if not rows:
            break

        cur = dst_conn.cursor()
        cur.executemany(
            f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING",
            rows,
        )
        dst_conn.commit()
        migrated += len(rows)
        offset += batch_size
        log.info(f"  Migrated {migrated}/{total} rows")

    if vacuum_after:
        log.info(f"  Running VACUUM ANALYZE on {table}")
        dst_conn.execute(f"VACUUM ANALYZE {table}")

    log.info(f"  Done: {table}")


def run_migration(source_db: str, target_url: str, verify: bool = False):
    """Run the full migration."""
    log.info(f"Source: {source_db}")
    log.info(f"Target: {target_url.split('@')[0].split(':')[0]}@{target_url.split('@')[1].split('/')[0]}")

    if not os.path.exists(source_db):
        log.error(f"Source database not found: {source_db}")
        sys.exit(1)

    src = get_sqlite_conn(source_db)
    dst = get_pg_conn(target_url)

    if verify:
        log.info("=== VERIFICATION MODE ===")
        for table in ["candles_5min", "trade_log", "session_aggregates"]:
            cur = dst.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            log.info(f"  {table}: {count} rows in PostgreSQL")
        return

    log.info("=== CREATING SCHEMA ===")
    # Load canonical schema from schema_postgres.sql
    schema_sql = _load_schema()
    # Execute schema statement by statement (some may fail on re-run — non-fatal)
    for stmt in schema_sql.split(";"):
        stmt = stmt.strip()
        if not stmt or stmt.startswith("--"):
            continue
        try:
            dst.execute(stmt)
            dst.commit()
        except Exception as e:
            log.warning(f"  Schema statement failed (non-fatal): {e}")
            dst.rollback()

    log.info("=== MIGRATING DATA ===")

    # candles_5min
    migrate_table(
        src, dst, "candles_5min",
        ["id", "timestamp", "symbol", "open", "high", "low", "close",
         "volume", "tick_volume", "session_id", "created_at"],
        batch_size=10000,
    )

    # session_aggregates
    migrate_table(
        src, dst, "session_aggregates",
        ["id", "trade_date", "symbol", "session_id", "session_high",
         "session_low", "session_open", "session_close", "session_range",
         "total_volume", "avg_volume", "volume_ratio", "avg_true_range",
         "realized_vol", "close_to_open", "direction", "gap_pct",
         "range_vs_atr", "candle_count"],
        batch_size=1000,
    )

    # trade_log
    migrate_table(
        src, dst, "trade_log",
        ["id", "entry_time", "exit_time", "symbol", "entry_price", "exit_price",
         "direction", "session_id", "pnl_ticks", "pnl_dollars", "result",
         "target_rrr", "actual_rrr", "rrr_met", "amd_phase", "adx_entry",
         "atr_entry", "ci_entry", "vwap_entry", "vwap_slope_entry", "vr_entry",
         "volatility_regime", "expected_move_ticks", "actual_move_ticks",
         "alpha_raw", "holding_minutes", "exit_type"],
        batch_size=5000,
    )

    # model_registry
    migrate_table(
        src, dst, "model_registry",
        ["id", "model_name", "version", "feature_cols", "trained_at",
         "accuracy", "cv_roc_auc_mean", "cv_roc_auc_std", "n_samples",
         "dataset_start", "dataset_end", "model_path", "notes"],
        batch_size=100,
    )

    # training_log
    migrate_table(
        src, dst, "training_log",
        ["id", "model_name", "version", "trained_at", "duration_sec",
         "n_samples", "accuracy_before", "accuracy_after", "improvement",
         "mode", "notes"],
        batch_size=100,
    )

    # feature_importance
    migrate_table(
        src, dst, "feature_importance",
        ["id", "model_name", "feature", "importance", "computed_at"],
        batch_size=5000,
    )

    # signal_log (feedback loop — migrate only if table exists in source)
    src_tables = {r[0] for r in src.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    if "signal_log" in src_tables:
        migrate_table(
            src, dst, "signal_log",
            ["id", "signal_time", "symbol", "session_id", "signal",
             "confidence", "regime", "regime_confidence", "market_regime",
             "session_phase", "votes_json", "consensus_json",
             "matched_trade_id", "outcome_result", "outcome_correct", "created_at"],
            batch_size=5000,
        )
    else:
        log.info("  signal_log not in source — skipping")

    if "signal_outcome" in src_tables:
        migrate_table(
            src, dst, "signal_outcome",
            ["id", "signal_id", "trade_id", "result", "correct",
             "pnl_ticks", "pnl_dollars", "actual_move_ticks",
             "expected_move_ticks", "recorded_at"],
            batch_size=5000,
        )
    else:
        log.info("  signal_outcome not in source — skipping")

    src.close()
    dst.close()
    log.info("=== MIGRATION COMPLETE ===")
    log.info("  Update ml-engine/config.py: DATABASE_URL = os.getenv('DATABASE_URL')")
    log.info("  Update ml-engine/data/candle_db.py to use SQLAlchemy with PostgreSQL driver")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate SQLite → Neon PostgreSQL")
    parser.add_argument("--source", default="ml-engine/trading_data.db",
                        help="Source SQLite database path")
    parser.add_argument("--target-url", default=os.getenv("DATABASE_URL"),
                        help="PostgreSQL connection string (or set DATABASE_URL env var)")
    parser.add_argument("--verify", action="store_true",
                        help="Verify PostgreSQL row counts without migrating")
    args = parser.parse_args()

    if not args.target_url:
        log.error("No DATABASE_URL. Set it via: export DATABASE_URL='postgresql://...'\n"
                  "  Or: python scripts/migrate_to_postgres.py --target-url 'postgresql://...'")
        sys.exit(1)

    run_migration(args.source, args.target_url, verify=args.verify)
