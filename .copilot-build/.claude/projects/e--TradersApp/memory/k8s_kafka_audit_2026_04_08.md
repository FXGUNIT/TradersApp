---
name: k8s_kafka_audit_2026_04_08
description: Kubernetes + Kafka audit findings and fixes applied
type: reference
---

# TradersApp k8s + Kafka Audit — 2026-04-08

## k3s Readiness
- Bootstrap script exists at `k8s/scripts/bootstrap.sh` — supports `--install`, `--deploy`, `--full`, `--destroy`, `--status`
- k3s NOT confirmed installed on this machine — must validate with `kubectl get nodes` before deployment
- Bootstrap script only runs on Linux/WSL2 (fails on native Windows)

## Persistent Volume Inventory

| PVC | Size | Survives Pod Restart? | Notes |
|-----|------|----------------------|-------|
| `ml-models-pvc` | 5Gi | ✅ Yes | Model binaries (`/models/store`) |
| `mlflow-artifacts-pvc` | 20Gi | ✅ Yes | MLflow MinIO bucket |
| `redis-pvc` | 1Gi | ✅ Yes | Redis cache + Feast online store |
| Kafka `data` (StatefulSet) | 10Gi | ✅ Yes | Kafka log segments |
| MLflow PostgreSQL | 10Gi | ✅ Yes | Experiment metadata |
| MLflow MinIO | 20-50Gi | ✅ Yes | Model artifacts |
| ml-engine `/data` | `emptyDir: {}` | ❌ **NO — DATA LOSS RISK** | SQLite `trading_data.db` — ephemeral |
| ml-engine `/tmp` | `emptyDir: memory` | ❌ No | Scratch + GPU spill |

## Critical Fix Applied
- **ml-engine `/data` was ephemeral (`emptyDir: {}`)** — SQLite DB lost on every pod restart
- Fixed by adding `envFrom: ml-engine-secrets` to both Helm template and Kustomize deployment
  - Infisical injects `DATABASE_URL` → ml-engine auto-selects `PostgresBackend` (see `candle_db.py:1199-1214`)
  - `CandleDatabase` facade: `DATABASE_URL` env var wins, falls back to SQLite
- Files changed: `k8s/helm/tradersapp/templates/ml-engine.yaml`, `k8s/ml-deployment.yaml`

## Kafka Topics

| Topic | Partitions | Consumer(s) | At-Least-Once? |
|-------|-----------|-------------|----------------|
| `candle-data` | 6 | ✅ **NOW WIRED** (consumer.py → `CandleDatabase.insert_candles`) | ✅ Yes (manual commit) |
| `consensus-signals` | 6 | ✅ **NOW WIRED** (consumer.py → `FeedbackLogger.log_signal()`) | ✅ Yes (manual commit) |
| `model-predictions` | 6 | ✅ **NOW WIRED** (consumer.py → `ConceptDriftDetector.record_prediction()`) | ✅ Yes (manual commit) |
| `feedback-loop` | 3 | ✅ Wired (`ConceptDriftDetector` + `FeedbackLogger`) | ✅ Yes |
| `drift-alerts` | 3 | ✅ Wired (`RetrainPipeline`) | ✅ Yes |

- Consumer group: `traders-ml-engine` (default), `ml-engine-consumers` in ConfigMap
- **All 5 topics now have consumers registered** in `consumer.py:_register_default_handlers()`
- `CandleDatabase` / `FeedbackLogger` / `ConceptDriftDetector` all use the dual-backend facade

## Secrets (Infisical → k8s via ESO)
- `ml-engine-secrets` in `external-secrets.yaml` already has `DATABASE_URL` → key `ml-engine/database` property `url`
- `ml-engine-secrets` also contains: `MLFLOW_TRACKING_URI`, `REDIS_URL`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- All secrets sync from Infisical every 1h via External Secrets Operator

## Remaining Risks
1. **Kafka replication factor = 1** — single-broker, no fault tolerance for Kafka itself (fine for dev, not prod)
2. **MLflow image in prod uses `registry.example.com`** — placeholder, must be replaced with real registry
3. **SQLite backend still exists** — ml-engine falls back to SQLite if `DATABASE_URL` is unset; ensure ESO secret is always populated
4. **`model-predictions` consumer passes `correct=None`** — outcome comes later via `feedback-loop`; ConceptDriftDetector may need to track unverified predictions separately

## How to Run This Audit
```bash
# Check k3s nodes
kubectl get nodes -o wide

# Check all PVCs
kubectl get pvc -n tradersapp

# Check ESO secret sync status
kubectl get externalsecrets -n tradersapp
kubectl describe externalsecret ml-engine-secrets -n tradersapp

# Check Kafka topics (from Kafka container)
docker compose -f docker-compose.kafka.yml exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Check ml-engine pod logs for Kafka consumer
kubectl logs -n tradersapp -l app=ml-engine --tail=50 -f
```
