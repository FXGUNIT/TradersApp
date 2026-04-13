# Migration Runbook: k3s → Docker Compose Dev Stack

**Target:** 4 GB RAM, CPU-only laptop, no GPU.
**Total stack:** ~1 GB (core) / ~1.2 GB (with MLflow) / ~1.5 GB (full + observability).
**k3s savings:** ~2–3 GB freed immediately on stop.

---

## Pre-flight: Free RAM from k3s

```powershell
# 1. Stop k3s — frees ~2-4 GB immediately
wsl -d Ubuntu -- sudo systemctl stop k3s

# 2. Verify stopped
wsl -d Ubuntu -- sudo systemctl status k3s

# 3. Optional: disable so it doesn't start on next WSL boot
wsl -d Ubuntu -- sudo systemctl disable k3s

# 4. Confirm RAM freed
wsl -d Ubuntu -- free -h
```

## Step 1: Backup Data from k3s (Before Blowing It Away)

```powershell
# Copy SQLite DB from k3s pod → Windows filesystem
wsl -d Ubuntu -- bash -c "
  POD=\$(kubectl get pod -n tradersapp -l app=ml-engine -o jsonpath='{.items[0].metadata.name}')
  kubectl cp tradersapp/\$POD:/data/trading_data.db /tmp/trading_data.db
"
# Move into the repo
cp /mnt/e/TradersApp/tmp/trading_data.db /mnt/e/TradersApp/ml-engine/data/trading_data.db 2>/dev/null

# Copy model files
wsl -d Ubuntu -- bash -c "
  POD=\$(kubectl get pod -n tradersapp -l app=ml-engine -o jsonpath='{.items[0].metadata.name}')
  kubectl cp tradersapp/\$POD:/models/store /tmp/ml-models/ -r
"
cp -r /mnt/e/tmp/ml-models/store /mnt/e/TradersApp/ml-engine/models/ 2>/dev/null
```

## Step 2: Verify Docker Engine Is Running

```powershell
docker info | Select-String "Server Version"
docker compose version
```

If Docker Desktop isn't running → start it first.

## Step 3: Create the MLflow Artifact Directory (New Step)

```powershell
# MLflow uses a local bind mount — no MinIO/Postgres needed
New-Item -ItemType Directory -Force -Path E:\TradersApp\mlflow\artifacts | Out-Null
```

## Step 4: Build and Start the Dev Stack

```powershell
cd E:\TradersApp

# Builds Docker images automatically on startup
.\scripts\dev-up.ps1 -Tier core

# Watch logs for startup errors
docker compose -f docker-compose.dev.yml logs -f
```

## Step 5: Verify All Services

```powershell
# Wait ~60s for ML Engine to finish loading models, then:

docker exec traders-dev-redis redis-cli ping
# Expected: PONG

curl http://localhost:8001/health
# Expected: {"ok":true,...}

curl http://localhost:8082/health
# Expected: 200 OK

curl http://localhost:8788/health
# Expected: 200

curl -o /dev/null -s -w "%{http_code}" http://localhost:80
# Expected: 200

docker compose -f docker-compose.dev.yml ps
# All: "healthy" or "running"
```

## Step 6: Smoke-Test the App

```powershell
Start-Process "http://localhost:80"

# BFF → ML Engine round-trip
curl http://localhost:8788/api/ml/health
```

## Step 7: Enable MLflow (On-Demand)

```powershell
# Only when you need experiment tracking — saves RAM the rest of the time
.\scripts\dev-up.ps1 -Tier mlops

# MLflow UI
Start-Process "http://localhost:5000"

# Backend: SQLite at ./mlflow/mlflow.db
# Artifacts: ./mlflow/artifacts (bind mount — visible in repo)
```

## Step 8: Full Observability Tier (Optional)

```powershell
# Adds Prometheus + Alertmanager + Grafana + Loki + Jaeger
.\scripts\dev-up.ps1 -Tier full

# UIs
Start-Process "http://localhost:9090"   # Prometheus
Start-Process "http://localhost:3001"   # Grafana
Start-Process "http://localhost:16686"  # Jaeger
```

> `-Tier full` starts `docker-compose.dev.yml` with the `mlops` profile and also brings up `docker-compose.observability.yml`.

## Rollback: Return to k3s

```powershell
# Tear down compose stack
.\scripts\dev-up.ps1 -Down

# Re-enable and start k3s
wsl -d Ubuntu -- sudo systemctl enable k3s
wsl -d Ubuntu -- sudo systemctl start k3s

# Verify
wsl -d Ubuntu -- kubectl get pods -A
```

## Day-to-Day Workflow

```powershell
# Morning start
.\scripts\dev-up.ps1

# After code changes → restart through the normal bootstrap path
.\scripts\dev-up.ps1

# View logs for one service
docker compose -f docker-compose.dev.yml logs -f ml-engine

# Evening stop (data persists in bind mounts)
.\scripts\dev-up.ps1 -Down

# Clean up dangling images (weekly)
docker image prune -f
```

## What Changed vs. k3s

| Old (k3s)           | New (Compose)                                          |
| ------------------- | ------------------------------------------------------ |
| Longhorn PVCs       | Bind mounts (`./ml-engine/data`, `./ml-engine/models`) |
| PostgreSQL + MinIO  | SQLite + local FS for MLflow                           |
| ~3–5 GB RAM         | ~1–1.2 GB RAM                                          |
| `kubectl apply`     | `.\scripts\dev-up.ps1`                                 |
| Helm upgrades       | `docker compose up --build`                            |
| Longhorn validation | N/A (no Longhorn in dev)                               |
