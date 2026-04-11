#!/usr/bin/env python3
"""
DVC Stage: ingest - load raw CSV data into SQLite.
Usage: python ml-engine/scripts/dvc_ingest.py
Reads: CSV file (params: data.csv_path)
Writes: ml-engine/data/trading_data.db
"""

import json
import os
import sys
from pathlib import Path

import pandas as pd

ML_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ML_DIR))

import config
from data.candle_db import CandleDatabase
from data.load_ninjatrader_csv import compute_session_aggregates, load_ninjatrader_csv
from data_quality.validation_pipeline import validate_incoming_dataset


def run(csv_path: str | None = None, symbol: str = "MNQ") -> dict:
    csv_path = csv_path or os.environ.get("CSV_PATH", str(ML_DIR / "data" / "ninjatrader_export.csv"))
    csv_path = Path(csv_path)

    if not csv_path.exists():
        print(f"[DVC ingest] CSV not found: {csv_path} - skipping (no raw data yet)")
        return {"skipped": True, "reason": "no_csv"}

    print(f"[DVC ingest] Loading {csv_path}")
    df = load_ninjatrader_csv(str(csv_path), symbol=symbol)

    print(f"[DVC ingest] {len(df)} candles loaded, sessions: {df['session_id'].nunique()}")
    print(f"[DVC ingest] Date range: {df['timestamp'].min()} -> {df['timestamp'].max()}")
    candles_dq = validate_incoming_dataset(
        df=df,
        dataset_type="candles",
        source=f"dvc_ingest:{csv_path.name}",
        block=True,
        persist_rejected=True,
    )
    print(
        "[DVC ingest] Candle DQ gate passed: "
        f"critical_failures={candles_dq.get('critical_failures', 0)}, "
        f"warnings={candles_dq.get('warning_failures', 0)}"
    )

    db_path = ML_DIR / "data" / "trading_data.db"
    db = CandleDatabase(str(db_path))
    db.write_candles(df)
    print(f"[DVC ingest] Wrote {len(df)} candles to {db_path}")

    agg = compute_session_aggregates(df)
    sessions_dq = validate_incoming_dataset(
        df=agg,
        dataset_type="sessions",
        source=f"dvc_ingest_session_aggregates:{csv_path.name}",
        block=True,
        persist_rejected=True,
    )
    print(
        "[DVC ingest] Session DQ gate passed: "
        f"critical_failures={sessions_dq.get('critical_failures', 0)}, "
        f"warnings={sessions_dq.get('warning_failures', 0)}"
    )
    db.write_session_aggregates(agg)
    print(f"[DVC ingest] Wrote {len(agg)} session aggregates")

    stats = {
        "candles": len(df),
        "sessions": int(df["session_id"].nunique()),
        "date_range": [str(df["timestamp"].min()), str(df["timestamp"].max())],
        "symbol": symbol,
        "dq": {
            "candles_passed": bool(candles_dq.get("passed", False)),
            "sessions_passed": bool(sessions_dq.get("passed", False)),
            "candles_critical_failures": int(candles_dq.get("critical_failures", 0)),
            "sessions_critical_failures": int(sessions_dq.get("critical_failures", 0)),
        },
    }

    out_stats = ML_DIR / "data" / "ingest_stats.json"
    with open(out_stats, "w", encoding="utf-8") as handle:
        json.dump(stats, handle, indent=2)
    print(f"[DVC ingest] Wrote stats to {out_stats}")

    return stats


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))
