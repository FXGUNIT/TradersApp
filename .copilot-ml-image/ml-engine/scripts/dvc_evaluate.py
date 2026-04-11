#!/usr/bin/env python3
"""
DVC Stage: evaluate — Run backtesting and collect evaluation metrics.
Usage: python ml-engine/scripts/dvc_evaluate.py
Reads: ml-engine/data/trading_data.db, ml-engine/models/store/
Writes: ml-engine/data/evaluation_metrics.json
"""
import sys, os, json
from pathlib import Path

ML_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ML_DIR))

import config
from data.candle_db import CandleDatabase
from training.model_store import ModelStore


def run(symbol: str = "MNQ") -> dict:
    print(f"[DVC evaluate] Running evaluation for {symbol}")

    db = CandleDatabase(config.DB_PATH)
    store = ModelStore(config.MODEL_STORE)
    versions = store.list_versions()

    results = {}
    for v in versions:
        name = v["model_name"]
        version = v["version"]

        # Load model
        model = store.load(name, version)
        if model is None:
            continue

        # Get metadata
        meta = store.load_meta(name, version)
        metrics = meta.get("metrics", {})

        results[name] = {
            "version": version,
            "cv_roc_auc_mean": metrics.get("cv_roc_auc_mean"),
            "cv_roc_auc_std": metrics.get("cv_roc_auc_std"),
            "cv_accuracy_mean": metrics.get("cv_accuracy_mean"),
            "cv_precision_mean": metrics.get("cv_precision_mean"),
            "cv_recall_mean": metrics.get("cv_recall_mean"),
            "cv_f1_mean": metrics.get("cv_f1_mean"),
            "trained_at": meta.get("saved_at"),
            "feature_cols": meta.get("feature_cols", []),
        }

    # Write metrics
    out_path = ML_DIR / "data" / "evaluation_metrics.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"[DVC evaluate] Wrote metrics to {out_path}")

    # Summary
    print(f"\n[DVC evaluate] Model evaluation summary:")
    for name, m in results.items():
        auc = m.get("cv_roc_auc_mean", "N/A")
        print(f"  {name}: AUC={auc}, trained={m.get('trained_at', '?')}")

    return {"models": results, "count": len(results)}


if __name__ == "__main__":
    symbol = sys.argv[1] if len(sys.argv) > 1 else "MNQ"
    result = run(symbol=symbol)
    print(json.dumps(result, indent=2))