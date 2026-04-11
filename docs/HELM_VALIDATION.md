# Helm Chart Validation

**Status:** OK — Helm v3.16.3 (GitCommit: cfd07493f46efc9debd9cc1b02a0961186df7fdf)

Validation result: `helm lint` passed — 1 chart linted, 0 chart(s) failed.

---

## Chart Metadata

| Field | Value |
|-------|-------|
| `apiVersion` | v2 |
| `name` | tradersapp |
| `description` | TradersApp — Algorithmic Trading ML Platform |
| `version` | 1.0.0 |
| `appVersion` | 1.0.0 |
| `type` | application |
| `dependencies` | kube-prometheus-stack (alias: monitoringStack, v80.13.3) |

---

## Templates Rendered (34 total resources)

| Count | Kind |
|-------|------|
| 10 | Service |
| 8 | Deployment |
| 6 | PersistentVolumeClaim |
| 4 | NetworkPolicy |
| 4 | ConfigMap |
| 2 | PodDisruptionBudget |
| 2 | Job |
| 2 | HorizontalPodAutoscaler |
| 2 | CronJob |
| 1 | StatefulSet |
| 1 | Secret |

---

## Template Files (22 templates)

```
NOTES.txt, _helpers.tpl, analysis-service.yaml, app-config.yaml,
bff.yaml, feast.yaml, frontend.yaml, grafana-hpa-scaling-dashboard-cm.yaml,
grafana-ml-inference-dashboard-cm.yaml, hpa-watcher.yaml, hpa.yaml,
ingress.yaml, kafka.yaml, keda-autoscaling.yaml, limit-range.yaml,
ml-engine.yaml, mlflow.yaml, pod-monitor.yaml, postgresql.yaml,
prometheus-rules.yaml, resource-quota.yaml, security.yaml,
triton.yaml, vllm-mamba.yaml
```

---

## Resource Verification

**Deployments rendered:**
- analysis-service (replicas: 2)
- bff (replicas: 2)
- frontend (replicas: 2)
- ml-engine (replicas: 1)
- mlflow-postgres, minio, mlflow, redis (each replicas: 1)

**HPA rendered:** ml-engine-hpa, bff-hpa

**StatefulSet:** kafka (replicas: 1)

**CronJobs:** tradersapp-tradersapp-feast-materialize,
tradersapp-tradersapp-feast-stream-materialize

**Jobs:** kafka-topic-bootstrap, minio-setup

**Resource specs:** 28 CPU entries, 28 memory entries across all Deployments

**NetworkPolicies (zero-trust):** ml-engine-netpol, bff-netpol,
analysis-service-netpol, frontend-netpol — each restricts ingress to only
allowed peers and egress to redis for ml-engine.

---

## Errors
None — dry-run template render completed with no `error:`/`Error`/`ERROR` strings found.

---

## Commands to Deploy

**Development:**
```bash
export PATH="/e/TradersApp/.helm-bin/windows-amd64:$PATH"
helm upgrade --install tradersapp k8s/helm/tradersapp/ \
  --namespace tradersapp-dev \
  --create-namespace \
  --values k8s/helm/tradersapp/values.dev.yaml \
  --wait --timeout 10m
```

**Production:**
```bash
export PATH="/e/TradersApp/.helm-bin/windows-amd64:$PATH"
helm upgrade --install tradersapp k8s/helm/tradersapp/ \
  --namespace tradersapp-prod \
  --create-namespace \
  --values k8s/helm/tradersapp/values.prod.yaml \
  --set mlEngine.image.tag=latest \
  --set bff.image.tag=latest \
  --wait --timeout 15m
```

---

## Helm Installation Notes

Helm v3.16.3 was installed by downloading directly from
`https://get.helm.sh/helm-v3.16.3-windows-amd64.zip` and extracting to
`e:\TradersApp\.helm-bin\windows-amd64\helm.exe`. Chocolatey install failed
due to permission/lock issues (requires administrator shell).

To persist on PATH permanently (PowerShell as Admin):
```powershell
[System.Environment]::SetEnvironmentVariable(
  "PATH", "$env:PATH;C:\TradersApp\.helm-bin\windows-amd64", "User")
```

---

## Post-Deploy Checklist

- [ ] All pods healthy (`kubectl get pods -n tradersapp`)
- [ ] Services expose correct ports
- [ ] Ingress routes correct
- [ ] No Secrets showing as errors
- [ ] NetworkPolicies enforced (`kubectl get netpol -n tradersapp`)
