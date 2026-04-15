# Runbook: Deployment Failure

**Severity:** P1 if production, P2 if staging
**Detection:** GitHub Actions deploy job fails, Railway shows error

---

## Step 1: Identify failing job

```bash
gh run list --workflow=ci.yml --limit=5
# Check the failing job's logs
gh run view <run-id> --log | tail -50
```

---

## Step 2: Common failures

### Unit tests failing
```bash
# Run locally
cd ml-engine && pytest tests/ -m unit -q --tb=short
cd .. && npm run lint
```

### Docker build failing
```bash
# Build locally
docker build -t traders-ml-engine:test ml-engine/

# Common issues:
# - Missing AI_GEMINI_PRO_KEY in .env -> set in Infisical
# - Python dependency not in requirements.txt
```

### Integration test failing (warn-only — does not block deploy)
Check integration report: GitHub Actions -> Artifacts -> integration-report.html

### Railway secrets missing
```bash
# Check Railway dashboard for "Variable not set" errors
# Sync secrets from Infisical:
./scripts/setup-infisical.ps1
```

---

## Step 3: Rollback

If production deploy is broken:
```bash
# Railway: traders-bff -> Deployments -> select last working SHA -> Redeploy
# Railway: traders-ml-engine -> Deployments -> select last working SHA -> Redeploy

# Frontend rollback: Vercel dashboard -> Deployments -> select previous
gh run rerun <last-good-run-id>
```

---

## Step 4: Post-incident

- [ ] Fix root cause in code
- [ ] Re-run CI
- [ ] Document in GitHub issue
