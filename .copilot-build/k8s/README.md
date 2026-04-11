# TradersApp — Kubernetes (k3s) Deployment Guide

## Overview

TradersApp runs on [k3s](https://k3s.io) — a lightweight, CNCF-certified Kubernetes distribution that installs in under 60 seconds. Every microservice, ML inference server, and data pipeline runs as a containerized pod under k3s orchestration.

## Directory Structure

```
k8s/
├── base/                       # Shared base manifests (all environments)
│   ├── kustomization.yaml      # Kustomize entry point
│   ├── namespace.yaml          # tradersapp namespace
│   ├── config.yaml             # ConfigMaps (non-sensitive config)
│   ├── secrets.yaml            # Secrets (gitignored — see below)
│   ├── storage.yaml            # PersistentVolumeClaims (model store, Redis)
│   ├── network-policies.yaml   # Zero-trust network policies
│   ├── pdb.yaml                # PodDisruptionBudgets (safe rolling updates)
│   └── pod-monitor.yaml        # PodMonitor CRDs (Prometheus Operator)
│
├── overlay/                    # Kustomize environment overlays
│   ├── dev/
│   │   └── kustomization.yaml  # Dev: 1 replica, debug resources
│   ├── staging/
│   │   └── kustomization.yaml  # Staging: 2 replicas, moderate resources
│   └── prod/
│       └── kustomization.yaml  # Prod: 3 replicas BFF, semver tags, full resources
│
├── helm/tradersapp/            # Helm chart (alternative to Kustomize)
│   ├── Chart.yaml
│   ├── values.yaml             # Default values (dev)
│   ├── values.prod.yaml        # Production override
│   └── templates/              # Go template manifests
│
├── observability/              # Observability stack manifests
│   ├── prometheus.yml          # Prometheus scrape config
│   ├── grafana-provisioning/   # Grafana dashboards + datasources
│   ├── loki.yml                # Loki log aggregation
│   ├── promtail.yml            # Promtail log collector
│   └── deploy.yaml             # Full Prometheus+Grafana+Loki+Jaeger stack
│
├── scripts/
│   └── bootstrap.sh            # One-command k3s install + deploy
│
├── ml-deployment.yaml          # ML Engine (Deployment + Service)
├── bff-deployment.yaml          # BFF (Deployment + Service)
├── frontend-deployment.yaml    # Frontend (Deployment + Service + Ingress)
├── triton-deployment.yaml      # Triton Inference Server (GPU)
├── hpa-ml-engine.yaml          # HPA for ML Engine (1-4 replicas)
├── hpa-bff.yaml                # HPA for BFF (2-8 replicas)
└── namespace.yaml              # Namespace manifest
```

## Quick Start

### Option 1: Bootstrap Script (Recommended)

```bash
# Install k3s + build images + deploy dev stack
./k8s/scripts/bootstrap.sh --full

# Deploy to specific environment
./k8s/scripts/bootstrap.sh --deploy kustomize staging
./k8s/scripts/bootstrap.sh --deploy helm prod
```

### Option 2: Manual (kubectl + Kustomize)

```bash
# 1. Install k3s
curl -sfL https://get.k3s.io | sh -

# 2. Set kubeconfig
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# 3. Build Docker images
docker build -t tradersapp/ml-engine:latest -f Dockerfile.ml-engine .
docker build -t tradersapp/bff:latest -f Dockerfile.bff .
docker build -t tradersapp/frontend:latest -f Dockerfile.frontend .

# 4. Deploy dev stack
kubectl apply -k k8s/overlay/dev/

# 5. Verify
kubectl get pods -n tradersapp
kubectl get svc -n tradersapp
kubectl get hpa -n tradersapp
```

### Option 3: Helm

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install tradersapp ./k8s/helm/tradersapp -n tradersapp -f values.prod.yaml --wait
```

## Zero-Downtime Deployments

All deployments use `RollingUpdate` strategy:
- `maxUnavailable: 0` — never lose availability during upgrades
- `maxSurge: 1` (ML Engine) or `maxSurge: 2` (BFF/Frontend) — controlled resource spike
- PodDisruptionBudgets ensure minimum pod counts during node drains

```yaml
# Example from ml-deployment.yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0  # Zero-downtime
```

## Horizontal Scaling

| Service | Min | Max | Trigger |
|---------|-----|-----|---------|
| ML Engine | 1 | 4 | CPU >70% OR mem >80% |
| BFF | 2 | 8 | CPU >60% |
| Frontend | 2 | — | Static, no HPA |

HPA is configured in [hpa-ml-engine.yaml](hpa-ml-engine.yaml) and [hpa-bff.yaml](hpa-bff.yaml).

## Security

### Secrets Management

**Never commit real secrets to git.** The `base/secrets.yaml` file contains placeholders only.

```bash
# Create secrets from env vars (recommended)
kubectl create secret generic tradersapp-secrets \
  --from-literal=POSTGRES_PASSWORD=your_real_password \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --namespace tradersapp

# Or use Infisical (already configured in the project)
./scripts/setup-infisical.ps1
```

### Network Policies (Zero-Trust)

Every service denies all inbound/outbound traffic by default, then explicitly allows only required connections:

```
frontend  → bff (port 8788)
bff       → ml-engine (port 8001)
ml-engine → redis (6379), kafka (9092), postgres (5432), mlflow (5000), dns (53)
```

See [base/network-policies.yaml](base/network-policies.yaml).

### Pod Security

- All pods run as non-root (`runAsNonRoot: true`)
- All pods have `readOnlyRootFilesystem: true`
- All pods drop `ALL` capabilities
- No privilege escalation

## Horizontal Autoscaling

The ML Engine has a **startup probe** (up to 5 minutes) while models load, followed by readiness/liveness probes. The HPA won't add pods until the startup probe passes.

## Triton (GPU Inference)

Triton is disabled by default (no GPU in dev). To enable on a GPU node:

```bash
# Label a GPU node
kubectl label node <node-name> nvidia.com/gpu=true

# Deploy Triton
kubectl apply -f k8s/triton-deployment.yaml

# Or via Helm
helm upgrade tradersapp ./k8s/helm/tradersapp --set triton.enabled=true
```

## Observability

Install the full stack:
```bash
kubectl apply -f k8s/observability/deploy.yaml
```

Then access:
- Prometheus: `http://<node>:30900`
- Grafana: `http://<node>:30001` (admin/CHANGEME)
- Loki: `http://<node>:3100`
- Jaeger: `http://<node>:16686`

For ML Engine-specific dashboards, import [ml-engine.json](observability/grafana-provisioning/dashboards/ml-engine.json).

## Environment Overrides

| Environment | Command | Replicas (BFF/ML) | Tag |
|-------------|---------|-------------------|-----|
| Dev | `kubectl apply -k overlay/dev/` | 1/1 | dev-latest |
| Staging | `kubectl apply -k overlay/staging/` | 2/1 | staging-latest |
| Prod | `kubectl apply -k overlay/prod/` | 3/1 | v1.0.0 |

## Troubleshooting

```bash
# Check pod logs
kubectl logs -n tradersapp -l app=ml-engine -f

# Check pod events
kubectl describe pod -n tradersapp -l app=ml-engine

# Check HPA status
kubectl get hpa -n tradersapp -o wide

# Check resource usage
kubectl top pods -n tradersapp

# Check network policies (requires CNI with policy support)
kubectl get networkpolicy -n tradersapp

# Port-forward for local access
kubectl port-forward -n tradersapp svc/ml-engine 8001:8001
```

## Files to Never Commit

- `k8s/base/secrets.yaml` — contains real credentials (use placeholders)
- Any `values.prod.yaml` with real API keys
- `KUBECONFIG` files

Use `.gitignore` patterns for secrets and environment-specific overrides.