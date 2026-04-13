# HPA Scaling Test Runbook

**Status:** Live validation passed - residual metrics flaps noted  
**Last Updated:** 2026-04-13  
**Cluster:** desktop-control-plane (k3s v1.34.3) - `tradersapp-dev`

---

## Overview

Validate that Kubernetes Horizontal Pod Autoscalers (HPAs) for TradersApp can scale `ml-engine` and `bff` up under sustained load and back down after idle.

---

## What Gets Scaled

| Deployment | Min Replicas | Max Replicas | Target CPU% | Target Memory% | Custom Metric |
|-----------|-------------|-------------|-------------|----------------|---------------|
| `bff` | 2 | 8 | 60% | none | none |
| `ml-engine` | 1 | 10 | 70% | 80% | none in `tradersapp-dev` |

### `bff-hpa`
- Scale-up stabilization: 15s
- Scale-down stabilization: 300s
- Targets `Deployment/bff` in `tradersapp-dev`

### `ml-engine-hpa`
- Scale-up stabilization: 30s
- Scale-down stabilization: 300s
- Targets `Deployment/ml-engine` in `tradersapp-dev`
- Dev overlay uses CPU and memory only. The latency metric remains a production/custom-metrics concern.

---

## Cluster State (2026-04-12)

### Repo-Managed HPAs Restored

The live namespace is now back on the repo-managed HPA names:

```bash
kubectl get hpa -n tradersapp-dev
NAME            REFERENCE              TARGETS        MINPODS   MAXPODS   REPLICAS
bff-hpa         Deployment/bff         cpu: 70%/60%   2         8         3
ml-engine-hpa   Deployment/ml-engine   ...            1         10        >1
```

What was verified live:
- `ml-engine-hpa` was recreated from `k8s/overlay/dev/hpa-ml-engine.yaml` and scaled above its floor
- `bff-hpa` was recreated from `k8s/overlay/dev/hpa-bff.yaml`
- `bff-hpa` scaled from `2` to `3` and later returned to `2`
- validation scripts now fail fast if an unexpected HPA name already targets either deployment

### 2026-04-13 Recovery Summary

- `metrics-server` was installed live and patched with `--kubelet-insecure-tls`
- steady-state `kubectl top` works again, `kubectl get apiservice v1beta1.metrics.k8s.io` is back to `Available=True`, and both HPAs reached `ScalingActive: True`
- `ml-engine` now reaches `1/1` or `2/2 Ready` on `dev-retryfix-20260413a` depending on current HPA size
- `bff` now reaches `1/1 Ready` per pod on `dev-readyprobe-20260413b` with `httpGet` probes and `BFF_HOST=0.0.0.0`
- `scripts/k8s/validate-hpa-ml-engine.sh` cleanly scaled `ml-engine` from `1` to `3`
- independent BFF-targeted load scaled `bff` from `2` to `4` and later back to `2`
- the umbrella runner now uses live-baseline scale-up detection instead of a hardcoded `> 1`, which fixed a false-positive exit when `ml-engine` started above floor
- live umbrella pass artifact: `.artifacts/hpa-scaling-test-live-20260413-092043/result.txt` = `PASS`
- 2026-04-13 umbrella validation proved `ml-engine` baseline `1` -> `3` replicas (`desired=4`) under `/predict` load and back to baseline after idle
- residual risk: the Metrics API still dropped briefly twice during the long scale-down window, but it recovered and no longer blocks a clean Stage M pass

### Metrics API State

`metrics-server` is present in `kube-system`, and the steady-state metrics API is healthy again:

```bash
kubectl describe apiservice v1beta1.metrics.k8s.io
kubectl top nodes
kubectl top pods -n tradersapp-dev
```

Observed state:
- `kubectl get apiservice v1beta1.metrics.k8s.io` currently reports `Available=True`
- `kubectl top nodes` and `kubectl top pods -n tradersapp-dev` work in steady state
- the umbrella runner held a clean `3/3` preflight probe window with both HPAs at `ScalingActive=True`
- two short `Metrics API not available` windows were still observed during the 2026-04-13 scale-down loop, so HPA health should still be paired with live Metrics API checks during future regressions

