# TODO Master List
**Last Updated:** 2026-04-17
**Based on:** Stage P production deployment + Session Redesign + ML Research Foundation

---

## EXECUTION PRIORITY

### TIER 1 — ACTIVE NOW: Complete k3s CI/CD Pipeline
Push TradersApp from GitHub Actions → k3s on OCI → live at traders.app.
Everything below is blocked by this completing successfully.

### TIER 2 — STAGING: k3s bootstrap + secrets injection
Once CI/CD works, bootstrap namespace + secrets on k3s cluster, then Helm deploy.

### TIER 3 — DNS + Frontend binding
Point traders.app → OCI public IP via DNS A record once k3s ingress works.

### TIER 4 — Backend ML Improvements
All Stages S1–S6, ML1–ML8 are background. Implement carefully, update live app when ready.

---

## STAGE P — Production Deployment (Live 24x7 on OCI k3s)
*Target: GitHub Actions → k3s (OCI E2.1.Micro) → traders.app*

### P01 — OCI Compute Instance ✅ DONE
- [x] OCI E2.1.Micro at 144.24.112.249 (ap-mumbai-1, Always Free)
- [x] Oracle Linux 8.10 aarch64
- [x] 2 GB swap file added (prevents k3s OOM during install)
- [x] ED25519 SSH key pair generated

### P02 — k3s Installation & Configuration ✅ DONE
- [x] k3s v1.34.6+k3s1 binary installed manually (RPM install OOMs on 1GB RAM)
- [x] 2 GB swap required for k3s runtime on E2.1.Micro
- [x] k3s flags: `--cluster-init --tls-san=144.24.112.249 --disable traefik,servicelb,helm-controller,kube-proxy,cloud-controller,metrics-server,local-storage`
- [x] **CRITICAL:** Do NOT set `KUBECONFIG` env var for k3s server process — causes data dir race condition
- [x] k3s API server accessible on port 6443 (firewalld rule added)
- [x] Node `tradersapp-oci` Ready in k3s cluster

> **k3s startup command (run manually after instance restart):**
> ```bash
> ssh opc@144.24.112.249
> sudo /usr/local/bin/k3s server \
>   --cluster-init \
>   --tls-san=144.24.112.249 \
>   --write-kubeconfig /tmp/k3s-server.yaml \
>   --write-kubeconfig-mode 644 \
>   --disable traefik --disable servicelb \
>   --disable-helm-controller --disable-kube-proxy \
>   --disable-cloud-controller \
>   --disable metrics-server --disable local-storage
> ```

### P03 — k3s Auto-Restart on Boot 🔴 IN PROGRESS
- [ ] Create systemd service for k3s so it survives instance restarts
- [ ] Verify k3s comes up automatically after `sudo reboot`
- [ ] kubeconfig refreshed after each k3s restart (token changes)

### P04 — OCI Security Configuration ✅ DONE
- [x] TCP 6443 ingress rule in security list `ocid1.securitylist.oc1.ap-mumbai-1.aaaaaaaa2z34lytlitagp454gasqyh4sahcyhwxj27vt4ybe6gditysjtrjq` (0.0.0.0/0)
- [x] Oracle Linux firewalld: `firewall-cmd --add-port=6443/tcp --permanent && firewall-cmd --reload`
- [x] k3s TLS certificate includes `--tls-san=144.24.112.249` (fixes x509 certificate error)

### P05 — kubeconfig Secret (KUBECONFIG_B64) ✅ DONE
- [x] Generate: `sed 's|server: https://127.0.0.1:6443|server: https://144.24.112.249:6443|g' /tmp/k3s-server.yaml | base64 -w0 > /tmp/k3s-b64.txt`
- [x] Download with `ssh -q ... sudo cat /tmp/k3s-b64.txt > localfile` (2>/dev/null to strip stderr)
- [x] Set via: `cat file | gh secret set KUBECONFIG_B64 --repo FXGUNIT/TradersApp`
- [x] After k3s restart: re-generate kubeconfig, re-download, update secret

