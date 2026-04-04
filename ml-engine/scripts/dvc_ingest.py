#!/usr/bin/env python3
"""
DVC Stage: ingest — Load raw data into SQLite.
Usage: python ml-engine/scripts/dvc_ingest.py
Reads: CSV file (params: data.csv_path)
Writes: ml-engine/data/trading_data.db
"""
import sys, os
from pathlib import Path

ML_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ML_DIR))

import config
from data.candle_db import CandleDatabase
from data.load_ninjatrader_csv import load_ninjatrader_csv, compute_session_aggregates
import pandas as pd


def run(csv_path: str | None = None, symbol: str = "MNQ") -> dict:
    csv_path = csv_path or os.environ.get("CSV_PATH", str(ML_DIR / "data" / "ninjatrader_export.csv"))
    csv_path = Path(csv_path)

    if not csv_path.exists():
        print(f"[DVC ingest] CSV not found: {csv_path} — skipping (no raw data yet)")
        return {"skipped": True, "reason": "no_csv"}

    print(f"[DVC ingest] Loading {csv_path}")
    df = load_ninjatrader_csv(str(csv_path), symbol=symbol)

    print(f"[DVC ingest] {len(df)} candles loaded, sessions: {df['session_id'].nunique()}")
    print(f"[DVC ingest] Date range: {df['timestamp'].min()} → {df['timestamp'].max()}")

    # Write to SQLite
    db_path = ML_DIR / "data" / "trading_data.db"
    db = CandleDatabase(str(db_path))
    db.write_candles(df)
    print(f"[DVC ingest] Wrote {len(df)} candles to {db_path}")

    # Compute session aggregates
    agg = compute_session_aggregates(df)
    db.write_session_aggregates(agg)
    print(f"[DVC ingest] Wrote {len(agg)} session aggregates")

    stats = {
        "candles": len(df),
        "sessions": int(df["session_id"].nunique()),
        "date_range": [str(df["timestamp"].min()), str(df["timestamp"].max())],
        "symbol": symbol,
    }

    out_stats = ML_DIR / "data" / "ingest_stats.json"
    with open(out_stats, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"[DVC ingest] Wrote stats to {out_stats}")

    return stats


if __name__ == "__main__":
    import json
    result = run()
    print(json.dumps(result, indent=2))