# ADR-004: MLflow Self-Hosted for MLOps

**ADR ID:** ADR-004
**Title:** MLflow Self-Hosted for MLOps
**Status:** Accepted
**Date:** 2026-04-03
**Author:** FXGUNIT

## Context

The ML Engine trains multiple model families (LightGBM, XGBoost, RandomForest, HMM, FP-FK, Anomalous Diffusion) across different market regimes. Without experiment tracking:
- No record of which hyperparameters produced which metrics
- No way to compare model versions across time
- No audit trail for compliance (which data version produced which model)
- Manual model promotion — no registry of "this is the production model"

## Decision

Use **MLflow Self-Hosted** as the MLOps platform:

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MLflow Platform                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐     ┌──────────────┐                   │
│  │  MLflow      │────▶│  PostgreSQL  │                   │
│  │  Tracking    │     │  (Metadata)  │                   │
│  │  Server      │     │              │                   │
│  └──────────────┘     └──────────────┘                   │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                       │
│  │  MinIO        │                                       │
│  │  (Artifacts)  │                                       │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

### Infrastructure Configuration

```bash
# docker-compose.mlflow.yml
services:
  mlflow:
    image: ghcr.io/mlflow/mlflow:v2.21.3
    ports:
      - "5000:5000"
    environment:
      MLFLOW_TRACKING_URI: postgresql://mlflow:${POSTGRES_PASSWORD}@postgres:5432/mlflow
      MLFLOW_ARTIFACT_ROOT: s3://mlflow-artifacts/
      AWS_ACCESS_KEY_ID: ${MINIO_USER}
      AWS_SECRET_ACCESS_KEY: ${MINIO_PASSWORD}
      AWS_ENDPOINT_URL: http://minio:9000
    command: >
      mlflow server
      --backend-store-uri postgresql://mlflow:${POSTGRES_PASSWORD}@postgres:5432/mlflow
      --default-artifact-root s3://mlflow-artifacts/
      --host 0.0.0.0
      --port 5000
```

### What Gets Tracked

| Data | Format | Purpose |
|------|--------|---------|
| Parameters | JSON | Hyperparameter values |
| Metrics | Scalar | ROC-AUC, Sharpe, win rate, PBO |
| Artifacts | Files | Model pickles, feature metadata |
| Tags | Key-value | DVC commit hash for lineage |
| Notes | Text | Experiment descriptions |

### Model Registry Stages

```
None → Staging → Production → Archived
  │       │          │            │
  │       ▼          ▼            ▼
  │   Auto-    Human       Paper trade
  │   promote  review      verified
  │   if PBO   required
  │   < 5%
  │
  Initial
  training
```

### Auto-Registration Criteria

Models passing either gate are auto-registered to Staging:

**Strategy Gate:**
- PBO < 5%
- Sharpe ≥ 0.5
- Win rate ≥ 50%

**Classifier Fallback Gate:**
- CV ROC-AUC ≥ 0.55
- CV accuracy ≥ 0.52

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mlflow/status` | GET | Server connectivity |
| `/mlflow/experiments` | GET | List experiments |
| `/mlflow/models` | GET | Registered models |
| `/mlflow/promote` | POST | Staging → Production |

## Consequences

### Positive
- **Full experiment history:** Every run searchable by date, metrics, parameters
- **Model lineage:** DVC commit hash links model → training data version
- **Model registry:** Explicit production/staging stages with version history
- **Auto-promotion:** Models passing thresholds automatically staged
- **Self-hosted:** No cloud dependency, data never leaves infrastructure
- **SQL queries:** PostgreSQL backend enables complex experiment queries

### Negative
- **Infrastructure overhead:** 3 Docker containers (MLflow, PostgreSQL, MinIO)
- **Credential management:** PostgreSQL password stored in Infisical
- **Persistence:** MinIO needs persistent volume backup
- **Single point of failure:** No HA in this version

### Neutral
- MLflow autolog handles sklearn models automatically
- Can upgrade MinIO to AWS S3 by changing `MLFLOW_S3_ENDPOINT_URL`
- CI pulls artifacts using service token from Infisical

## Alternatives Considered

### Weights & Biases (wandb)
- **Pros:** Excellent UX, automatic hyperparameter tuning
- **Cons:** Cloud-only, no self-hosted option, paid for teams
- **Why rejected:** No self-hosted option, vendor lock-in

### Neptune.ai
- **Pros:** Clean UI, good integrations
- **Cons:** Cloud-only, similar limitations to W&B
- **Why rejected:** No self-hosted option

### Amazon SageMaker
- **Pros:** Fully managed, AWS integration
- **Cons:** AWS lock-in, overkill for single-developer system
- **Why rejected:** Vendor lock-in, complexity

### Custom Experiment Tracker (Homegrown)
- **Pros:** Full control
- **Cons:** Significant development effort
- **Why rejected:** Building ML experiment tracking is out of scope

## References

- [MLflow Documentation](https://mlflow.org/docs/latest/index.html)
- [MLflow Model Registry](https://mlflow.org/docs/latest/model-registry.html)
- [MLflow Tracking Server Setup](https://mlflow.org/docs/latest/tracking.html#tracking-server)
- Related ADRs: [ADR-001 DVC](ADR-001-dvc-data-versioning.md) (DVC commit hash for lineage), [ADR-012 Continual Learning](ADR-012-continual-learning.md) (MLflow for training tracking)