### P06 — CI/CD Pipeline (`deploy-k8s.yml`) 🔴 IN PROGRESS
- [x] kubeconfig decode fixed (SSH stderr pollution with `ssh -q` + 2>/dev/null)
- [x] TLS SAN fix: `--tls-san=144.24.112.249` on k3s server prevents x509 certificate error
- [x] firewalld fix: opened TCP 6443 on Oracle Linux (OCI security list alone not enough)
- [x] `--install` flag added to `helm upgrade` (required for first-time deploy with `--atomic`)
- [x] `.venv-research/` removed from git history via `git-filter-repo` (253MB torch_cpu.dll was blocking push)
- [x] `.venv-research/` added to `.gitignore`

### P07 — k3s Namespace + Secrets Bootstrap ⏳ PENDING
- [ ] Run `scripts/admin/k3s-dev-bootstrap.ps1` via WSL to create tradersapp namespace + secrets
- [ ] Or use GitHub Actions step: kubectl apply secrets from .env.local values
- [ ] Required secrets: `ml-engine-secrets`, `tradersapp-secrets`, `bff-secrets`, `mlflow-runtime-secret`

### P08 — Helm Chart Values ✅ DONE
- [x] `values.prod.yaml` exists in `k8s/helm/tradersapp/`
- [x] `values.dev.yaml` exists with dev overrides
- [x] All Docker images tagged with GitHub SHA from CI pipeline

### P09 — Helm Deployment ⏳ BLOCKED BY P06
- [ ] Helm upgrade runs in CI: `helm upgrade tradersapp ./k8s/helm/tradersapp --install --atomic --wait`
- [ ] Images loaded into k3s containerd from GHCR
- [ ] Wait for rollout: bff, ml-engine, frontend deployments
- [ ] Smoke tests: bff health, ml-engine health, frontend ingress

### P10 — Persistent Storage 🔴 KNOWN ISSUE
- k3s with `--disable local-storage` means no PersistentVolumeClaims work
- PostgreSQL, Redis, MinIO pods will fail if they need PVCs
- **Workaround:** Use `emptyDir` volumes or HostPath for dev; for prod consider NFS backend
- [ ] Assess which services actually need persistent storage
- [ ] Implement `emptyDir` fallback for ml-engine PostgreSQL (data in container, non-persistent)
- [ ] Redis: `emptyDir` for cache only (no persistence needed for dev)
- [ ] MinIO/MLflow: requires persistent storage — deploy NFS provisioner or skip for now

### P11 — Ingress / External Access 🔴 KNOWN ISSUE
- k3s running with `--disable traefik --disable servicelb` — no built-in ingress controller
- [ ] Deploy k8s nginx-ingress or use NodePort service
- [ ] Frontend served at `http://144.24.112.249:30080` (NodePort)
- [ ] BFF served at `http://144.24.112.249:30081` (NodePort)
- [ ] Or deploy MetalLB for LoadBalancer (if supported on E2.1.Micro)
- [ ] Point DNS `traders.app` → `144.24.112.249` once ingress works

### P12 — DNS Configuration ⏳ BLOCKED BY P11
- [ ] Register/manage `traders.app` domain (Cloudflare or Porkbun)
- [ ] A record: `traders.app` → `144.24.112.249`
- [ ] CNAME: `bff.traders.app` → `traders.app`
- [ ] CNAME: `api.traders.app` → `traders.app`
- [ ] TLS: Let's Encrypt cert-manager or Cloudflare origin cert

### P13 — Frontend Vercel Deployment 🔴 REDIRECT NEEDED
- Vercel deploys from `vercel.json` — currently targets Vercel infrastructure
- [ ] Either: Keep Vercel for frontend static hosting + proxy via Cloudflare to OCI k3s
- [ ] Or: Move frontend to k3s alongside backend (NodePort)
- [ ] Update `vercel.json` CSP headers for new domain once live

