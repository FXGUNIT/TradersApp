"""
Feast Feature Store Backfill Script

Backfills historical features from SQLite into the Feast online store (Redis).

Usage:
  # Full backfill (all symbols, all time)
  python -m ml_engine.features.feast_repo.backfill --symbol MNQ

  # Partial backfill (specific date range)
  python -m ml_engine.features.feast_repo.backfill \
    --symbol MNQ \
    --start 2025-01-01 \
    --end 2026-04-06

  # Per feature view
  python -m ml_engine.features.feast_repo.backfill \
    --symbol MNQ \
    --views candle_features,historical_features,session_features

  # Dry run (validate without writing to Redis)
  python -m ml_engine.features.feast_repo.backfill --symbol MNQ --dry-run

  # With custom Redis URL
  FEAST_REDIS_URL=redis://redis:6379 python -m ml_engine.features.feast_repo.backfill --symbol MNQ

Exit codes:
  0 = success
  1 = parameter error
  2 = database error
  3 = Redis error
"""

from __future__ import annotations

import os
import sys
import time
import logging
import argparse
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional, Iterator
from pathlib import Path

# Add ml-engine to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "ml-engine"))

import pandas as pd
import numpy as np

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("feast_backfill")


# ─── Redis Client ─────────────────────────────────────────────────────────────

class RedisWriter:
    """Writes materialized features to Redis with batching."""

    def __init__(self, redis_url: str, ttl_seconds: int = 86400, batch_size: int = 500):
        self.redis_url = redis_url
        self.ttl_seconds = ttl_seconds
        self.batch_size = batch_size
        self._redis = None
        self._connect()

    def _connect(self):
        if not REDIS_AVAILABLE:
            raise RuntimeError("Redis not available. Install with: pip install redis")
        self._redis = redis.from_url(self.redis_url, decode_responses=True)
        self._redis.ping()
        log.info(f"Connected to Redis: {self.redis_url}")

    def write_features(
        self,
        feature_view_name: str,
        entity_key: str,
        features: dict,
        timestamp: datetime,
    ) -> None:
        """Write a single feature row to Redis."""
        redis_key = f"tradersapp:{feature_view_name}:{entity_key}"
        feature_data = {}
        for k, v in features.items():
            if v is None or (isinstance(v, float) and np.isnan(v)):
                continue
            feature_data[k] = float(v) if isinstance(v, (int, float)) else str(v)
        feature_data["_timestamp"] = timestamp.isoformat()

        pipe = self._redis.pipeline()
        pipe.hset(redis_key, mapping=feature_data)
        pipe.expire(redis_key, self.ttl_seconds)
        pipe.execute()

    def write_batch(
        self,
        feature_view_name: str,
        rows: pd.DataFrame,
        entity_col: str = "symbol",
        timestamp_col: Optional[str] = None,
    ) -> int:
        """Write a batch of feature rows to Redis."""
        written = 0
        pipe = self._redis.pipeline()

        for _, row in rows.iterrows():
            entity_key = str(row.get(entity_col, "MNQ"))
            redis_key = f"tradersapp:{feature_view_name}:{entity_key}"

            feature_data = {}
            for col in rows.columns:
                if col in (entity_col, timestamp_col, "_timestamp"):
                    continue
                val = row.get(col)
                if val is None or (isinstance(val, float) and np.isnan(val)):
                    continue
                feature_data[col] = float(val) if isinstance(val, (int, float)) else str(val)

            if timestamp_col and timestamp_col in row:
                feature_data["_timestamp"] = str(row[timestamp_col])

            pipe.hset(redis_key, mapping=feature_data)
            pipe.expire(redis_key, self.ttl_seconds)
            written += 1

            if written % self.batch_size == 0:
                pipe.execute()
                pipe = self._redis.pipeline()

        if written % self.batch_size != 0:
            pipe.execute()

        return written

    def close(self):
        if self._redis:
            self._redis.close()


# ─── Feature View Backfills ──────────────────────────────────────────────────

