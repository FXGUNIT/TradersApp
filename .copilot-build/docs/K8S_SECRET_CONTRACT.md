# Kubernetes Secret Contract

Updated: 2026-04-11

This document records the secret contract expected by the current Kubernetes manifests and Helm chart, plus the live findings from the `tradersapp-dev` cluster validated on 2026-04-10.

## Live cluster facts

- Active application namespace: `tradersapp-dev`
- Storage foundation: validated (`A01-A12` complete)
- External Secrets CRD/status: not available in the live cluster (`kubectl get externalsecret -A` failed because the resource type does not exist)
- Live secrets observed in `tradersapp-dev`:
  - `ml-engine-secrets`
  - `tradersapp-secrets`
- Live secrets missing in `tradersapp-dev`:
  - `mlflow-runtime-secret`
  - `keycloak-admin-secret`

## Service contract

### `ml-engine`

Repo contract:
- Base/dev manifests inject `ml-engine-secrets` via `envFrom`
- Base/dev manifests also read `tradersapp-secrets/POSTGRES_PASSWORD`
- Production-oriented external secret definition expects `ml-engine-secrets` to provide:
  - `DATABASE_URL`
  - `MLFLOW_TRACKING_URI`
  - `REDIS_URL`
  - `KEYCLOAK_CLIENT_ID`
  - `KEYCLOAK_CLIENT_SECRET`
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`

Live `tradersapp-dev` findings:
- `ml-engine-secrets` currently contains:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_DEFAULT_REGION`
  - `AWS_SECRET_ACCESS_KEY`
  - `MLFLOW_TRACKING_URI`
- `DATABASE_URL` is missing
- `REDIS_URL` is missing
- `KEYCLOAK_CLIENT_ID` is missing
- `KEYCLOAK_CLIENT_SECRET` is missing
- Dev overlay sets `REQUIRE_DATABASE_URL=false`, so the workload can start without `DATABASE_URL`, but this does not satisfy the Stage B verification target

### `bff`

Repo contract:
- Base/dev manifests read:
  - `tradersapp-secrets/JWT_SECRET`
  - `tradersapp-secrets/BFF_API_KEY`
- Production Helm values define `bff.envFrom` with `bff-secrets`
- `bff-secrets` is intended to carry:
  - `JWT_SECRET`
  - `KEYCLOAK_URL`
  - `KEYCLOAK_REALM`
  - `KEYCLOAK_CLIENT_ID`
  - `KEYCLOAK_CLIENT_SECRET`

Live `tradersapp-dev` findings:
- `tradersapp-secrets` currently contains:
  - `BFF_API_KEY`
  - `JWT_SECRET`
  - `POSTGRES_PASSWORD`
- No separate `bff-secrets` object exists in the live dev namespace
- The Helm prod chart previously ignored `.Values.bff.envFrom`; this was fixed on 2026-04-10 in `k8s/helm/tradersapp/templates/bff.yaml`

### `mlflow`

Repo contract:
- Helm uses `mlflow-runtime-secret` as the runtime secret object for MLflow
- The Helm template consumes these keys from `mlflow-runtime-secret`:
  - `POSTGRES_DB`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `MINIO_ROOT_USER`
  - `MINIO_ROOT_PASSWORD`
- CI deployment script `scripts/ci/deploy-k3s.sh` creates exactly those five keys in `mlflow-runtime-secret`
- `k8s/base/external-secrets.yaml` now mirrors the same secret object and key names

Live `tradersapp-dev` findings:
- `mlflow-runtime-secret` was not present in the last validated `tradersapp-dev` snapshot
- The live cluster still does not have the External Secrets CRD installed, so the secret must come from Helm or bootstrap, not from cluster-side syncing

### `keycloak`

Repo contract:
- `keycloak-admin-secret` should provide:
  - `KEYCLOAK_ADMIN_PASSWORD`
  - `KEYCLOAK_DB_PASSWORD`

Live `tradersapp-dev` findings:
- `keycloak-admin-secret` does not exist in the application namespace
- This does not currently block the dev overlay, but it remains part of the production secret contract

### `redis`

Repo contract:
- Dev/base config uses non-secret config for Redis host/port:
  - `REDIS_HOST`
  - `REDIS_PORT`
- Dev BFF overlay also sets `REDIS_URL=redis://localhost:9999`
- Production comments expect Redis auth to come from external secret material associated with `ml-engine-secrets`

Live `tradersapp-dev` findings:
- Redis connectivity config exists through config maps and explicit env vars
- A secret-backed `REDIS_URL` was not present in `ml-engine-secrets`

## Confirmed mismatches

1. The live cluster is using static opaque secrets in `tradersapp-dev`, not External Secrets Operator objects.
2. `ml-engine-secrets` does not contain `DATABASE_URL`, so `B02` is currently failing.
3. `mlflow-runtime-secret` is absent in the last validated live cluster snapshot, so `B03` is currently failing.
4. The repo has two BFF secret patterns:
   - Raw manifests/dev overlay use `tradersapp-secrets`
   - Helm prod values use `bff-secrets`
5. The Helm chart default/runtime path and CI agree on `mlflow-runtime-secret`, but the validated live cluster snapshot still lacks it.

## Practical interpretation

- Stage B should treat `B01-B05` as a live verification pass, not an assumption that Infisical sync is already functioning.
- For the current dev cluster, `JWT_SECRET` and `BFF_API_KEY` exist, but the broader prod-style secret contract is incomplete.
- Before relying on the Helm prod path, make sure the runtime secret is provisioned in-cluster; the repo contract now uses `mlflow-runtime-secret` with the five runtime keys above.
