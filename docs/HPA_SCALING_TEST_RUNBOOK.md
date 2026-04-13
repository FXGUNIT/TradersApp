# HPA Scaling Test Runbook

**Status:** Live cluster tested - current blockers identified  
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
- steady-state `kubectl top` works and both HPAs reached `ScalingActive: True`
- `ml-engine` now reaches `2/2 Ready` on `dev-retryfix-20260413a`
- `bff` now reaches `1/1 Ready` per pod on `dev-readyprobe-20260413b` with `httpGet` probes and `BFF_HOST=0.0.0.0`
- `scripts/k8s/validate-hpa-ml-engine.sh` cleanly scaled `ml-engine` from `1` to `3`
- independent BFF-targeted load scaled `bff` from `2` to `4` and later back to `2`
- follow-up live checks still show `v1beta1.metrics.k8s.io` as `Available=False (FailedDiscoveryCheck)` and `kubectl top nodes` returns `Metrics API not available`
- `kubectl describe hpa ml-engine-hpa` and `kubectl describe hpa bff-hpa` still report `ScalingActive=True`, so HPA conditions must be paired with live Metrics API checks before closing Stage M
- remaining risk: under aggressive end-to-end validation, the Metrics API can still briefly flap and force one more clean rerun of the umbrella script

### Metrics API State

`metrics-server` is present in `kube-system`, but the metrics API is still flapping between healthy and unavailable:

```bash
kubectl describe apiservice v1beta1.metrics.k8s.io
kubectl top nodes
kubectl top pods -n tradersapp-dev
```

Observed state:
- `kubectl top` sometimes works and sometimes returns `Metrics API not available`
- the `metrics-server` pod has a high restart count
- `bff-hpa` can report `ScalingActive: True` when metrics are present
- `ml-engine-hpa` still becomes noisy whenever the Metrics API drops out
- recent live checks showed the aggregated API can stay `False (FailedDiscoveryCheck)` even while both HPAs still advertise `ScalingActive=True`

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

Current runtime blockers:
- new `ml-engine` pods can reach `2/2 Ready`, but the deployment is not yet stably converged
- `bff` can scale, but its pods are still not consistently Ready
- `redis` and `tradersapp-postgres` are healthy

Stage M is now blocked by metrics stability and app readiness - not by PVC provisioning or HPA naming drift.

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
The umbrella runner now also requires a clean probe window where the Metrics API responds and both HPAs hold `ScalingActive=True`; during scale-down it can extend the wait budget when the Metrics API flaps and returns `BLOCKED` instead of misclassifying the run as a clean failure.

### Step 4: Watch Scaling Events

```bash
kubectl get events -n tradersapp-dev --watch --field-selector involvedObject.kind=HorizontalPodAutoscaler
watch -n5 "kubectl get hpa -n tradersapp-dev && kubectl get pods -n tradersapp-dev -l app=ml-engine"
```

### Step 5: Validate Scale-Up

Pass criteria:
- `kubectl get hpa ml-engine-hpa -n tradersapp-dev` shows `currentReplicas > 1`
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

## Blocker Summary

| Blocker | Severity | Fix |
|---------|----------|-----|
| Live HPAs drifted to manual `bff` / `ml-engine` objects pinned to `1/1` | Critical | Delete drifted HPAs and apply repo-managed `bff-hpa` / `ml-engine-hpa` |
| `metrics.k8s.io` API unhealthy | Critical | Repair metrics-server until `kubectl top` works and HPA reports `ScalingActive=True` |
| `custom.metrics.k8s.io` not registered | Medium | Install Prometheus adapter if custom latency metrics are required |
| `ml-engine` startup probes failing | Critical | Redeploy a healthy `dev-latest` image and verify `/live` and `/ready` |
| `bff` startup probes timing out | Medium | Fix BFF readiness after Redis and ML Engine reachability are stable |

---

## Scripts

- `scripts/k8s/run-hpa-scaling-test.sh` - end-to-end HPA validation
- `scripts/k8s/validate-hpa-ml-engine.sh` - ml-engine-specific validation
- `scripts/k8s/validate-hpa-bff.sh` - bff-specific validation
- `scripts/k8s/watch-hpa-events.sh` - live HPA event watcher

## See Also

- `docs/K6_LOAD_TEST_RUNBOOK.md`
- `k8s/overlay/dev/hpa-ml-engine.yaml`
- `k8s/overlay/dev/hpa-bff.yaml`
- `k8s/helm/tradersapp/values.dev.yaml`
