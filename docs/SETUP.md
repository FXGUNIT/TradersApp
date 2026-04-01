# TradersApp — Production Deployment Guide (Browser Steps)

**Time to complete: ~30 minutes.** All services used are **free forever**.

---

## BEFORE YOU START

Things Claude has already done for you:
- ✅ All code written and committed
- ✅ `vercel.json` created (Vercel config with security headers + Firebase env vars)
- ✅ `wrangler.toml.example` created (Cloudflare Workers config)
- ✅ `railway.json` already exists
- ✅ GitHub Actions CI/CD already written
- ✅ `ml-engine/scripts/migrate_to_postgres.py` ready (Neon migration script)

**What you need to do:** Click through 4 dashboards to link your accounts.

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

For **Environment Variables** (in Railway project settings):
1. Project Settings → Environment → **Production**
2. Add these variables (values from `.env.local` on your machine):
   ```
   BFF_ADMIN_PASS_HASH=3eb02e9d7b591705b146ae87b1c2e7fe0daccf8e6603bb0872c54cb9091f96e0
   MASTER_SALT=46bd6c4a99b24642e0215af90b19ac89962a5e13b9aa5f8c1bed85d0538e0f13
   ML_ENGINE_URL=https://api.traders.app
   ```
3. For ML Engine service, add:
   ```
   DATABASE_URL=sqlite:///ml-engine/trading_data.db   # SQLite for now
   ```

### 1C. Link Railway to GitHub (for auto-deploy)
1. In Railway: Project Settings → **GitHub Sync** → connect repo
2. Enable **Auto-Deploy**: ✅ ON (deploys on every push to `main`)

### 1D. Get Railway Token (for GitHub Actions)
1. Go to [railway.app/account](https://railway.app/account)
2. Scroll to **Tokens** → Click **"Create Token"**
3. Name: `GitHub Actions` → Copy the token
4. Go to **GitHub.com → your repo → Settings → Secrets and variables → Actions**
5. Click **"New repository secret"**:
   - Name: `RAILWAY_TOKEN` → Paste token
6. Also add these as **Repository Variables** (not Secrets):
   - `RAILWAY_PROD_ENV_ID` → paste your Environment ID
   - `RAILWAY_PROD_ML_SERVICE_ID` → paste ML Engine Service ID
   - `RAILWAY_PROD_BFF_SERVICE_ID` → paste BFF Service ID

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
9. **Environment Variables** — Add these:
   ```
   VITE_BFF_URL               = https://bff.traders.app
   VITE_FIREBASE_API_KEY      = AIzaSyBPN7fIZ-UfVQ5EMti1TzrFPsi4wtUEtKI
   VITE_FIREBASE_AUTH_DOMAIN  = traders-regiment.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID    = traders-regiment
   VITE_FIREBASE_STORAGE_BUCKET = traders-regiment.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID = (from your .env.local)
   VITE_FIREBASE_APP_ID       = (from your .env.local)
   ```
10. Click **"Deploy"** — takes ~2 minutes

### 2B. Link to GitHub (for auto-deploy)
1. Project Settings → **GitHub Integration** → **"Configure GitHub App"**
2. Install Vercel on your GitHub account
3. Enable **"Include scope of GitHub Repositories"** → select TradersApp
4. Add to GitHub Secrets (github.com → Settings → Secrets):
   - `VERCEL_TOKEN` → (from Vercel Dashboard → Settings → Tokens → Create Token)
   - `VERCEL_ORG_ID` → (from Vercel Dashboard → Settings → Teams → copy Org ID)
   - `VERCEL_PROJECT_ID` → (from Vercel Dashboard → Settings → copy Project ID)

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
   - Max Age: 12 months
   - Include Subdomains: ✅
   - Preload: ✅

### 3D. WAF Rules (free OWASP protection)
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

### 4B. Add to Infisical
1. Go to **[infisical.com](https://infisical.com)** → your workspace
2. Add Secret → `DATABASE_URL` → paste Neon connection string
3. Also add `DATABASE_URL` as a Railway environment variable

### 4C. Run Migration
```bash
# Install dependencies
pip install psycopg2-binary

# Run migration (connects to Neon, migrates SQLite → PostgreSQL)
python ml-engine/scripts/migrate_to_postgres.py \
  --source ml-engine/trading_data.db \
  --target-url "$DATABASE_URL"
```

---

## STEP 5 — Infisical GitHub App (already done)

Infisical is already configured:
- Workspace ID: `0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab`
- Dev environment exists
- `npm run bff:dev:infisical` already works

**To add the GitHub App integration:**
1. Go to **app.infisical.com** → your workspace
2. Navigate to **Settings → Integrations → GitHub**
3. Connect your GitHub account/repo
4. Enable **"Auto-inject secrets into GitHub Actions"**

---

## DEPLOY THE APP

After completing Steps 1-3, push to `main`:

```bash
cd TradersApp
git checkout main
git pull
# GitHub Actions will now:
# 1. Build frontend → deploy to Vercel
# 2. Build ML Engine Docker image → deploy to Railway
# 3. Build BFF Docker image → deploy to Railway
# 4. Post Discord/Slack notifications on success/failure
```

Check progress at: **github.com/gunitsingh1994/TradersApp/actions**

---

## VERIFY EVERYTHING WORKS

```bash
# 1. Frontend
curl https://traders.app/health  # should return 200

# 2. BFF
curl https://bff.traders.app/health  # should return 200

# 3. ML Engine
curl https://api.traders.app/health  # should return 200

# 4. Run ML tests
cd ml-engine
pytest tests/ -v --tb=short
```

---

## ROLLBACK IF SOMETHING BREAKS

If a deploy breaks the app:

1. **Vercel rollback:**
   - Vercel Dashboard → Deployments → find last working one → **"..." → Redeploy**

2. **Railway rollback:**
   - Railway Dashboard → ML Engine → Deployments → find last working one → **"..." → Redeploy**
   - Same for BFF

3. **ML Model rollback:**
   - GitHub Actions → **"Rollback ML Models"** workflow → run manually → enter last good version tag

---

## MONTHLY FREE TIER CHECKLIST

| Service | Usage | Free Limit | Notes |
|---------|-------|-----------|-------|
| Vercel | Frontend CDN | 100GB bandwidth | ✅ Under limit |
| Railway | BFF + ML Engine | 500 hours/month | ~16 hrs/day free |
| Neon | PostgreSQL | 0.5GB storage | Scale to 3GB if needed |
| Cloudflare | DNS + WAF + SSL | Unlimited | ✅ Already on it |
| GitHub Actions | CI/CD | 2000 min/month | ✅ Well under limit |
| Infisical | Secrets | 3 seats, 5 projects | ✅ Under limit |
| Discord | Alerts | Unlimited | ✅ Already configured |