def backfill_candle_features(
    db_path: str,
    writer: RedisWriter,
    symbol: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    dry_run: bool = False,
) -> int:
    """
    Backfill candle features from candles_5min table.

    Computes all derived features inline from raw OHLCV data.
    """
    log.info(f"Backfilling candle_features for {symbol} ({start} → {end})")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Compute features inline (matching feature_pipeline.py logic)
    query = """
        WITH candles AS (
            SELECT
                timestamp, symbol,
                open, high, low, close, volume,
                MAX(high, LAG(close,1) OVER w) - MIN(low, LAG(close,1) OVER w) AS tr,
                AVG(MAX(h, LAG(c,1) OVER w) - MIN(l, LAG(c,1) OVER w))
                    OVER (ORDER BY timestamp ROWS BETWEEN 13 PRECEDING AND CURRENT ROW) AS atr,
                LOG(close / NULLIF(LAG(close,1) OVER w, 0)) AS log_return,
                close - open AS intrabar_momentum,
                high - low AS range,
                (high - low) / NULLIF(low, 0) AS range_pct,
                (high - MAX(open, close)) / NULLIF(high - low, 0) AS upper_wick_pct,
                (MIN(open, close) - low) / NULLIF(high - low, 0) AS lower_wick_pct,
                LAG(close,1) OVER w AS prev_close,
                AVG(LOG(close / NULLIF(LAG(close,1) OVER w, 0)))
                    OVER (ORDER BY timestamp ROWS BETWEEN 9 PRECEDING AND CURRENT ROW) AS rolling_std_10,
                AVG(LOG(close / NULLIF(LAG(close,1) OVER w, 0)))
                    OVER (ORDER BY timestamp ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS rolling_std_20,
                AVG(LOG(close / NULLIF(LAG(close,1) OVER w, 0)))
                    OVER (ORDER BY timestamp ROWS BETWEEN 19 PRECEDING AND CURRENT ROW)
                    * SQRT(78) AS realized_vol,
                SUM(LOG(close / NULLIF(LAG(close,1) OVER w, 0)))
                    OVER (ORDER BY timestamp ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS momentum_3bar,
                SUM(LOG(close / NULLIF(LAG(close,1) OVER w, 0)))
                    OVER (ORDER BY timestamp ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) AS momentum_5bar,
                volume / NULLIF(
                    AVG(volume) OVER (ORDER BY timestamp ROWS BETWEEN 4 PRECEDING AND CURRENT ROW),
                    0
                ) AS volume_ratio_5
            FROM (
                SELECT
                    timestamp, symbol,
                    open, high, low, close, volume,
                    open AS o, high AS h, low AS l, close AS c
                FROM candles_5min
                WHERE symbol = :symbol
                    AND (:start IS NULL OR timestamp >= :start)
                    AND (:end IS NULL OR timestamp <= :end)
            )
            WINDOW w AS (ORDER BY timestamp)
            ORDER BY timestamp
        )
        SELECT
            timestamp,
            symbol,
            open, high, low, close, volume,
            tr AS tr,
            atr AS atr,
            atr / NULLIF(close, 0) AS atr_pct,
            log_return,
            intrabar_momentum,
            range AS range,
            range_pct,
            COALESCE(upper_wick_pct, 0) AS upper_wick_pct,
            COALESCE(lower_wick_pct, 0) AS lower_wick_pct,
            COALESCE(rolling_std_10, 0) AS rolling_std_10,
            COALESCE(rolling_std_20, 0) AS rolling_std_20,
            COALESCE(realized_vol, 0) AS realized_vol,
            COALESCE(momentum_3bar, 0) AS momentum_3bar,
            COALESCE(momentum_5bar, 0) AS momentum_5bar,
            COALESCE(volume_ratio_5, 1) AS volume_ratio_5,
            -- Default / placeholders for MathEngine features
            0.5 AS adx,
            50.0 AS ci,
            close AS vwap,
            0.0 AS vwap_slope_entry,
            1.0 AS vr,
            0.5 AS sweep_prob,
            1 AS volatility_regime,
            -- AMD phase (unknown during backfill)
            0.0 AS amd_ACCUMULATION,
            0.0 AS amd_MANIPULATION,
            0.0 AS amd_DISTRIBUTION,
            0.0 AS amd_TRANSITION,
            1.0 AS amd_UNCLEAR,
            1 AS vr_regime
        FROM candles
        WHERE timestamp IS NOT NULL
    """

    params = {"symbol": symbol, "start": start.isoformat() if start else None, "end": end.isoformat() if end else None}

    rows = 0
    batch = []

    for chunk in pd.read_sql_query(query, conn, params=params, chunksize=1000):
        if dry_run:
            rows += len(chunk)
            continue

        for _, row in chunk.iterrows():
            batch.append(row.to_dict())
            if len(batch) >= 500:
                df = pd.DataFrame(batch)
                writer.write_batch("candle_features", df, entity_col="symbol", timestamp_col="timestamp")
                rows += len(batch)
                batch = []
                log.info(f"  candle_features: {rows} rows written")

        if rows > 0 and rows % 10000 == 0:
            log.info(f"  candle_features progress: {rows} rows")

    if batch:
        df = pd.DataFrame(batch)
        if not dry_run:
            writer.write_batch("candle_features", df, entity_col="symbol", timestamp_col="timestamp")
        rows += len(batch)

    conn.close()
    log.info(f"candle_features: {rows} rows {'validated' if dry_run else 'written'}")
    return rows


