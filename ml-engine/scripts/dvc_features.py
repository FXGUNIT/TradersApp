#!/usr/bin/env python3
"""
DVC Stage: features — Engineer features from candle data.
Usage: python ml-engine/scripts/dvc_features.py
Reads: ml-engine/data/trading_data.db
Writes: ml-engine/data/features.parquet, ml-engine/data/feature_stats.json
"""
import sys, os, json
from pathlib import Path

ML_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ML_DIR))

import config
from data.candle_db import CandleDatabase
from features.feature_pipeline import engineer_features, FEATURE_COLS, get_feature_vector
import pandas as pd


def run(window_size: int = 14) -> dict:
    print(f"[DVC features] Engineering features (window={window_size})")

    db = CandleDatabase(config.DB_PATH)
    df = db.get_candles(n=10000)

    if df.empty:
        print("[DVC features] No candles in DB — skipping")
        return {"skipped": True, "reason": "no_data"}

    feat = engineer_features(df, window_size=window_size)

    out_parquet = ML_DIR / "data" / "features.parquet"
    feat.to_parquet(str(out_parquet), index=False)
    print(f"[DVC features] Wrote {len(feat)} rows to {out_parquet}")

    stats = {
        "rows": len(feat),
        "cols": len(FEATURE_COLS),
        "feature_cols": FEATURE_COLS,
        "date_range": [str(df["timestamp"].min()), str(df["timestamp"].max())],
    }
    out_stats = ML_DIR / "data" / "feature_stats.json"
    with open(out_stats, "w") as f:
        json.dump(stats, f, indent=2)

    return stats


if __name__ == "__main__":
    ws = int(sys.argv[1]) if len(sys.argv) > 1 else 14
    result = run(window_size=ws)
    print(json.dumps(result, indent=2))