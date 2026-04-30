# Deployment Guide — TradersApp

<<<<<<< HEAD
**Last updated:** 2026-04-23
**Status:** Contabo VPS + Docker Compose is the active production path. OCI k3s is archived fallback only. See `docs/P26_Contabo_Deployment_Plan.md`.

---

## Active Production Path

- Single `Contabo VPS`
- `GitHub Actions -> GHCR -> SSH -> Docker Compose`
- Canonical public frontend:
  - `tradergunit.pages.dev`
- Current Contabo runtime proof hosts:
  - `173.249.18.14.sslip.io`
  - `bff.173.249.18.14.sslip.io`
  - `api.173.249.18.14.sslip.io`
- `is-a.dev` is retired for the active path and should not be treated as a
  pending blocker.
- Runtime bundle:
  - [deploy/contabo/docker-compose.yml](/e:/TradersApp/deploy/contabo/docker-compose.yml:1)
  - [deploy/contabo/Caddyfile](/e:/TradersApp/deploy/contabo/Caddyfile:1)
  - [scripts/contabo/setup-vps.sh](/e:/TradersApp/scripts/contabo/setup-vps.sh:1)
  - [scripts/contabo/deploy.sh](/e:/TradersApp/scripts/contabo/deploy.sh:1)
  - [docs/P26_Contabo_Deployment_Plan.md](/e:/TradersApp/docs/P26_Contabo_Deployment_Plan.md:1)

`traders.app` is not owned or paid for in the active project. Treat older
`traders.app` references in archived OCI sections below as historical context,
not as the live Contabo target and not as a task to pursue. The user-facing
frontend entry point is `https://tradergunit.pages.dev/`.

## Archived OCI Reference

The rest of this document describes the old OCI k3s path kept for audit and rollback context. It is no longer the active production route.

=======
**Last updated:** 2026-04-02

---

>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
## Infrastructure Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Cloudflare WAF                              │
│  (DDoS protection, SSL/TLS 1.3, CDN, OWASP rules, bot management)│
│  Proxy mode: Full (strict) SSL for all traffic                     │
<<<<<<< HEAD
└───────────────────────────────┬────────────────────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   OCI Always Free      │
                    │   k3s on E2.1.Micro    │
                    │   (144.24.112.249)     │
                    │                        │
                    │  ┌────────────────┐    │
                    │  │ tradersapp NS  │    │
                    │  │  bff           │    │
                    │  │  frontend      │    │
                    │  │  ml-engine     │    │
                    │  │  redis         │    │
                    │  └────────────────┘    │
                    └───────────────────────┘
```

> **Archived topology:** OCI Always Free k3s only. This is retained as historical context. The active production route is the Contabo runbook above.

=======
└──────────────┬──────────────────┬───────────────────┬──────────────┘
               │                  │                   │
        ┌──────▼──────┐   ┌──────▼──────┐    ┌──────▼──────┐
        │   Vercel    │   │   Railway   │    │   Railway   │
        │  (Frontend) │   │  (BFF :8788)│    │(ML :8001)   │
        │   Port 443  │   │  Port 8788  │    │  Port 8001  │
        │   CDN edge  │   │  Persistent │    │  Persistent  │
        └─────────────┘   └─────────────┘    └─────────────┘
```

>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
---

## 1. Prerequisites

