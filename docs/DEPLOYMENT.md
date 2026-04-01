# Deployment Guide — TradersApp

**Last updated:** 2026-04-02

---

## Infrastructure Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Cloudflare WAF                              │
│  (DDoS protection, SSL/TLS 1.3, CDN, OWASP rules, bot management)│
│  Proxy mode: Full (strict) SSL for all traffic                     │
└──────────────┬──────────────────┬───────────────────┬──────────────┘
               │                  │                   │
        ┌──────▼──────┐   ┌──────▼──────┐    ┌──────▼──────┐
        │   Vercel    │   │   Railway   │    │   Railway   │
        │  (Frontend) │   │  (BFF :8788)│    │(ML :8001)   │
        │   Port 443  │   │  Port 8788  │    │  Port 8001  │
        │   CDN edge  │   │  Persistent │    │  Persistent  │
        └─────────────┘   └─────────────┘    └─────────────┘
```

---

## 1. Prerequisites

### Accounts Required
- [ ] GitHub account (already have)
- [ ] Vercel account (https://vercel.com) — connect GitHub repo
- [ ] Railway account (https://railway.app) — connect GitHub repo
- [ ] Cloudflare account (https://cloudflare.com) — add domain
- [ ] Infisical account (https://infisical.com) — secrets management
- [ ] Neon account (https://neon.tech) — PostgreSQL (optional, dev uses SQLite)

### Domain
- [ ] Purchase domain or use existing (e.g., `traders.app`)
- [ ] Transfer to Cloudflare or update nameservers

---

## 2. Cloudflare Setup

### DNS Configuration

Add these records in Cloudflare DNS:

| Type | Name | Content | Proxy | SSL |
|---|---|---|---|---|
| A | traders.app | [Vercel IP] | Proxied | Strict |
| A | www | [Vercel IP] | Proxied | Strict |
| CNAME | api | [Railway ML Engine URL] | Proxied | Strict |
| CNAME | bff | [Railway BFF URL] | Proxied | Strict |
| A | ml-engine | [Railway ML IP] | Proxied | Strict |

### SSL/TLS Configuration (Cloudflare Dashboard)

1. **SSL/TLS → Overview:** Set to **Full (strict)**
2. **SSL/TLS → Edge Certificates:**
   - Enable **Always Use HTTPS**
   - Enable **Automatic HTTPS Rewrites**
   - TLS version: **1.3** (Cloudflare handles downgrades)
3. **SSL/TLS → Origin Server:**
   - Generate origin certificate (free, 15-year)
   - Download and upload to Railway environment variables:
     - `SSL_CERT` (full certificate chain)
     - `SSL_KEY` (private key)
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
| ML Engine | `https://api.traders.app/health` | `{"ok": true, ...}` |
| BFF | `https://bff.traders.app/health` | `{"ok": true, ...}` |
| Frontend | `https://traders.app` | HTTP 200 |

---

## 9. Smoke Test Checklist

After every deployment, verify:

- [ ] `GET /health` returns 200 on all services
- [ ] `GET /ai/status` returns AI provider configuration
- [ ] `GET /news/countdown` returns news event data
- [ ] `GET /ml/health` returns ML engine status
- [ ] Frontend loads without console errors
- [ ] No CORS errors in browser
- [ ] Rate limit headers present (`X-RateLimit-Remaining`)
- [ ] Security headers present (CSP, X-Frame-Options, etc.)
- [ ] No 5xx errors in Railway logs