### P14 — Observability 🔴 KNOWN ISSUE
- Prometheus + Grafana stack too heavy for E2.1.Micro (1GB RAM)
- [ ] Deploy lightweight alternatives: k8s event exporter, GitHub Actions log streaming
- [ ] Smoke test monitoring via GitHub Actions on each deploy
- [ ] Telegram/Discord alerts via CI/CD post-deploy hook

### P15 — Backup & Rollback ⏳ BLOCKED BY P09
- [ ] Test `helm rollback tradersapp` on CI failure
- [ ] Database migration rollback strategy
- [ ] GitHub Actions `on_failure: rollback` job already wired in deploy-k8s.yml

### P16 — Go-Live Sign-Off 🔴 BLOCKED BY P09
- [ ] Manual smoke test: load traders.app, check consensus signal renders
- [ ] Paper trade for 1 week before any real money
- [ ] Board Room deliberation rule applies to all signals

---

## Git History Rewrite — COMPLETED 2026-04-17
- `.venv-research/` (253 MB, contained torch_cpu.dll) removed from all commits via `git-filter-repo`
- GitHub forced-pushed rewritten history: `d20438d7...1e6a5559`
- `.venv-research/` added to `.gitignore`
- All backup tags cleaned up
- **Note:** If you cloned before this rewrite, do `git fetch --all && git reset --hard origin/main`

---

## STAGE S — Trading Session & Dashboard Redesign
*See: `C:\Users\Asus\.claude\plans\sorted-wishing-nebula.md`*

### Phase S1 — Trading Session Config Foundation
- [ ] S1-01 — Create `ml-engine/config/trading_sessions.yaml`
- [ ] S1-02 — Create `ml-engine/infrastructure/timezone_utils.py`
- [ ] S1-03 — Create `ml-engine/infrastructure/session_state_machine.py`
- [ ] S1-04 — Create `ml-engine/infrastructure/session_loader.py`
- [ ] S1-05 — Update `ml-engine/config.py`
- [ ] S1-06 — Update `ml-engine/features/feature_pipeline.py`
- [ ] S1-07 — Update `ml-engine/session/session_probability.py`
- [ ] S1-08 — Update `ml-engine/models/session/time_probability.py`
- [ ] S1-09 — Update `ml-engine/data/schema.sql`
- [ ] S1-10 — Add `infrastructure/` to `ml-engine/` directory
- [ ] S1-11 — Write DST transition test suite

### Phase S2 — BFF Multi-Instrument Routing
- [ ] S2-01 — Create `bff/services/instrumentRegistry.mjs`
- [ ] S2-02 — Create `bff/services/circuitBreakerRegistry.mjs`
- [ ] S2-03 — Rewrite `bff/routes/consensusRoutes.mjs`
- [ ] S2-04 — Create `bff/routes/calendarRoutes.mjs`
- [ ] S2-05 — Register routes in `bff/server.mjs`
- [ ] S2-06 — Update `bff/services/consensusEngine.mjs`
- [ ] S2-07 — Create `bff/services/calendarService.mjs`

### Phase S3 — Frontend Dashboard Redesign
- [ ] S3-01 — Create `src/features/dashboard/ActiveInstrumentContext.jsx`
- [ ] S3-02 — Create `src/features/dashboard/InstrumentSwitcher.jsx`
- [ ] S3-03 — Create `src/features/dashboard/MarketTimelineClock.jsx`
- [ ] S3-04 — Create `src/features/dashboard/SessionStatusPanel.jsx`
- [ ] S3-05 — Create `src/features/calendar/EventCalendarCompact.jsx`
- [ ] S3-06 — Create `src/features/calendar/ExpiryCalendarPanel.jsx`
- [ ] S3-07 — Redesign `src/pages/CollectiveConsciousness.jsx`
- [ ] S3-08 — Create `src/pages/CollectiveConsciousness.css`
- [ ] S3-09 — Update `src/features/consensus/consensusGateway.js`
- [ ] S3-10 — Create `src/services/calendarGateway.js`
- [ ] S3-11 — Update `src/features/consensus/SessionProbabilityPanel.jsx`
- [ ] S3-12 — Create pre-session briefing component
- [ ] S3-13 — Create `src/features/dashboard/InstrumentQuickStats.jsx`

