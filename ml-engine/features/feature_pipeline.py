"""
Full Feature Engineering Pipeline.
Takes raw candles + session aggregates + trade log + MathEngine snapshot
Returns: feature DataFrame aligned to candle timestamps.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import sys, os

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


# -------------------------------------------------------------------------
# Session segmenter
# -------------------------------------------------------------------------

def assign_session_ids(df: pd.DataFrame, timestamp_col: str = "timestamp") -> pd.DataFrame:
    """
    Assign session_id to each candle row based on Eastern Time.
    session_id: 0 = pre-market (4:00-9:15), 1 = main (9:30-16:00), 2 = post (16:01-20:00)
    """
    df = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(df[timestamp_col]):
        df[timestamp_col] = pd.to_datetime(df[timestamp_col])

    # Convert to ET (UTC-5 / UTC-4 depending on DST)
    et = df[timestamp_col].dt.tz_convert("America/New_York")
    hm = et.dt.hour * 60 + et.dt.minute

    # Slice: [0,570] pre, (570,965] main, (965,1200] post
    conditions = [
        hm <= 555,               # pre: up to 09:15 (4:00*60=240 to 9:15*60=555)
        (hm >= 570) & (hm <= 960),  # main: 09:30 (570) to 16:00 (960)
        hm > 960,                # post: after 16:00
    ]
    df["session_id"] = np.select(conditions, [0, 1, 2], default=1)
    df["et_hour"] = et.dt.hour
    df["et_minute"] = et.dt.minute
    return df


# -------------------------------------------------------------------------
# Per-candle technical features
# -------------------------------------------------------------------------

def compute_candle_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute all per-candle technical features."""
    df = df.copy()
    df = df.sort_values("timestamp").reset_index(drop=True)

    # ATR (14-bar)
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    prev_close.iloc[0] = close.iloc[0]  # fill first row with current close
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    df["tr"] = tr
    df["atr"] = tr.rolling(14, min_periods=1).mean()

    # Log return
    df["log_return"] = np.log(close / close.shift(1).fillna(close.iloc[0]))
    df["log_return"] = df["log_return"].fillna(0)

    # Intraday momentum
    df["intrabar_momentum"] = close - df["open"]

    # Range metrics
    df["range"] = high - low
    df["range_pct"] = df["range"] / low.replace(0, 1)
    df["upper_wick_pct"] = (high - pd.concat([df["open"], close], axis=1).max(axis=1)) / df["range"].replace(0, 1)
    df["lower_wick_pct"] = (pd.concat([df["open"], close], axis=1).min(axis=1) - low) / df["range"].replace(0, 1)

    # ATR as % of price
    df["atr_pct"] = df["atr"] / close.replace(0, 1)

    # Volume ratio (5-bar rolling)
    vol_ma5 = df["volume"].rolling(5, min_periods=1).mean()
    df["volume_ratio_5"] = df["volume"] / vol_ma5.replace(0, 1)

    # Rolling std of returns
    df["rolling_std_10"] = df["log_return"].rolling(10, min_periods=1).std()
    df["rolling_std_20"] = df["log_return"].rolling(20, min_periods=1).std()

    # Realized volatility (20-bar)
    df["realized_vol"] = df["log_return"].rolling(20, min_periods=1).std() * np.sqrt(78)

    # HMM-style momentum: 3-bar and 5-bar
    df["momentum_3bar"] = close - close.shift(3).fillna(close.iloc[0])
    df["momentum_5bar"] = close - close.shift(5).fillna(close.iloc[0])

    # VWAP deviation (if column exists)
    if "vwap" in df.columns:
        df["vwap_deviation"] = (close - df["vwap"]) / df["vwap"].replace(0, 1)
        df["above_vwap"] = (close > df["vwap"]).astype(float)

    return df


# -------------------------------------------------------------------------
# Time features
# -------------------------------------------------------------------------

