# HPA Scaling Test Runbook

**Status:** Stub — needs implementation

## Overview

Validates that Kubernetes Horizontal Pod Autoscaler (HPA) correctly scales TradersApp microservices under load and scales back down when load subsides.

## What Gets Scaled

| Deployment | Min Replicas | Max Replicas | Target CPU% | Target Memory% |
|-----------|-------------|-------------|-------------|----------------|
| `bff` | 2 | 20 | 70% | 80% |
| `ml-engine` | 2 | 10 | 80% | 85% |
| `telegram-bridge` | 1 | 5 | 70% | 75% |

## Pre-Test Checklist

- [ ] Prometheus metrics available (`metrics.k8s.io` or custom)
- [ ] `kubectl top pods` confirms metrics are flowing
- [ ] VPA not also enabled (VPA and HPA conflict)
- [ ] Cluster has sufficient node capacity to scale up

## Load Test Procedure

```bash
# 1. Apply baseline load
kubectl run load-generator \
  --image=loadimpact/k6 \
  --restart=Never \
  -- /bin/sh -c "k6 run /tests/load.js"

# 2. Watch HPA events
kubectl get events --watch --field-selector involvedObject.kind=HorizontalPodAutoscaler

# 3. Monitor replica count
watch -n5 "kubectl get hpa -n tradersapp"

# 4. Verify scaling up
# Expected: replicas increase within 2-5 minutes of sustained load

# 5. Stop load and verify scale down
# Expected: replicas decrease after 5 minutes of low utilization
```

## Acceptance Criteria

- [ ] HPA triggers scale-up within 3 minutes of sustained high load
- [ ] Scale-up does not exceed max replicas under test load
- [ ] HPA triggers scale-down within 5 minutes of idle
- [ ] No pod evictions during scaling (PDB respected)
- [ ] No crashed pods during scaling events
- [ ] Service availability maintained (SLA > 99.5%) during scale

## Scale Down Cooldown

HPA defaults: stabilization window 5 minutes (scale-down), 0 minutes (scale-up).
Tune via `--horizontal-pod-autoscaler-downscale-stabilization` flag.

## See Also

- `docs/K6_LOAD_TEST_RUNBOOK.md`
- `k8s/helm/tradersapp/values.prod.yaml` — HPA configuration
