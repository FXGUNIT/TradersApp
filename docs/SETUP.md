<<<<<<< HEAD
# TradersApp — Production Deployment Guide (OCI k3s)

> **Archived reference only.** The active production path is `Contabo VPS + Docker Compose`, not OCI k3s. We do not own or pay for `traders.app`; ignore the DNS/domain instructions below unless a future paid-domain plan is explicitly reopened. Use [P26_Contabo_Deployment_Plan.md](/e:/TradersApp/docs/P26_Contabo_Deployment_Plan.md:1) and [TODO_MASTER_LIST.md](/e:/TradersApp/docs/TODO_MASTER_LIST.md:1) for the current no-owned-domain deployment path.

**Time to complete: ~30 minutes.** This document is retained only as historical OCI/k3s evidence.
=======
# TradersApp — Production Deployment Guide (Browser Steps)

**Time to complete: ~30 minutes.** All services used are **free forever**.
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

---

## BEFORE YOU START

Things Claude has already done for you:
- ✅ All code written and committed
<<<<<<< HEAD
- ✅ GitHub Actions CI/CD already written (`.github/workflows/deploy-k8s.yml`)
- ✅ k3s bootstrapped on OCI E2.1.Micro (144.24.112.249)
- ✅ k3s systemd service configured (auto-restart on boot)
- ✅ Infisical workspace configured (workspace ID: `0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab`)
- ✅ All secrets in Infisical (pushed via `scripts/setup-infisical.ps1`)
- ✅ `k8s/helm/tradersapp/values.minimal.yaml` — core-4 deploy profile

**What you need to do:** Complete the k3s core deploy (P09), then DNS cutover (P12).

---

## STEP 0 — Infisical Setup (FIRST)

Infisical is the **single source of truth for all secrets**. Everything pulls from it.
=======
- ✅ `vercel.json` created (Vercel config with security headers + Firebase env vars)
- ✅ `railway.json` already exists for BFF + ML Engine
- ✅ GitHub Actions CI/CD already written (with Infisical secret sync)
- ✅ Infisical workspace configured (workspace ID: `0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab`)
- ✅ `ml-engine/scripts/migrate_to_postgres.py` ready (Neon migration script)
- ✅ `scripts/setup-infisical.ps1` — one-shot setup of all secrets

**What you need to do:** Click through 4 dashboards to link your accounts.

---

## STEP 0 — Infisical Setup (FIRST — do this before everything else)

Infisical is the **single source of truth for all secrets**. Everything else (Railway, Vercel, CI) pulls from it.
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