def backfill_historical_features(
    db_path: str,
    writer: RedisWriter,
    symbol: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    dry_run: bool = False,
) -> int:
    """Backfill rolling historical features from trade_log."""
    log.info(f"Backfilling historical_features for {symbol} ({start} → {end})")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    query = """
        WITH trades AS (
            SELECT
                entry_time,
                symbol,
                result,
                pnl_ticks,
                pnl_dollars,
                CASE WHEN result = 'win' THEN 1 ELSE 0 END AS is_win,
                CASE WHEN result = 'loss' THEN 1 ELSE 0 END AS is_loss,
                SUM(pnl_ticks) OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS gross_wins,
                SUM(CASE WHEN pnl_ticks < 0 THEN ABS(pnl_ticks) ELSE 0 END)
                    OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS gross_losses,
                AVG(pnl_dollars) OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS expectancy_20,
                SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END)
                    OVER (ORDER BY entry_time ROWS BETWEEN 49 PRECEDING AND CURRENT ROW) AS wins_50,
                COUNT(*) OVER (ORDER BY entry_time ROWS BETWEEN 49 PRECEDING AND CURRENT ROW) AS count_50,
                AVG(CASE WHEN result = 'win' THEN 1.0 ELSE 0.0 END)
                    OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS win_rate_20,
                AVG(CASE WHEN result = 'win' THEN 1.0 ELSE 0.0 END)
                    OVER (ORDER BY entry_time ROWS BETWEEN 49 PRECEDING AND CURRENT ROW) AS win_rate_50
            FROM trade_log
            WHERE symbol = :symbol
                AND exit_time IS NOT NULL
                AND (:start IS NULL OR entry_time >= :start)
                AND (:end IS NULL OR entry_time <= :end)
        )
        SELECT
            entry_time AS timestamp,
            symbol,
            win_rate_20,
            win_rate_50,
            expectancy_20,
            CASE WHEN gross_losses > 0 THEN gross_wins / gross_losses ELSE 1.0 END AS profit_factor_20,
            -- AMD phase win rates (placeholders — computed from AMD model)
            0.5 AS amd_win_rate_ACCUMULATION,
            0.5 AS amd_win_rate_MANIPULATION,
            0.5 AS amd_win_rate_DISTRIBUTION,
            0.5 AS amd_win_rate_TRANSITION
        FROM trades
        WHERE win_rate_20 IS NOT NULL
        ORDER BY entry_time
    """

    params = {"symbol": symbol, "start": start.isoformat() if start else None, "end": end.isoformat() if end else None}

    rows = 0
    batch = []

    for chunk in pd.read_sql_query(query, conn, params=params, chunksize=500):
        if dry_run:
            rows += len(chunk)
            continue

        for _, row in chunk.iterrows():
            batch.append(row.to_dict())
            if len(batch) >= 500:
                df = pd.DataFrame(batch)
                writer.write_batch("historical_features", df, entity_col="symbol", timestamp_col="timestamp")
                rows += len(batch)
                batch = []
                log.info(f"  historical_features: {rows} rows written")

    if batch:
        df = pd.DataFrame(batch)
        if not dry_run:
            writer.write_batch("historical_features", df, entity_col="symbol", timestamp_col="timestamp")
        rows += len(batch)

    conn.close()
    log.info(f"historical_features: {rows} rows {'validated' if dry_run else 'written'}")
    return rows


def backfill_session_features(
    db_path: str,
    writer: RedisWriter,
    symbol: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    dry_run: bool = False,
) -> int:
    """Backfill session aggregate features."""
    log.info(f"Backfilling session_features for {symbol} ({start} → {end})")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    query = """
        SELECT
            trade_date AS timestamp,
            symbol,
            direction,
            close_to_open,
            gap_pct,
            session_range,
            range_vs_atr,
            gap_fill_pct,
            daily_range_used_pct,
            volume_ratio AS volume_ratio_sess,
            candle_count
        FROM session_aggregates
        WHERE symbol = :symbol
            AND (:start IS NULL OR trade_date >= :start)
            AND (:end IS NULL OR trade_date <= :end)
        ORDER BY trade_date
    """

    params = {"symbol": symbol, "start": start.isoformat() if start else None, "end": end.isoformat() if end else None}

    rows = 0
    batch = []

    for chunk in pd.read_sql_query(query, conn, params=params, chunksize=500):
        if dry_run:
            rows += len(chunk)
            continue

        for _, row in chunk.iterrows():
            batch.append(row.to_dict())
            if len(batch) >= 500:
                df = pd.DataFrame(batch)
                writer.write_batch("session_features", df, entity_col="symbol", timestamp_col="timestamp")
                rows += len(batch)
                batch = []

    if batch:
        df = pd.DataFrame(batch)
        if not dry_run:
            writer.write_batch("session_features", df, entity_col="symbol", timestamp_col="timestamp")
        rows += len(batch)

    conn.close()
    log.info(f"session_features: {rows} rows {'validated' if dry_run else 'written'}")
    return rows


