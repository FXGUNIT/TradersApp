# Live Cluster Validation

This runbook covers the read-only validation script used for the immediate live-cluster gates in `docs/TODO_MASTER_LIST.md`.

## Script

`scripts/k8s/validate-live-cluster-gates.sh`

Checks performed:

- namespace existence
- `ml-engine-secrets`
- `bff-secrets` or `tradersapp-secrets`
- `mlflow-runtime-secret`
- at least one `HorizontalPodAutoscaler`
- at least one `PodDisruptionBudget`
- at least one `ResourceQuota`
- at least one `LimitRange`

## Usage

```bash
bash scripts/k8s/validate-live-cluster-gates.sh
NAMESPACE=tradersapp-dev bash scripts/k8s/validate-live-cluster-gates.sh
bash scripts/k8s/validate-live-cluster-gates.sh --namespace tradersapp-dev
```

## Notes

- The script is read-only. It only uses `kubectl get`/`kubectl list` style queries.
- It exits non-zero when any required gate is missing.
- The BFF secret check passes if either `bff-secrets` or `tradersapp-secrets` exists, matching the repo's current secret-contract split.
