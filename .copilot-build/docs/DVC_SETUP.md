# TradersApp — DVC Data Versioning

**Purpose:** Version-control datasets, features, and models alongside code.

## Quick Reference

```bash
# Install DVC
pip install dvc

# Initialize (already done)
python -m dvc init

# Track new data
python -m dvc add ml-engine/data/my_data.csv

# Add to pipeline
python -m dvc add ml-engine/models/direction/lgb_model.pkl

# Run full pipeline
python -m dvc repro

# Push to remote storage
python -m dvc push

# Pull latest data
python -m dvc pull

# Check status
python -m dvc status
```

## Remote Storage

- **Type:** Local filesystem
- **Path:** `ml-engine/dvc-storage/`
- **To upgrade to S3/MinIO:**
  ```bash
  python -m dvc remote add -d storage s3://your-bucket/tradersapp
  ```

## Files Tracked by DVC

| File | Type | Purpose |
|------|------|---------|
| `ml-engine/data/schema.sql` | Data schema | Database structure |
| `ml-engine/data/candle_db.py` | Data loader | CSV → SQLite pipeline |
| `ml-engine/data/load_ninjatrader_csv.py` | Data loader | NinjaTrader import |
| `ml-engine/models/*/*.pkl` | Models | Trained model weights |

## Pipeline Stages

1. **load_candles** — Load NinjaTrader CSV → SQLite
2. **features** — Feature engineering pipeline
3. **train_regime** — HMM, FP-FK, Anomalous Diffusion
4. **train_direction** — LightGBM direction model
5. **evaluate** — Consensus evaluation metrics

## Important Notes

- The SQLite database (`trading_data.db`) is NOT tracked by DVC directly
  because it may be locked by running processes. Use `dvc repro` to
  regenerate it from source CSV files.
- Always use `dvc repro` after pulling changes to ensure data is consistent.
- Model files are tracked after `train_direction` / `train_regime` stages run.
