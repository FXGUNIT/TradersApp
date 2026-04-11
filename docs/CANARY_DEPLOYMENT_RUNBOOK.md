# Canary Deployment Runbook

## Enabling Canary

```bash
helm upgrade tradersapp ./k8s/helm/tradersapp \
  --set bff.canary.enabled=true \
  --set bff.canary.image.tag=$(git rev-parse --short HEAD) \
  --namespace tradersapp-dev
```

## Monitoring Canary Traffic

- Canary receives 1/(replicas+1) of traffic via weighted Service selector
- Monitor: `kubectl get pods -n tradersapp-dev -l app=bff-canary`
- Canary pod logs: `kubectl logs -l app=bff-canary -n tradersapp-dev -f`

## Promotion Criteria

- Canary pod must be Running and Ready for 10 consecutive minutes
- Zero restarts during 10-min window
- `/health` returns 200 on canary pod
- P95 latency on canary < 500ms (matching main deployment)
- No error rate increase vs main deployment

## Auto-Promotion (optional)

After 10-min window passes all criteria, promote:

```bash
helm upgrade tradersapp ./k8s/helm/tradersapp \
  --set bff.image.tag=<canary-sha> \
  --set bff.canary.enabled=false \
  --namespace tradersapp-dev
```

## Rollback Canary

```bash
helm rollback tradersapp -n tradersapp-dev

# Or disable explicitly:
helm upgrade tradersapp ./k8s/helm/tradersapp \
  --set bff.canary.enabled=false \
  --namespace tradersapp-dev
```
