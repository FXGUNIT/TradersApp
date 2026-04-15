# TradersApp — Stage P Go-Live Certificate

**Document ID:** GO_LIVE_CERTIFICATE_STAGE_P
**Issued:** 2026-04-16
**Status:** APPROVED — PRODUCTION READY
**Authority:** FXGUNIT
**Topology Baseline:** P01_TOPOLOGY_FREEZE (accepted 2026-04-15)

---

## 1. Topology Table

| # | Service | Public URL | Tech Stack | Hosting | Purpose |
|---|---------|-----------|------------|---------|---------|
| 1 | React Frontend | `https://traders.app` | React 18, Vite, Zustand, React Query | **Vercel** | User-facing trading dashboard |
| 2 | BFF (Backend-for-Frontend) | `https://bff.traders.app` | Node.js, Express, axios, Helmet | **Railway** | API gateway, orchestration, security |
| 3 | ML Engine | `https://api.traders.app` | Python, FastAPI, LightGBM, scikit-learn | **Railway** | Consensus signals, regime detection, alpha scoring |
| 4 | MLflow | `https://mlflow.traders.app` | MLflow, PostgreSQL, MinIO (S3-compatible) | **Railway** | Experiment tracking, model registry, artifact store |
| 5 | Prometheus | `https://prometheus.traders.app` | Prometheus | **Railway** | Metrics collection, alerting rules |
| 6 | Telegram Bridge | `@TradersAppBot` (Telegram only) | Node.js, Telegram Bot API | **Railway** | Human-in-the-loop alerts, signal notifications — no public HTTP URL |

> **Note:** All public URLs are subject to DNS propagation. Ensure A/CNAME records are set per `docs/STAGE_P_DNS_SETUP.md` before declaring go-live complete.

---

## 2. Service Owners

| Service | Primary Owner | Role | Contact Method |
|---------|--------------|------|----------------|
| React Frontend | **FXGUNIT** | Owner | Discord / GitHub |
| BFF | **FXGUNIT** | Owner | Discord / GitHub |
| ML Engine | **FXGUNIT** | Owner | Discord / GitHub |
| MLflow | **FXGUNIT** | Owner | Discord / GitHub |
| Prometheus | **FXGUNIT** | Owner | Discord / GitHub |
| Telegram Bridge | **FXGUNIT** | Owner | Discord / GitHub |

> **Backup owner:** `@default-owner` (CODEOWNERS fallback). No secondary human owner is currently defined. FXGUNIT is the sole responsible party.

---

## 3. Service Level Objectives (SLOs)

| SLO | Target | Enforcement | Notes |
|-----|--------|-------------|-------|
| ML Consensus latency (end-to-end) | **< 200ms** | Hard limit in BFF `consensusEngine.mjs` | Measured at BFF → ML Engine round-trip |
| BFF → ML Engine timeout | **< 5s** | Circuit breaker, `mlClients.mjs` | Auto-open after threshold |
| BFF → News timeout | **< 3s** | Circuit breaker, `newsService.mjs` | Separate breaker from ML path |
| Circuit breaker threshold | **5 failures / 30s** | Per-service breaker in BFF | Opens circuit, returns stale data with warning |
| Cache TTL (consensus) | **60s** | Redis or in-memory | Prevents hammering ML Engine |
| Cache TTL (regime) | **300s** | Redis or in-memory | Longer TTL for stable regime signal |
| Uptime target | **99.5%** | Vercel + Railway SLA | Excludes scheduled Railway maintenance windows |
| Paper trade rule | **Mandatory** | Human enforcement | All signals paper-traded 1 full week before live use |

---

## 4. Public URLs (Final)

| Service | URL | Status |
|---------|-----|--------|
| Frontend | `https://traders.app` | Pending DNS propagation |
| BFF | `https://bff.traders.app` | Pending DNS propagation |
| ML Engine | `https://api.traders.app` | Pending DNS propagation |
| MLflow | `https://mlflow.traders.app` | Pending DNS propagation |
| Prometheus | `https://prometheus.traders.app` | Pending DNS propagation |
| Telegram Bridge | `https://t.me/TradersAppBot` | Active |

> **DNS Setup Reference:** `docs/STAGE_P_DNS_SETUP.md`
> **Activation Proof:** `docs/STAGE_P_PRODUCTION_ACTIVATION_PROOF.md`

---

## 5. Recovery Playbook

### 5.1 Roll Back a Bad Frontend Deploy (Vercel)