def compute_time_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute all time-based features."""
    df = df.copy()

    if not pd.api.types.is_datetime64_any_dtype(df["timestamp"]):
        df["timestamp"] = pd.to_datetime(df["timestamp"])

    et = df["timestamp"].dt.tz_convert("America/New_York")
    df["hour_of_day"] = et.dt.hour
    df["day_of_week"] = et.dt.dayofweek   # 0=Monday
    df["date"] = et.dt.date

    # Session percentage elapsed
    sess_counts = df.groupby(["date", "session_id"])["timestamp"].transform("count")
    df["session_candle_count"] = df.groupby(["date", "session_id"])["timestamp"].cumcount() + 1
    df["session_pct"] = df["session_candle_count"] / sess_counts.replace(0, 1)

    # Minutes into session
    sess_start = {
        0: 240,   # 04:00 ET
        1: 570,   # 09:30 ET
        2: 961,   # 16:01 ET
    }
    hm = et.dt.hour * 60 + et.dt.minute
    df["minutes_into_session"] = hm - df["session_id"].map(sess_start)

    # Boolean time periods
    df["is_first_30min"] = (df["minutes_into_session"] <= 30).astype(float)
    df["is_last_30min"] = (
        (df["session_id"] == 1) & (df["minutes_into_session"] >= 870)  # 14:30+
    ).astype(float)
    df["is_lunch_hour"] = (
        ((et.dt.hour == 12) | ((et.dt.hour == 11) & (et.dt.minute >= 30))) &
        (df["session_id"] == 1)
    ).astype(float)

    return df


# -------------------------------------------------------------------------
# Key level features
# -------------------------------------------------------------------------

def compute_level_features(df: pd.DataFrame, levels: dict | None = None) -> pd.DataFrame:
    """
    Compute distance to key levels (PDH/PDL/PWH/PWL) normalized by ATR.
    levels: dict with keys 'pdh', 'pdl', 'pwh', 'pwl', 'poc', 'vah', 'val'
    """
    df = df.copy()
    close = df["close"]
    atr = df["atr"].replace(0, 1)

    if levels:
        df["price_to_pdh"] = (close - levels.get("pdh", close)) / atr
        df["price_to_pdl"] = (levels.get("pdl", close) - close) / atr
        df["price_to_pwh"] = (close - levels.get("pwh", close)) / atr
        df["price_to_pwl"] = (levels.get("pwl", close) - close) / atr
        df["near_level"] = (
            (df["price_to_pdh"].abs() < 0.5) |
            (df["price_to_pdl"].abs() < 0.5) |
            (df["price_to_pwh"].abs() < 0.5) |
            (df["price_to_pwl"].abs() < 0.5)
        ).astype(float)
    else:
        # Compute rolling PDH/PDL per session from data itself
        df["rolling_pdh"] = df.groupby(["date"])["high"].cummax()
        df["rolling_pdl"] = df.groupby(["date"])["low"].cummin()
        df["price_to_pdh"] = (close - df["rolling_pdh"].shift(1).fillna(close)) / atr
        df["price_to_pdl"] = (df["rolling_pdl"].shift(1).fillna(close) - close) / atr
        df["near_level"] = (
            (df["price_to_pdh"].abs() < 0.5) | (df["price_to_pdl"].abs() < 0.5)
        ).astype(float)

    return df


# -------------------------------------------------------------------------
# AMD phase encoding
# -------------------------------------------------------------------------

def encode_amd_phases(df: pd.DataFrame, amd_phase_col: str = "amdPhase") -> pd.DataFrame:
    """One-hot encode AMD phases."""
    df = df.copy()
    for phase in config.AMD_PHASES:
        df[f"amd_{phase}"] = (df.get(amd_phase_col, "UNCLEAR") == phase).astype(float)
    return df


# -------------------------------------------------------------------------
# Volatility regime encoding
# -------------------------------------------------------------------------

def encode_vr_regime(df: pd.DataFrame, vr_col: str = "vr") -> pd.DataFrame:
    """Encode volatility regime from VR value."""
    df = df.copy()
    vr = df.get(vr_col, 1.0)
    df["vr_regime"] = np.select(
        [vr < 0.85, vr < 1.15],
        [config.VR_COMPRESSION, config.VR_NORMAL],
        default=config.VR_EXPANSION
    )
    return df


# -------------------------------------------------------------------------
# Historical win rate features (from trade log)
# -------------------------------------------------------------------------

def compute_historical_features(
    df: pd.DataFrame, trade_log: pd.DataFrame
) -> pd.DataFrame:
    df = df.copy()
    if trade_log.empty:
        df["win_rate_20"] = 0.5
        df["win_rate_50"] = 0.5
        df["expectancy_20"] = 0.0
        df["profit_factor_20"] = 1.0
        return df

    trade_log = trade_log.dropna(subset=["entry_time"]).copy()
    trade_log["entry_time"] = pd.to_datetime(trade_log["entry_time"])

    # Normalize timezone: merge_asof requires same tz on both sides
    # If df timestamps are tz-aware, convert trade_log to same tz; otherwise convert to naive
    ts_dtype = df["timestamp"].dtype
    try:
        has_tz = ts_dtype.tz is not None
    except (AttributeError, TypeError):
        has_tz = False

    try:
        tl_tz = trade_log["entry_time"].dtype.tz
    except (AttributeError, TypeError):
        tl_tz = None

    if has_tz and tl_tz is None:
        # Candles are tz-aware, trades are naive → localize trades to candle tz
        trade_log["entry_time"] = trade_log["entry_time"].dt.tz_localize(ts_dtype.tz, nonexistent="shift_forward")
    elif not has_tz and tl_tz is not None:
        # Candles are naive, trades are tz-aware → make trades naive
        trade_log["entry_time"] = trade_log["entry_time"].dt.tz_localize(None)

    trade_log["is_win"] = (trade_log["result"] == "win").astype(float)

    def _pf(s: pd.Series) -> float:
        gross = s[s > 0].sum()
        loss = abs(s[s < 0].sum())
        return gross / loss if loss > 0 else 1.0

    # Precompute rolling stats on trade_log (sorted by time, no future leakage)
    trade_log = trade_log.sort_values("entry_time").reset_index(drop=True)
    trade_log["win_rate_20"] = trade_log["is_win"].rolling(20, min_periods=5).mean()
    trade_log["win_rate_50"] = trade_log["is_win"].rolling(50, min_periods=5).mean()
    trade_log["expectancy_20"] = trade_log["pnl_dollars"].rolling(20, min_periods=5).mean()
    trade_log["profit_factor_20"] = trade_log["pnl_dollars"].rolling(20, min_periods=5).apply(_pf, raw=True)

    # Use pd.merge_asof for backward-looking alignment:
    # each candle gets the most recent trade stats BEFORE that candle
    df_sorted = df.sort_values("timestamp").reset_index(drop=True)
    tl_sorted = trade_log.sort_values("entry_time").reset_index(drop=True)

    cols_to_merge = ["entry_time", "win_rate_20", "win_rate_50", "expectancy_20", "profit_factor_20"]
    if "amd_phase" in trade_log.columns:
        cols_to_merge.append("amd_phase")

    merged = pd.merge_asof(
        df_sorted[["timestamp"]], tl_sorted[cols_to_merge],
        left_on="timestamp", right_on="entry_time",
        direction="backward", allow_exact_matches=False
    )

    # Merge back, preserving original df order
    df["win_rate_20"] = merged["win_rate_20"].fillna(0.5).values
    df["win_rate_50"] = merged["win_rate_50"].fillna(0.5).values
    df["expectancy_20"] = merged["expectancy_20"].fillna(0.0).values
    df["profit_factor_20"] = merged["profit_factor_20"].fillna(1.0).values

    # AMD phase win rates (computed from all trade history)
    if "amd_phase" in trade_log.columns:
        amd_wr = {}
        for phase in config.AMD_PHASES:
            sub = trade_log[trade_log["amd_phase"] == phase]
            amd_wr[phase] = sub["is_win"].mean() if len(sub) > 0 else 0.5
        for phase, wr in amd_wr.items():
            df[f"amd_win_rate_{phase}"] = wr

    return df


# -------------------------------------------------------------------------
# Cross-session features
# -------------------------------------------------------------------------

def compute_cross_session_features(df: pd.DataFrame, session_agg: pd.DataFrame) -> pd.DataFrame:
    """Compute features from previous/next session data."""
    df = df.copy()
    if session_agg.empty:
        df["pre_to_main_dir"] = 0.0
        df["gap_fill_pct"] = 0.0
        df["daily_range_used_pct"] = 0.0
        return df

    session_agg = session_agg.copy()
    session_agg["trade_date"] = pd.to_datetime(session_agg["trade_date"])

    # Map session aggregates back to candles by date + session
    df["trade_date"] = pd.to_datetime(df["timestamp"].dt.date)
    df = df.merge(
        session_agg[["trade_date", "session_id", "gap_pct", "range_vs_atr", "direction", "volume_ratio"]],
        on=["trade_date", "session_id"],
        how="left",
    )

    df["gap_pct"] = df["gap_pct"].fillna(0)
    df["range_vs_atr"] = df["range_vs_atr"].fillna(1.0)
    df["volume_ratio_sess"] = df["volume_ratio"].fillna(1.0)

    # Gap fill: did price reach yesterday's close?
    df["gap_fill_pct"] = (df["gap_pct"].abs() * 0.5).clip(0, 1)

    # Daily range used: what % of ATR has been used by current candle
    if "atr" in df.columns:
        daily_range = df.groupby("date")["range"].transform("sum")
        df["daily_range_used_pct"] = (daily_range / (df["atr"] * 14 + 1)).clip(0, 2)

    df = df.drop(columns=["volume_ratio"], errors="ignore")
    return df


# -------------------------------------------------------------------------
# Labels
# -------------------------------------------------------------------------

def compute_labels(df: pd.DataFrame) -> pd.DataFrame:
    """Compute ML training labels."""
    df = df.copy()
    close = df["close"]

    # Label 1: Directional (next candle close > current close)
    df["label_direction"] = (close.shift(-1) > close).astype(int)

    # Label 2: RRR met (already in trade_log, flag here for merged)
    # Label 3: AMD alignment (computed separately)
    # Label 4: Alpha (already in trade_log)
    # Label 5: Session direction
    session_close = df.groupby([df["timestamp"].dt.date, "session_id"])["close"].transform("last")
    session_open  = df.groupby([df["timestamp"].dt.date, "session_id"])["close"].transform("first")
    df["label_session_dir"] = (session_close > session_open).astype(int)

    return df


# -------------------------------------------------------------------------
# Full pipeline
# -------------------------------------------------------------------------

def engineer_features(
    candles_df: pd.DataFrame,
    trade_log_df: pd.DataFrame | None = None,
    session_agg_df: pd.DataFrame | None = None,
    math_engine_snapshot: dict | None = None,
    key_levels: dict | None = None,
) -> pd.DataFrame:
    """
    Full feature engineering pipeline.
    Takes raw candles DataFrame and optional trade log + session aggregates.
    Returns feature DataFrame aligned to candle timestamps.

    Parameters
    ----------
    candles_df : DataFrame with columns: timestamp, open, high, low, close, volume,
                 optional: tick_volume, symbol, vwap, adx, atr, ci, vr, sweepProb, amdPhase
    trade_log_df : Historical trade log DataFrame
    session_agg_df : Session aggregate DataFrame
    math_engine_snapshot : Dict of current MathEngine values
    key_levels : Dict of key levels {pdh, pdl, pwh, pwl}

    Returns
    -------
    pd.DataFrame with all engineered features, sorted by timestamp
    """
    if candles_df.empty:
        return candles_df.copy()

    df = candles_df.copy()

    # 1. Assign session IDs
    df = assign_session_ids(df)

    # 2. Compute per-candle technical features
    df = compute_candle_features(df)

    # 3. Compute time features
    df = compute_time_features(df)

    # 4. Compute key level features
    df = compute_level_features(df, key_levels)

    # 5. Broadcast MathEngine snapshot to all candles
    if math_engine_snapshot:
        for feat, val in math_engine_snapshot.items():
            if feat in df.columns:
                df[feat] = val
            elif isinstance(val, (int, float)):
                df[feat] = val

    # 6. Encode AMD phase
    if "amdPhase" in df.columns:
        df = encode_amd_phases(df)
    elif math_engine_snapshot and "amdPhase" in math_engine_snapshot:
        for phase in config.AMD_PHASES:
            df[f"amd_{phase}"] = 1 if math_engine_snapshot["amdPhase"] == phase else 0
    else:
        for phase in config.AMD_PHASES:
            df[f"amd_{phase}"] = 0.0

    # 7. Encode VR regime
    if "vr" in df.columns:
        df = encode_vr_regime(df)
    elif math_engine_snapshot and "vr" in math_engine_snapshot:
        vr = math_engine_snapshot["vr"]
        df["vr_regime"] = (
            0 if vr < 0.85 else (1 if vr < 1.15 else 2)
        )
    else:
        df["vr_regime"] = 1

    # 8. Historical win rate features
    df = compute_historical_features(
        df, trade_log_df if trade_log_df is not None else pd.DataFrame()
    )

    # 9. Cross-session features
    df = compute_cross_session_features(
        df, session_agg_df if session_agg_df is not None else pd.DataFrame()
    )

    # 10. Compute labels
    df = compute_labels(df)

    return df


# -------------------------------------------------------------------------
# Feature list
# -------------------------------------------------------------------------

FEATURE_COLS = [
    # From candle data
    "open", "high", "low", "close", "volume",
    "tr", "atr", "log_return", "intrabar_momentum",
    "range", "range_pct", "upper_wick_pct", "lower_wick_pct",
    "atr_pct", "volume_ratio_5",
    "rolling_std_10", "rolling_std_20", "realized_vol",
    "momentum_3bar", "momentum_5bar",
    # Time features
    "hour_of_day", "day_of_week", "session_pct",
    "minutes_into_session", "session_id",
    "is_first_30min", "is_last_30min", "is_lunch_hour",
    # Level features
    "price_to_pdh", "price_to_pdl", "near_level",
    # MathEngine
    "adx", "ci", "vwap", "vwap_slope_entry",
    "vr", "sweep_prob", "volatility_regime",
    # AMD encoding
    "amd_ACCUMULATION", "amd_MANIPULATION", "amd_DISTRIBUTION",
    "amd_TRANSITION", "amd_UNCLEAR",
    # VR regime
    "vr_regime",
    # Historical
    "win_rate_20", "win_rate_50", "expectancy_20", "profit_factor_20",
    # Cross-session
    "gap_pct", "range_vs_atr", "daily_range_used_pct",
]


def get_feature_vector(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract only the ML feature columns from a full feature DataFrame.
    Returns DataFrame with only FEATURE_COLS that exist in df.
    """
    available = [c for c in FEATURE_COLS if c in df.columns]
    return df[available].copy()
