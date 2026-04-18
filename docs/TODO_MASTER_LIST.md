# TODO Master List
**Last Updated:** 2026-04-19
**Based on:** Stage P production deployment + Session Redesign + ML Research Foundation



<!-- master-progress:start -->
## Progress Dashboard
Generated: `2026-04-19 04:03`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Master Backlog  30.7%  [#######-----------------]
Tasks          done 042 | in progress 000 | blocked 000 | todo 095 | total 137
```

How to read this:
- `Master Backlog` counts every checkbox task across Stage P, Stage S, and ML research.
- Tier bars are strategic buckets and can overlap; phase bars are the exact checklist counts.

### By Area

| Area | Tasks | Progress | Status |
|---|---|---:|---|
| Stage P | [42/82] |  51.2% | CURRENT BLOCKER |
| Stage S | [0/47] |   0.0% | PENDING |
| ML Research | [0/8] |   0.0% | PENDING |

### By Tier

| Tier | Scope | Progress | Status |
|---|---|---:|---|
| TIER 1 | Stage P rollout path |  51.2% | CURRENT BLOCKER |
| TIER 2 | Bootstrap + minimal core |  50.0% | CURRENT BLOCKER |
| TIER 3 | OCI ingress + DNS cutover |   0.0% | BLOCKED |
| TIER 4 | Stage S + ML backlog |   0.0% | PENDING |

### By Phase

| Phase | Tasks | Progress | Status |
|---|---|---:|---|
| P01 - OCI Compute Instance ✅ DONE | [4/4] | 100.0% | DONE |
| P02 - k3s Installation & Configuration ✅ DONE | [6/6] | 100.0% | DONE |
| P03 - k3s Auto-Restart on Boot ✅ DONE | [6/6] | 100.0% | DONE |
| P04 - OCI Security Configuration ✅ DONE | [3/3] | 100.0% | DONE |
| P05 - kubeconfig Secret (KUBECONFIG_B64) ✅ DONE | [4/4] | 100.0% | DONE |
| P06 - CI/CD Pipeline (`deploy-k8s.yml`) DONE - minimal direct-apply path | [12/12] | 100.0% | DONE |
| P07 - k3s Namespace + Secrets Bootstrap ✅ DONE | [3/3] | 100.0% | DONE |
| P08 - Helm Chart Values ✅ DONE | [4/4] | 100.0% | DONE |
| P09 - Core Deployment CURRENT BLOCKER | [0/7] |   0.0% | CURRENT BLOCKER |
| P10 - Stateful Services Inside Free Limits 🔴 KNOWN ISSUE | [0/5] |   0.0% | KNOWN ISSUE |
| P11 - Ingress / External Access BLOCKED BY P09 | [0/6] |   0.0% | BLOCKED |
| P12 - DNS + TLS on Current Registrar ⏳ BLOCKED BY P11 | [0/5] |   0.0% | BLOCKED |
| P13 - Frontend on OCI k3s BLOCKED BY P11 | [0/4] |   0.0% | BLOCKED |
| P14 - Observability 🔴 KNOWN ISSUE | [0/3] |   0.0% | KNOWN ISSUE |
| P15 - Backup & Rollback ⏳ BLOCKED BY P09 | [0/3] |   0.0% | BLOCKED |
| P16 - Go-Live Sign-Off 🔴 BLOCKED BY P09 | [0/4] |   0.0% | BLOCKED |
| P17 - Documentation Alignment ⏳ PENDING | [0/3] |   0.0% | PENDING |
| S1 - Trading Session Config Foundation | [0/11] |   0.0% | PENDING |
| S2 - BFF Multi-Instrument Routing | [0/7] |   0.0% | PENDING |
| S3 - Frontend Dashboard Redesign | [0/13] |   0.0% | PENDING |
| S4 - Options Module (Greenfield) | [0/7] |   0.0% | PENDING |
| S5 - Economic Calendar & Expiry Calendar | [0/5] |   0.0% | PENDING |
| S6 - Database + Trade Logging | [0/4] |   0.0% | PENDING |
| ML1 - Volatility Surface建模 (Bergomi-like) | [0/1] |   0.0% | PENDING |
| ML2 - HMM Regime Detection (upgrade from FP-FK) | [0/1] |   0.0% | PENDING |
| ML3 - Anomalous Diffusion (Lévy processes) | [0/1] |   0.0% | PENDING |
| ML4 - Mamba Sequence Model | [0/1] |   0.0% | PENDING |
| ML5 - PFHedge for Greeks-aware hedging | [0/1] |   0.0% | PENDING |
| ML6 - Alpha Signal Ensemble | [0/1] |   0.0% | PENDING |
| ML7 - Continual Learning (EWC + replay buffer) | [0/1] |   0.0% | PENDING |
| ML8 - Backtesting rig (kernc-backtesting) | [0/1] |   0.0% | PENDING |

<!-- master-progress:end -->

---

## EXECUTION PRIORITY

### TIER 1 — ACTIVE NOW: Complete k3s CI/CD Pipeline
Push TradersApp from GitHub Actions → k3s on OCI → live at traders.app.
Everything below is blocked by this completing successfully.

### TIER 2 — STAGING: k3s bootstrap + secrets injection
Once CI/CD works, bootstrap namespace + secrets on k3s cluster, then minimal core deploy.

### TIER 3 — DNS + OCI ingress binding
Point `traders.app`, `bff.traders.app`, and `api.traders.app` at the OCI public edge once ingress is stable.

### TIER 4 — Backend ML Improvements
All Stages S1–S6, ML1–ML8 are background. Implement carefully, update live app when ready.

---

## PRODUCTION CONSTRAINTS

- Production topology is OCI Always Free k3s only. Do not depend on Railway, Vercel, or any other paid-hosting path.
- Keep the existing domain, but use the current registrar/DNS provider already attached to `traders.app` instead of adding a new paid platform.
- Do not cut app features to fit the server. Reduce infrastructure overhead first; keep trading logic, accuracy checks, and robustness requirements intact.
- Robustness on free infrastructure means deterministic boot, repeatable deploys, working health checks, and recovery procedures. It does not imply multi-node HA on a single Always Free node.
- Public production hosts must terminate on the OCI/k3s edge: `traders.app`, `bff.traders.app`, and `api.traders.app`.

---

## STAGE P — Production Deployment (Live 24x7 on OCI k3s)
*Target: GitHub Actions → single-node k3s on OCI Always Free → `traders.app` + `bff.traders.app` + `api.traders.app`*

### Current Checkpoint - 2026-04-19
- Latest completed failed deploy: GitHub Actions run `24613991349`
- Active pipeline runs while this TODO is being updated: `24614292140` is at `Deploy Production`, and `24614650418` is still in pre-deploy CI jobs
- Production deploy concurrency is already serialized in CI with `group: deploy-production-main`; upstream test/build jobs can overlap, but the production deploy job is not supposed to run in parallel
- GHCR images are present; `ghcr.io/fxgunit/bff:latest`, `ghcr.io/fxgunit/frontend:latest`, and `ghcr.io/fxgunit/ml-engine:latest` all exist
- The current hard blocker is not missing images; it is node pressure on the OCI free-tier k3s node during the core rollout
- Exact latest failure: the node hit `DiskPressure`, evicted `bff`, `frontend`, `ml-engine`, and `redis`, then applied `node.kubernetes.io/disk-pressure:NoSchedule`, which left replacement pods Pending with `FailedScheduling`
- New mitigation now added in the deploy path: pre-deploy node-pressure recovery deletes failed/evicted pods and, when `DiskPressure` is active, runs a privileged host cleanup job to prune unused k3s/containerd artifacts before retrying
- Windows-to-OCI `kubectl` TLS timeout / handshake problems still exist, but GitHub Actions is reaching the cluster far enough to start real deploys; the cluster is then destabilizing during rollout


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

### P03 — k3s Auto-Restart on Boot ✅ DONE
- [x] Created systemd service for k3s at `/etc/systemd/system/k3s.service`
- [x] Service enabled and running: `systemctl status k3s` shows `active (running)`
- [x] k3s survives containerd restarts via systemd watchdog (Restart=always, RestartSec=10)
- [x] kubeconfig auto-generated at `/tmp/k3s-server.yaml` on boot
- [x] systemd MemoryMax=750M and --kube-apiserver-arg toleration flags added to prevent cascade OOM
- [x] kubeconfig refreshed after k3s restart: `sed 's|127.0.0.1|144.24.112.249|g' /tmp/k3s-server.yaml > /tmp/k3s_external.yaml`

### P04 — OCI Security Configuration ✅ DONE
- [x] TCP 6443 ingress rule in security list `ocid1.securitylist.oc1.ap-mumbai-1.aaaaaaaa2z34lytlitagp454gasqyh4sahcyhwxj27vt4ybe6gditysjtrjq` (0.0.0.0/0)
- [x] Oracle Linux firewalld: `firewall-cmd --add-port=6443/tcp --permanent && firewall-cmd --reload`
- [x] k3s TLS certificate includes `--tls-san=144.24.112.249` (fixes x509 certificate error)

### P05 — kubeconfig Secret (KUBECONFIG_B64) ✅ DONE
- [x] Generate: `sed 's|server: https://127.0.0.1:6443|server: https://144.24.112.249:6443|g' /tmp/k3s-server.yaml | base64 -w0 > /tmp/k3s-b64.txt`
- [x] Download with `ssh -q ... sudo cat /tmp/k3s-b64.txt > localfile` (2>/dev/null to strip stderr)
- [x] Set via: `cat file | gh secret set KUBECONFIG_B64 --repo FXGUNIT/TradersApp`
- [x] After k3s restart: re-generate kubeconfig, re-download, update secret

### P06 - CI/CD Pipeline (`deploy-k8s.yml`) DONE - minimal direct-apply path
- [x] kubeconfig decode fixed, TLS SAN fix, firewalld opened 6443
- [x] `--install` flag added; `--atomic` removed (fails first-deploy with no prior release)
- [x] `.venv-research/` removed from git history (253MB blocking push)
- [x] Stale release cleanup fixed (was deleting namespace - caused "namespace not found" errors)
- [x] Migration job heredoc fixed: `<< 'MIGRATION_YAML'` -> `<< MIGRATION_YAML` (expands $NS/$TAG)
- [x] hpa-watcher.yaml heredoc indentation fixed (closing EOF at 0 spaces -> YAML parse error)
- [x] nginx.conf bff resolver fix (resolver 10.43.0.10 + variable-based proxy_pass)
- [x] k3s systemd service installed (auto-restart on boot) - see P03
- [x] Ingress-nginx installed via SSH on OCI; CI step has intermittent API failures
- [x] `values.minimal.yaml` created for core-4-only deploys
- [x] Production CI now pushes both `latest` and current commit SHA image tags before deploy
- [x] Production CI now deploys the rendered minimal manifest via direct `kubectl apply`

### P07 — k3s Namespace + Secrets Bootstrap ✅ DONE
- [x] Run `scripts/admin/k3s-dev-bootstrap.ps1` via WSL — created all 4 secrets
- [x] Created: `ml-engine-secrets` (16 keys), `tradersapp-secrets` (9 keys), `bff-secrets` (17 keys), `mlflow-runtime-secret` (5 keys)
- [x] All key presence checks passed (JWT_SECRET, BFF_API_KEY, DATABASE_URL, etc.)

### P08 — Helm Chart Values ✅ DONE
- [x] `values.prod.yaml` exists in `k8s/helm/tradersapp/`
- [x] `values.dev.yaml` exists with dev overrides
- [x] `values.minimal.yaml` created — core 4 only (bff, frontend, ml-engine, redis) with pinned SHA tags
- [x] All Docker images tagged with GitHub SHA from CI pipeline

### P09 - Core Deployment CURRENT BLOCKER
- Current hard failure mode on the OCI free node is rollout-time node pressure, not missing GHCR images
  - Run `24613991349` already built and pushed current commit images, then failed during the real production deploy
  - Verified from GHCR: `ghcr.io/fxgunit/bff:latest`, `ghcr.io/fxgunit/frontend:latest`, and `ghcr.io/fxgunit/ml-engine:latest` exist
  - Exact node taint from the failed deploy diagnostics: `node.kubernetes.io/disk-pressure:NoSchedule`
  - Exact node condition from the failed deploy diagnostics: `DiskPressure=True`, `MemoryPressure=False`
  - Exact pod outcome from the failed deploy diagnostics: `bff`, `frontend`, `ml-engine`, and `redis` were evicted with `The node had condition: [DiskPressure]`
  - Exact scheduler outcome from the failed deploy diagnostics: replacement pods stayed Pending with `0/1 nodes are available: 1 node(s) had untolerated taint(s)`
  - Windows-to-OCI `kubectl` TLS / handshake instability is still real, but it is a secondary symptom right now; GitHub Actions is reaching the cluster, and the cluster is collapsing during rollout
  - Fix already applied: `values.minimal.yaml` forces coherent core-only runtime settings (`bff` HTTP transport, `ml-engine` Kafka off, required DB off, security extras off)
  - Fix already applied: core runtime Deployments use `Recreate` in the minimal profile so the node does not schedule two generations at once
  - Fix already applied: production CI builds and pushes current commit SHA images before deploy
  - Fix already applied: production CI deploys the rendered minimal manifest via direct `kubectl apply`
  - Fix already applied: automatic production CI defers `ingress-nginx` + `cert-manager` until after the core runtime stabilizes
  - Fix already applied: `scripts/k8s/recover-node-pressure.sh` now runs before the minimal apply and again on `DiskPressure` retry paths to delete failed pods, prune unused k3s/containerd artifacts, and wait for the node taint to clear
  - Operational note: when the API will not stabilize, the existing cold-restart pattern is still `systemctl restart k3s` and, only if required, clearing the etcd data dir before recreating kubeconfig
- [ ] Inspect and reduce disk usage on the OCI node (`containerd` images, dead sandboxes, evicted pod artifacts, logs, temp files)
- [ ] Clear `node.kubernetes.io/disk-pressure:NoSchedule` and keep it clear through a full minimal rollout
- [ ] values.minimal.yaml direct-apply deploy completes with exactly one Running/Ready pod each for `redis`, `ml-engine`, `bff`, and `frontend`
- [ ] Confirm the cluster is running the current CI commit SHA images for `bff`, `frontend`, and `ml-engine`
- [ ] Verify stale ReplicaSets / invalid-image pods are fully gone after the new cleanup path
- [ ] Smoke tests: `bff /health`, `ml-engine /health`, frontend `http://frontend:80`, `redis-cli ping`
- [ ] KUBECONFIG_B64 secret in GitHub updated after each k3s cold restart

### P10 — Stateful Services Inside Free Limits 🔴 KNOWN ISSUE
- k3s is running with `--disable local-storage`, so standard PVC-backed workloads will not work as-is
- Free-only production cannot assume a paid managed database, object store, or storage provisioner
- [ ] Audit each stateful component and classify it as required-for-production or removable-from-runtime
- [ ] Keep Redis explicitly ephemeral (`emptyDir`) because it is cache, not source-of-truth
- [ ] Remove stale PVC baggage from old experiments (`data-kafka-0`, abandoned Longhorn references, other dead claims)
- [ ] Decide whether PostgreSQL is truly required in the live request path; if yes, fit it into the single-node free design with a documented recovery method
- [ ] Defer any non-essential MLflow/MinIO persistence until a genuinely free durable path is proven

### P11 - Ingress / External Access BLOCKED BY P09
- k3s runs with `--disable traefik --disable servicelb`, so external traffic must be handled explicitly
- Automatic CI no longer bootstraps `ingress-nginx` / `cert-manager` before the core deploy on the free OCI node; edge bootstrap is now a separate post-core action to avoid destabilizing P09
- External access is intentionally downstream of core runtime stability; do not treat ingress as the primary blocker while P09 is still failing on node pressure
- [ ] Standardize on one free edge path: `ingress-nginx` on OCI k3s, not Vercel, Railway, or another proxy dependency
- [ ] Expose `ingress-nginx` on the OCI node with a free-compatible service path once P09 is stable (NodePort is acceptable for debugging; final production path must remain OCI-only)
- [ ] Route `traders.app`, `bff.traders.app`, and `api.traders.app` through the same OCI public IP and ingress controller
- [ ] Keep NodePort only as a temporary debugging fallback, not the final public architecture
- [ ] Prove frontend, BFF, and ML engine all answer through ingress before touching final DNS
- [ ] Ensure the ingress path is compatible with Let's Encrypt / cert-manager challenge flow

### P12 — DNS + TLS on Current Registrar ⏳ BLOCKED BY P11
- Current live mismatch: `traders.app` resolves to the wrong edge, HTTPS is broken, and `api.traders.app` is still NXDOMAIN
- Current authoritative DNS is on the existing registrar nameservers; keep that path instead of introducing another paid DNS layer
- [ ] Fix the apex A record so `traders.app` points to the OCI ingress IP instead of the current wrong edge
- [ ] Create `bff.traders.app` and `api.traders.app` DNS records against the same OCI edge
- [ ] Remove or replace legacy DNS entries that still send traffic to the wrong AWS / old frontend path
- [ ] Issue and validate Let's Encrypt certificates for apex + API/BFF hosts through cert-manager on k3s
- [ ] Verify `https://traders.app`, `https://bff.traders.app/health`, and `https://api.traders.app/health`

### P13 - Frontend on OCI k3s BLOCKED BY P11
- Production frontend must be served from OCI/k3s, not Vercel
- [ ] Remove Vercel from the production go-live path and treat `vercel.json` as non-production only unless explicitly needed for previews
- [ ] Serve the built frontend from the cluster alongside the backend stack
- [ ] Confirm `traders.app` no longer redirects to `stocks.news` or any legacy deployment
- [ ] Re-check CSP, API base URLs, and frontend environment wiring for the OCI-hosted domains

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
- [ ] Manual smoke test: `bff.traders.app/health` and `api.traders.app/health` both return healthy over HTTPS
- [ ] Paper trade for 1 week before any real money
- [ ] Board Room deliberation rule applies to all signals

### P17 — Documentation Alignment ⏳ PENDING
- [ ] Rewrite or archive any Stage P docs that still reference Railway/Vercel as the production path
- [ ] Make this master TODO the source of truth for the free-only production architecture
- [ ] Update DNS/TLS runbooks to match the current registrar + OCI ingress plan

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
Generated: `2026-04-19 04:03`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Active Backlog    0.0%  [------------------------]
Stage Progress  00/00 complete
Task Counts     done 000 | in progress 000 | blocked 000 | todo 000 | total 000
```

| Section | Tasks | Progress | Status |
|---|---|---:|---|


<!-- live-status:end -->
