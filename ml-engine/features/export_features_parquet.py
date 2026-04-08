"""
Export Features to Parquet — bridges the trading database to Feast offline store.

Usage:
  python -m ml_engine.features.export_features_parquet

Exports from the configured trading database:
  1. candles_5min → candle_features.parquet
  2. trade_log → trade_features.parquet
  3. session_aggregates → session_features.parquet

Then run:
  feast materialize

Environment:
  DATABASE_URL: PostgreSQL connection string for k8s/production
  FEAST_DB_PATH: fallback SQLite path for local development
"""

import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pandas as pd

# Add ml-engine to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml_engine.data.candle_db import CandleDatabase
from ml_engine.features.feast_repo.feature_pipeline import engineer_features, get_feature_vector

OUTPUT_DIR = PROJECT_ROOT / "ml_engine" / "data" / "feast_features"


def export_candle_features(db: CandleDatabase, symbol: str = "MNQ") -> pd.DataFrame:
    """
    Export candle features to Parquet for Feast offline store.

    Reads all candles, computes full feature matrix, exports with:
      - symbol, timestamp as entity keys
      - all features as columns
      - created_at for point-in-time safety
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "candles_features.parquet"

    # Read all candles for the symbol
    df = db.get_candles(
        start="2020-01-01",
        end=datetime.now(timezone.utc).isoformat()[:10],
        symbol=symbol,
        limit=500000,
    )

    if df.empty:
        print(f"[Export] No candles found for {symbol}")
        return pd.DataFrame()

    # Engineer features using the existing feature pipeline
    feat_df = engineer_features(
        candles_df=df,
        trade_log_df=None,
        session_agg_df=None,
        math_engine_snapshot=None,
        key_levels=None,
    )

    # Select only feature columns (exclude labels and timestamps used for alignment)
    feat_cols = [c for c in feat_df.columns if not c.startswith("label_")]
    feat_df = feat_df[feat_cols].copy()

    # Ensure entity columns exist
    feat_df["symbol"] = symbol
    feat_df["timestamp"] = feat_df.index

    # Add created_at
    feat_df["created_at"] = datetime.now(timezone.utc)

    feat_df.to_parquet(str(output_path), index=False)
    print(f"[Export] Wrote {len(feat_df)} rows to {output_path}")
    return feat_df


def export_trade_features(db: CandleDatabase, symbol: str = "MNQ") -> pd.DataFrame:
    """
    Export historical trade features to Parquet for Feast.

    Computes rolling window features per trade:
      - win_rate_20, win_rate_50
      - expectancy_20
      - profit_factor_20
      - amd_win_rate_*
    """
    output_path = OUTPUT_DIR / "trade_features.parquet"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    trades = db.get_trade_log(limit=50000, symbol=symbol)

    if trades.empty:
        print(f"[Export] No trade log found for {symbol}")
        return pd.DataFrame()

    trades = trades.sort_values("entry_time").reset_index(drop=True)

    # Compute rolling features
    wins = (trades["result"] == "win").astype(float)

    trades["win_rate_20"] = wins.rolling(20, min_periods=1).mean()
    trades["win_rate_50"] = wins.rolling(50, min_periods=1).mean()
    trades["expectancy_20"] = trades["pnl_dollars"].rolling(20, min_periods=1).mean()
    trades["profit_factor_20"] = _rolling_profit_factor(trades["pnl_ticks"], 20)

    # AMD phase win rates (global, not rolling)
    for phase in ["ACCUMULATION", "MANIPULATION", "DISTRIBUTION", "TRANSITION"]:
        mask = trades["amd_phase"] == phase
        if mask.sum() > 0:
            trades[f"amd_win_rate_{phase}"] = wins[mask].mean()

    # Select features + entity keys
    feat_cols = [c for c in ["win_rate_20", "win_rate_50", "expectancy_20", "profit_factor_20",
                              "amd_win_rate_ACCUMULATION", "amd_win_rate_MANIPULATION",
                              "amd_win_rate_DISTRIBUTION", "amd_win_rate_TRANSITION"]
                if c in trades.columns]

    result = trades[["symbol", "entry_time"] + feat_cols].copy()
    result.columns = ["symbol", "entry_time"] + feat_cols
    result["created_at"] = datetime.now(timezone.utc)

    result.to_parquet(str(output_path), index=False)
    print(f"[Export] Wrote {len(result)} rows to {output_path}")
    return result


def export_session_features(db: CandleDatabase, symbol: str = "MNQ") -> pd.DataFrame:
    """
    Export session aggregate features to Parquet for Feast.
    """
    output_path = OUTPUT_DIR / "session_features.parquet"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Get session aggregates
    try:
        start = "2020-01-01"
        end = datetime.now(timezone.utc).isoformat()[:10]
        sess_df = db.get_session_aggregates(start, end, symbol=symbol)
    except Exception:
        print(f"[Export] No session aggregates found for {symbol}")
        return pd.DataFrame()

    if sess_df.empty:
        print(f"[Export] No session aggregates found for {symbol}")
        return pd.DataFrame()

    # Select relevant columns
    cols = ["trade_date", "symbol", "direction", "close_to_open",
            "gap_pct", "session_range", "range_vs_atr",
            "volume_ratio", "candle_count"]
    cols = [c for c in cols if c in sess_df.columns]

    result = sess_df[cols].copy()
    if "volume_ratio" in result.columns:
        result = result.rename(columns={"volume_ratio": "volume_ratio_sess"})

    result["created_at"] = datetime.now(timezone.utc)
    result.to_parquet(str(output_path), index=False)
    print(f"[Export] Wrote {len(result)} rows to {output_path}")
    return result


def _rolling_profit_factor(pnl_series: pd.Series, window: int) -> pd.Series:
    """Compute rolling profit factor: gross wins / gross losses."""
    wins = pnl_series.clip(lower=0).rolling(window, min_periods=1).sum()
    losses = pnl_series.clip(upper=0).abs().rolling(window, min_periods=1).sum()
    return wins / losses.replace(0, float("nan"))


def main():
    db_path = os.environ.get("FEAST_DB_PATH", str(PROJECT_ROOT / "ml_engine" / "data" / "trading_data.db"))
    database_url = os.environ.get("DATABASE_URL", "").strip() or None
    db = CandleDatabase(db_path=db_path, database_url=database_url)

    symbol = os.environ.get("FEAST_SYMBOL", "MNQ")
    source = "DATABASE_URL" if database_url else db_path
    print(f"[Export] Exporting features for {symbol} from {source}")

    export_candle_features(db, symbol)
    export_trade_features(db, symbol)
    export_session_features(db, symbol)

    print(f"[Export] Complete! Parquet files at: {OUTPUT_DIR}")
    print(f"[Export] Next: feast materialize")


if __name__ == "__main__":
    main()
