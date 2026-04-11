"""
Custom Feast Provider — materializes features from SQLite to Redis.

Custom provider for TradersApp:
  - Offline: reads from SQLite (existing trading_data.db)
  - Online: writes to Redis

This provider implements the Feast Provider interface to bridge
SQLite-based offline storage with Redis online serving without
requiring Parquet file exports.

Usage:
  1. feast apply                 — register all feature views
  2. python -m ml_engine.features.feast_repo.materialize --all  — materialize to Redis
  3. Feast client: feast get-online-features(...)  — retrieve features

Environment variables:
  FEAST_DB_PATH: path to SQLite database (default: ml_engine/data/trading_data.db)
  FEAST_REDIS_URL: Redis connection URL (default: redis://localhost:6379)
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
import numpy as np

from feast import provider
from feast.infra.offline_stores.sqlite import SQLiteOfflineStore
from feast.infra.online_stores.redis import RedisOnlineStore
from feast.repo_config import RepoConfig
from feast.feature_view import FeatureView
from feast.entity import Entity

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class TradersProvider(provider.Provider):
    """
    Custom Feast provider for TradersApp.

    Offline: SQLite (read-only from existing trading_data.db)
    Online: Redis (write materialized features)

    Materialization strategy:
      1. Read feature data from SQLite using raw SQL queries
      2. Transform to feature DataFrame with entity keys
      3. Write to Redis with TTL
    """

    def __init__(self, config: RepoConfig, **kwargs):
        self.config = config
        db_path = os.environ.get(
            "FEAST_DB_PATH",
            os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))),
                "data", "trading_data.db",
            ),
        )
        self.db_path = db_path

        # Redis online store
        redis_url = os.environ.get(
            "FEAST_REDIS_URL",
            "redis://localhost:6379",
        )
        self._redis_url = redis_url
        self._redis: Optional[object] = None
        if REDIS_AVAILABLE:
            try:
                self._redis = redis.from_url(redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None

    def _query_sqlite(self, query: str, params: list | None = None) -> pd.DataFrame:
        """Execute a SQL query against the SQLite database."""
        import sqlite3
        conn = sqlite3.connect(self.db_path)
        try:
            return pd.read_sql_query(query, conn, params=params, parse_dates=self._get_datetime_cols(query))
        finally:
            conn.close()

    def _get_datetime_cols(self, query: str) -> list[str]:
        """Detect datetime columns from a query (simple heuristic)."""
        datetime_keywords = ["timestamp", "time", "date", "created_at"]
        cols = []
        for kw in datetime_keywords:
            if kw in query.lower():
                cols.append(kw)
        return cols

    # ─── Offline store ─────────────────────────────────────────────────────────

    def get_offline_store(self):
        return SQLiteOfflineStore()

    def pull_latest_from_offline_store(
        self,
        feature_views: list[FeatureView],
        entity_df: pd.DataFrame,
        registry,
        project: str,
    ) -> pd.DataFrame:
        """
        Pull the latest features from the offline store for training.

        Matches the entity_df against feature views using merge_asof
        for temporal features. This is the primary method for building
        training datasets.
        """
        results = []

        for fv in feature_views:
            try:
                df = self._pull_features_for_view(fv, entity_df)
                if not df.empty:
                    results.append(df)
            except Exception as e:
                print(f"[Feast] Warning: could not pull features for {fv.name}: {e}")

        if not results:
            return pd.DataFrame()

        # Merge all feature views onto entity_df
        merged = entity_df.copy()
        for df in results:
            # Drop entity columns from feature df to avoid duplication
            feat_cols = [c for c in df.columns if c not in entity_df.columns]
            if feat_cols:
                merged = merged.merge(df[feat_cols], left_index=True, right_index=True, how="left")

        return merged

    def _pull_features_for_view(
        self,
        fv: FeatureView,
        entity_df: pd.DataFrame,
    ) -> pd.DataFrame:
        """
        Pull features for a single feature view.
        Uses the feature view name to route to the appropriate SQL query.
        """
        if fv.name == "candle_features":
            return self._pull_candle_features(entity_df)
        elif fv.name == "historical_features":
            return self._pull_historical_features(entity_df)
        elif fv.name == "session_features":
            return self._pull_session_features(entity_df)
        else:
            return pd.DataFrame()

    def _pull_candle_features(self, entity_df: pd.DataFrame) -> pd.DataFrame:
        """Pull candle features from candles_5min table."""
        if entity_df.empty:
            return pd.DataFrame()

        # Get time range from entity_df
        if "timestamp" in entity_df.columns:
            ts_col = "timestamp"
        elif "event_timestamp" in entity_df.columns:
            ts_col = "event_timestamp"
        else:
            return pd.DataFrame()

        timestamps = pd.to_datetime(entity_df[ts_col])
        start = timestamps.min()
        end = timestamps.max()

        symbol = entity_df["symbol"].iloc[0] if "symbol" in entity_df.columns else "MNQ"

        # Read candles from SQLite
        query = f"""
            SELECT
                timestamp, symbol,
                open, high, low, close, volume,
                -- Computed features (these are pre-computed in the DB or derived)
                close - open AS intrabar_momentum,
                high - low AS range,
                (high - low) / NULLIF(low, 0) AS range_pct,
                -- Simple rolling stats (computed inline for simplicity)
                -- Full feature pipeline uses feature_pipeline.py for production
                close AS close_price
            FROM candles_5min
            WHERE symbol = ?
              AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp ASC
        """
        df = self._query_sqlite(query, [symbol, start.isoformat(), end.isoformat()])
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        return df.set_index("timestamp")

    def _pull_historical_features(self, entity_df: pd.DataFrame) -> pd.DataFrame:
        """Pull historical trade features from trade_log table."""
        if entity_df.empty:
            return pd.DataFrame()

        symbol = entity_df["symbol"].iloc[0] if "symbol" in entity_df.columns else "MNQ"

        query = f"""
            SELECT
                entry_time,
                symbol,
                -- Rolling win rate (last 20 trades)
                CAST(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END)
                     OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW)
                     AS FLOAT) /
                CAST(COUNT(*) OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW)
                     AS FLOAT) AS win_rate_20,
                -- Rolling expectancy (last 20 trades)
                AVG(pnl_dollars) OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW)
                     AS expectancy_20,
                -- Rolling profit factor
                CASE
                    WHEN SUM(CASE WHEN pnl_ticks < 0 THEN ABS(pnl_ticks) ELSE 0 END)
                         OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) = 0
                    THEN NULL
                    ELSE SUM(CASE WHEN pnl_ticks > 0 THEN pnl_ticks ELSE 0 END)
                         OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) /
                         SUM(CASE WHEN pnl_ticks < 0 THEN ABS(pnl_ticks) ELSE 0 END)
                         OVER (ORDER BY entry_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW)
                END AS profit_factor_20
            FROM trade_log
            WHERE symbol = ?
              AND exit_time IS NOT NULL
            ORDER BY entry_time ASC
        """
        df = self._query_sqlite(query, [symbol])
        df["entry_time"] = pd.to_datetime(df["entry_time"])
        return df.set_index("entry_time")

    def _pull_session_features(self, entity_df: pd.DataFrame) -> pd.DataFrame:
        """Pull session aggregate features from session_aggregates table."""
        if entity_df.empty:
            return pd.DataFrame()

        symbol = entity_df["symbol"].iloc[0] if "symbol" in entity_df.columns else "MNQ"

        query = f"""
            SELECT
                trade_date,
                symbol,
                direction,
                close_to_open,
                gap_pct,
                session_range,
                range_vs_atr,
                volume_ratio AS volume_ratio_sess,
                candle_count
            FROM session_aggregates
            WHERE symbol = ?
            ORDER BY trade_date ASC
        """
        df = self._query_sqlite(query, [symbol])
        df["trade_date"] = pd.to_datetime(df["trade_date"])
        return df.set_index("trade_date")

    # ─── Online store ─────────────────────────────────────────────────────────

    def get_online_store(self):
        return RedisOnlineStore()

    def online_read_prebuilt_features(
        self,
        table: str,
        entity_keys: list[dict],
    ) -> list[tuple[dict, datetime]]:
        """
        Read pre-built features from Redis for a list of entity keys.
        Used for online inference — must return features in <10ms.
        """
        if self._redis is None:
            return [(None, datetime.min)] * len(entity_keys)

        results = []
        for key in entity_keys:
            # Redis key format: {project}:{feature_view}:{entity_key_hash}
            redis_key = self._build_redis_key(table, key)
            try:
                data = self._redis.hgetall(redis_key)
                # Parse timestamps
                feature_dict = {}
                for k, v in data.items():
                    if k.endswith("_timestamp"):
                        continue
                    try:
                        feature_dict[k] = float(v)
                    except (ValueError, TypeError):
                        feature_dict[k] = v
                results.append((feature_dict, datetime.now(timezone.utc)))
            except Exception:
                results.append((None, datetime.min))

        return results

    def write_to_online_store(
        self,
        feature_view: FeatureView,
        features: pd.DataFrame,
        timestamp: datetime,
        registry,
    ):
        """
        Write materialized features to Redis.

        Called by `feast materialize` and `feast materialize-incremental`.
        Uses Redis hash for efficient storage.
        """
        if self._redis is None:
            print(f"[Feast] Warning: Redis not available, skipping online write for {feature_view.name}")
            return

        import json
        entity_df = features[["symbol", "timestamp"]].copy() if "timestamp" in features.columns else features[["symbol"]].copy()
        entity_df["timestamp"] = pd.to_datetime(entity_df["timestamp"])

        feat_cols = [c for c in features.columns if c not in ["symbol", "timestamp", "entity_timestamp"]]

        for _, row in features.iterrows():
            key = {"symbol": str(row.get("symbol", "MNQ"))}
            redis_key = self._build_redis_key(feature_view.name, key)

            # Hash the row values
            feature_data = {}
            for col in feat_cols:
                val = row.get(col)
                if val is None or (isinstance(val, float) and np.isnan(val)):
                    continue
                feature_data[col] = float(val) if isinstance(val, (int, float)) else str(val)

            try:
                pipe = self._redis.pipeline()
                pipe.hset(redis_key, mapping=feature_data)
                pipe.expire(redis_key, feature_view.ttl_seconds or 86400)
                pipe.execute()
            except Exception as e:
                print(f"[Feast] Warning: could not write to Redis: {e}")

    def _build_redis_key(self, feature_view_name: str, entity_key: dict) -> str:
        """Build a Redis key for a feature view entity key."""
        symbol = entity_key.get("symbol", "MNQ")
        return f"tradersapp:{feature_view_name}:{symbol}"

    def get_feature_names(
        self,
        feature_view: FeatureView,
        registry,
    ) -> list[str]:
        """Return the list of feature names for a feature view."""
        return [f.name for f in feature_view.schema]

    def __repr__(self):
        return f"TradersProvider(db={self.db_path}, redis={self._redis_url})"
