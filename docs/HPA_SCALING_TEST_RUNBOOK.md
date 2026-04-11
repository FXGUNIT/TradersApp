# HPA Scaling Test Runbook

**Status:** Live cluster tested — blockers identified
**Last Updated:** 2026-04-12
**Cluster:** desktop-control-plane (k3s v1.34.3) — tradersapp-dev namespace

---

## Overview

Validates that Kubernetes Horizontal Pod Autoscaler (HPA) correctly scales TradersApp microservices under load and scales back down when load subsides.

---

## What Gets Scaled

| Deployment | Min Replicas | Max Replicas | Target CPU% | Target Memory% | Custom Metric |
|-----------|-------------|-------------|-------------|----------------|---------------|
| `bff` | 2 | 8 | 60% | — | — |
| `ml-engine` | 1 | 10 | 70% | 80% | P95 latency < 200ms |

### bff HPA — `bff-hpa`
- Scale-up stabilization: 15s
- Scale-down stabilization: 300s
- Scale-up policy: 100% pod increase per 15s period
- Targets `Deployment/bff` in namespace `tradersapp-dev`

### ml-engine HPA — `ml-engine-hpa`
- Scale-up stabilization: 30s
- Scale-down stabilization: 300s (50% max reduction per 60s)
- Scale-up policies: 100% or +2 pods per 15s (select max)
- Targets `Deployment/ml-engine` in namespace `tradersapp-dev`
- Custom metric: `ml-engine-p95-latency-ms` → scale up when avg > 200ms

---

## Cluster State (2026-04-12)

### HPAs Applied
Both HPAs were successfully applied to `tradersapp-dev`:
```
kubectl get hpa -n tradersapp-dev
NAME            REFERENCE              TARGETS                            MINPODS   MAXPODS   REPLICAS   AGE
bff-hpa         Deployment/bff         cpu: <unknown>/60%                2         8         2          ~2m
ml-engine-hpa   Deployment/ml-engine   cpu: <unknown>/70%...             1         10        1          ~2m
```

### Critical Finding: `ScalingActive: False`
```
Conditions:
  Type           Status  Reason                   Message
  ----           ------  ------                   -------
  AbleToScale    True    SucceededGetScale        the HPA controller was able to get the target's current scale
  ScalingActive  False   FailedGetResourceMetric  the HPA was unable to compute the replica count:
                                                   failed to get cpu utilization: unable to get metrics
                                                   for resource cpu: unable to fetch metrics from resource
                                                   metrics API: the server could not find the requested
                                                   resource (get pods.metrics.k8s.io)
```

**Root Cause:** `metrics.k8s.io` API is not registered. The metrics-server pod is not installed in this k3s cluster.

**Additional Warnings:**
- `FailedGetPodsMetric`: `custom.metrics.k8s.io` not registered (Prometheus adapter not installed)
- `FailedGetResourceMetric` for memory: same cause

### Deployment Status
```
NAME                  READY   UP-TO-DATE   AVAILABLE   AGE
bff                   0/2     2            0           31h
ml-engine             0/1     1            0           31h
redis                 1/1     1            1           10h
tradersapp-postgres   1/1     1            1           10h
```

**ml-engine pods stuck in Pending:**
```
Events:
  Warning  FailedScheduling  ...  persistentvolumeclaim "ml-models-pvc" not found
  Warning  ProvisioningFailed  persistentvolumeclaim/ml-state-pvc  storageclass "local-path" not found
```

- `ml-models-pvc` — does not exist (Helm chart did not create it)
- `ml-state-pvc` — stuck Pending; local-path provisioner failing: `storageclass.storage.k8s.io "local-path" not found`
- bff pods crash-loop (52+ restarts): startup probe fails because ml-engine is unreachable

---

## Prerequisites (Must Be Satisfied Before Running Load Test)

### 1. Install metrics-server (enables CPU/memory HPA)

```bash
# For k3s (installs into kube-system)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Patch to work with self-signed certs (k3s self-signed)
kubectl patch deployment metrics-server -n kube-system \
  --type=json \
  -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# Verify
kubectl get apiservices | grep metrics
kubectl top nodes
kubectl top pods -n tradersapp-dev
```

### 2. Fix ml-engine PVCs (required for ml-engine pods to start)

```bash
# Option A: Create missing ml-models-pvc manually
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ml-models-pvc
  namespace: tradersapp-dev
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 2Gi
EOF

# Option B: Check why ml-state-pvc is failing
kubectl describe pvc ml-state-pvc -n tradersapp-dev
# If local-path storage class is missing, reinstall k3s with local-path provisioner
```

### 3. Verify pods are Running before testing HPA

```bash
kubectl get pods -n tradersapp-dev -l app=ml-engine
# Must show: 1/1 Running (not 0/1 Pending)

kubectl get pods -n tradersapp-dev -l app=bff
# Must show: 1/1 Running (not crashlooping)
```