1. Go to **[app.infisical.com](https://app.infisical.com)** → your workspace
2. Navigate to **Settings → Access Tokens → Create Token**
3. Name it `GitHub Actions` → select **"Read/Write"** scope → Copy the token (starts with `is.`)
4. Run the setup script:
   ```powershell
   .\scripts\setup-infisical.ps1 -InfisicalToken "is.your_token_here"
   ```
<<<<<<< HEAD
   This pushes all secrets from `.env.local` into Infisical and configures GitHub Actions secrets.

5. In Infisical dashboard → **Settings → Integrations**:
   - **GitHub App**: connect `TradersApp` repo → enable "Auto-inject secrets into GitHub Actions"

---

## STEP 1 — OCI k3s Core Deploy

> Full instructions in `docs/TODO_MASTER_LIST.md` — P01 through P09.

**Required before DNS cutover:**
1. SSH to OCI node: `ssh opc@144.24.112.249`
2. Confirm k3s running: `sudo systemctl status k3s`
3. Confirm KUBECONFIG refresh (after any k3s restart):
   ```bash
   sed 's|127.0.0.1|144.24.112.249|g' /tmp/k3s-server.yaml > /tmp/k3s_external.yaml
   base64 -w0 /tmp/k3s_external.yaml
   # Update KUBECONFIG_B64 secret in GitHub: Settings → Secrets → KUBECONFIG_B64
   ```
4. Secrets already bootstrapped via `scripts/admin/k3s-dev-bootstrap.ps1` (P07 done)
5. Push to `main` → GitHub Actions runs `deploy-k8s.yml` → core 4 deploy to OCI

---

## STEP 2 — Cloudflare DNS (after P09 stabilizes)

**What it does:** DNS, SSL, DDoS protection, WAF.

### 2A. Login to Cloudflare
1. Go to **[dash.cloudflare.com](https://dash.cloudflare.com)**
2. Select `traders.app` domain

### 2B. DNS Records
Add these records once k3s core deploy is healthy and ingress controller is running (P11):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | `144.24.112.249` | Proxied |
| A | www | `144.24.112.249` | Proxied |
| A | bff | `144.24.112.249` | Proxied |
| A | api | `144.24.112.249` | Proxied |

### 2C. SSL/TLS
1. Mode: **"Full (strict)"**
2. Edge Certificates → Enable **"Always Use HTTPS"**
3. Enable **"HSTS"** (strict transport security):
=======
   This will:
   - Push all secrets from your `.env.local` into Infisical (production / staging / development)
   - Set GitHub Actions secrets (INFISICAL_TOKEN + all AI keys)
   - Document the full secret schema

5. In Infisical dashboard → **Settings → Integrations**:
   - **GitHub App**: connect `TradersApp` repo → enable "Auto-inject secrets into GitHub Actions"
   - **Railway** (optional): connect Railway project → auto-inject into BFF + ML Engine services

**Local dev with Infisical:**
```bash
npm run dev:infisical          # Frontend with secrets from Infisical
npm run bff:dev:infisical      # BFF with secrets from Infisical
```

---

## STEP 1 — Railway (15 minutes)

**What it does:** Hosts your BFF (backend) and ML Engine (Python). Free: 500 hours/month.

### 1A. Create Railway Account
1. Go to **[railway.app](https://railway.app)**
2. Click **"Login"** → **"Login with GitHub"** → authorize
3. You're in — Railway auto-imports repos it can see

### 1B. Create 2 Services (ML Engine + BFF)

For **ML Engine**:
1. Click **"New Project"** → **"Deploy from GitHub repo"**
2. Find `TradersApp` → select `main` branch
3. Under **"Service Name"** type: `ml-engine`
4. Under **"Build"** → Builder: **Nixpacks** (auto-detected from `railway.json`)
5. Under **"Settings"** → **"Networking"** → **"Public Networking"**: ✅ ON
6. Copy the **Service ID** (from the URL: `railway.app/project/.../service/THIS-IS-THE-ID`)
7. Copy the **Environment ID** (from Project Settings → copy Environment ID)

For **BFF**:
1. Click **"New Project"** → **"Deploy from GitHub repo"**
2. Find `TradersApp` → select `main` branch
3. Under **"Service Name"** type: `bff`
4. Builder: **Nixpacks** → root directory: `bff/` (specify in service settings)
5. Under **"Settings"** → **"Networking"** → **"Public Networking"**: ✅ ON
6. Environment Variable: `BFF_PORT` = `8788`
7. Copy the **Service ID**

### 1C. Link Railway to GitHub (for auto-deploy)
1. In Railway: Project Settings → **GitHub Sync** → connect repo
2. Enable **Auto-Deploy**: ✅ ON (deploys on every push to `main`)

### 1D. Get Railway Token (for GitHub Actions)
1. Go to [railway.app/account](https://railway.app/account)
2. Scroll to **Tokens** → Click **"Create Token"**
3. Name: `GitHub Actions` → Copy the token
4. Set as GitHub Secret:
   ```bash
   gh secret set RAILWAY_TOKEN --body "your_token" --repo gunitsingh1994/TradersApp
   ```
5. Also add these as **Repository Variables** (not Secrets):
   ```bash
   gh variable set RAILWAY_PROD_ENV_ID --body "your_env_id" --repo gunitsingh1994/TradersApp
   gh variable set RAILWAY_PROD_ML_SERVICE_ID --body "your_ml_service_id" --repo gunitsingh1994/TradersApp
   gh variable set RAILWAY_PROD_BFF_SERVICE_ID --body "your_bff_service_id" --repo gunitsingh1994/TradersApp
   ```

> **⚠️ NOTE:** Railway environment variables are synced from Infisical automatically after each deploy. The setup-infisical.ps1 script handles this. You do NOT need to manually enter secrets in the Railway dashboard — they flow from Infisical → Railway via the CI/CD pipeline.

---

## STEP 2 — Vercel (5 minutes)

**What it does:** Hosts your React frontend on CDN edge. Free: 100GB bandwidth/month.

### 2A. Import Project
1. Go to **[vercel.com](https://vercel.com)**
2. Click **"Login"** → **"Continue with GitHub"** → authorize
3. Click **"Add New..."** → **"Project"**
4. Find **TradersApp** → Click **"Import"**
5. Vercel auto-detects **Vite** → Framework Preset: `Vite`
6. Root Directory: `.` (leave as default)
7. **Build Command**: `npm run build`
8. **Output Directory**: `dist`
9. **Environment Variables** — these are pulled from Infisical automatically. You can also add manually:
   ```
   VITE_BFF_URL               = https://bff.traders.app
   VITE_FIREBASE_API_KEY      = (from Infisical: AIzaSyBPN7fIZ-UfVQ5EMti1TzrFPsi4wtUEtKI)
   VITE_FIREBASE_AUTH_DOMAIN  = traders-regiment.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID    = traders-regiment
   VITE_FIREBASE_STORAGE_BUCKET = traders-regiment.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID = (from Infisical)
   VITE_FIREBASE_APP_ID       = (from Infisical)
   ```
   > **⚠️ NOTE:** Vercel environment variables are synced from Infisical automatically after each deploy. Use the `infisical-sync.yml` workflow to trigger a manual sync if needed.
10. Click **"Deploy"** — takes ~2 minutes

### 2B. Link to GitHub (for auto-deploy)
1. Project Settings → **GitHub Integration** → **"Configure GitHub App"**
2. Install Vercel on your GitHub account
3. Enable **"Include scope of GitHub Repositories"** → select TradersApp
4. Get Vercel credentials from Vercel Dashboard → Settings → Tokens:
   - `VERCEL_TOKEN` → set in GitHub Secrets (via setup-infisical.ps1)
   - `VERCEL_ORG_ID` → set in GitHub Secrets
   - `VERCEL_PROJECT_ID` → set in GitHub Secrets

### 2C. Custom Domain (traders.app)
1. In Vercel: Project Settings → **Domains**
2. Add `traders.app` → Vercel will give you DNS records
3. Go to **Cloudflare** (Step 3) to add those DNS records

---

## STEP 3 — Cloudflare (10 minutes)

**What it does:** DNS, SSL, DDoS protection, WAF. Already have your domains registered.

### 3A. Login to Cloudflare
1. Go to **[dash.cloudflare.com](https://dash.cloudflare.com)**
2. Select `traders.app` domain

### 3B. DNS Records
Add these records (Vercel will give you the values after Step 2):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | api | `<railway-bff-ip>` (or CNAME to Railway URL) | DNS only |
| CNAME | bff | `<railway-bff-hostname>.up.railway.app` | Proxied |
| CNAME | staging | `<staging-url>` | Proxied |
| CNAME | @ | cname.vercel-dns.com | Proxied |

**To get Railway BFF hostname:**
1. In Railway → BFF Service → Settings → Networking → copy Public URL
2. Use that as the CNAME target

### 3C. SSL/TLS
1. Go to **SSL/TLS** tab
2. Mode: **"Full (strict)"**
3. Edge Certificates → Enable **"Always Use HTTPS"**
4. Enable **"HSTS"** (strict transport security):
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
   - Max Age: 12 months
   - Include Subdomains: ✅
   - Preload: ✅

<<<<<<< HEAD
### 2D. WAF Rules (free OWASP protection)
=======
### 3D. WAF Rules (free OWASP protection)
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
1. Go to **Security** → **WAF**
2. Add Rule Set → **OWASP ModSecurity Core Rule Set** (free)
3. Create custom rules:
   ```
   Rule 1: Block SQL injection
     Field: URI Query String
     Contains: UNION|SELECT|INSERT|DROP|--|1=1
     Action: Block

   Rule 2: Block XSS
     Field: URI Query String
     Contains: <script|javascript:|onerror=|onclick=
     Action: Block

   Rule 3: Rate limit API
     Field: URI starts with /api
     Rate: 100 requests/minute per IP
     Action: Challenge
   ```

<<<<<<< HEAD
---

## STEP 3 — Neon PostgreSQL (optional — not in core runtime)

**What it does:** Optional PostgreSQL backend. Not deployed in core minimal runtime.

See `docs/POSTGRES_CUTOVER_PLAN.md` when/if PostgreSQL is added to the OCI k3s stack.
=======
### 3E. DDoS Protection
1. Go to **Security** → **DDoS**
2. Under **"Configure protective alerts"** → Add webhook to Discord:
   - https://discord.com/api/webhooks/...

### 3F. Get Cloudflare API Token (for wrangler.toml)
1. Go to **Profile** → **API Tokens**
2. Click **"Create Token"** → **"Edit zone DNS"** template
3. Zone Resources: select `traders.app`
4. Copy the token
5. Save to a password manager (you'll use it for wrangler CLI)

---

## STEP 4 — Neon PostgreSQL (optional — do later)

**What it does:** Auto-scaling serverless PostgreSQL with TimescaleDB. Free: 0.5GB storage forever.

### 4A. Create Neon Project
1. Go to **[neon.tech](https://neon.tech)**
2. Click **"Login"** → **"Login with GitHub"**
3. Click **"New Project"**:
   - Name: `traders-app`
   - Region: `US East (N. Virginia)` (closest to Railway)
   - Postgres Version: `16`
4. Copy the **Connection String** (looks like: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)

### 4B. Add to Infisical (not Railway directly)
1. In Infisical dashboard: add secret → `DATABASE_URL` → paste Neon connection string
2. The CI/CD pipeline (infisical-sync.yml) will auto-sync it to Railway after the next deploy.

### 4C. Run Migration
```bash
# Install dependencies
pip install psycopg2-binary

# Run migration (connects to Neon, migrates SQLite → PostgreSQL)
python ml-engine/scripts/migrate_to_postgres.py \
  --source ml-engine/trading_data.db \
  --target-url "$DATABASE_URL"
```
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

---

## DEPLOY THE APP

<<<<<<< HEAD
After completing Steps 0-2:
=======
After completing Steps 1-3, push to `main`:
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

```bash
cd TradersApp
git checkout main
git pull
<<<<<<< HEAD
# GitHub Actions will:
# 1. Build and push GHCR images (bff, frontend, ml-engine, redis) with SHA tags
# 2. Run node-pressure recovery on OCI k3s node
# 3. kubectl apply the minimal manifest (core 4 services)
# 4. Smoke test health endpoints
```

Check progress at: **github.com/FXGUNIT/TradersApp/actions**
=======
# GitHub Actions will now:
# 1. Build frontend → deploy to Vercel
# 2. Build ML Engine Docker image → deploy to Railway
# 3. Build BFF Docker image → deploy to Railway
# 4. Post Discord/Slack notifications on success/failure
```

Check progress at: **github.com/gunitsingh1994/TradersApp/actions**
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

---

## VERIFY EVERYTHING WORKS

```bash
# 1. Frontend
<<<<<<< HEAD
curl https://traders.app/

# 2. BFF
curl https://bff.traders.app/health

# 3. ML Engine
curl https://api.traders.app/health
=======
curl https://traders.app/health  # should return 200

# 2. BFF
curl https://bff.traders.app/health  # should return 200

# 3. ML Engine
curl https://api.traders.app/health  # should return 200

# 4. Run ML tests
cd ml-engine
pytest tests/ -v --tb=short
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
```

---

## ROLLBACK IF SOMETHING BREAKS

<<<<<<< HEAD
1. **Via kubectl on OCI node:**
   ```bash
   ssh opc@144.24.112.249
   kubectl --kubeconfig /tmp/k3s_external.yaml rollout undo deployment/<name> -n tradersapp
   ```

2. **Via GitHub Actions:** Re-run the `deploy-k8s.yml` workflow — rebuilds and redeploys.

3. **ML Model rollback:**
   GitHub Actions → **"Rollback ML Models"** workflow → run manually → enter last good version tag
=======
If a deploy breaks the app:

1. **Vercel rollback:**
   - Vercel Dashboard → Deployments → find last working one → **"..." → Redeploy**

2. **Railway rollback:**
   - Railway Dashboard → ML Engine → Deployments → find last working one → **"..." → Redeploy**
   - Same for BFF

3. **ML Model rollback:**
   - GitHub Actions → **"Rollback ML Models"** workflow → run manually → enter last good version tag
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

---

## MONTHLY FREE TIER CHECKLIST

<<<<<<< HEAD
| Service | Usage | Free Limit | Status |
|---------|-------|-----------|--------|
| OCI E2.1.Micro | k3s node | Always Free | Archived reference |
| GitHub Actions | CI/CD | 2000 min/month | ✅ Under limit |
| GHCR | Container registry | 500MB | ✅ Well under limit |
| Cloudflare | DNS + WAF + SSL | Unlimited | ✅ Active |
| Infisical | Secrets | Free tier | ✅ Under limit |
| Discord | Alerts | Unlimited | ✅ Active |
| Railway | **DEPRECATED** | — | ❌ Not used |
| Vercel | **DEPRECATED** | — | ❌ Not used |
=======
| Service | Usage | Free Limit | Notes |
|---------|-------|-----------|-------|
| Vercel | Frontend CDN | 100GB bandwidth | ✅ Under limit |
| Railway | BFF + ML Engine | 500 hours/month | ~16 hrs/day free |
| Neon | PostgreSQL | 0.5GB storage | Scale to 3GB if needed |
| Cloudflare | DNS + WAF + SSL | Unlimited | ✅ Already on it |
| GitHub Actions | CI/CD | 2000 min/month | ✅ Well under limit |
| Infisical | Secrets | 3 seats, 5 projects | ✅ Under limit |
| Discord | Alerts | Unlimited | ✅ Already configured |
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