### Phase S4 — Options Module (Greenfield)
- [ ] S4-01 — Create `src/features/options/optionsGateway.js` (Dhan API)
- [ ] S4-02 — Create `src/features/options/OptionsStrikePanel.jsx`
- [ ] S4-03 — Create `src/features/options/GreeksDisplayPanel.jsx`
- [ ] S4-04 — Create `src/features/options/ExpiryAdvisor.jsx`
- [ ] S4-05 — Create `src/features/options/PositionRiskCard.jsx`
- [ ] S4-06 — Create `src/features/options/VolRegimeIndicator.jsx`
- [ ] S4-07 — Update position sizing panel for options

### Phase S5 — Economic Calendar & Expiry Calendar
- [ ] S5-01 — Create `bff/services/expiryCalendar.mjs`
- [ ] S5-02 — Create `ml-engine/calendar/_seeds.py`
- [ ] S5-03 — Create `ml-engine/calendar/forex_seeds.py`
- [ ] S5-04 — Create `bff/services/forexFactoryScraper.mjs`
- [ ] S5-05 — Update `bff/services/breakingNewsService.mjs`

### Phase S6 — Database + Trade Logging
- [ ] S6-01 — Run ALTER TABLE migration for session metadata
- [ ] S6-02 — Create `ml-engine/data/candle_db.py` trade log insert
- [ ] S6-03 — Implement partial exit tracking
- [ ] S6-04 — Create paper trade log view

---

## STAGES ML1–ML8 — ML Engine Research & Implementation
*See: `ml_engine_research_foundation.md` for full reading list and architecture*

- [ ] ML1 — Volatility Surface建模 (Bergomi-like)
- [ ] ML2 — HMM Regime Detection (upgrade from FP-FK)
- [ ] ML3 — Anomalous Diffusion (Lévy processes)
- [ ] ML4 — Mamba Sequence Model
- [ ] ML5 — PFHedge for Greeks-aware hedging
- [ ] ML6 — Alpha Signal Ensemble
- [ ] ML7 — Continual Learning (EWC + replay buffer)
- [ ] ML8 — Backtesting rig (kernc-backtesting)

---

## KEY LESSONS LEARNED (Apr 17, 2026)

### k3s on E2.1.Micro (Always Free, 1GB RAM)
- RPM install OOMs → install binary directly: `curl -sfL https://get.k3s.io | K3S_KEEP_ANSWERS=... sh -` fails; use binary + swap
- 2 GB swap required even for minimal k3s runtime
- Disable as many controllers as possible to reduce memory footprint
- k3s server process must NOT have `KUBECONFIG` env var set

### TLS Certificates
- k3s generates certs for `127.0.0.1`, `10.2.0.61`, `10.43.0.1` by default
- External access (GitHub Actions) requires `--tls-san=144.24.112.249`
- Regenerate kubeconfig after adding TLS SAN (token also changes)

### GitHub Actions kubeconfig
- SSH stderr on Oracle Linux includes warning text that pollutes stdout
- Fix: `ssh -q ... sudo cat file.txt > local.txt 2>/dev/null`
- Set secret via: `cat file | gh secret set SECRET_NAME --repo owner/repo`

### OCI Network
- Security list ingress rules are NOT enough on Oracle Linux
- Must also configure firewalld: `firewall-cmd --add-port=6443/tcp --permanent`

### Git LFS
- `.venv-research/` contained 253 MB torch library → blocked GitHub push
- Solution: `git-filter-repo --path .venv-research --invert-paths`
- Never commit `.venv-research/` or any virtualenv to git


<!-- live-status:start -->
## Live Status
Generated: `2026-04-18 08:20`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Active Backlog    0.0%  [------------------------]
Stage Progress  00/00 complete
Task Counts     done 000 | in progress 000 | blocked 000 | todo 000 | total 000
```

| Section | Tasks | Progress | Status |
|---|---|---:|---|


<!-- live-status:end -->
