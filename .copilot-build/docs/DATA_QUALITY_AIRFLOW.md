# Automated Data Quality Pipelines (Great Expectations + Airflow)

This stack enforces data quality before models train or retrain.

## What is implemented

- Great Expectations checks on:
  - `candles_5min`
  - `trade_log`
  - `session_aggregates`
- Ingestion-time hard gate on incoming datasets (`candles`, `trades`, `sessions`) before DB writes:
  - API routes: `/candles/upload`, `/trades/upload`, `/candles/parse-csv`
  - DVC ingestion: `ml-engine/scripts/dvc_ingest.py`
  - Prediction pre-check: `/predict` validates incoming candle windows before model inference
- Automatic quarantine on rejected data:
  - saves rejection report JSON + sampled CSV for triage
  - default path: `airflow/reports/dq_rejections`
- Airflow DAG `data_quality_pipeline`:
  - runs every 30 minutes
  - fails hard on critical quality failures
  - sends webhook alerts on failure
  - logs DQ metrics to MLflow
- Airflow DAG `feedback_retrain_loop` now includes `validate_data_quality_gate` before retraining.
- `Trainer.train_direction_models()` enforces a pre-train data quality gate by default.

## Required environment variables

- `DQ_DB_PATH` (default: `ml-engine/data/trading_data.db`)
- `DQ_BLOCK_ON_CRITICAL` (default: `true`)
- `DQ_REQUIRE_GX` (default: `true`)
- `DQ_ALERT_WEBHOOK` (optional but recommended)
- `MLFLOW_TRACKING_URI` (default: `http://mlflow:5000`)
- `DQ_QUARANTINE_DIR` (default: `airflow/reports/dq_rejections`)
- `DQ_VALIDATE_BEFORE_PREDICT` (default: `true`)

## Local self-hosted bring-up

Start dependencies (`ml-engine`, `mlflow`) first, then Airflow:

```bash
docker compose -f docker-compose.yml up -d ml-engine mlflow
docker compose -f docker-compose.airflow.yml up -d
```

Airflow UI:

- URL: `http://localhost:8081`
- user: `admin`
- pass: `admin`

Enable DAGs:

- `data_quality_pipeline`
- `feedback_retrain_loop`

## Manual run

```bash
python ml-engine/data_quality/validation_pipeline.py --json
```

Run DVC ingest with hard gate:

```bash
python ml-engine/scripts/dvc_ingest.py
```

If an incoming dataset fails validation, the process fails and writes quarantine artifacts under `DQ_QUARANTINE_DIR`.

If critical checks fail and `DQ_BLOCK_ON_CRITICAL=true`, this exits non-zero.

## Notes for production

- Keep `DQ_REQUIRE_GX=true` so the gate fails if Great Expectations is unavailable.
- Configure `DQ_ALERT_WEBHOOK` from Infisical.
- Keep DAG schedules active; do not rely on ad-hoc manual checks.
