# Helm Validation Runbook

**Status:** Stub — needs implementation

## Purpose

Validate that the TradersApp Helm chart is correctly structured, passes linting, and produces valid Kubernetes manifests before deployment.

## Pre-Flighth Checks

- [ ] Chart version incremented in `Chart.yaml`
- [ ] All required values documented in `values.yaml`
- [ ] `helm lint` passes with no errors
- [ ] `helm template` produces valid YAML
- [ ] All image tags resolve
- [ ] Resource requests/limits set for all deployments
- [ ] SecurityContext configured

## Validation Commands

```bash
# Lint
helm lint k8s/helm/tradersapp

# Template render (dry-run)
helm template tradersapp k8s/helm/tradersapp \
  --values k8s/helm/tradersapp/values.prod.yaml \
  --namespace tradersapp \
  --dry-run=client

# Diff against live cluster
helm diff upgrade tradersapp k8s/helm/tradersapp \
  --values k8s/helm/tradersapp/values.prod.yaml \
  --namespace tradersapp \
  --dry-run
```

## Post-Deploy Validation

- [ ] All pods healthy (`kubectl get pods -n tradersapp`)
- [ ] Services expose correct ports
- [ ] Ingress routes correct
- [ ] No Secrets showing as errors

## See Also

- `docs/K8S_LIVE_CLUSTER_VALIDATION.md`
- `docs/CANARY_DEPLOYMENT_RUNBOOK.md`