### 4. Install Prometheus Adapter (for custom metrics like `ml-engine-p95-latency-ms`)

```bash
# Using Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus-adapter prometheus-community/prometheus-adapter \
  --namespace prometheus \
  --create-namespace \
  --set metricsRelistInterval=30s

# Or using kustomize if repo has overlays
# Required for ml-engine-hpa custom metric to activate
```

---

## Load Test Procedure

### Step 1: Verify pre-conditions
```bash
# 1. Metrics API available
kubectl get apiservices | grep metrics.k8s.io
kubectl top nodes  # Must return node CPU/memory

# 2. HPAs exist and are reachable
kubectl get hpa -n tradersapp-dev

# 3. ml-engine pods running
kubectl get pods -n tradersapp-dev -l app=ml-engine
```

### Step 2: Record baseline
```bash
kubectl get hpa -n tradersapp-dev -o wide > /tmp/hpa-baseline.txt
kubectl get deploy -n tradersapp-dev -o wide >> /tmp/hpa-baseline.txt
cat /tmp/hpa-baseline.txt
```

### Step 3: Start load generation

```bash
# Using busybox (always available in k8s)
kubectl run -n tradersapp-dev load-test --rm -i --image=busybox --restart=Never -- \
  sh -c 'while true; do wget -qO- http://ml-engine:8001/health; sleep 0.05; done' &
LOAD_PID=$!
echo "Load PID: $LOAD_PID"

# Alternative: kubectl exec into a running pod if busybox not preferred
# kubectl exec -n tradersapp-dev deploy/bff -- sh -c 'while true; do curl -s http://ml-engine:8001/health; done'
```

### Step 4: Monitor HPA scaling events
```bash
# In another terminal, watch HPA events
kubectl get events -n tradersapp-dev --watch --field-selector involvedObject.kind=HorizontalPodAutoscaler

# Watch replica count
watch -n5 "kubectl get hpa -n tradersapp-dev && kubectl get pods -n tradersapp-dev -l app=ml-engine"
```

### Step 5: Wait for scale-up (expect within 30-60s with current HPA config)
```bash
echo "Waiting 90s for scale-up..."
sleep 90
kubectl get hpa -n tradersapp-dev -o wide
kubectl get pods -n tradersapp-dev -l app=ml-engine
```

### Step 6: Verify scale-up occurred

**Pass criteria:**
- `kubectl get hpa ml-engine-hpa -n tradersapp-dev` shows `currentReplicas > 1`
- Pod events show no evictions or crashes during scaling
- `kubectl top pods -n tradersapp-dev -l app=ml-engine` shows CPU > 70%

### Step 7: Stop load and verify scale-down
```bash
kill $LOAD_PID 2>/dev/null || true

echo "Waiting 360s for scale-down (5min stabilization window + buffer)..."
sleep 360
kubectl get hpa -n tradersapp-dev -o wide
kubectl get pods -n tradersapp-dev -l app=ml-engine
```

### Step 8: Capture final state
```bash
kubectl get hpa -n tradersapp-dev -o yaml > /tmp/hpa-final.yaml
kubectl describe hpa -n tradersapp-dev >> /tmp/hpa-final.txt
```

---

## Acceptance Criteria

- [ ] HPA `ScalingActive: True` after metrics-server is installed
- [ ] HPA triggers scale-up within 3 minutes of sustained high load
- [ ] Scale-up does not exceed max replicas (ml-engine: 10, bff: 8)
- [ ] HPA triggers scale-down within 5 minutes of idle
- [ ] No pod evictions during scaling (PDB respected — check PDBs exist)
- [ ] No crashed pods during scaling events
- [ ] Service availability maintained during scale

---

## Blocker Summary

| Blocker | Severity | Fix |
|---------|----------|-----|
| `metrics.k8s.io` not registered | **Critical** | Install metrics-server |
| `custom.metrics.k8s.io` not registered | Medium | Install Prometheus adapter |
| `ml-models-pvc` missing | **Critical** | Create PVC or fix Helm chart |
| `ml-state-pvc` stuck Pending | **Critical** | Verify local-path storage class |
| bff pods crashloop | Medium | Fix ml-engine reachability first |

---

## Scripts

- `scripts/k8s/run-hpa-scaling-test.sh` — automated end-to-end scaling test
- `scripts/k8s/validate-hpa-ml-engine.sh` — ml-engine-specific validation script
- `scripts/k8s/validate-hpa-bff.sh` — bff-specific validation script
- `scripts/k8s/watch-hpa-events.sh` — live HPA event watcher

## See Also

- `docs/K6_LOAD_TEST_RUNBOOK.md` — HTTP load testing with k6
- `k8s/overlay/dev/hpa-ml-engine.yaml` — ml-engine HPA manifest (tradersapp-dev)
- `k8s/overlay/dev/hpa-bff.yaml` — bff HPA manifest (tradersapp-dev)
- `k8s/helm/tradersapp/values.prod.yaml` — HPA configuration source of truth
