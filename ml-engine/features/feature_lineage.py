"""
Feature Lineage Registry — tracks the origin and transformation of every feature.

Tracks:
  - Feature name → source table/column mapping
  - Feature → transformation function
  - Feature → Feast FeatureView + version
  - Feature freshness (last materialization timestamp)
  - Feature drift score (PSI between train and serve distributions)

Usage:
  registry = FeatureLineageRegistry()
  registry.register("win_rate_20", source="trade_log", transformation="rolling_mean_20")
  registry.get_lineage("win_rate_20")  # → FeatureLineage
  registry.get_stale_features(threshold_hours=24)  # → list of stale features

This is the "feature catalog" — the single source of truth for what every
feature means and where it comes from.
"""

from __future__ import annotations

import json
import os
import sqlite3
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd


@dataclass
class FeatureLineage:
    """
    Full lineage record for a single feature.
    """
    feature_name: str
    feature_view: str
    source_table: str
    source_column: str | None
    transformation: str  # e.g., "rolling_mean_20", "atr_14", "one_hot"
    dtype: str           # e.g., "float64", "int64"
    description: str
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    version: int = 1
    last_materialized: str | None = None
    last_materialized_by: str | None = None
    freshness_hours: float | None = None
    drift_score: float | None = None  # PSI vs training distribution
    tags: list[str] = field(default_factory=list)

    def is_stale(self, threshold_hours: float = 24.0) -> bool:
        if self.last_materialized is None:
            return True
        try:
            last = pd.to_datetime(self.last_materialized)
            age = (datetime.now(timezone.utc) - last.to_pydatetime()).total_seconds() / 3600
            return age > threshold_hours
        except Exception:
            return True

    def to_dict(self) -> dict:
        return asdict(self)