Extended cooldown-window probe:

```bash
NAMESPACE=tradersapp-dev DURATION_SECONDS=300 INTERVAL_SECONDS=15 \
  bash scripts/k8s/diagnose-metrics-api-stability.sh
```

This writes timestamped APIService / `kubectl top` / metrics-server / HPA samples into `.artifacts/metrics-api-stability-*` so a future flap is captured in one place instead of reconstructed from ad hoc commands.

### PVC State

The original ml-engine PVC blockers are cleared:

```bash
kubectl get pvc -n tradersapp-dev
NAME                                  STATUS
ml-models-pvc                         Bound
ml-state-pvc                          Bound
tradersapp-tradersapp-feast-features  Pending
```

`ml-models-pvc` and `ml-state-pvc` are now `Bound`. The remaining Feast PVC is not on the critical path for Stage M scaling validation.

### Deployment Readiness

```bash
kubectl get deploy,pods -n tradersapp-dev
```

Current runtime notes:
- `ml-engine` and `bff` both scale and converge normally in `tradersapp-dev`
- `redis` and `tradersapp-postgres` are healthy
- `minio-setup` still reports a missing `mlflow-runtime-secret`, but that job is outside the HPA validation path

Stage M is no longer blocked by app readiness, PVCs, or HPA naming drift. Remaining follow-up is optional hardening around transient Metrics API drops during long cooldown windows.

---

## Prerequisites

### 1. Repair `metrics-server`

```bash
# If metrics-server is absent, install it
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# For k3s, patch in the safe kubelet flags
kubectl patch deployment metrics-server -n kube-system \
  --type=json \
  -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"},{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-preferred-address-types=InternalIP,Hostname,InternalDNS,ExternalDNS,ExternalIP"}]'

# Verify the API is actually healthy
kubectl get apiservice v1beta1.metrics.k8s.io
kubectl get deploy,svc,endpoints -n kube-system | grep metrics-server
kubectl logs -n kube-system deploy/metrics-server --tail=100
kubectl top nodes
kubectl top pods -n tradersapp-dev
```

`kubectl top` must work before HPA scale-up validation is meaningful.

### 2. Remove Drifted HPAs And Re-Apply The Repo-Managed Manifests

```bash
# Remove the unexpected one-replica HPAs
kubectl delete hpa bff ml-engine -n tradersapp-dev

# Apply the repo-managed dev HPAs
kubectl apply -f k8s/overlay/dev/hpa-bff.yaml
kubectl apply -f k8s/overlay/dev/hpa-ml-engine.yaml

# Or reconcile through Helm now that values.dev.yaml enables autoscaling
helm upgrade --install tradersapp ./k8s/helm/tradersapp \
  -n tradersapp-dev \
  -f k8s/helm/tradersapp/values.yaml \
  -f k8s/helm/tradersapp/values.dev.yaml

# Expected end state
kubectl get hpa ml-engine-hpa bff-hpa -n tradersapp-dev
```

### 3. Verify Pods Are Ready

```bash
kubectl get pods -n tradersapp-dev -l app=ml-engine
kubectl get pods -n tradersapp-dev -l app=bff
```

Required state before load testing:
- `ml-engine` main container and sidecar are both Ready
- `bff` pods are Ready
- startup and readiness probes pass consistently

### 4. Install Prometheus Adapter For Future Custom Metrics

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus-adapter prometheus-community/prometheus-adapter \
  --namespace prometheus \
  --create-namespace \
  --set metricsRelistInterval=30s
