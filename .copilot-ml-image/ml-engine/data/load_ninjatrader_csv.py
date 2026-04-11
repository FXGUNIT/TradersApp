"""
NinjaTrader CSV Parser + Loader.
Parses NinjaTrader export → normalized 5-min DataFrame → SQLite.
NinjaTrader exports: Date, Time, Open, High, Low, Close, Volume (TickVolume optional)
"""
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from features.feature_pipeline import assign_session_ids


def load_ninjatrader_csv(filepath: str, symbol: str = "MNQ") -> pd.DataFrame:
    """
    Parse NinjaTrader CSV export → normalized DataFrame with session IDs.

    Parameters
    ----------
    filepath : str
        Path to the CSV file exported from NinjaTrader
    symbol : str
        Trading symbol (default: MNQ)

    Returns
    -------
    pd.DataFrame with columns: timestamp, open, high, low, close, volume, tick_volume, session_id
    """
    # Read CSV — NinjaTrader typically has Date, Time, Open, High, Low, Close, Volume
    df = pd.read_csv(filepath)

    # Normalize column names
    df.columns = [c.strip().lower().strip('"') for c in df.columns]

    # Handle Date+Time combined or separate
    if "date" in df.columns and "time" in df.columns:
        df["timestamp"] = pd.to_datetime(
            df["date"].astype(str) + " " + df["time"].astype(str)
        )
    elif "date" in df.columns:
        # Assume date only, try to parse
        df["timestamp"] = pd.to_datetime(df["date"])
    elif "timestamp" in df.columns or "datetime" in df.columns:
        ts_col = "timestamp" if "timestamp" in df.columns else "datetime"
        df["timestamp"] = pd.to_datetime(df[ts_col])

    # Standardize OHLCV
    for col, required in [("open", float), ("high", float), ("low", float), ("close", float), ("volume", int)]:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")
        df[col] = pd.to_numeric(df[col], errors="coerce").astype(required)

    # Optional tick_volume
    tv_col = next((c for c in df.columns if "tick" in c or "tickvol" in c), None)
    df["tick_volume"] = pd.to_numeric(df[tv_col], errors="coerce").fillna(0).astype(int) if tv_col else 0

    # Sort by timestamp
    df = df.sort_values("timestamp").reset_index(drop=True)

    # Assign session IDs
    df = assign_session_ids(df)

    # Normalize columns
    df_out = df[["timestamp", "open", "high", "low", "close", "volume", "tick_volume", "session_id"]].copy()
    df_out["symbol"] = symbol

    return df_out


def compute_session_aggregates(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute session-level aggregates from 5-min candle data.
    Used for precomputing session stats before ML training.
    """
    df = df.copy()
    df["trade_date"] = df["timestamp"].dt.date

    results = []
    for (date, sess_id), grp in df.groupby(["trade_date", "session_id"]):
        grp = grp.sort_values("timestamp")
        atr_vals = grp.get("atr", grp["high"] - grp["low"])
        if "atr" not in grp.columns:
            high, low, close_prev = grp["high"], grp["low"], grp["close"].shift(1).fillna(grp["close"])
            tr = pd.concat([high - low, (high - close_prev).abs(), (low - close_prev).abs()], axis=1).max(axis=1)
            atr_vals = tr.rolling(14, min_periods=1).mean()

        avg_vol = grp["volume"].mean()
        prev_close = df[df["trade_date"] < date]["close"].tail(1).values

        row = {
            "trade_date": pd.Timestamp(date),
            "symbol": grp["symbol"].iloc[0] if "symbol" in grp.columns else "MNQ",
            "session_id": int(sess_id),
            "session_high": grp["high"].max(),
            "session_low": grp["low"].min(),
            "session_open": grp["open"].iloc[0],
            "session_close": grp["close"].iloc[-1],
            "session_range": grp["high"].max() - grp["low"].min(),
            "total_volume": int(grp["volume"].sum()),
            "avg_volume": float(avg_vol),
            "volume_ratio": float(grp["volume"].iloc[-5:].mean() / avg_vol) if avg_vol > 0 else 1.0,
            "avg_true_range": float(atr_vals.mean()),
            "realized_vol": float(grp["close"].pct_change().std() * np.sqrt(78)),  # annualized
            "close_to_open": float((grp["close"].iloc[-1] - grp["open"].iloc[0]) / grp["open"].iloc[0]),
            "direction": 1 if grp["close"].iloc[-1] > grp["open"].iloc[0] else (-1 if grp["close"].iloc[-1] < grp["open"].iloc[0] else 0),
            "gap_pct": float((grp["open"].iloc[0] - prev_close[0]) / prev_close[0]) if len(prev_close) > 0 else 0.0,
            "range_vs_atr": float((grp["high"].max() - grp["low"].min()) / atr_vals.iloc[-1]) if atr_vals.iloc[-1] > 0 else 1.0,
            "candle_count": len(grp),
        }
        results.append(row)

    return pd.DataFrame(results)
