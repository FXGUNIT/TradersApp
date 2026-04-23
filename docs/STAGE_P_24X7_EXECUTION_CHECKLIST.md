# Stage P 24x7 Go-Live Execution Checklist

> **Archived legacy checklist.** The active public frontend is `https://tradergunit.pages.dev/`, and the live Contabo runtime proof hosts remain on `sslip.io`. The `traders.app` instructions below are historical OCI-era material only.

Last verified: 2026-04-16 20:33 IST (2026-04-16T15:03Z)
Repo: FXGUNIT/TradersApp

## 1) Current blockers (verified)

- Public DNS unresolved (NXDOMAIN):
  - `bff.traders.app`
  - `api.traders.app`
  - `staging.traders.app`
- Frontend routing issue:
  - `https://traders.app` redirects to `https://stocks.news/`
  - `https://traders.app/health` returns 404
- CI deploy contract gap:
  - Missing secrets (8):
    - `DISCORD_WEBHOOK_URL`
    - `INFISICAL_TOKEN`
    - `PAGERDUTY_ROUTING_KEY`
    - `RAILWAY_TOKEN`
    - `SLACK_WEBHOOK_URL`
    - `VERCEL_ORG_ID`
    - `VERCEL_PROJECT_ID`
    - `VERCEL_TOKEN`
  - Missing variables (6):
    - `RAILWAY_PROD_BFF_SERVICE_ID`
    - `RAILWAY_PROD_ENV_ID`
    - `RAILWAY_PROD_ML_SERVICE_ID`
    - `RAILWAY_STAGING_BFF_SERVICE_ID`
    - `RAILWAY_STAGING_ENV_ID`
    - `RAILWAY_STAGING_ML_SERVICE_ID`

## 2) Collect these values before running commands

- Railway:
  - `RAILWAY_TOKEN`
  - Production: `RAILWAY_PROD_ENV_ID`, `RAILWAY_PROD_ML_SERVICE_ID`, `RAILWAY_PROD_BFF_SERVICE_ID`
  - Staging: `RAILWAY_STAGING_ENV_ID`, `RAILWAY_STAGING_ML_SERVICE_ID`, `RAILWAY_STAGING_BFF_SERVICE_ID`
  - Public host targets for DNS:
    - BFF target (for `bff.traders.app`)
    - ML target (for `api.traders.app`)
- Vercel:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
  - Staging domain target (for `staging.traders.app`)
- Infisical:
  - `INFISICAL_TOKEN`
- Alerting:
  - `SLACK_WEBHOOK_URL`
  - `DISCORD_WEBHOOK_URL`
  - `PAGERDUTY_ROUTING_KEY`
- Optional but recommended for monitor workflow:
  - `MLFLOW_TRACKING_URI` (public URL)
  - `PROMETHEUS_URL` (public URL)

## 3) Copy-paste this PowerShell block (GitHub secrets + variables)

Run from repo root `e:\TradersApp`.

```powershell
$repo = "FXGUNIT/TradersApp"

# Auth checks
gh auth status

# Prompt all required values
$RAILWAY_TOKEN = Read-Host "RAILWAY_TOKEN"
$VERCEL_TOKEN = Read-Host "VERCEL_TOKEN"
$VERCEL_ORG_ID = Read-Host "VERCEL_ORG_ID"
$VERCEL_PROJECT_ID = Read-Host "VERCEL_PROJECT_ID"
$INFISICAL_TOKEN = Read-Host "INFISICAL_TOKEN"
$SLACK_WEBHOOK_URL = Read-Host "SLACK_WEBHOOK_URL"
$DISCORD_WEBHOOK_URL = Read-Host "DISCORD_WEBHOOK_URL"
$PAGERDUTY_ROUTING_KEY = Read-Host "PAGERDUTY_ROUTING_KEY"

$RAILWAY_PROD_ENV_ID = Read-Host "RAILWAY_PROD_ENV_ID"
$RAILWAY_PROD_ML_SERVICE_ID = Read-Host "RAILWAY_PROD_ML_SERVICE_ID"
$RAILWAY_PROD_BFF_SERVICE_ID = Read-Host "RAILWAY_PROD_BFF_SERVICE_ID"
$RAILWAY_STAGING_ENV_ID = Read-Host "RAILWAY_STAGING_ENV_ID"
$RAILWAY_STAGING_ML_SERVICE_ID = Read-Host "RAILWAY_STAGING_ML_SERVICE_ID"
$RAILWAY_STAGING_BFF_SERVICE_ID = Read-Host "RAILWAY_STAGING_BFF_SERVICE_ID"

# Existing monitor vars (confirm/update values)
$BFF_URL = "https://bff.traders.app"
$FRONTEND_URL = "https://traders.app"
$K6_BASE_URL = "https://staging.traders.app"
$ML_ENGINE_URL = "https://api.traders.app"
$MODEL_FRESHNESS_MAX_DAYS = "7"
$MLFLOW_TRACKING_URI = Read-Host "MLFLOW_TRACKING_URI (public URL, not localhost)"
$PROMETHEUS_URL = Read-Host "PROMETHEUS_URL (public URL, not localhost)"

# Set required secrets
gh secret set RAILWAY_TOKEN --repo $repo --body $RAILWAY_TOKEN
gh secret set VERCEL_TOKEN --repo $repo --body $VERCEL_TOKEN
gh secret set VERCEL_ORG_ID --repo $repo --body $VERCEL_ORG_ID
gh secret set VERCEL_PROJECT_ID --repo $repo --body $VERCEL_PROJECT_ID
gh secret set INFISICAL_TOKEN --repo $repo --body $INFISICAL_TOKEN
gh secret set SLACK_WEBHOOK_URL --repo $repo --body $SLACK_WEBHOOK_URL
gh secret set DISCORD_WEBHOOK_URL --repo $repo --body $DISCORD_WEBHOOK_URL
gh secret set PAGERDUTY_ROUTING_KEY --repo $repo --body $PAGERDUTY_ROUTING_KEY

# Optional parity secret used in some flows
gh secret set ROLLBACK_WEBHOOK_URL --repo $repo --body $DISCORD_WEBHOOK_URL

# Set required variables
gh variable set RAILWAY_PROD_ENV_ID --repo $repo --body $RAILWAY_PROD_ENV_ID
gh variable set RAILWAY_PROD_ML_SERVICE_ID --repo $repo --body $RAILWAY_PROD_ML_SERVICE_ID
gh variable set RAILWAY_PROD_BFF_SERVICE_ID --repo $repo --body $RAILWAY_PROD_BFF_SERVICE_ID
gh variable set RAILWAY_STAGING_ENV_ID --repo $repo --body $RAILWAY_STAGING_ENV_ID
gh variable set RAILWAY_STAGING_ML_SERVICE_ID --repo $repo --body $RAILWAY_STAGING_ML_SERVICE_ID
gh variable set RAILWAY_STAGING_BFF_SERVICE_ID --repo $repo --body $RAILWAY_STAGING_BFF_SERVICE_ID

# Re-apply monitor/public URL vars
gh variable set BFF_URL --repo $repo --body $BFF_URL
gh variable set FRONTEND_URL --repo $repo --body $FRONTEND_URL
gh variable set K6_BASE_URL --repo $repo --body $K6_BASE_URL
gh variable set ML_ENGINE_URL --repo $repo --body $ML_ENGINE_URL
gh variable set MODEL_FRESHNESS_MAX_DAYS --repo $repo --body $MODEL_FRESHNESS_MAX_DAYS
gh variable set MLFLOW_TRACKING_URI --repo $repo --body $MLFLOW_TRACKING_URI
gh variable set PROMETHEUS_URL --repo $repo --body $PROMETHEUS_URL

Write-Host "== Secrets configured =="
gh secret list --repo $repo
Write-Host "== Variables configured =="
gh variable list --repo $repo
```

