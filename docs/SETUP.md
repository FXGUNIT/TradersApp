# TradersApp — Production Deployment Guide (OCI k3s)

**Time to complete: ~30 minutes.** Production runs on OCI Always Free k3s only.

---

## BEFORE YOU START

Things Claude has already done for you:
- ✅ All code written and committed
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

1. Go to **[app.infisical.com](https://app.infisical.com)** → your workspace
2. Navigate to **Settings → Access Tokens → Create Token**
3. Name it `GitHub Actions` → select **"Read/Write"** scope → Copy the token (starts with `is.`)
4. Run the setup script:
   ```powershell
   .\scripts\setup-infisical.ps1 -InfisicalToken "is.your_token_here"
   ```
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
   - Max Age: 12 months
   - Include Subdomains: ✅
   - Preload: ✅

### 2D. WAF Rules (free OWASP protection)
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

---

## STEP 3 — Neon PostgreSQL (optional — not in core runtime)

**What it does:** Optional PostgreSQL backend. Not deployed in core minimal runtime.

See `docs/POSTGRES_CUTOVER_PLAN.md` when/if PostgreSQL is added to the OCI k3s stack.

---

## DEPLOY THE APP

After completing Steps 0-2:

```bash
cd TradersApp
git checkout main
git pull
# GitHub Actions will:
# 1. Build and push GHCR images (bff, frontend, ml-engine, redis) with SHA tags
# 2. Run node-pressure recovery on OCI k3s node
# 3. kubectl apply the minimal manifest (core 4 services)
# 4. Smoke test health endpoints
```

Check progress at: **github.com/FXGUNIT/TradersApp/actions**

---

## VERIFY EVERYTHING WORKS

```bash
# 1. Frontend
curl https://traders.app/

# 2. BFF
curl https://bff.traders.app/health

# 3. ML Engine
curl https://api.traders.app/health
```

---

## ROLLBACK IF SOMETHING BREAKS

1. **Via kubectl on OCI node:**
   ```bash
   ssh opc@144.24.112.249
   kubectl --kubeconfig /tmp/k3s_external.yaml rollout undo deployment/<name> -n tradersapp
   ```

2. **Via GitHub Actions:** Re-run the `deploy-k8s.yml` workflow — rebuilds and redeploys.

3. **ML Model rollback:**
   GitHub Actions → **"Rollback ML Models"** workflow → run manually → enter last good version tag

---

## MONTHLY FREE TIER CHECKLIST

| Service | Usage | Free Limit | Status |
|---------|-------|-----------|--------|
| OCI E2.1.Micro | k3s node | Always Free | ✅ Active |
| GitHub Actions | CI/CD | 2000 min/month | ✅ Under limit |
| GHCR | Container registry | 500MB | ✅ Well under limit |
| Cloudflare | DNS + WAF + SSL | Unlimited | ✅ Active |
| Infisical | Secrets | Free tier | ✅ Under limit |
| Discord | Alerts | Unlimited | ✅ Active |
| Railway | **DEPRECATED** | — | ❌ Not used |
| Vercel | **DEPRECATED** | — | ❌ Not used |
