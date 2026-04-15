# Runbook: Model Rollback

**Severity:** P1 — ML predictions degraded
**Detection:** Model PBO > 5%, Sharpe < 0.5, or known bad version deployed

---

## Step 1: Identify current model version

```bash
curl -sf http://localhost:8001/model-status | python3 -m json.tool
# Check "version" or "commit" field

# Check MLflow for run history
# Access: http://localhost:5000 (local) or MLflow hosted
```

---

## Step 2: List available model backups

```bash
# GitHub Releases
gh release list --repo gunitsingh1994/TradersApp

# GitHub Assets:
# models_backup_YYYYMMDD_HHMMSS.tar.gz

# Railway persistent disk (if models stored there):
railway run --service ml-engine ls /data/models/
```

---

## Step 3: Rollback via GitHub Actions (recommended)

Navigate to: https://github.com/gunitsingh1994/TradersApp/actions/workflows/rollback.yml

1. Click "Run workflow"
2. Select version: `models_backup_YYYYMMDD_HHMMSS`
3. Type `yes` to confirm
4. Wait for completion (~5 minutes)

---

## Step 4: Manual rollback (if Actions unavailable)

```bash
# Download from GitHub Release
gh release download models_backup_20260410_120000.tar.gz --dir /tmp/

# Restore
python ml-engine/scripts/version_models.py --restore /tmp/models_backup_20260410_120000.tar.gz

# Restart ML Engine
docker restart traders-ml-engine
```

---

## Step 5: Verify rollback

```bash
curl -sf http://localhost:8001/model-status | python3 -m json.tool
curl -sf http://localhost:8001/health | python3 -m json.tool
```

---

## Step 6: Post-incident

- [ ] File MLflow issue for the degraded model run
- [ ] Add tag `rollback:done` to GitHub issue
- [ ] Investigate why the model degraded (data quality? concept drift?)