## 4) DNS changes (registrar / Cloudflare)

Create or update these records exactly with your real provider targets:

- `traders.app` -> A `144.24.112.249` (OCI k3s node)
- `www.traders.app` -> A `144.24.112.249`
- `bff.traders.app` -> A `144.24.112.249`
- `api.traders.app` -> A `144.24.112.249`
- `staging.traders.app` -> remove if exists (Vercel staging deprecated)

Then verify propagation:

```powershell
nslookup traders.app
nslookup bff.traders.app
nslookup api.traders.app
nslookup staging.traders.app
```

## 5) OCI k3s core deploy verification

After pushing to `main`, GitHub Actions runs `deploy-k8s.yml` automatically:

1. Confirm all 4 pods running:
   ```powershell
   kubectl --kubeconfig $env:KUBECONFIG get pods -n tradersapp
   ```
2. Confirm health endpoints respond:
   ```powershell
   curl https://bff.traders.app/health
   curl https://api.traders.app/health
   ```
3. If cluster was restarted, refresh kubeconfig and update `KUBECONFIG_B64` GitHub secret:
   ```bash
   sed 's|127.0.0.1|144.24.112.249|g' /tmp/k3s-server.yaml | base64 -w0
   # Then update via: gh secret set KUBECONFIG_B64 --body "<b64>" --repo FXGUNIT/TradersApp
   ```

CLI re-deploy trigger:

```powershell
# Trigger full pipeline (build + deploy to OCI k3s)
gh workflow run deploy-k8s.yml --ref main
```

## 6) Trigger and verify full pipeline

```powershell
# Trigger CI
gh workflow run ci.yml --ref main

# Watch latest CI
gh run list --workflow "CI/CD Pipeline" --limit 1
gh run watch <RUN_ID> --exit-status

# Refresh contract proof
python scripts/stage_p_ci_contract_probe.py --output .artifacts/stage-p/ci-contract-live-latest.json

# Refresh public readiness proof
python scripts/stage_p_public_probe.py --print-json
```

## 7) Success criteria (must all be true)

- `Deploy Production` job is green and does not fail in contract validation.
- `bff.traders.app`, `api.traders.app`, `staging.traders.app` resolve publicly.
- `https://traders.app` serves TradersApp (no redirect to `stocks.news`).
- `https://traders.app/health` returns HTTP 200.
- `https://bff.traders.app/health` returns HTTP 200.
- `https://api.traders.app/health` returns HTTP 200.
- `scripts/stage_p_public_probe.py` reports P02-P07 passing.

## 8) If it still fails

- CI fails at `Validate production deploy contract`:
  - One or more required secrets/variables still missing or empty.
- Deploy to Kubernetes fails at cluster connectivity:
  - `KUBECONFIG_B64` is missing/invalid or points to localhost.
- Public probe still shows redirect:
  - Vercel domain binding/redirect rule still wrong.
- Public probe still shows NXDOMAIN:
  - DNS records not created or not propagated yet.
