# Runbook: BFF Down

**Severity:** P1 — all API calls fail
**Detection:** Railway health check fails, `/ready` non-200
**SLA:** Restore within 15 minutes

---

## Step 1: Verify

```bash
# Railway health check
curl -sf http://localhost:8788/ready
# Railway: check Railway dashboard -> traders-bff service -> health

# Local Docker
docker logs traders-bff --tail 30
```

---

## Step 2: Common causes

### Port 8789 already in use (BFF port conflict)
```bash
lsof -i :8788
# Kill the conflicting process
```

### Redis unavailable (BFF can't start)
```bash
# See: docs/runbooks/redis-unavailable.md
docker exec traders-redis redis-cli ping
```

### ML Engine URL misconfigured
```bash
# Check ML_ENGINE_URL env var
docker exec traders-bff env | grep ML_ENGINE

# If wrong: update in Railway dashboard -> Variables
# Then restart: railway restart --service traders-bff
```

### Syntax/error in recent deployment
```bash
# Roll back to previous image
# Railway: traders-bff -> Deployments -> select previous SHA -> Redeploy

# Or via GitHub Actions:
gh run list --workflow=rollback.yml --limit=5
```

---

## Step 3: Restart BFF

```bash
# Railway
railway restart --service traders-bff

# Local Docker
docker restart traders-bff
sleep 3
curl -sf http://localhost:8788/ready
```

---

## Step 4: Post-incident

- [ ] Check Railway logs for the crash reason
- [ ] If new error: file bug with full stack trace from logs
- [ ] If ML Engine URL issue: update Infisical secret