def validate_materialization(writer: RedisWriter, symbol: str, expected_counts: dict) -> dict:
    """Validate that features were materialized correctly."""
    log.info("Validating materialization...")

    results = {}
    for view_name, expected in expected_counts.items():
        redis_key_pattern = f"tradersapp:{view_name}:{symbol}"
        # Count keys matching pattern
        keys = list(writer._redis.scan_iter(f"tradersapp:{view_name}:{symbol}*"))
        actual = len(keys)

        # Sample a key to check feature completeness
        if keys:
            sample_key = keys[0]
            data = writer._redis.hgetall(sample_key)
            feature_count = len([k for k in data.keys() if not k.startswith("_")])
        else:
            feature_count = 0

        status = "OK" if actual >= expected * 0.9 else "INCOMPLETE" if actual > 0 else "MISSING"
        results[view_name] = {
            "expected_min": expected,
            "actual": actual,
            "status": status,
            "sample_feature_count": feature_count,
        }
        log.info(f"  {view_name}: {actual}/{expected} rows, {feature_count} features/sample, {status}")

    return results


# ─── CLI ────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Backfill Feast feature store from SQLite to Redis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--symbol", default=os.environ.get("FEAST_SYMBOL", "MNQ"), help="Trading symbol (default: MNQ)")
    parser.add_argument("--start", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", help="End date (YYYY-MM-DD)")
    parser.add_argument("--db", default=os.environ.get("FEAST_DB_PATH", str(PROJECT_ROOT / "ml-engine" / "data" / "trading_data.db")), help="SQLite database path")
    parser.add_argument("--redis-url", default=os.environ.get("FEAST_REDIS_URL", "redis://localhost:6379"), help="Redis URL")
    parser.add_argument("--ttl", type=int, default=86400, help="Redis TTL in seconds (default: 86400 = 24h)")
    parser.add_argument("--views", default="candle_features,historical_features,session_features", help="Comma-separated feature views to backfill")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing to Redis")
    parser.add_argument("--batch-size", type=int, default=500, help="Redis pipeline batch size")
    parser.add_argument("--validate", action="store_true", help="Run validation after backfill")
    parser.add_argument("--workers", type=int, default=1, help="Number of parallel workers (future)")
    return parser.parse_args()


def main():
    args = parse_args()

    log.info("=" * 60)
    log.info(f"Feast Backfill — TradersApp")
    log.info(f"  Symbol: {args.symbol}")
    log.info(f"  Start: {args.start or 'beginning'}")
    log.info(f"  End: {args.end or 'now'}")
    log.info(f"  DB: {args.db}")
    log.info(f"  Redis: {args.redis_url}")
    log.info(f"  Dry run: {args.dry_run}")
    log.info("=" * 60)

    # Parse dates
    start = datetime.fromisoformat(args.start) if args.start else None
    end = datetime.fromisoformat(args.end) if args.end else datetime.now(timezone.utc)

    # Validate DB
    if not os.path.exists(args.db):
        log.error(f"Database not found: {args.db}")
        sys.exit(2)

    views = [v.strip() for v in args.views.split(",")]

    total_start = time.time()
    total_rows = {}

    if not args.dry_run:
        writer = RedisWriter(args.redis_url, ttl_seconds=args.ttl, batch_size=args.batch_size)
    else:
        writer = None

    try:
        for view in views:
            row_count = 0
            if view == "candle_features":
                row_count = backfill_candle_features(args.db, writer, args.symbol, start, end, args.dry_run)
            elif view == "historical_features":
                row_count = backfill_historical_features(args.db, writer, args.symbol, start, end, args.dry_run)
            elif view == "session_features":
                row_count = backfill_session_features(args.db, writer, args.symbol, start, end, args.dry_run)
            else:
                log.warning(f"Unknown feature view: {view}")
                continue
            total_rows[view] = row_count

        # Validation
        if args.validate and not args.dry_run:
            results = validate_materialization(writer, args.symbol, total_rows)
            all_ok = all(r["status"] == "OK" for r in results.values())
            if not all_ok:
                log.warning("Validation found incomplete feature views — review above")

        elapsed = time.time() - total_start
        log.info("=" * 60)
        log.info(f"Backfill complete in {elapsed:.1f}s")
        for view, count in total_rows.items():
            log.info(f"  {view}: {count} rows")
        log.info("=" * 60)

    except sqlite3.Error as e:
        log.error(f"Database error: {e}")
        sys.exit(2)
    except redis.ConnectionError as e:
        log.error(f"Redis connection error: {e}")
        sys.exit(3)
    except Exception as e:
        log.error(f"Unexpected error: {e}")
        raise
    finally:
        if writer:
            writer.close()


if __name__ == "__main__":
    main()
