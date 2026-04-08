---
name: k8s_kafka_audit_2026_04_08
description: Kubernetes + Kafka audit findings and fixes applied
type: reference
---

# TradersApp k8s + Kafka Audit — 2026-04-08

## k3s Cluster Status (2026-04-08)

**k3s v1.34.6 running on WSL Ubuntu (hostname: fxg, node IP: 172.21.239.98)**
- Single-node cluster: `fxg` (control-plane, Ready)
- k3s service active since ~2026-04-07 21:29 UTC
- StorageClass: `local-path` (default, Rancher provisioner)
- Container runtime: containerd 2.2.2
- Ingress controller: Traefik (v3.6.10) — installed but pods in Error state
- `metrics-server` pod: 0/1 Ready (restart loop — may need investigation)

**tradersapp namespace:** Empty — no workloads deployed yet. ConfigMaps, PDBs, NetworkPolicies applied successfully before WSL crash.

**WSL Ubuntu crashed (2026-04-08)** — Error code 6 (kernel panic). Needs Windows reboot to recover.

**kubectl access:** Via `wsl -d Ubuntu -- bash -c 'sudo k3s kubectl ...'`

**k3s Deploy Status (2026-04-08):**
- `namespace/tradersapp-dev` created ✅
- ConfigMaps: ml-engine-config, bff-config, ml-engine-env, observability-config ✅
- Services: ml-engine (8001), bff (8788), frontend (80) ✅
- PVC: ml-models-pvc ✅ **Bound** to `pvc-5e6fd37e-692b-4679-a188-41bc8d967a3b`
- PVC: mlflow-artifacts-pvc, redis-pvc → Pending (local-path provisioner, will bind when pods schedule)
- Deployments: ml-engine, bff, frontend → **ImagePullBackOff** (images not built yet)
- PDBs, HPAs, NetworkPolicies, Ingresses → all applied ✅
- ⚠️ **CRITICAL:** Docker Desktop crashed during ml-engine image build (I/O error on COPY step). WSL also crashed (shared Hyper-V infra). Requires **full Windows restart** before continuing.
- ⚠️ Files still need building: `tradersapp/ml-engine:dev-latest`, `tradersapp/bff:dev-latest`, `tradersapp/frontend:dev-latest`

**kubectl access:**
- kubectl from inside WSL Ubuntu works: `sudo k3s kubectl ...`
- kubectl from Windows cannot reach k3s API (port 6443 bound to WSL loopback only)
- kubectl wrapper at `E:\TradersApp\.claude\kubectl` — routes via WSL
- kubeconfig at `E:\TradersApp\.claude\projects\e--TradersApp\kubeconfig` (UTF-16, needs `netsh portproxy` admin to work from Windows)

## Deploy Scripts (k8s/scripts/)

- **`bootstrap-docker.sh`** — Installs Docker CE inside WSL Ubuntu (needed because Docker Desktop is slow/error-prone)
- **`deploy.sh`** — Full deploy: build images → import into k3s → apply all manifests → verify

## Deploy Steps (after WSL reboot)

1. `wsl -d Ubuntu` (or just open a new WSL terminal)
2. `cd /mnt/e/TradersApp`
3. `sudo bash k8s/scripts/bootstrap-docker.sh` (first time only — installs Docker in WSL)
4. `bash k8s/scripts/deploy.sh` (builds images, imports to k3s, deploys everything)
5. `sudo k3s kubectl get pods -n tradersapp` (watch pods come up)

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

## k8s Kustomization Fixes Applied
- `k8s/namespace.yaml` copied into `k8s/base/namespace.yaml` (was missing from base/)
- `k8s/overlay/dev/kustomization.yaml` fixed: namespace.yaml and storage.yaml copied into dev overlay dir (kustomize requires files to be within overlay tree)
- `k8s/overlay/dev/storage.yaml` fixed: removed hardcoded namespace, changed storageClassName from `standard` → `local-path`
- `k8s/base/storage.yaml` still has `storageClassName: standard` — needs fixing separately for base non-overlay deployments

## ml-engine Build Fix Applied
- `ml-engine/requirements.txt`: upgraded `great-expectations==1.2.4` → `>=1.7.0` (resolved pandas conflict: ge 1.2.4 requires `pandas<2.2` but code uses `pandas==2.2.3`)
- `ml-engine/Dockerfile`: fixed `UndefinedVar` on MODEL_STORE_PVC_MOUNT line
- `requirements.txt` changed: `great-expectations==1.2.4` → `great-expectations>=1.7.0`

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
1. **Docker Desktop crashed + WSL crashed** — requires full Windows restart. Docker Desktop's Linux VM had I/O error during ml-engine COPY step. WSL shares Hyper-V infra → both down.
2. **Docker images not built** — must build after restart: ml-engine, bff, frontend → import into k3s containerd
3. **`metrics-server` pod 0/1 Ready** — restart loop, needs investigation
4. **Traefik pods Error state** — ingress controller not healthy
5. **`base/storage.yaml` still has `storageClassName: standard`** — only dev overlay is fixed

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

## Post-Restart Recovery (after Docker Desktop + WSL fix)
```powershell
# 1. Verify WSL is back
wsl -d Ubuntu -- bash -c 'echo WSL OK'

# 2. Verify k3s is still running
wsl -d Ubuntu -- bash -c 'sudo systemctl is-active k3s'

# 3. Create local-path storage dir if needed
wsl -d Ubuntu -- bash -c 'sudo mkdir -p /var/lib/rancher/k3s/storage && sudo chmod 777 /var/lib/rancher/k3s/storage'

# 4. Build and load Docker images into k3s
docker build -t tradersapp/ml-engine:dev-latest -f E:\TradersApp\ml-engine\Dockerfile E:\TradersApp\ml-engine
docker build -t tradersapp/bff:dev-latest -f E:\TradersApp\bff\Dockerfile E:\TradersApp\bff
# (frontend has no Dockerfile yet — needs creating)

# 5. Import images into k3s containerd
wsl -d Ubuntu -- bash -c 'sudo k3s ctr images import <(docker save tradersapp/ml-engine:dev-latest)'
wsl -d Ubuntu -- bash -c 'sudo k3s ctr images import <(docker save tradersapp/bff:dev-latest)'

# 6. Restart pods to pick up new images
wsl -d Ubuntu -- bash -c 'sudo k3s kubectl rollout restart deployment/ml-engine -n tradersapp-dev'
wsl -d Ubuntu -- bash -c 'sudo k3s kubectl rollout restart deployment/bff -n tradersapp-dev'
```