### Accounts Required
- [ ] GitHub account (already have)
<<<<<<< HEAD
- [ ] Oracle Cloud Infrastructure account (https://cloud.oracle.com) — OCI Always Free tier
- [ ] Cloudflare account (https://cloudflare.com) — add domain
- [ ] Infisical account (https://infisical.com) — secrets management
- [ ] Neon account (https://neon.tech) — PostgreSQL *(optional — not in core runtime)*
=======
- [ ] Vercel account (https://vercel.com) — connect GitHub repo
- [ ] Railway account (https://railway.app) — connect GitHub repo
- [ ] Cloudflare account (https://cloudflare.com) — add domain
- [ ] Infisical account (https://infisical.com) — secrets management
- [ ] Neon account (https://neon.tech) — PostgreSQL (optional, dev uses SQLite)
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

### Domain
- [ ] Purchase domain or use existing (e.g., `traders.app`)
- [ ] Transfer to Cloudflare or update nameservers

---

## 2. Cloudflare Setup

### DNS Configuration

<<<<<<< HEAD
After OCI ingress is live (P11/P12), add these records in Cloudflare DNS:

| Type | Name | Content | Proxy | SSL |
|---|---|---|---|---|
| A | traders.app | `144.24.112.249` | Proxied | Strict |
| A | www | `144.24.112.249` | Proxied | Strict |
| CNAME | api | `144.24.112.249` | Proxied | Strict |
| CNAME | bff | `144.24.112.249` | Proxied | Strict |

> **Before P12 completes:** These records may still point to old Vercel/Railway edges. Update only after OCI ingress is confirmed healthy.
=======
Add these records in Cloudflare DNS:

| Type | Name | Content | Proxy | SSL |
|---|---|---|---|---|
| A | traders.app | [Vercel IP] | Proxied | Strict |
| A | www | [Vercel IP] | Proxied | Strict |
| CNAME | api | [Railway ML Engine URL] | Proxied | Strict |
| CNAME | bff | [Railway BFF URL] | Proxied | Strict |
| A | ml-engine | [Railway ML IP] | Proxied | Strict |
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

### SSL/TLS Configuration (Cloudflare Dashboard)

1. **SSL/TLS → Overview:** Set to **Full (strict)**
2. **SSL/TLS → Edge Certificates:**
   - Enable **Always Use HTTPS**
   - Enable **Automatic HTTPS Rewrites**
   - TLS version: **1.3** (Cloudflare handles downgrades)
3. **SSL/TLS → Origin Server:**
<<<<<<< HEAD
   - Generate origin certificate (free, 15-year) for OCI k3s edge
   - After cert-manager is deployed (P11/P12), TLS certs are managed automatically via Let's Encrypt
   - Until then, terminate TLS at Cloudflare edge only
=======
   - Generate origin certificate (free, 15-year)
   - Download and upload to Railway environment variables:
     - `SSL_CERT` (full certificate chain)
     - `SSL_KEY` (private key)
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
4. **DDoS → L7 DDoS Mitigation:** Set to **ON**
5. **Security → WAF:**
   - Enable **OWASP ModSecurity Core Rule Set**
   - Create custom rules:
     - Block IPs with >100 requests/minute (rate limit)
     - Challenge suspicious user agents
     - Block known malicious IPs (use Cloudflare threat score)

### Bot Management (Cloudflare Dashboard)

1. **Security → Bots:** Enable **Bot Fight Mode** (free) or **Super Bot Fight Mode** (paid)
2. Block automated threats while allowing legitimate trading bots

### Page Rules (optional)

```
If URL matches: traders.app/*
Then:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 hour
  - Browser Cache TTL: 30 minutes
  (for static assets only — not API endpoints)
```

---

<<<<<<< HEAD
## 3. OCI k3s Node Setup

> Full details in `docs/TODO_MASTER_LIST.md` — P01 through P09.

### One-time node setup
```bash
# SSH to OCI node as opc user
ssh opc@144.24.112.249

# Add 2 GB swap (required for k3s on 1GB RAM)
sudo swapon /swapfile

# Install k3s binary directly (RPM OOMs on E2.1.Micro)
curl -sfL https://github.com/k3s-io/k3s/releases/download/v1.34.6%2Bk3s1/k3s -o /usr/local/bin/k3s
chmod +x /usr/local/bin/k3s

# Run k3s server (do NOT set KUBECONFIG env var for the server process)
sudo /usr/local/bin/k3s server \
  --cluster-init \
  --tls-san=144.24.112.249 \
  --write-kubeconfig /tmp/k3s-server.yaml \
  --write-kubeconfig-mode 644 \
  --disable traefik --disable servicelb \
  --disable-helm-controller --disable-kube-proxy \
  --disable-cloud-controller \
  --disable metrics-server --disable local-storage

# Open firewall for k3s API server port
sudo firewall-cmd --add-port=6443/tcp --permanent
sudo firewall-cmd --reload

# Generate external kubeconfig
sed 's|127.0.0.1|144.24.112.249|g' /tmp/k3s-server.yaml > /tmp/k3s_external.yaml

# Install systemd service for auto-restart on boot
# (see P03 in TODO_MASTER_LIST.md for full systemd unit file)
```

### Updating KUBECONFIG_B64 secret after k3s restart
```bash
# On OCI node — re-generate kubeconfig after restart
sed 's|127.0.0.1|144.24.112.249|g' /tmp/k3s-server.yaml | base64 -w0

# Set via GitHub Actions secret (or directly)
# GitHub: Settings → Secrets → KUBECONFIG_B64
```

## 4. GitHub Actions CI/CD

Deployments are driven by `.github/workflows/deploy-k8s.yml`.

**Required GitHub Secrets:**

| Secret | How to Get |
|---|---|
| `KUBECONFIG_B64` | `base64 -w0 /tmp/k3s_external.yaml` on OCI node |
| `INFISICAL_PROJECT_ID` | Infisical project settings |
| `DISCORD_WEBHOOK_URL` | Discord → Server Settings → Webhooks |

**Pipeline flow:**
1. Build and push `ghcr.io/fxgunit/<service>:latest` + SHA-tagged images
2. Run node-pressure recovery script (`scripts/k8s/recover-node-pressure.sh`)
3. Run OCI core preflight gates (`scripts/k8s/check-oci-core-preflight.sh`) against node pressure and optional SSH-based memory/disk thresholds
4. Render deterministic staged core manifests, emit `05-core-budget.md` / `05-core-budget.json`, dry-run validate each slice, then apply in order `redis -> ml-engine -> bff -> frontend`
5. Smoke test health endpoints

**Current provisional 1 GB node budget used by the staged render:**
- Base OS reserve: `160 MiB`
- k3s control-plane reserve: `190 MiB`
- Pre-deploy `MemAvailable` floor: `350 MiB`
- Safe resident application budget after that floor: `674 MiB`
- Core pod summed memory requests: `512 MiB`
- Residual RAM headroom above summed requests: `162 MiB`

> These values are the current hard deploy budget for P09-C16. Replace them only after the live OCI evidence capture tasks (`P09-C01` through `P09-C15`) prove a tighter or safer floor.

**Per-stage rollout evidence path:**
- Local/scripted runs save staged manifests, preflight output, and per-service rollout snapshots under `artifacts/k8s/deploy-core-minimal/<timestamp>/`
- CI uploads that directory as the `k8s-core-deploy-evidence-<run_id>` artifact so failed OCI retries preserve memory, events, and pod-log evidence

**Isolation matrix runner for P09-C42 to P09-C46:**
- `scripts/k8s/run-core-isolation-matrix.sh` runs the staged validation sequence `singles -> pairs -> triple -> full`
- It uses the same `deploy-core-minimal.sh` path as CI, preserves per-profile logs under `artifacts/k8s/core-isolation-matrix/<timestamp>/`, and stops on the first failing profile unless `--continue-on-failure` is set
- Use `--dry-run` to preview the exact profile order without touching the cluster

**Triggering a deploy:**
Push to `main` branch → GitHub Actions runs `deploy-k8s.yml` automatically.
=======
## 3. Vercel (Frontend)

### Connect Repository
1. Go to https://vercel.com → New Project
2. Import `traders-app` GitHub repo
3. Framework: **Vite** (detected automatically)
4. Root directory: `/`
5. Build command: `npm run build`
6. Output directory: `dist`

### Environment Variables (Vercel Dashboard → Settings → Environment Variables)

| Name | Value |
|---|---|
| `VITE_MASTER_SALT` | `<generate: openssl rand -hex 32>` |
| `VITE_ADMIN_PASS_HASH` | `<hash from: npm run admin:hash>` |
| `VITE_BFF_URL` | `https://bff.traders.app` |
| `VITE_ML_ENGINE_URL` | `https://api.traders.app` |
| `VITE_NEWS_API_KEY` | NewsData.io key (free tier) |

### Custom Domain
1. Settings → Domains → Add `traders.app`
2. Add CNAME from Vercel dashboard to Cloudflare
3. Cloudflare: change CNAME proxy mode to **Proxied**

### Deployment
- Auto-deploy on push to `main` branch
- Preview deployments for PRs

---

## 4. Railway (BFF + ML Engine)

### Create Project
1. https://railway.app → New Project → Deploy from GitHub repo
2. Add both services:
   - `bff` — directory: `bff`
   - `ml-engine` — directory: `ml-engine`

### BFF Service (Railway)

**Settings → Environment:**
```
NODE_ENV=production
PORT=8788
BFF_HOST=0.0.0.0
BFF_PORT=8788
ML_ENGINE_URL=https://api.traders.app
BFF_ALLOWED_ORIGINS=https://traders.app,https://www.traders.app
```

**Settings → Health Check:**
- Path: `/health`
- Port: `8788`

**Settings → Custom Domain:**
- Add `bff.traders.app` → CNAME to Railway URL

### ML Engine Service (Railway)

**Settings → Environment:**
```
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
PORT=8001
```

**Settings → Health Check:**
- Path: `/health`
- Port: `8001`

**Settings → Custom Domain:**
- Add `api.traders.app` → CNAME to Railway URL

### Persistent Disk (ML Engine)
1. Railway → ML Engine → Settings → Add Persistent Disk
2. Mount at: `/app/data`
3. This persists the SQLite database across deploys

### Infisical Integration

1. Install Infisical CLI: `npm install -g infisical`
2. Connect Infisical to GitHub repo
3. Create secrets:
   - `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, etc.
   - `NEWS_API_KEY`
   - `NEWS_API_KEY` (backup)
4. In Railway: Settings → Variables → Reference from Infisical
   ```
   ${{ infisical.FIREBASE_API_KEY }}
   ```

### Deploy
- Railway auto-deploys on push to linked branch
- Use Railway CLI for manual deploys:
  ```bash
  railway login
  railway up --service ml-engine
  railway up --service bff
  ```
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

---

## 5. Infisical Secrets Setup

### Create Project
1. https://app.infisical.com → New Project → TradersApp
2. Import secrets from `.env.example`

### Secrets to Configure

```bash
# ML Engine
ML_MODELS_PATH=/app/data/models
PYTHONUNBUFFERED=1

# BFF
NODE_ENV=production
BFF_HOST=0.0.0.0
BFF_PORT=8788
ML_ENGINE_URL=https://api.traders.app
BFF_ALLOWED_ORIGINS=https://traders.app

# AI Providers (at least one)
AI_GROQ_TURBO_KEY=
AI_GEMINI_PRO_KEY=
AI_OPENROUTER_MIND_ALPHA=

# Firebase (for App Check)
FIREBASE_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_AUTH_DOMAIN=
FIREBASE_STORAGE_BUCKET=

# News
NEWS_API_KEY=           # NewsData.io free tier
NEWS_API_KEY_BACKUP=   # Secondary key

# Admin
BFF_ADMIN_PASS_HASH=    # From: npm run admin:hash
MASTER_SALT=            # Generate: openssl rand -hex 32

# Telegram (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Railway
RAILWAY_TOKEN=          # From Railway account settings
```

### GitHub Actions Integration
1. Infisical → Settings → GitHub App
2. Install on repository
3. In GitHub Actions, use Infisical Action:
   ```yaml
   - uses: infisical/infisical-action@v3
     with:
       project-id: ${{ secrets.INFISICAL_PROJECT_ID }}
       env: production
   ```

---

## 6. GitHub Secrets Configuration

In GitHub repo → Settings → Secrets and variables → Actions:

### Required Secrets

| Secret | Where Used | How to Get |
|---|---|---|
<<<<<<< HEAD
| `KUBECONFIG_B64` | CI/CD | `sed 's\|127.0.0.1\|144.24.112.249\|g' /tmp/k3s-server.yaml \| base64 -w0` on OCI node |
=======
| `VERCEL_TOKEN` | CI/CD | Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | CI/CD | `vercel org ls` |
| `VERCEL_PROJECT_ID` | CI/CD | `vercel project ls` |
| `RAILWAY_TOKEN` | CI/CD | Railway → Account Settings → Tokens |
| `RAILWAY_STAGING_ENV_ID` | Deploy | Railway staging env ID |
| `RAILWAY_STAGING_BFF_SERVICE_ID` | Deploy | Railway staging BFF service ID |
| `RAILWAY_STAGING_ML_SERVICE_ID` | Deploy | Railway staging ML service ID |
| `RAILWAY_PROD_ENV_ID` | Deploy | Railway production env ID |
| `RAILWAY_PROD_BFF_SERVICE_ID` | Deploy | Railway production BFF service ID |
| `RAILWAY_PROD_ML_SERVICE_ID` | Deploy | Railway production ML service ID |
| `SLACK_WEBHOOK_URL` | Monitor | Slack → Workspace → Apps → Incoming Webhooks |
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
| `DISCORD_WEBHOOK_URL` | Monitor | Discord → Server Settings → Integrations → Webhooks |
| `INFISICAL_PROJECT_ID` | Secrets | Infisical project settings |

### Required Variables (not secrets)

In GitHub repo → Settings → Secrets and variables → Actions → Variables:

| Variable | Value |
|---|---|
| `ML_ENGINE_URL` | `https://api.traders.app` |
| `BFF_URL` | `https://bff.traders.app` |
| `FRONTEND_URL` | `https://traders.app` |

---

## 7. Rollback Plan

### ML Models
```bash
# List available backups
python ml-engine/scripts/version_models.py --status

# Restore from specific backup
python ml-engine/scripts/version_models.py --restore ./backups/models_backup_20260401_020000.tar.gz

# GitHub Actions: trigger rollback
gh workflow run rollback.yml -f version=2026-04-01
```

<<<<<<< HEAD
### OCI k3s Rollback (Primary)

```bash
# Via kubectl on OCI node
ssh opc@144.24.112.249
kubectl --kubeconfig /tmp/k3s_external.yaml rollout undo deployment/<name> -n tradersapp
kubectl --kubeconfig /tmp/k3s_external.yaml rollout status deployment/<name> -n tradersapp
```

**Via GitHub Actions:** Re-run the `deploy-k8s.yml` workflow — it will rebuild and redeploy from the current commit.

### ML Models
```bash
# List available backups
python ml-engine/scripts/version_models.py --status

# Restore from specific backup
python ml-engine/scripts/version_models.py --restore ./backups/models_backup_20260401_020000.tar.gz

# GitHub Actions: trigger rollback
gh workflow run rollback.yml -f version=2026-04-01
=======
### Railway Deployments

**Via Railway Dashboard:**
1. Railway → ML Engine → Deployments
2. Find the working deployment → click "Revert to this deployment"

**Via Railway CLI:**
```bash
railway login
railway status
railway rollback --service ml-engine
railway rollback --service bff
```

### Vercel Frontend
```bash
# List deployments
vercel list

# Rollback to previous deployment
vercel rollback [deployment-url]
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
```

### Database Rollback (if using Neon PostgreSQL)
```bash
# Neon creates a branch for each deployment
# To restore: Neon Dashboard → Branches → Restore from branch
```

---

## 8. Health Check URLs

| Service | URL | Expected |
|---|---|---|
<<<<<<< HEAD
| Canonical frontend | `https://tradergunit.pages.dev` | HTTP 200 + app shell (`Welcome back`) |
| Runtime edge | `https://173.249.18.14.sslip.io` | HTTP 200 |
| BFF | `https://bff.173.249.18.14.sslip.io/health` | `{"ok": true, ...}` |
| ML Engine | `https://api.173.249.18.14.sslip.io/health` | `{"ok": true, ...}` |
=======
| ML Engine | `https://api.traders.app/health` | `{"ok": true, ...}` |
| BFF | `https://bff.traders.app/health` | `{"ok": true, ...}` |
| Frontend | `https://traders.app` | HTTP 200 |
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

---

## 9. Smoke Test Checklist

After every deployment, verify:

<<<<<<< HEAD
- [ ] `https://tradergunit.pages.dev` returns 200 with the live app shell (`Welcome back` + `Continue with Google`)
- [ ] Pages root security headers are present (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`)
- [ ] Optional diagnostics page stays isolated at `https://tradergunit.pages.dev/developer`
- [ ] `https://173.249.18.14.sslip.io` returns 200 for the current runtime edge
- [ ] `GET /health` returns 200 on all runtime services
=======
- [ ] `GET /health` returns 200 on all services
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
- [ ] `GET /ai/status` returns AI provider configuration
- [ ] `GET /news/countdown` returns news event data
- [ ] `GET /ml/health` returns ML engine status
- [ ] Frontend loads without console errors
- [ ] No CORS errors in browser
<<<<<<< HEAD
- [ ] BFF routes called from the Pages root origin return the expected CORS header
- [ ] Negative admin verify returns a normal auth failure, not a filesystem/runtime error
- [ ] Rate limit headers present (`X-RateLimit-Remaining`)
- [ ] Security headers present (CSP, X-Frame-Options, etc.)
- [ ] No 5xx errors in k3s pod logs (`kubectl get pods -n tradersapp`)
=======
- [ ] Rate limit headers present (`X-RateLimit-Remaining`)
- [ ] Security headers present (CSP, X-Frame-Options, etc.)
- [ ] No 5xx errors in Railway logs
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
