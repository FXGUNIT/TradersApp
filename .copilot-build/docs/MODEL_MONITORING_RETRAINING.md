# Continuous Model Monitoring + Auto-Retraining

This repo now has a closed operational loop for production model health using MLflow, Prometheus, and Airflow.

## What Runs Continuously

- ML Engine exposes a unified snapshot at `/monitoring/status`
- Prometheus scrapes live metrics from `/metrics`
- Airflow runs `continuous_model_monitoring` every 5 minutes
- Airflow runs `feedback_retrain_loop` weekly as a scheduled fallback
- MLflow registry state is synchronized into Prometheus gauges for freshness alerts

## Monitoring Signals

The monitoring snapshot combines four sources:

- Drift:
  - feature drift via PSI
  - concept drift via rolling win-rate degradation
  - regime drift via the existing regime detector
- Latency:
  - `/predict` SLA report from the in-process `SLAMonitor`
- MLflow:
  - active experiment/run overview
  - registry counts and production model freshness
- Retrain readiness:
  - last training record
  - new closed trades since last training
  - whether drift recommends retraining

## Automatic Retrain Policy

Retraining is triggered automatically only when all of these are true:

1. Drift monitoring recommends retraining.
2. Enough new closed trades have accumulated since the last training run.
3. The Great Expectations data-quality gate passes.

Latency is monitored and alerted, but it does **not** auto-trigger retraining. That is deliberate. Latency regressions are often caused by infrastructure, cache, or dependency issues, and retraining the model is usually the wrong remediation.

## Key Endpoints

- `GET /monitoring/status`
- `GET /drift/status`
- `GET /sla`
- `GET /mlflow/status`
- `POST /feedback/retrain`
- `GET /feedback/retrain-status`

## Prometheus Metrics Added

- `ml_monitoring_last_check_timestamp`
- `ml_drift_status{detector=...}`
- `ml_drift_should_retrain`
- `ml_concept_drift_baseline_win_rate`
- `ml_concept_drift_current_win_rate`
- `ml_concept_drift_win_rate_drop_pct`
- `ml_retrain_last_success_timestamp`
- `ml_retrain_last_failure_timestamp`
- `ml_retrain_last_duration_seconds`
- `ml_model_stage_age_seconds{model_name,stage}`

## Airflow DAGs

- `continuous_model_monitoring`
  - every 5 minutes
  - refreshes monitoring snapshot
  - enforces DQ gate
  - triggers incremental retrain on drift
- `feedback_retrain_loop`
  - weekly fallback retrain cadence
- `mlflow_model_lifecycle`
  - registry sync, promotion, and archive workflow

## Local Bring-Up

```bash
docker compose -f docker-compose.airflow.yml up -d
curl -f "http://localhost:8001/monitoring/status?symbol=MNQ&sync_metrics=true"
```

Then enable these DAGs in Airflow:

- `continuous_model_monitoring`
- `feedback_retrain_loop`
- `mlflow_model_lifecycle`

## Alerting

Prometheus rules now cover:

- drift severity and stale monitoring snapshots
- retrain failures, retrain stalls, and missed retrain triggers
- 50ms critical-path breaches
- stale production models in MLflow

Alert definitions live in:

- [ml-engine.rules.yml](../k8s/observability/alerts/ml-engine.rules.yml)
- [infrastructure.rules.yml](../k8s/observability/alerts/infrastructure.rules.yml)