```

This is not required for the current `tradersapp-dev` HPA validation path. It is only needed if the environment later re-enables latency-based HPA metrics.

---

## Load Test Procedure

### Step 1: Verify Pre-Conditions

```bash
kubectl get apiservice v1beta1.metrics.k8s.io
kubectl top nodes
kubectl get hpa ml-engine-hpa bff-hpa -n tradersapp-dev
kubectl get pods -n tradersapp-dev -l app=ml-engine
kubectl get pods -n tradersapp-dev -l app=bff
```

### Step 2: Record Baseline

```bash
kubectl get hpa -n tradersapp-dev -o wide > /tmp/hpa-baseline.txt
kubectl get deploy -n tradersapp-dev -o wide >> /tmp/hpa-baseline.txt
cat /tmp/hpa-baseline.txt
```

### Step 3: Run The Automated Validation

```bash
NAMESPACE=tradersapp-dev bash scripts/k8s/run-hpa-scaling-test.sh
NAMESPACE=tradersapp-dev bash scripts/k8s/validate-hpa-ml-engine.sh
NAMESPACE=tradersapp-dev bash scripts/k8s/validate-hpa-bff.sh
```

The scripts now refuse to continue if a drifted HPA with the wrong name already targets the deployment.
The umbrella runner now also requires a clean probe window where the Metrics API responds and both HPAs hold `ScalingActive=True`; it uses live-baseline scale-up detection, and during scale-down it can extend the wait budget when the Metrics API flaps instead of misclassifying the run as a clean failure.

### Step 4: Watch Scaling Events

```bash
kubectl get events -n tradersapp-dev --watch --field-selector involvedObject.kind=HorizontalPodAutoscaler
watch -n5 "kubectl get hpa -n tradersapp-dev && kubectl get pods -n tradersapp-dev -l app=ml-engine"
```

### Step 5: Validate Scale-Up

Pass criteria:
- `kubectl get hpa ml-engine-hpa -n tradersapp-dev` shows replicas rising above the live baseline captured before load
- `kubectl get hpa bff-hpa -n tradersapp-dev` can scale independently under BFF-targeted load
- pod events show no evictions or crashes during scaling
- `kubectl top pods -n tradersapp-dev -l app=ml-engine` shows CPU above the configured threshold during the test

### Step 6: Validate Scale-Down

After load stops:
- HPA desired replicas fall back to the configured minimum
- scale-down completes within the 300s stabilization window plus buffer
- service readiness remains intact during convergence

---

## Acceptance Criteria

- [ ] `ml-engine-hpa` and `bff-hpa` are the only HPAs targeting those deployments
- [ ] HPA `ScalingActive: True` after metrics-server repair
- [ ] `ml-engine` scales up within 3 minutes of sustained load
- [ ] `bff` scales independently under BFF-targeted load
- [ ] Scale-up stays within configured max replicas
- [ ] Scale-down completes after idle without crashing pods
- [ ] Service availability is maintained throughout the test

---

## Residual Risks

| Risk | Severity | Follow-up |
|------|----------|-----------|
| Transient `metrics.k8s.io` drops can still appear during long scale-down windows | Medium | Keep pairing HPA checks with live `kubectl top` / APIService checks when debugging regressions |
| `custom.metrics.k8s.io` is not registered in `tradersapp-dev` | Medium | Install Prometheus adapter only if custom latency metrics are required in this environment |
| `minio-setup` still fails on missing `mlflow-runtime-secret` | Low | Repair the secret if that bootstrap job matters for another stage; it does not block HPA validation |

---

## Scripts

- `scripts/k8s/run-hpa-scaling-test.sh` - end-to-end HPA validation
- `scripts/k8s/diagnose-metrics-api-stability.sh` - extended Metrics API / HPA stability sampler
- `scripts/k8s/validate-hpa-ml-engine.sh` - ml-engine-specific validation
- `scripts/k8s/validate-hpa-bff.sh` - bff-specific validation
- `scripts/k8s/watch-hpa-events.sh` - live HPA event watcher

## See Also

- `docs/K6_LOAD_TEST_RUNBOOK.md`
- `k8s/overlay/dev/hpa-ml-engine.yaml`
- `k8s/overlay/dev/hpa-bff.yaml`
- `k8s/helm/tradersapp/values.dev.yaml`
