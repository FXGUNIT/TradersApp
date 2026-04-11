# PostgreSQL Production Cutover Runbook

**Last audit:** 2026-04-12
**Status:** Cutover pending — PostgreSQL dependency wired, secrets + cluster provisioning required for prod

---

## Audit 2026-04-12: Findings and Fixes Applied

| # | Finding | Fix Applied | Status |
|---|---------|-------------|--------|
| 1 | `ml-engine` Deployment template missing `DATABASE_URL` env var | Added `secretKeyRef: ml-engine-secrets/DATABASE_URL` to `templates/ml-engine.yaml` lines 164-167 | **FIXED** |
| 2 | Migration Job already has `DATABASE_URL` secret ref (lines 272-277 of `deploy-k8s.yml`) | No change needed — already correct | OK |
| 3 | `envFrom` in `values.prod.yaml` already includes `secretRef: ml-engine-secrets` | No change needed — both containers pick up DATABASE_URL via envFrom | OK |
| 4 | `ml-engine-secrets` exists only in `tradersapp-dev` namespace (dev) | Must provision in `tradersapp` (prod) namespace — see Step 3 below | **PENDING** |
| 5 | Dev cluster pod `ml-engine-5d4f4dcd95-kcqrd` has no host assigned | Dev cluster unreachable for live verification | N/A |

---

## Step 1: Verify Current Backend (Dev Cluster)

```bash
kubectl exec deploy/ml-engine -n tradersapp-dev -- python -c "
import os
from ml_engine.data.candle_db import CandleDatabase
db = CandleDatabase()
print('Backend:', db._backend.__class__.__name__)
print('URL:', os.environ.get('DATABASE_URL', 'NOT SET')[:50] + '...')
"
```

**Expected output when PostgreSQL is active:** `Backend: PostgresBackend`

If SQLite is still in use, `CandleDatabase` will fall back to `SqliteBackend`. In dev, this is acceptable if `DATABASE_URL` is not yet set in the dev secret.

---

## Step 2: Provision `ml-engine-secrets` in Production Namespace

The `DATABASE_URL` secret must exist in the **production** `tradersapp` namespace (not `tradersapp-dev`).

```bash
# Option A: Create manually (replace with actual credentials)
kubectl create secret generic ml-engine-secrets \
  -n tradersapp \
  --from-literal=DATABASE_URL="postgresql://user:password@postgres-host:5432/trading" \
  --from-literal=REQUIRE_DATABASE_URL="true"

# Option B: Via External Secrets Operator (preferred — uses k8s/base/external-secrets.yaml)
# Ensure the ExternalSecret manifest targets the production secret store and syncs
# the DATABASE_URL key into the tradersapp namespace.

# Verify the secret exists:
kubectl get secret ml-engine-secrets -n tradersapp -o jsonpath='{.data.DATABASE_URL}'
```

---

## Step 3: Restart ml-engine After Secret Provision

```bash
kubectl rollout restart deploy/ml-engine -n tradersapp
kubectl rollout status deploy/ml-engine -n tradersapp --timeout=120s
```

---

## Step 4: Verify PostgreSQL Backend is Active

```bash
kubectl exec deploy/ml-engine -n tradersapp -- python -c "
from ml_engine.data.candle_db import CandleDatabase
db = CandleDatabase()
print('Backend:', db._backend.__class__.__name__)
print('Schema OK:', db._backend.conn is not None)
"
```

**Expected:** `Backend: PostgresBackend`

---

## Step 5: Run Database Migration (Idempotent — Safe to Re-Run)

```bash
# Runs as a Kubernetes Job via deploy-k8s.yml (lines 243-288), or manually:
kubectl exec deploy/ml-engine -n tradersapp -- \
  python scripts/migrate_to_postgres.py \
    --source ml-engine/trading_data.db \
    --target-url \$DATABASE_URL
```

This migrates from the local SQLite dev database to PostgreSQL. Uses `ON CONFLICT DO NOTHING` — safe to re-run.

---

## Step 6: Backfill Historical Data (Optional)

```bash
kubectl exec deploy/ml-engine -n tradersapp -- python -m ml_engine.data.load_ninjatrader_csv \
  --symbol=MNQ \
  --timeframe=5min \
  --database-url=\$DATABASE_URL
```

---

## Deployment Pipeline Integration

The `deploy-k8s.yml` workflow (`.github/workflows/deploy-k8s.yml`) handles the migration automatically on every production deploy:

1. **Migration Job** (lines 243-288): Creates a `batch/v1` Job that runs `python scripts/migrate_to_postgres.py` using the `ml-engine-secrets/DATABASE_URL` secret. Non-fatal (`continue-on-error: true`) — schema may already be up to date.
2. **Helm Upgrade**: Runs after migration, applying `values.prod.yaml` which now includes the explicit `DATABASE_URL` env var on the ml-engine container.
3. **Smoke Tests**: BFF and ml-engine health checks confirm the deployment is healthy post-migration.

**Requirement:** `ml-engine-secrets` must be present in the `tradersapp` namespace before the first deploy that uses this pipeline. The Helm template references `secretKeyRef: ml-engine-secrets` — if the secret is missing, the pod will fail to start.

---

## Helm Template Changes (Applied 2026-04-12)

File: `k8s/helm/tradersapp/templates/ml-engine.yaml`

```yaml
# Lines 161-167: Added DATABASE_URL env var to ml-engine container
- name: REQUIRE_DATABASE_URL
  value: {{ ternary "true" "false" .Values.mlEngine.requireDatabaseUrl | quote }}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: ml-engine-secrets
      key: DATABASE_URL
```

The `envFrom` section (lines 139, 178 in `values.prod.yaml`) also already references `ml-engine-secrets`, so both the ml-engine container and the model-registry sidecar inherit DATABASE_URL from there.

---

## PostgreSQL Cutover Checklist

- [ ] PostgreSQL instance provisioned and reachable from `tradersapp` namespace
- [ ] `ml-engine-secrets` created in `tradersapp` namespace with `DATABASE_URL` + `REQUIRE_DATABASE_URL=true`
- [ ] `ml-engine` pod restarted (`kubectl rollout restart deploy/ml-engine -n tradersapp`)
- [ ] Step 4 verification: `Backend: PostgresBackend` confirmed
- [ ] Migration job completed (Step 5)
- [ ] Historical data backfilled if needed (Step 6)
- [ ] Smoke tests pass in CI (`deploy-k8s.yml`)
- [ ] Paper trade verification complete (see Paper Trading Rule in CLAUDE.md)

---

## Tech Debt

- `feature_lineage.py` uses standalone `feature_lineage.db` — safe for single-pod but will diverge under multi-pod deployment. Migrate to a `feature_lineage` table in the main PostgreSQL database.
- Dev cluster (`tradersapp-dev`) pod `ml-engine-5d4f4dcd95-kcqrd` has no host assigned — cluster may need to be re-provisioned for live dev verification.
