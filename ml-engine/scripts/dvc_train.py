#!/usr/bin/env python3
"""
DVC Stage: train — Train all ML models from the pipeline.
Usage: python ml-engine/scripts/dvc_train.py
Reads: ml-engine/data/trading_data.db
Writes: ml-engine/models/store/ (versioned by DVC)
"""
import sys, os
from pathlib import Path

ML_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ML_DIR))

import config
from data.candle_db import CandleDatabase
from training.trainer import Trainer
from training.model_store import ModelStore


def run(mode: str = "incremental", min_trades: int = 100) -> dict:
    print(f"[DVC train] Starting training (mode={mode}, min_trades={min_trades})")

    db_path = ML_DIR / "data" / "trading_data.db"
    db = CandleDatabase(str(db_path))
    trainer = Trainer(db_path=str(db_path), store_dir=config.MODEL_STORE)

    result = trainer.train_all(mode=mode, min_trades=min_trades)
    print(f"[DVC train] Training complete: {result}")

    # Verify models were saved
    store = ModelStore(config.MODEL_STORE)
    versions = store.list_versions()
    print(f"[DVC train] {len(versions)} model versions in store: {versions}")

    return {
        "trained": result.get("trained", []),
        "skipped": result.get("skipped", []),
        "failed": result.get("failed", []),
        "model_versions": versions,
    }


if __name__ == "__main__":
    import json
    mode = sys.argv[1] if len(sys.argv) > 1 else "incremental"
    min_trades = int(sys.argv[2]) if len(sys.argv) > 2 else 100
    result = run(mode=mode, min_trades=min_trades)
    print(json.dumps(result, indent=2))