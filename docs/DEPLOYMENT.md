# Deployment Guide — TradersApp

**Last updated:** 2026-04-19
**Status:** OCI k3s — Railway/Vercel deprecated as production path. See `docs/TODO_MASTER_LIST.md`

---

## Infrastructure Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Cloudflare WAF                              │
│  (DDoS protection, SSL/TLS 1.3, CDN, OWASP rules, bot management)│
│  Proxy mode: Full (strict) SSL for all traffic                     │
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

> **Production topology:** OCI Always Free k3s only. Railway and Vercel are no longer used for production hosting. `docs/TODO_MASTER_LIST.md` is the authoritative source.

---

## 1. Prerequisites

### Accounts Required
- [ ] GitHub account (already have)
- [ ] Oracle Cloud Infrastructure account (https://cloud.oracle.com) — OCI Always Free tier
- [ ] Cloudflare account (https://cloudflare.com) — add domain
- [ ] Infisical account (https://infisical.com) — secrets management
- [ ] Neon account (https://neon.tech) — PostgreSQL *(optional — not in core runtime)*

### Domain
- [ ] Purchase domain or use existing (e.g., `traders.app`)
- [ ] Transfer to Cloudflare or update nameservers

---

## 2. Cloudflare Setup

### DNS Configuration

After OCI ingress is live (P11/P12), add these records in Cloudflare DNS:

| Type | Name | Content | Proxy | SSL |
|---|---|---|---|---|
| A | traders.app | `144.24.112.249` | Proxied | Strict |
| A | www | `144.24.112.249` | Proxied | Strict |
| CNAME | api | `144.24.112.249` | Proxied | Strict |
| CNAME | bff | `144.24.112.249` | Proxied | Strict |

> **Before P12 completes:** These records may still point to old Vercel/Railway edges. Update only after OCI ingress is confirmed healthy.

### SSL/TLS Configuration (Cloudflare Dashboard)

1. **SSL/TLS → Overview:** Set to **Full (strict)**
2. **SSL/TLS → Edge Certificates:**
   - Enable **Always Use HTTPS**
   - Enable **Automatic HTTPS Rewrites**
   - TLS version: **1.3** (Cloudflare handles downgrades)
3. **SSL/TLS → Origin Server:**
   - Generate origin certificate (free, 15-year) for OCI k3s edge
   - After cert-manager is deployed (P11/P12), TLS certs are managed automatically via Let's Encrypt
   - Until then, terminate TLS at Cloudflare edge only
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

**Triggering a deploy:**
Push to `main` branch → GitHub Actions runs `deploy-k8s.yml` automatically.

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
| `KUBECONFIG_B64` | CI/CD | `sed 's\|127.0.0.1\|144.24.112.249\|g' /tmp/k3s-server.yaml \| base64 -w0` on OCI node |
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
- [ ] No 5xx errors in k3s pod logs (`kubectl get pods -n tradersapp`)
