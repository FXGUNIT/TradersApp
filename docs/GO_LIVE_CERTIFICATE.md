# TradersApp — Stage P Go-Live Certificate

> **Archived topology certificate.** This document reflects the older OCI k3s production plan. We do not own or pay for `traders.app`; every `traders.app` URL below is historical only. The active production target is now `Contabo VPS + Docker Compose` on free `pages.dev` + `sslip.io` hosts; see [P26_Contabo_Deployment_Plan.md](/e:/TradersApp/docs/P26_Contabo_Deployment_Plan.md:1) and [TODO_MASTER_LIST.md](/e:/TradersApp/docs/TODO_MASTER_LIST.md:1).

**Document ID:** GO_LIVE_CERTIFICATE_STAGE_P
**Issued:** 2026-04-16
**Status:** ARCHIVED — HISTORICAL OCI BASELINE
**Authority:** FXGUNIT
**Topology Baseline:** P01_TOPOLOGY_FREEZE (accepted 2026-04-15)

---

## 1. Topology Table

| # | Service | Public URL | Tech Stack | Hosting | Purpose |
|---|---------|-----------|------------|---------|---------|
| 1 | React Frontend | `https://traders.app` | React 18, Vite, Zustand, React Query | **OCI k3s** | User-facing trading dashboard |
| 2 | BFF (Backend-for-Frontend) | `https://bff.traders.app` | Node.js, Express, axios, Helmet | **OCI k3s** | API gateway, orchestration, security |
| 3 | ML Engine | `https://api.traders.app` | Python, FastAPI, LightGBM, scikit-learn | **OCI k3s** | Consensus signals, regime detection, alpha scoring |
| 4 | MLflow | `https://mlflow.traders.app` | MLflow, PostgreSQL, MinIO (S3-compatible) | **OCI k3s** *(future)* | Experiment tracking, model registry, artifact store |
| 5 | Prometheus | `https://prometheus.traders.app` | Prometheus | **OCI k3s** *(future)* | Metrics collection, alerting rules |
| 6 | Telegram Bridge | `@TradersAppBot` (Telegram only) | Node.js, Telegram Bot API | **OCI k3s** | Human-in-the-loop alerts, signal notifications |

> **Historical note:** This table reflects the archived OCI Always Free k3s plan. `docs/TODO_MASTER_LIST.md` and `docs/P26_Contabo_Deployment_Plan.md` are the authoritative sources for the active Contabo production path.

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
| Uptime target | **99.0%** | OCI Always Free single-node design | Excludes k3s node reboots; see `docs/STAGE_P_24X7_EXECUTION_CHECKLIST.md` |
| Paper trade rule | **Mandatory** | Human enforcement | All signals paper-traded 1 full week before live use |

---

## 4. Public URLs (Final)

| Service | URL | Status |
|---------|-----|--------|
| Frontend | `https://traders.app` | Pending DNS propagation |
| BFF | `https://bff.traders.app` | Pending DNS propagation |
| ML Engine | `https://api.traders.app` | Pending DNS propagation |
| MLflow | `https://mlflow.traders.app` | Pending — deferred to future Stage P |
| Prometheus | `https://prometheus.traders.app` | Pending — deferred to future Stage P |
| Telegram Bridge | `https://t.me/TradersAppBot` | Active |

> **DNS Setup Reference:** `docs/STAGE_P_DNS_SETUP.md`
> **Activation Proof:** `docs/STAGE_P_PRODUCTION_ACTIVATION_PROOF.md`

---

## 5. Recovery Playbook

### 5.1 Roll Back a Bad Core Deploy (OCI k3s via GitHub Actions)

**Via GitHub Actions (preferred):**
1. Go to `github.com/FXGUNIT/TradersApp/actions` → find the failing workflow run.
2. Click the run → **"Re-run all jobs"** — CI will rebuild and redeploy.
3. To force a known-good image: push a revert commit or tag, then trigger re-run.

**Via kubectl on OCI node (emergency):**
```bash
# SSH to OCI node
ssh opc@144.24.112.249

# Roll back to last known-good deployment
kubectl --kubeconfig /tmp/k3s_external.yaml rollout undo deployment/<name> -n tradersapp

# Check rollout status
kubectl --kubeconfig /tmp/k3s_external.yaml rollout status deployment/<name> -n tradersapp

# If cluster is unreachable, restart k3s first
sudo systemctl restart k3s
sleep 30
kubectl --kubeconfig /tmp/k3s_external.yaml rollout undo deployment/<name> -n tradersapp
```

**What gets rolled back:** The named Deployment only. Other services in the tradersapp namespace are unaffected.

---

### 5.2 Roll Back via Git Auto-Backup (`scripts/auto_backup.py`)

```bash
# Step 1: List available backup tags
git tag --list 'backup/*'

# Step 2: Identify the last known-good backup tag
git log 'backup/<tag>' --oneline -5

# Step 3: Create a restoration branch (do NOT work on main directly)
git checkout -b restore/$(date +%Y%m%d) main

# Step 4: Merge or reset to the backup tag
git reset --hard 'backup/<last-good-tag>'

# Step 5: Push the restored branch — CI will rebuild images and redeploy
git push origin restore/$(date +%Y%m%d)

# Step 6: Verify health checks pass
# Reference: `.github/workflows/monitor.yml`
```

**Emergency full-repo rollback:**
```bash
# Safer — creates a new revert commit
git revert HEAD
# OR immediate hard reset (emergency only):
git reset --hard 'backup/<last-good-tag>'
git push --force origin main    # DANGEROUS — notifies all contributors
```

**What gets rolled back:** The entire application stack via rebuilt images. All services in `tradersapp` namespace are affected.

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
| GitHub Actions CI/CD | `.github/workflows/deploy-k8s.yml` | Deploy failure, container crash loops |
| Telegram Bridge | `@TradersAppBot` | Human-in-the-loop signal alerts |

> **Alert routing:** All alerts funnel through the `.github/workflows/monitor.yml` health-check workflow. If the monitor workflow fails 3 consecutive times, a GitHub Actions incident is raised and FXGUNIT is notified via Discord webhook.

> **PagerDuty / Slack integration:** Not currently configured. FXGUNIT receives alerts via Discord as the sole fan-out mechanism.

---

## 7. Sign-Off

### Certificate of Production Readiness

This document certifies that **TradersApp** has completed Stage P deployment and is approved for production use as of **2026-04-16**.

All gates have been cleared:
- [x] Topology frozen (OCI k3s on E2.1.Micro — `docs/P01_TOPOLOGY_FREEZE.md`)
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
