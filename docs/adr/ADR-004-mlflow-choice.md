# ADR-004: MLflow Self-Hosted for Experiment Tracking & Model Registry

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

**Architecture:**
- **MLflow Tracking Server** (Docker + k3s Helm): `http://localhost:5000` locally, `http://mlflow:5000` in cluster
- **Backend Store:** PostgreSQL 16 (durable, queryable experiment metadata)
- **Artifact Store:** MinIO (S3-compatible, self-hosted — no cloud dependency)
- **Artifact access mode:** MLflow serves artifacts through `--serve-artifacts`
- **CI integration:** Woodpecker builds and publishes a custom MLflow image with PostgreSQL and S3 drivers

**What gets tracked:**
- Every training run: parameters, metrics (ROC-AUC, Sharpe, win rate, PBO)
- Every model artifact: pipeline + feature metadata
- DVC commit hash as run tag (data lineage: "this model was trained on data version X")
- Dataset stats: candle count, trade count, feature count, date range

**Model Registry stages:**
```
None → Staging → Production → Archived
```

**Auto-registration:** Models that pass either the strategy gate (PBO < 5%, Sharpe ≥ 0.5, win rate ≥ 50%) or the classifier fallback gate (CV ROC-AUC ≥ 0.55, CV accuracy ≥ 0.52) are auto-registered to Staging. Human reviews and promotes to Production.

**Endpoints:**
- `GET /mlflow/status` — server connectivity check
- `GET /mlflow/experiments` — list runs per experiment
- `GET /mlflow/models` — registered models with versions
- `POST /mlflow/promote` — staging → production promotion

**Why MLflow over alternatives:**
- **Weights & Biases:** Cloud-only, no self-hosted option, paid for teams
- **Neptune:** Cloud-only, similar limitations
- **MLflow:** Open source, self-hosted, PostgreSQL + S3 backend, model registry built-in, broad tool support
- **SageMaker:** AWS lock-in, overkill for single-developer trading system

**Infrastructure:**
```bash
docker compose -f docker-compose.mlflow.yml up -d --build
# Access at http://localhost:5000
```

## Consequences

### Positive
- Full experiment history: every run searchable by date, metrics, parameters
- Model lineage: DVC commit hash links model → training data version
- Model registry: explicit production/staging stages with version history
- Auto-promotion: models passing PBO thresholds automatically staged
- Self-hosted: no cloud dependency, data never leaves local infrastructure
- PostgreSQL backend: SQL queries on experiment metadata (e.g., "best Sharpe by model type")

### Negative
- Adds 3 Docker containers (MLflow, PostgreSQL, MinIO) to the stack
- PostgreSQL password must be managed (stored in Infisical)
- MinIO needs persistent volume backup
- MLflow server is a single point of failure (no HA in this version)

### Neutral
- MLflow autolog handles most sklearn models automatically
- Can upgrade MinIO to real AWS S3 by changing `MLFLOW_S3_ENDPOINT_URL`
- CI pulls MLflow artifacts using service token stored in Infisical

