# MLflow MLOps Lifecycle

This repo uses self-hosted MLflow as the central MLOps control plane for experiment tracking, model registry, and promotion.

## Architecture

- MLflow tracking server stores run metadata in PostgreSQL.
- MinIO stores model artifacts in an S3-compatible bucket.
- MLflow serves artifacts through the tracking server using `--serve-artifacts`, so `ml-engine` only needs `MLFLOW_TRACKING_URI`.
- `ml-engine` logs a parent training run plus nested per-model runs.
- Models that pass validation gates are registered into MLflow and moved to `Staging`.
- Promotion to `Production` is explicit via the ML API.

## Images and Deployment

- Local stack: [docker-compose.mlflow.yml](../docker-compose.mlflow.yml)
- Runtime image: [Dockerfile.mlflow](../Dockerfile.mlflow)
- k3s chart: [mlflow.yaml](../k8s/helm/tradersapp/templates/mlflow.yaml)
- Default values: [values.yaml](../k8s/helm/tradersapp/values.yaml)
- Production values: [values.prod.yaml](../k8s/helm/tradersapp/values.prod.yaml)

The custom MLflow image extends the official `ghcr.io/mlflow/mlflow:v2.21.3` image and adds:

- `psycopg2-binary` for PostgreSQL backend connectivity
- `boto3` for S3 / MinIO artifact storage

## Training Lifecycle

1. `trainer.py` starts a parent MLflow run for the full training session.
2. Each model family gets a nested run with its own params, metrics, tags, and artifact.
3. The trained sklearn pipeline is logged as the model artifact.
4. Validated models are registered and transitioned to `Staging`.
5. Human review or API promotion moves approved versions to `Production`.

## Validation Gates

Auto-registration supports two gates:

- strategy gate:
  - `pbo < 0.05`
  - `sharpe_oracle >= 0.5`
  - `win_rate >= 0.50`
- classifier fallback gate:
  - `cv_roc_auc_mean >= 0.55`
  - `cv_accuracy_mean >= 0.52`

This prevents the current direction classifiers from being excluded just because they do not emit strategy metrics yet.

## API Endpoints

- `GET /mlflow/status`
- `GET /mlflow/experiments`
- `GET /mlflow/models`
- `POST /mlflow/promote?model_name=<name>&from_stage=Staging&to_stage=Production`

## Local Bring-Up

```bash
docker compose -f docker-compose.mlflow.yml up -d --build
curl -f http://localhost:5000/health
curl -f http://localhost:9000/minio/health/live
```

UI endpoints:

- MLflow: `http://localhost:5000`
- MinIO console: `http://localhost:9001`

## Registry Smoke Test

Run a live end-to-end registration test against the local MLflow stack:

```bash
docker run --rm ^
  -e MLFLOW_TRACKING_URI=http://host.docker.internal:5000 ^
  -v ${PWD}:/work -w /work ^
  tradersapp/mlflow:local /bin/sh -lc ^
  "python -m pip install --quiet scikit-learn==1.6.1 && python scripts/ci/mlflow_smoke_test.py"
```

This creates:

- an experiment run
- a logged sklearn model artifact
- a registered model version
- a transition to `Staging`

## k3s Rollout Notes

- The Helm chart deploys PostgreSQL, MinIO, a MinIO bucket setup job, and MLflow.
- Production-style clusters set `MLFLOW_TRACKING_URI=http://mlflow:5000`.
- `values.dev.yaml` currently disables the in-cluster MLflow stack; in that mode dev runtime should use `MLFLOW_TRACKING_URI=disabled` instead of a dead in-cluster service URL.
- CI/CD builds and publishes the custom MLflow image and injects the commit SHA into the Helm release.
- Production deploys use a runtime Kubernetes secret (`mlflow-runtime-secret`) for:
  - `POSTGRES_PASSWORD`
  - `MINIO_ROOT_USER`
  - `MINIO_ROOT_PASSWORD`
  This secret is created by `scripts/ci/deploy-k3s.sh` from Woodpecker secrets synced from Infisical.

## Infisical Secret Mapping (Production)

Keep these values in Infisical (for example under `production`):

- `CI_MLFLOW_POSTGRES_PASSWORD`
- `CI_MLFLOW_MINIO_USER`
- `CI_MLFLOW_MINIO_PASSWORD`

Then mirror them into Woodpecker repository secrets:

- `mlflow_postgres_password`
- `mlflow_minio_user`
- `mlflow_minio_password`

During deploy, the pipeline converts those into Kubernetes secret keys expected by Helm:

- `POSTGRES_PASSWORD`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`

## Secrets

Do not keep production passwords in Git.

At minimum, production rollout must provide:

- `mlflow.postgres.password`
- `mlflow.minio.user`
- `mlflow.minio.password`

Use Infisical or Kubernetes secrets for real values.
