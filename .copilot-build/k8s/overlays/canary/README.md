# TradersApp Canary Deployment Strategy

**Last Updated:** 2026-04-06

---

## Overview

All production deployments use a **canary release** pattern:

```
Production Traffic
  ├── 90% → Stable (current production version)
  └── 10% → Canary (new version)
```

**Automated gates** determine whether the canary is promoted or rolled back:
1. **Latency gate**: Canary P95 latency must be within 10% of stable
2. **Error rate gate**: Canary error rate must not exceed 1%
3. **SLO gate**: No SLO burn rate alerts firing
4. **Accuracy gate**: Rolling accuracy must not drop > 5% vs baseline

---

## Deployment Flow

### Phase 1: Deploy Canary (10% traffic)

```bash
# Deploy canary version (10% traffic)
kubectl set image deployment/tradersapp-ml-engine-canary \
  ml-engine=tradersapp/ml-engine:v1.2.3-canary

# Verify canary is healthy
kubectl rollout status deployment/tradersapp-ml-engine-canary -n tradersapp
kubectl logs -n tradersapp deployment/tradersapp-ml-engine-canary --tail=50
```

### Phase 2: Monitor (15 minutes)

Monitor canary metrics for 15 minutes:

```bash
# Check canary vs stable latency
promtool query instant \
  'histogram_quantile(0.95, sum(rate(ml_engine_inference_latency_ms_bucket{version="canary"}[5m])) by (le))'

promtool query instant \
  'histogram_quantile(0.95, sum(rate(ml_engine_inference_latency_ms_bucket{version="stable"}[5m])) by (le))'
```

### Phase 3: Promote or Rollback

**Promote** (if all gates pass):
```bash
# Full rollout — promote canary to 100%
kubectl rollout undo deployment/tradersapp-ml-engine-stable -n tradersapp
kubectl set image deployment/tradersapp-ml-engine-stable \
  ml-engine=tradersapp/ml-engine:v1.2.3-canary
```

**Rollback** (if any gate fails):
```bash
# Immediate rollback
kubectl rollout undo deployment/tradersapp-ml-engine-canary -n tradersapp
kubectl delete deployment/tradersapp-ml-engine-canary -n tradersapp
```

---

## Argo Rollouts Configuration

For automated canary management with progressive delivery:

```yaml
# k8s/rollouts/ml-engine-rollout.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: ml-engine
  namespace: tradersapp
spec:
  replicas: 4
  strategy:
    canary:
      # Traffic weight: 10% to canary
      trafficRouting:
        nginx:
          stableIngress: ml-engine-stable
          additionalIngressAnnotations:
            canary-weight: "10"
      # Canary analysis template
      analysis:
        templates:
          - templateName: ml-engine-latency
          - templateName: ml-engine-errors
        args:
          - name: service-name
            value: ml-engine-canary
      # Step progression
      steps:
        - setWeight: 10      # 10% canary
        - pause: {duration: 5m}
        - analysis:
            templates:
              - templateName: ml-engine-latency
        - setWeight: 25     # 25% canary
        - pause: {duration: 5m}
        - analysis:
            templates:
              - templateName: ml-engine-latency
              - templateName: ml-engine-errors
        - setWeight: 50     # 50% canary
        - pause: {duration: 5m}
        - fullRollout: true # 100%

  analysisTemplates:
    - name: ml-engine-latency
      spec:
        args:
          - name: service-name
        metrics:
          - name: latency
            interval: 1m
            successCondition: result[0] <= 1.1 * 200  # 10% higher than stable
            failureLimit: 2
            provider:
              prometheus:
                address: http://prometheus:9090
                query: |
                  histogram_quantile(0.95,
                    sum(rate(ml_engine_inference_latency_ms_bucket{version="canary"}[2m])) by (le)
                  )

    - name: ml-engine-errors
      spec:
        metrics:
          - name: error-rate
            interval: 1m
            successCondition: result[0] < 0.01  # < 1% error rate
            failureLimit: 1
            provider:
              prometheus:
                address: http://prometheus:9090
                query: |
                  sum(rate(ml_engine_inference_errors_total{version="canary"}[2m]))
                  /
                  sum(rate(ml_engine_inference_requests_total{version="canary"}[2m]))
```

---

## Flagger (Flux CD Canary)

Alternative: Use Flagger for GitOps-based progressive delivery with automated rollback.

```yaml
# Install Flagger
helm upgrade -i flagger flagger/flagger \
  --namespace=flagger \
  --set crd.create=true \
  --set meshProvider=nginx

# Create Canary resource
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: ml-engine
  namespace: tradersapp
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ml-engine
  strategy:
    canary:
      analysis:
        interval: 1m
        threshold: 2          # Max failed checks before rollback
        maxWeight: 50         # Max traffic weight
        stepWeight: 10        # Increment per check
        metrics:
          - name: request-success-rate
            thresholdRange:
              min: 99
            interval: 1m
          - name: latency
            templateRef:
              name: ml-engine-latency
              namespace: tradersapp
```

---

## Service Mesh (Istio) Canary

```yaml
# istio/canary-virtualservice.yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ml-engine
spec:
  hosts:
    - ml-engine
  http:
    - route:
        - destination:
            host: ml-engine-stable
          weight: 90
        - destination:
            host: ml-engine-canary
          weight: 10
---
# Prometheus metric: triton_inference_latency_ms{version="stable|canary"}
# Add version label to all metrics via Prometheus relabeling
```