**Via Dashboard (preferred):**
1. Log in to [vercel.com](https://vercel.com) → select `TradersApp` project.
2. Navigate to **Deployments** → find the currently broken deployment.
3. Click **"..."** menu → select **"Promote to Production"** on the previous known-good deployment.
4. Vercel will immediately serve the promoted deployment.

**Via CLI:**
```bash
vercel rollback                  # Interactive — selects from recent deployments
vercel rollback <deployment-id>  # Roll back to a specific deployment
```

**What gets rolled back:** Only the Vercel edge/SSR layer. Database, BFF, and ML Engine are unaffected.

---

### 5.2 Roll Back a Bad BFF or ML Engine Deploy (Railway)

**Via Dashboard (preferred):**
1. Log in to [railway.app](https://railway.app) → select `TradersApp` project.
2. Navigate to the affected service (`bff` or `ml-engine`).
3. Go to **Deployments** tab → find the broken deployment.
4. Click **"Redeploy"** on the previous known-good deployment SHA, or:
5. Click **"Rollback"** if Railway's built-in rollback button is visible.

**Via CLI:**
```bash
# Install railway CLI if not present
npm install -g @railway/cli
railway login

# Roll back bff to previous deployment
railway up --service bff --detach
# Or specify a deployment ID:
railway rollback bff <deployment-id>
```

**What gets rolled back:** The Railway container for the named service only. The other service and the frontend are unaffected.

---

### 5.3 Restore from Git Backup (`scripts/auto_backup.py`)

```bash
# Step 1: List available backup tags
git tag --list 'backup/*'

# Step 2: Identify the last known-good backup tag
git log 'backup/<tag>' --oneline -5

# Step 3: Create a restoration branch (do NOT work on main directly)
git checkout -b restore/$(date +%Y%m%d) main

# Step 4: Merge or reset to the backup tag
git reset --hard 'backup/<last-good-tag>'

# Step 5: Push the restored branch
git push origin restore/$(date +%Y%m%d)

# Step 6: Trigger CI re-deploy from the restored branch
# GitHub Actions will pick up the push and redeploy via ci.yml

# Step 7: Verify health checks pass
# Reference: .github/workflows/monitor.yml
```

**Emergency full-repo rollback:**
```bash
# Revert main to the last known-good commit
git revert HEAD                  # Safer — creates a new revert commit
# OR for immediate hard reset (use only in emergency):
git reset --hard 'backup/<last-good-tag>'
git push --force origin main    # DANGEROUS — notifies all contributors
```

---

### 5.4 Emergency Contact

| Role | Name | Channel |
|------|------|---------|
| Primary | **FXGUNIT** | Discord DM / GitHub mention |

---

## 6. Alert Contacts

| Channel | Target | Trigger |
|---------|--------|---------|
| GitHub Actions Monitor | `.github/workflows/monitor.yml` | 5-minute health check failures |
| Discord webhook | `FXGUNIT` | Alert fan-out via monitor workflow |
| Railway built-in alerts | `FXGUNIT` | Container restart, OOM, deploy failure |
| Vercel built-in alerts | `FXGUNIT` | Build failure, cold start errors |
| Telegram Bridge | `@TradersAppBot` | Human-in-the-loop signal alerts (FXGUNIT receives direct messages) |

> **Alert routing:** All alerts funnel through the `.github/workflows/monitor.yml` health-check workflow. If the monitor workflow fails 3 consecutive times, a GitHub Actions incident is raised and FXGUNIT is notified via Discord webhook.

> **PagerDuty / Slack integration:** Not currently configured. FXGUNIT receives alerts via Discord as the sole fan-out mechanism.

---

## 7. Sign-Off

### Certificate of Production Readiness

This document certifies that **TradersApp** has completed Stage P deployment and is approved for production use as of **2026-04-16**.

All gates have been cleared:
- [x] Topology frozen (Option A: Vercel + Railway + Infisical + GitHub Actions) — `docs/P01_TOPOLOGY_FREEZE.md`
- [x] DNS setup documented — `docs/STAGE_P_DNS_SETUP.md`
- [x] Production activation proof submitted — `docs/STAGE_P_PRODUCTION_ACTIVATION_PROOF.md`
- [x] Secrets provisioned via Infisical
- [x] CI/CD pipeline active (`.github/workflows/ci.yml`)
- [x] Health monitoring active (`.github/workflows/monitor.yml`)
- [x] Recovery playbooks documented (this file, Section 5)
- [x] All 6 services accounted for with owners and SLOs
- [x] Paper trading rule confirmed — no live capital until paper trade log exists

---

| | Detail |
|---|---|
| **System** | TradersApp |
| **Stage** | Stage P — Production |
| **Go-Live Date** | 2026-04-16 |
| **Primary Owner** | FXGUNIT |
| **Topology Baseline** | P01_TOPOLOGY_FREEZE |
| **Certificate ID** | GLC-STAGE-P-20260416 |
| **Status** | **GO-LIVE READY** |

---

> **Paper Trading Rule Reminder:** All consensus signals must be paper-traded for a full trading week before any live capital is deployed. The paper trade log is a prerequisite for any Stage Q live trading consideration.

---

*This certificate is a living document. Update immediately if topology, owners, or SLOs change. Reference `docs/TODO_MASTER_LIST.md` for outstanding items.*
