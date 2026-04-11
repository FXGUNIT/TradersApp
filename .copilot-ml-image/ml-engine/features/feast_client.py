"""
Feast Client — high-level feature retrieval for ML Engine inference.

Provides:
  - get_candle_features()     — OHLCV + technical indicators for a single timestamp
  - get_all_features()        — all feature views merged for a single row
  - get_historical_features() — rolling trade stats for training dataset

Usage:
  from ml_engine.features.feast_client import get_candle_features
  features = get_candle_features(symbol="MNQ", timestamp="2026-04-03T14:30:00")

Fallback: if Feast is not configured, falls back to direct SQLite queries.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from typing import Optional
from pathlib import Path

import pandas as pd
import numpy as np

# Add project root
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


try:
    import feast
    FEAST_AVAILABLE = True
except ImportError:
    FEAST_AVAILABLE = False

# ─── Feature Retrieval ──────────────────────────────────────────────────────────

def get_candle_features(
    symbol: str = "MNQ",
    timestamp: str | datetime | None = None,
) -> dict:
    """
    Get candle features for a single symbol + timestamp.

    Uses Feast online store (Redis) for <10ms retrieval.
    Falls back to SQLite if Feast is not available.

    Returns:
        dict of feature_name → value
    """
    ts = _normalize_timestamp(timestamp)

    if FEAST_AVAILABLE and _feast_configured():
        return _feast_get_candle_features(symbol, ts)
    else:
        return _db_get_candle_features(symbol, ts)


def get_all_features(
    symbol: str = "MNQ",
    timestamp: str | datetime | None = None,
) -> dict:
    """
    Get all available features for a single symbol + timestamp.

    Combines: candle features + historical features + session features.
    Used for ML inference at prediction time.

    Returns:
        dict of feature_name → value
    """
    ts = _normalize_timestamp(timestamp)

    features = {}

    if FEAST_AVAILABLE and _feast_configured():
        features.update(_feast_get_all_features(symbol, ts))
    else:
        features.update(_db_get_candle_features(symbol, ts))
        features.update(_db_get_historical_features(symbol, ts))
        features.update(_db_get_session_features(symbol, ts))

    return features


def get_historical_features_for_training(
    symbol: str = "MNQ",
    start: str | datetime | None = None,
    end: str | datetime | None = None,
    lookback_days: int = 90,
) -> pd.DataFrame:
    """
    Build a training feature matrix using Feast offline store.

    Args:
        symbol: Trading symbol
        start: Start date (default: lookback_days ago)
        end: End date (default: today)
        lookback_days: Days of historical data

    Returns:
        DataFrame with features and entity columns
    """
    end_dt = _normalize_timestamp(end) or datetime.now(timezone.utc)
    start_dt = _normalize_timestamp(start) or (end_dt - pd.Timedelta(days=lookback_days))

    if FEAST_AVAILABLE and _feast_configured():
        return _feast_get_training_features(symbol, start_dt, end_dt)
    else:
        return _db_get_training_features(symbol, start_dt, end_dt)


# ─── Feat Implementation ────────────────────────────────────────────────────────

def _feast_configured() -> bool:
    """Check if Feast store is configured and online store is reachable."""
    repo_path = PROJECT_ROOT / "ml_engine" / "features" / "feast_repo"
    if not (repo_path / "feature_store.yaml").exists():
        return False

    # Try to load the feature store
    try:
        fs = feast.FeatureStore(repo_path=str(repo_path))
        return True
    except Exception:
        return False


def _feast_get_candle_features(symbol: str, ts: datetime) -> dict:
    """Get candle features via Feast."""
    try:
        fs = feast.FeatureStore(repo_path=str(PROJECT_ROOT / "ml_engine" / "features" / "feast_repo"))
        feature_vector = fs.get_online_features(
            entity_rows=[{"symbol": symbol}],
            feature_refs=[
                "candle_features:close",
                "candle_features:atr",
                "candle_features:atr_pct",
                "candle_features:log_return",
                "candle_features:rolling_std_20",
                "candle_features:volume_ratio_5",
                "candle_features:hour_of_day",
                "candle_features:day_of_week",
                "candle_features:vr_regime",
                "candle_features:amd_ACCUMULATION",
                "candle_features:amd_DISTRIBUTION",
                "candle_features:vr",
            ],
        )
        return dict(feature_vector.features)
    except Exception:
        return {}


def _feast_get_all_features(symbol: str, ts: datetime) -> dict:
    """Get all feature views via Feast."""
    try:
        fs = feast.FeatureStore(repo_path=str(PROJECT_ROOT / "ml_engine" / "features" / "feast_repo"))
        feature_vector = fs.get_online_features(
            entity_rows=[{"symbol": symbol}],
            feature_refs=[
                "candle_features:close",
                "candle_features:atr",
                "candle_features:atr_pct",
                "candle_features:log_return",
                "candle_features:volume_ratio_5",
                "candle_features:vr",
                "candle_features:vr_regime",
                "candle_features:hour_of_day",
                "candle_features:day_of_week",
                "candle_features:amd_ACCUMULATION",
                "candle_features:amd_DISTRIBUTION",
                "historical_features:win_rate_20",
                "historical_features:expectancy_20",
                "historical_features:profit_factor_20",
            ],
        )
        return dict(feature_vector.features)
    except Exception:
        return {}


def _feast_get_training_features(symbol: str, start: datetime, end: datetime) -> pd.DataFrame:
    """Build training dataset via Feast offline store."""
    try:
        fs = feast.FeatureStore(repo_path=str(PROJECT_ROOT / "ml_engine" / "features" / "feast_repo"))
        entity_df = pd.DataFrame({
            "symbol": [symbol],
            "event_timestamp": pd.date_range(start, end, freq="5min"),
        })
        training_df = fs.get_historical_features(
            entity_df=entity_df,
            feature_refs=[
                "candle_features:close",
                "candle_features:atr",
                "candle_features:log_return",
                "candle_features:volume_ratio_5",
                "candle_features:vr",
                "candle_features:vr_regime",
                "historical_features:win_rate_20",
                "historical_features:expectancy_20",
            ],
        )
        return training_df
    except Exception:
        return pd.DataFrame()


# ─── Feast-Unavailable Fallback (uses CandleDatabase — PostgreSQL in k8s) ———————————

def _db_get_candle_features(symbol: str, ts: datetime) -> dict:
    """Fallback when Feast is unavailable: read candle features from CandleDatabase.

    In production (k8s), CandleDatabase uses PostgreSQL because DATABASE_URL is set.
    In dev (no DATABASE_URL), CandleDatabase falls back to SQLite.
    """
    try:
        from ml_engine.data.candle_db import CandleDatabase
        db = CandleDatabase()

        # Get the nearest candle
        candles = db.get_candles(
            start=(ts - pd.Timedelta(minutes=10)).isoformat(),
            end=ts.isoformat(),
            symbol=symbol,
            limit=3,
        )

        if candles.empty:
            return {}

        candle = candles.iloc[-1]

        # Basic features
        features = {
            "open": float(candle.get("open", 0)),
            "high": float(candle.get("high", 0)),
            "low": float(candle.get("low", 0)),
            "close": float(candle.get("close", 0)),
            "volume": float(candle.get("volume", 0)),
        }

        # Time features
        ts_local = pd.to_datetime(candle.get("timestamp", ts))
        features["hour_of_day"] = int(ts_local.hour)
        features["day_of_week"] = int(ts_local.dayofweek)

        return features
    except Exception:
        return {}


def _db_get_historical_features(symbol: str, ts: datetime) -> dict:
    """Fallback: compute rolling trade stats from SQLite."""
    try:
        from ml_engine.data.candle_db import CandleDatabase
        db = CandleDatabase()

        cutoff = (pd.to_datetime(ts) - pd.Timedelta(days=30)).isoformat()
        trades = db.get_trade_log(limit=50, symbol=symbol)
        trades = trades[trades["entry_time"] <= ts.isoformat()].tail(20)

        if trades.empty:
            return {}

        n = len(trades)
        wins = (trades["result"] == "win").sum()
        return {
            "win_rate_20": float(wins / max(n, 1)),
            "expectancy_20": float(trades["pnl_dollars"].mean()) if "pnl_dollars" in trades else 0.0,
        }
    except Exception:
        return {}


def _db_get_session_features(symbol: str, ts: datetime) -> dict:
    """Fallback: read session aggregates from SQLite."""
    try:
        from ml_engine.data.candle_db import CandleDatabase
        db = CandleDatabase()

        date_str = pd.to_datetime(ts).strftime("%Y-%m-%d")
        session = db.get_session_aggregates(date_str, date_str, symbol=symbol)

        if session.empty:
            return {}

        sess = session.iloc[0]
        return {
            "gap_pct": float(sess.get("gap_pct", 0)),
            "range_vs_atr": float(sess.get("range_vs_atr", 0)),
            "volume_ratio_sess": float(sess.get("volume_ratio", 0)),
        }
    except Exception:
        return {}


def _db_get_training_features(symbol: str, start: datetime, end: datetime) -> pd.DataFrame:
    """Fallback: build training features directly from SQLite."""
    try:
        from ml_engine.data.candle_db import CandleDatabase
        from ml_engine.features.feature_pipeline import engineer_features, get_feature_vector

        db = CandleDatabase()
        candles = db.get_candles(
            start=start.isoformat(),
            end=end.isoformat(),
            symbol=symbol,
            limit=100000,
        )
        if candles.empty:
            return pd.DataFrame()

        feat_df = engineer_features(candles, None, None, None, None)
        return feat_df
    except Exception:
        return pd.DataFrame()


# ─── Utilities ────────────────────────────────────────────────────────────────

def _normalize_timestamp(ts: str | datetime | None) -> datetime:
    """Normalize various timestamp formats to UTC datetime."""
    if ts is None:
        return datetime.now(timezone.utc)
    if isinstance(ts, str):
        return pd.to_datetime(ts).tz_convert("UTC").tz_localize(None) if pd.to_datetime(ts).tzinfo else pd.to_datetime(ts).tz_localize("UTC").tz_localize(None)
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts


def get_feature_info() -> dict:
    """
    Return metadata about available features for documentation.
    """
    return {
        "candle_features": [
            "open", "high", "low", "close", "volume",
            "tr", "atr", "atr_pct", "log_return",
            "intrabar_momentum", "range", "range_pct",
            "upper_wick_pct", "lower_wick_pct",
            "rolling_std_10", "rolling_std_20", "realized_vol",
            "momentum_3bar", "momentum_5bar",
            "volume_ratio_5",
            "hour_of_day", "day_of_week", "minutes_into_session",
            "session_pct", "is_first_30min", "is_last_30min", "is_lunch_hour",
            "price_to_pdh", "price_to_pdl", "near_level",
            "adx", "ci", "vwap", "vwap_slope_entry", "vr", "sweep_prob",
            "amd_ACCUMULATION", "amd_MANIPULATION", "amd_DISTRIBUTION",
            "amd_TRANSITION", "amd_UNCLEAR",
            "vr_regime", "volatility_regime",
        ],
        "historical_features": [
            "win_rate_20", "win_rate_50", "expectancy_20", "profit_factor_20",
            "amd_win_rate_ACCUMULATION", "amd_win_rate_MANIPULATION",
            "amd_win_rate_DISTRIBUTION", "amd_win_rate_TRANSITION",
        ],
        "session_features": [
            "direction", "close_to_open", "gap_pct",
            "session_range", "range_vs_atr", "gap_fill_pct",
            "daily_range_used_pct", "volume_ratio_sess", "candle_count",
        ],
        "feast_available": FEAST_AVAILABLE,
        "online_store": "redis" if FEAST_AVAILABLE else "db_fallback",
    }