class FeatureLineageRegistry:
    """
    Registry for all feature lineage metadata.
    Stores in SQLite for persistence + queryability.
    """

    DB_TABLE = "feature_lineage"

    def __init__(self, db_path: str | None = None):
        if db_path is None:
            base = Path(__file__).parent.parent.parent / "data"
            base.mkdir(parents=True, exist_ok=True)
            db_path = str(base / "feature_lineage.db")
        self.db_path = db_path
        self._ensure_schema()

    def _ensure_schema(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {self.DB_TABLE} (
                feature_name TEXT PRIMARY KEY,
                feature_view TEXT NOT NULL,
                source_table TEXT NOT NULL,
                source_column TEXT,
                transformation TEXT NOT NULL,
                dtype TEXT NOT NULL,
                description TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                version INTEGER DEFAULT 1,
                last_materialized TEXT,
                last_materialized_by TEXT,
                freshness_hours REAL,
                drift_score REAL,
                tags TEXT DEFAULT '[]'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS materialization_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feature_view TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                rows_materialized INTEGER,
                duration_seconds REAL,
                status TEXT,
                error TEXT
            )
        """)
        conn.commit()
        conn.close()

    def register(self, lineage: FeatureLineage) -> None:
        """Register a feature's lineage record."""
        conn = sqlite3.connect(self.db_path)
        conn.execute(f"""
            INSERT OR REPLACE INTO {self.DB_TABLE}
            (feature_name, feature_view, source_table, source_column, transformation,
             dtype, description, created_at, version, last_materialized,
             last_materialized_by, freshness_hours, drift_score, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            lineage.feature_name,
            lineage.feature_view,
            lineage.source_table,
            lineage.source_column,
            lineage.transformation,
            lineage.dtype,
            lineage.description,
            lineage.created_at,
            lineage.version,
            lineage.last_materialized,
            lineage.last_materialized_by,
            lineage.freshness_hours,
            lineage.drift_score,
            json.dumps(lineage.tags),
        ))
        conn.commit()
        conn.close()

    def register_many(self, lineages: list[FeatureLineage]) -> None:
        """Bulk register feature lineages."""
        for l in lineages:
            self.register(l)

    def get(self, feature_name: str) -> FeatureLineage | None:
        """Get lineage for a single feature."""
        conn = sqlite3.connect(self.db_path)
        row = conn.execute(
            f"SELECT * FROM {self.DB_TABLE} WHERE feature_name = ?", (feature_name,)
        ).fetchone()
        conn.close()
        if row is None:
            return None
        return self._row_to_lineage(row)

    def get_by_view(self, feature_view: str) -> list[FeatureLineage]:
        """Get all features belonging to a FeatureView."""
        conn = sqlite3.connect(self.db_path)
        rows = conn.execute(
            f"SELECT * FROM {self.DB_TABLE} WHERE feature_view = ? ORDER BY feature_name",
            (feature_view,)
        ).fetchall()
        conn.close()
        return [self._row_to_lineage(r) for r in rows]

    def get_all(self) -> list[FeatureLineage]:
        """Get all registered feature lineages."""
        conn = sqlite3.connect(self.db_path)
        rows = conn.execute(
            f"SELECT * FROM {self.DB_TABLE} ORDER BY feature_view, feature_name"
        ).fetchall()
        conn.close()
        return [self._row_to_lineage(r) for r in rows]

    def get_stale_features(
        self,
        threshold_hours: float = 24.0,
        feature_view: str | None = None,
    ) -> list[FeatureLineage]:
        """Get features that haven't been materialized within the threshold."""
        all_feats = self.get_by_view(feature_view) if feature_view else self.get_all()
        return [f for f in all_feats if f.is_stale(threshold_hours)]

    def update_materialization(
        self,
        feature_view: str,
        materialized_by: str = "feast_materialization",
    ) -> None:
        """Mark all features in a FeatureView as freshly materialized."""
        now = datetime.now(timezone.utc).isoformat()
        conn = sqlite3.connect(self.db_path)
        conn.execute(f"""
            UPDATE {self.DB_TABLE}
            SET last_materialized = ?,
                last_materialized_by = ?
            WHERE feature_view = ?
        """, (now, materialized_by, feature_view))
        conn.commit()
        conn.close()

    def log_materialization(
        self,
        feature_view: str,
        rows: int,
        duration_seconds: float,
        status: str,
        error: str | None = None,
    ) -> None:
        """Log a materialization run."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT INTO materialization_log
            (feature_view, started_at, completed_at, rows_materialized, duration_seconds, status, error)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            feature_view,
            datetime.now(timezone.utc).isoformat(),
            datetime.now(timezone.utc).isoformat(),
            rows,
            duration_seconds,
            status,
            error,
        ))
        conn.commit()
        conn.close()

    def get_materialization_history(
        self,
        feature_view: str | None = None,
        limit: int = 10,
    ) -> list[dict]:
        """Get materialization run history."""
        conn = sqlite3.connect(self.db_path)
        query = "SELECT * FROM materialization_log"
        params: list = []
        if feature_view:
            query += " WHERE feature_view = ?"
            params.append(feature_view)
        query += " ORDER BY started_at DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(query, params).fetchall()
        conn.close()
        cols = [d[0] for d in conn.execute("PRAGMA table_info(materialization_log)").fetchall()]
        return [dict(zip(cols, r)) for r in rows]

    def _row_to_lineage(self, row: sqlite3.Row) -> FeatureLineage:
        cols = ["feature_name", "feature_view", "source_table", "source_column",
                "transformation", "dtype", "description", "created_at", "version",
                "last_materialized", "last_materialized_by", "freshness_hours",
                "drift_score", "tags"]
        data = dict(zip(cols, row))
        data["tags"] = json.loads(data.get("tags", "[]"))
        return FeatureLineage(**data)

    def catalog(self) -> dict:
        """Generate a feature catalog report."""
        all_feats = self.get_all()
        by_view: dict[str, list[FeatureLineage]] = {}
        for f in all_feats:
            by_view.setdefault(f.feature_view, []).append(f)

        summary = {}
        for view, feats in by_view.items():
            stale = [f for f in feats if f.is_stale(24)]
            summary[view] = {
                "total_features": len(feats),
                "stale_features": len(stale),
                "stale_names": [f.feature_name for f in stale],
                "features": [f.feature_name for f in feats],
            }

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_features": len(all_feats),
            "by_feature_view": summary,
        }


# ─── Pre-populated Feature Lineage ──────────────────────────────────────────────

def register_tradersapp_lineage(registry: FeatureLineageRegistry) -> None:
    """
    Register the complete feature lineage for all TradersApp features.
    Call once after Feast registry is applied.
    """

    # Candle features: OHLCV + technical indicators
    candle_feats = [
        # OHLCV raw
        ("open",           "candles_5min",  "open",           "raw",              "float64", "Candle open price"),
        ("high",           "candles_5min",  "high",           "raw",              "float64", "Candle high price"),
        ("low",            "candles_5min",  "low",            "raw",              "float64", "Candle low price"),
        ("close",          "candles_5min",  "close",          "raw",              "float64", "Candle close price"),
        ("volume",         "candles_5min",  "volume",         "raw",              "float64", "Candle volume"),

        # True Range / ATR
        ("tr",             "candles_5min",  None,            "tr_14",            "float64", "True Range (14-bar max of high-low, high-prev_close, low-prev_close)"),
        ("atr",            "candles_5min",  None,            "atr_14",           "float64", "Average True Range (14-bar EMA of TR)"),
        ("atr_pct",        "candles_5min",  None,            "atr_pct",          "float64", "ATR as percentage of close price"),

        # Returns
        ("log_return",     "candles_5min",  None,            "log_return_1",     "float64", "Natural log of close / prev_close"),
        ("intrabar_momentum", "candles_5min", None,           "close_minus_open", "float64", "Close minus open (directional momentum within bar)"),
        ("range",          "candles_5min",  None,            "high_minus_low",   "float64", "High minus low (bar range)"),
        ("range_pct",      "candles_5min",  None,            "range_pct",        "float64", "Bar range as percentage of low"),
        ("upper_wick_pct", "candles_5min",  None,            "upper_wick",       "float64", "Upper wick as fraction of total range"),
        ("lower_wick_pct", "candles_5min",  None,            "lower_wick",       "float64", "Lower wick as fraction of total range"),

        # Volatility
        ("rolling_std_10", "candles_5min",  None,            "rolling_std_10",  "float64", "Standard deviation of log_return over 10 bars"),
        ("rolling_std_20", "candles_5min",  None,            "rolling_std_20",  "float64", "Standard deviation of log_return over 20 bars"),
        ("realized_vol",  "candles_5min",  None,            "realized_vol_78", "float64", "Annualized volatility: std20 * sqrt(78 bars/day)"),

        # Momentum
        ("momentum_3bar", "candles_5min",  None,            "momentum_3bar",   "float64", "Close - close 3 bars ago"),
        ("momentum_5bar", "candles_5min",  None,            "momentum_5bar",   "float64", "Close - close 5 bars ago"),

        # Volume
        ("volume_ratio_5", "candles_5min",  None,           "volume_ratio_5",  "float64", "Volume / 5-bar rolling mean volume"),

        # Time features
        ("hour_of_day",    "candles_5min",  None,            "hour_of_day",     "int64",   "Hour of day in Eastern Time (0-23)"),
        ("day_of_week",    "candles_5min",  None,            "day_of_week",     "int64",   "Day of week (0=Monday, 6=Sunday)"),
        ("minutes_into_session", "candles_5min", None,        "minutes_into_session", "int64", "Minutes elapsed in current trading session"),
        ("session_pct",    "candles_5min",  None,            "session_pct",      "float64", "Position within session (0.0-1.0)"),
        ("is_first_30min", "candles_5min",  None,            "is_first_30min",   "float64", "1.0 if within first 30 minutes of session"),
        ("is_last_30min",  "candles_5min",  None,            "is_last_30min",   "float64", "1.0 if within last 30 minutes of main session"),
        ("is_lunch_hour",  "candles_5min",  None,            "is_lunch_hour",   "float64", "1.0 if between 11:30-13:00 ET (low-volume period)"),

        # Key level features
        ("price_to_pdh",  "candles_5min",  None,            "price_to_pdh",    "float64", "(close - PDH) / ATR — proximity to prior day high"),
        ("price_to_pdl",  "candles_5min",  None,            "price_to_pdl",    "float64", "(PDL - close) / ATR — proximity to prior day low"),
        ("near_level",    "candles_5min",  None,            "near_level",      "float64", "1.0 if within 0.5 ATR of any key level"),

        # MathEngine / regime features
        ("adx",           "candles_5min",  None,            "adx_14",          "float64", "Average Directional Index (trend strength)"),
        ("ci",            "candles_5min",  None,            "ci",              "float64", "Choppiness Index (range-bound vs trending)"),
        ("vwap",          "candles_5min",  None,            "vwap",            "float64", "Volume-Weighted Average Price"),
        ("vwap_slope_entry", "candles_5min", None,          "vwap_slope",      "float64", "Slope of VWAP (positive=bullish, negative=bearish)"),
        ("vr",            "candles_5min",  None,            "vr_14",           "float64", "Volatility Ratio (ATR / smoothed ATR)"),
        ("sweep_prob",    "candles_5min",  None,            "sweep_prob",      "float64", "Probability of liquidity sweep (0-1)"),

        # AMD one-hot
        ("amd_ACCUMULATION", "candles_5min", None,          "one_hot_accumulation", "float64", "AMD phase: ACCUMULATION (1.0 or 0.0)"),
        ("amd_MANIPULATION", "candles_5min", None,          "one_hot_manipulation", "float64", "AMD phase: MANIPULATION (1.0 or 0.0)"),
        ("amd_DISTRIBUTION", "candles_5min", None,          "one_hot_distribution", "float64", "AMD phase: DISTRIBUTION (1.0 or 0.0)"),
        ("amd_TRANSITION",  "candles_5min", None,          "one_hot_transition",  "float64", "AMD phase: TRANSITION (1.0 or 0.0)"),
        ("amd_UNCLEAR",     "candles_5min", None,          "one_hot_unclear",      "float64", "AMD phase: UNCLEAR (1.0 or 0.0)"),

        # VR regime encoding
        ("vr_regime",      "candles_5min",  None,            "vr_regime",       "int64",   "VR-encoded regime: 0=Compression, 1=Normal, 2=Expansion"),
        ("volatility_regime", "candles_5min", None,          "volatility_regime", "int64",   "Alias for vr_regime"),
    ]

    # Historical features: rolling trade stats
    hist_feats = [
        ("win_rate_20",    "trade_log",  None,            "rolling_win_rate_20", "float64", "Win rate over last 20 closed trades"),
        ("win_rate_50",    "trade_log",  None,            "rolling_win_rate_50", "float64", "Win rate over last 50 closed trades"),
        ("expectancy_20",  "trade_log",  None,            "rolling_avg_pnl_20", "float64", "Average PnL per trade over last 20 trades (dollars)"),
        ("profit_factor_20", "trade_log", None,           "rolling_profit_factor_20", "float64", "Gross wins / gross losses over last 20 trades"),
        ("amd_win_rate_ACCUMULATION", "trade_log", None,  "amd_win_rate_accumulation", "float64", "Historical win rate when AMD phase = ACCUMULATION"),
        ("amd_win_rate_MANIPULATION", "trade_log", None,  "amd_win_rate_manipulation", "float64", "Historical win rate when AMD phase = MANIPULATION"),
        ("amd_win_rate_DISTRIBUTION", "trade_log", None,  "amd_win_rate_distribution", "float64", "Historical win rate when AMD phase = DISTRIBUTION"),
        ("amd_win_rate_TRANSITION",  "trade_log", None,  "amd_win_rate_transition",   "float64", "Historical win rate when AMD phase = TRANSITION"),
    ]

    # Session features
    sess_feats = [
        ("direction",      "session_aggregates", "direction",       "raw",              "int64",   "Session directional bias: 1=LONG, -1=SHORT"),
        ("close_to_open",  "session_aggregates", "close_to_open",   "raw",              "float64", "Close minus open (absolute dollar)"),
        ("gap_pct",        "session_aggregates", "gap_pct",         "raw",              "float64", "Overnight gap as percentage of prior close"),
        ("session_range",  "session_aggregates", "session_range",  "raw",              "float64", "High minus low for the full session"),
        ("range_vs_atr",   "session_aggregates", "range_vs_atr",   "raw",              "float64", "Session range normalized by ATR"),
        ("gap_fill_pct",   "session_aggregates", None,            "gap_fill_pct",     "float64", "Proxy for how much of the gap was filled (0-1)"),
        ("daily_range_used_pct", "session_aggregates", None,      "daily_range_used_pct", "float64", "Intraday range as fraction of ATR*14"),
        ("volume_ratio_sess", "session_aggregates", "volume_ratio", "raw",              "float64", "Session volume / average session volume"),
        ("candle_count",   "session_aggregates", "candle_count",  "raw",              "int64",   "Number of 5-minute candles in session"),
    ]

    for name, table, col, xform, dtype, desc in candle_feats:
        registry.register(FeatureLineage(
            feature_name=name,
            feature_view="candle_features",
            source_table=table,
            source_column=col,
            transformation=xform,
            dtype=dtype,
            description=desc,
            tags=["ohlcv"] if xform == "raw" else ["technical", "indicator"],
        ))

    for name, table, col, xform, dtype, desc in hist_feats:
        registry.register(FeatureLineage(
            feature_name=name,
            feature_view="historical_features",
            source_table=table,
            source_column=col,
            transformation=xform,
            dtype=dtype,
            description=desc,
            tags=["performance", "rolling"],
        ))

    for name, table, col, xform, dtype, desc in sess_feats:
        registry.register(FeatureLineage(
            feature_name=name,
            feature_view="session_features",
            source_table=table,
            source_column=col,
            transformation=xform,
            dtype=dtype,
            description=desc,
            tags=["session", "aggregate"],
        ))


# ─── Warmup ─────────────────────────────────────────────────────────────────────

def warmup_online_store(
    redis_url: str = "redis://localhost:6379",
    db_path: str | None = None,
    symbol: str = "MNQ",
    lookback_minutes: int = 60,
) -> dict:
    """
    Pre-populate Redis with the most recent features for immediate inference.

    Call this at ML Engine startup so the first inference request
    doesn't wait for a cache miss + materialization.

    Returns:
        dict with warmup statistics
    """
    import time

    warmup_start = time.perf_counter()
    from ml_engine.features.feast_client import get_all_features

    now = pd.Timestamp.now(tz="UTC")
    timestamps = pd.date_range(
        start=now - pd.Timedelta(minutes=lookback_minutes),
        end=now,
        freq="5min",
    )

    n_loaded = 0
    for ts in timestamps:
        try:
            features = get_all_features(symbol=symbol, timestamp=ts.isoformat())
            if features:
                n_loaded += 1
        except Exception:
            pass

    duration_ms = (time.perf_counter() - warmup_start) * 1000

    return {
        "warmup_started": now.isoformat(),
        "lookback_minutes": lookback_minutes,
        "timestamps_warmed": n_loaded,
        "duration_ms": round(duration_ms, 2),
    }
