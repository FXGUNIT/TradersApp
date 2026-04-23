# TODO Master List
**Last Updated:** 2026-04-24
**Status:** P26 ACTIVE — Contabo VPS + Docker Compose is the production path
**Based on:** Stage P production deployment + Session Redesign + ML Research Foundation



<!-- master-progress:start -->
## Progress Dashboard
Generated: `2026-04-24 01:42`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Master Backlog  97.2%  [#######################-]
Tasks          done 171 | in progress 000 | blocked 000 | todo 005 | total 176
```

How to read this:
- `Master Backlog` counts every checkbox task across Stage P, Stage S, and ML research.
- Tier bars are strategic buckets and can overlap; phase bars are the exact checklist counts.

### By Area

| Area | Tasks | Progress | Status |
|---|---|---:|---|
| Stage P | [116/121] |  95.9% | PENDING |
| Stage S | [47/47] | 100.0% | DONE |
| ML Research | [8/8] | 100.0% | DONE |

### By Tier

| Tier | Scope | Progress | Status |
|---|---|---:|---|
| TIER 1 | Stage P overall |  95.9% | PENDING |
| TIER 2 | Active Contabo production path | 100.0% | DONE |
| TIER 3 | Archived OCI fallback / evidence |   0.0% | DONE |
| TIER 4 | Stage S + ML backlog | 100.0% | DONE |

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
| P10 - Stateful Services Inside Free Limits ✅ DONE | [5/5] | 100.0% | DONE |
| P14 - Observability ✅ DONE | [3/3] | 100.0% | DONE |
| P17 - Documentation Alignment ✅ DONE | [4/4] | 100.0% | DONE |
| P18 - Windows Desktop Architecture Freeze | [5/5] | 100.0% | DONE |
| P19 - Windows Installer Wizard | [5/5] | 100.0% | DONE |
| P20 - Desktop Auth, Access Control, and Admin Kill Switch | [5/5] | 100.0% | DONE |
| P21 - Self-Update System | [5/5] | 100.0% | DONE |
| P22 - Desktop Security and IP Hardening | [5/5] | 100.0% | DONE |
| P23 - 4 GB Performance and Compatibility Certification | [0/5] |   0.0% | PENDING |
| P24 - Windows Release Readiness and Docs Alignment ✅ DONE | [5/5] | 100.0% | DONE |
| P26 - Contabo VPS Docker Compose Production Path 🔴 ACTIVE | [32/32] | 100.0% | DONE |
| S1 - Trading Session Config Foundation | [11/11] | 100.0% | DONE |
| S2 - BFF Multi-Instrument Routing | [7/7] | 100.0% | DONE |
| S3 - Frontend Dashboard Redesign | [13/13] | 100.0% | DONE |
| S4 - Options Module (Greenfield) | [7/7] | 100.0% | DONE |
| S5 - Economic Calendar & Expiry Calendar | [5/5] | 100.0% | DONE |
| S6 - Database + Trade Logging | [4/4] | 100.0% | DONE |
| ML1 - Volatility Surface建模 (Bergomi-like) | [1/1] | 100.0% | DONE |
| ML2 - HMM Regime Detection (upgrade from FP-FK) | [1/1] | 100.0% | DONE |
| ML3 - Anomalous Diffusion (Lévy processes) | [1/1] | 100.0% | DONE |
| ML4 - Mamba Sequence Model | [1/1] | 100.0% | DONE |
| ML5 - PFHedge for Greeks-aware hedging | [1/1] | 100.0% | DONE |
| ML6 - Alpha Signal Ensemble | [1/1] | 100.0% | DONE |
| ML7 - Continual Learning (EWC + replay buffer) | [1/1] | 100.0% | DONE |
| ML8 - Backtesting rig (kernc-backtesting) | [1/1] | 100.0% | DONE |

<!-- master-progress:end -->

---

## EXECUTION PRIORITY

### TIER 1 — ACTIVE NOW: canonical pages.dev frontend + Contabo runtime proof
The canonical public frontend is `https://tradergunit.pages.dev/`. Keep Pages healthy, keep the Contabo runtime proof hosts green, and do not block Stage P on `is-a.dev` unless a future hostname migration is explicitly reopened.

### TIER 2 — STAGING: performance hardening + k6 envelope capture
Fallback public reachability is already green on `sslip.io`. The next technical work is reducing the `bff_ml_health` failure burst and keeping better public-proof artifacts ready for the final domain cutover.

### TIER 3 — historical OCI archive / rollback path
The archived OCI fallback checklists were removed from this live master list. If that path is ever reopened, use the archived runbooks and recovery notes instead of treating OCI work as current backlog.

### TIER 4 — Backend ML Improvements
All Stages S1–S6, ML1–ML8 are background. Implement carefully, update live app when ready.

---

## PRODUCTION CONSTRAINTS

- Production topology is Contabo VPS single-host Docker Compose. OCI k3s is archival evidence and fallback only.
- The canonical public frontend is `tradergunit.pages.dev`. Do not treat `traders.app` or `tradergunit.is-a.dev` as the active production target in this repo unless that plan is explicitly reopened.
- Do not cut app features to fit the server. Reduce infrastructure overhead first; keep trading logic, accuracy checks, and robustness requirements intact.
- Robustness on a single VPS means deterministic boot, repeatable deploys, working health checks, backups, and recovery procedures. It does not imply multi-node HA.
- Public runtime services currently terminate on the Contabo VPS edge via the `sslip.io` proof hosts. The user-facing frontend entry point is `tradergunit.pages.dev`.

---

## STAGE P — Production Deployment (Live 24x7 on Contabo VPS + Docker Compose)
*Target: GitHub Actions → Cloudflare Pages canonical frontend (`tradergunit.pages.dev`) + single Contabo VPS runtime edge for `bff` and `api`*

### Current Checkpoint - 2026-04-22
- Production target is now Contabo VPS, not OCI k3s
- Repo-side Contabo deployment assets are the active workstream: Compose bundle, reverse proxy, bootstrap scripts, runtime env builder, and GitHub Actions deploy workflow
- Repo-side public verification is now wired three ways: local script, dedicated public-edge k6 suite, and GitHub Actions verification workflow
- OCI fallback checklists were removed from this live master list; archived runbooks remain available if that branch is ever reopened
- `tradergunit.pages.dev` is now the canonical public frontend and must be treated as the default public URL
- Contabo runtime proof remains on the current `sslip.io` host family:
  - `173.249.18.14.sslip.io`
  - `bff.173.249.18.14.sslip.io`
  - `api.173.249.18.14.sslip.io`
- The earlier `is-a.dev` cutover path is retired for the active production plan and should not block Stage P
- Success now means: `git push main` refreshes the Pages root, keeps the Contabo runtime proof hosts healthy, and preserves one clear public-host contract without laptop involvement


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

### Archived OCI / A1 fallback scope
The old OCI recovery backlog, OCI ingress and DNS follow-ons, and the Ampere A1 fallback checklist were removed from this live master list because they are not actionable on the current Contabo production path.

If that branch is ever reopened, use the archived references instead:
- `docs/OCI-DEPLOYMENT-RUNBOOK.md`
- `docs/SETUP.md`
- `docs/STAGE_P_DNS_SETUP.md`
- `docs/STAGE_P_24X7_EXECUTION_CHECKLIST.md`

### P26 — Contabo VPS Docker Compose Production Path 🔴 ACTIVE
*Single-host Contabo VPS with GitHub Actions deployment is the target production architecture.*

**Runbook:** See `docs/P26_Contabo_Deployment_Plan.md`
**Progress snapshot (2026-04-24):** `P26` is complete. The remaining live Stage P backlog is the Windows desktop certification work in `P23`.

#### P26 — Architecture Freeze
- [x] Freeze production target as `Contabo VPS` with `Docker Compose`, not OCI k3s
- [x] Freeze production delivery model as `GitHub Actions -> GHCR -> Contabo SSH deploy`
- [x] Freeze public host layout as an approved project frontend host plus matching `bff` and `api` hosts on the Contabo edge
- [x] Keep OCI k3s artifacts in the repo as rollback/reference only, not as the default path

#### P26 — Repo-Side Contabo Execution
- [x] Create a dedicated Contabo runtime bundle with Compose, reverse proxy, and server-local configs
- [x] Create an idempotent Contabo bootstrap script for a fresh Ubuntu/Debian VPS
- [x] Create an idempotent Contabo deploy script that updates the runtime bundle, pulls GHCR images, and restarts the stack safely
- [x] Create a runtime env builder that turns Infisical or direct env secrets into a server-ready `.env`
- [x] Create a dedicated GitHub Actions Contabo deployment workflow
- [x] Guard the old auto-production k3s path so Contabo can become the active deploy target without deleting the legacy workflow
- [x] Document the Contabo production runbook, secrets contract, and cutover steps
- [x] Create a dedicated Contabo public verification harness for DNS, TLS, and public health evidence
- [x] Create a Contabo public-edge k6 suite for first real concurrency-envelope capture
- [x] Create a manual GitHub Actions verification workflow for off-box public proof capture
- [x] Tighten the remote deploy smoke checks so localhost health explicitly covers `frontend`, `bff`, `ml-engine`, `analysis-service`, and `redis`

#### P26 — Live Cutover ✅ DONE
- [x] Contabo VPS is bought and running — public IP `173.249.18.14`
- [x] Add GitHub secret: `CONTABO_SSH_KEY` (private SSH key content)
- [x] Add GitHub secret: `CONTABO_VPS_HOST` (VPS public IP address)
- [x] Add GitHub secret: `CONTABO_VPS_USER` (`root`)
- [x] Add GitHub variables: `PRODUCTION_DEPLOY_PLATFORM=contabo`, `CONTABO_DOMAIN=<current placeholder>`, `CONTABO_APP_ROOT=/opt/tradersapp`, `INFISICAL_PROJECT_ID`
- [x] VPS docker-compose fixed: analysis-service command path corrected (`bff/analysis-server.mjs` → `analysis-server.mjs`)
- [x] REPO_ROOT fixed in `analysis-server.mjs` and `analysisTransport.mjs` — proto resolves to `/app/proto/` in container (commit `f0079b9e` / `bbee2a5d`)
- [x] New BFF image pulled to VPS (`f0079b9e24411297732a0151e7d27b129ced8819`) — proto path now resolves correctly
- [x] All 5 core services locally healthy: `redis` ✅ `ml-engine` ✅ `analysis-service` ✅ `bff` ✅ `frontend` ✅ (2026-04-21 ~09:25 UTC)
- [x] GitHub deploy-contabo workflow confirmed functional via manual SSH — `docker compose up` succeeds on VPS
- [x] GitHub deploy-contabo `workflow_run` trigger replaced with `repository_dispatch` — CI now calls the repository dispatch endpoint with commit SHA payload so `deploy-contabo.yml` receives the expected automatic-deploy context (commit `4221c20a`)
- [x] Automatic/manual `Deploy to Contabo VPS` bootstrap path stabilized on Contabo after image pushes; workflow run `24723298075` first passed end-to-end on commit `053289b6`, and the April 22 edge-readiness regression was re-fixed by commit `84eb0ca6` with workflow run `24769157865` passing end-to-end again
- [x] k6 public-edge verification now records first-envelope capture separately from threshold pass/fail
- [x] Run the Contabo public-edge k6 suite and record the first concurrency envelope — fallback-host evidence exists for both the first baseline and the 2026-04-23 follow-up run; latest results show `edge_health` and `bff_health` green, `ml_predict` p95 improved to about `1277ms`, and `/ml/health` is now treated as an expected degraded state when the ML engine reports missing training/candle data rather than as a generic transport regression
- [x] **DOMAIN CONTRACT ALIGNED** — `tradergunit.pages.dev` is the canonical public frontend, and the current Contabo runtime proof family remains the `sslip.io` host set until a deliberate future hostname migration is chosen
- [x] Confirm public health for `https://tradergunit.pages.dev/`, `https://bff.173.249.18.14.sslip.io/health`, and `https://api.173.249.18.14.sslip.io/health` after workflow/default-host alignment — validated `2026-04-24` via `.artifacts/pages-root/manual-runtime-verification.json`, `.artifacts/pages-root/manual-browser-verification.json`, and `.artifacts/pages-root/manual-summary.md` (all checks passed, no fallback hosts used)
- [x] Archive the final OCI node details after Contabo proved a clean redeploy cycle and fallback-host public readiness; see `docs/OCI-DEPLOYMENT-RUNBOOK.md` (2026-04-23)

Fallback-host note: `sslip.io` hosts (`173.249.18.14.sslip.io`) remain the active Contabo runtime proof surface. The canonical public frontend is `https://tradergunit.pages.dev/`.

### P10 — Stateful Services Inside Free Limits ✅ DONE
- [x] Audit each stateful component and classify it as required-for-production or removable-from-runtime
  *(PostgreSQL, MLflow, MinIO, Kafka, Feast, Triton, vLLM, Keycloak all disabled in `values.minimal.yaml`)*
- [x] Redis confirmed ephemeral (`persistence.enabled: false`, `emptyDir` cache) — not source-of-truth
- [x] No stale PVC baggage in `tradersapp-deployments.yaml` (the direct-apply CI manifest has zero PVCs)
- [x] `k8s/base/storage.yaml` has 4 PVCs (`ml-models-pvc`, `ml-state-pvc`, `mlflow-artifacts-pvc`, `redis-pvc`) — these are NOT in the direct-apply CI path
- [x] Defer MLflow/MinIO persistence until a genuinely free durable path is proven
  *(MLflow disabled in values.minimal.yaml — tracked as future Stage P improvement if RAM allows)*

### P14 — Observability ✅ DONE
> Note: Contabo edge health is now verified. Jaeger OTLP spam is disabled in ml-engine. GitHub Actions log monitoring + webhook alerts are the current path.
- Prometheus + Grafana stack too heavy for E2.1.Micro (1GB RAM) — skipped for Contabo single-host
- [x] Deploy lightweight alternatives: GitHub Actions log streaming (CI logs + artifact logs)
- [x] Smoke test monitoring via GitHub Actions on each deploy:  (workflow_dispatch)
- [x] Slack/Discord/Telegram alerts via CI/CD post-deploy hook:  updated (2026-04-23)

### P17 — Documentation Alignment ✅ DONE
- [x] Rewrite or archive any Stage P docs that still reference Railway/Vercel as the production path
- [x] Make this master TODO the source of truth for the free-only production architecture
- [x] Update DNS/TLS runbooks to match the current registrar + OCI ingress plan
- [x] **Docs updated this session (5/5):**
  - `docs/GO_LIVE_CERTIFICATE.md` — topology table, SLO, alert channels, rollback sections fully rewritten for OCI k3s
  - `docs/DEPLOYMENT.md` — infrastructure overview, OCI k3s setup, CI/CD, secrets, rollback sections rewritten
  - `docs/STAGE_P_DNS_SETUP.md` — DNS targets changed from Railway/Vercel to OCI k3s node IP (144.24.112.249), staging.traders.app deprecated
  - `docs/SETUP.md` — Railway/Vercel setup replaced with OCI k3s bootstrap and Cloudflare DNS steps
  - `docs/STAGE_P_24X7_EXECUTION_CHECKLIST.md` — DNS targets and deploy trigger replaced with OCI kubectl commands

### P18 - Windows Desktop Architecture Freeze
- [x] Freeze TradersApp end-user delivery as a Windows-only thin desktop client
- [x] Lock minimum supported end-user hardware to Windows 10/11 x64, 4 GB RAM, no discrete GPU, internet required
- [x] Keep BFF, ML inference, secrets, and admin enforcement server-side only
- [x] Lock desktop transport to packaged frontend assets talking to `bff.traders.app` and `api.traders.app` over HTTPS
- [x] Preserve the existing React UI/UX inside the Windows desktop shell instead of rewriting the experience natively

### P19 - Windows Installer Wizard
- [x] Add `desktop/windows/TradersApp.Desktop` as the Windows shell built on .NET 8 WPF + WebView2
- [x] Package the frontend into desktop app-local assets using the dedicated desktop web build
- [x] Add `desktop/windows/installer` WiX installer scaffolding for install, repair, uninstall, and shortcuts
- [x] Include WebView2 prerequisite detection plus Evergreen bootstrapper/offline runtime support
- [x] Support silent install and upgrade-friendly install paths for Windows deployments

### P20 - Desktop Auth, Access Control, and Admin Kill Switch
- [x] Extend identity session records with desktop metadata: `platform`, `appVersion`, `installId`, `deviceId`, `lastPolicyCheckAt`
- [x] Extend identity status responses with `clientPolicy.minimumDesktopVersion`, `clientPolicy.maintenanceActive`, `clientPolicy.forceLogout`, and `clientPolicy.reason`
- [x] Reuse the existing identity/session model instead of creating a parallel desktop auth backend
- [x] Revoke all active user sessions when an admin blocks that user
- [x] Force the desktop shell to sign out blocked, locked, maintenance-disabled, or minimum-version-rejected clients

### P21 - Self-Update System
- [x] Integrate NetSparkle signed appcast updates into the Windows shell
- [x] Support both automatic signed-feed checks and manual signed package import
- [x] Reject unsigned, corrupted, or downgraded update packages
- [x] Support restart-safe update handoff after download and install
- [x] Publish signed update metadata and release artifacts through GitHub Releases

### P22 - Desktop Security and IP Hardening
- [x] Strip source maps and release debug surfaces from the desktop web bundle
- [x] Store remembered desktop session material using DPAPI-backed secure storage in the shell
- [x] Block arbitrary top-level external navigation from the desktop WebView2 host
- [x] Keep secrets, model weights, and admin authority out of shipped desktop assets
- [x] Publish SHA-256 hashes, SBOM outputs, and malware/dependency scan results for desktop releases

### P23 - 4 GB Performance and Compatibility Certification
- Repo-side certification harness is now `scripts/windows/certify-desktop-performance.ps1`; it emits JSON/Markdown evidence for shell startup, idle RAM, OCR lazy-loading, GPU-free payload, and child-process checks
- Latest local baseline evidence was captured on `2026-04-22` at `.artifacts/windows/p23/desktop-p23-certification-20260422-164945.{json,md}`: shell ready `5.23s`, idle working set about `16.5 MB`, private memory about `3.3 MB`, and no child sidecar processes observed. This is useful prep evidence, but it is not the final 4 GB reference-machine sign-off.
- Full `P23` sign-off still requires manual runs on Windows 10 x64 and Windows 11 x64 `4 GB RAM` reference machines plus degraded-network and forced-logout proof
- [ ] Validate cold start to login screen at `<= 8s` on Windows 10/11 x64 4 GB reference machines
- [ ] Validate idle RAM at `<= 500 MB` after the shell and web UI fully load
- [ ] Confirm OCR and heavy modules remain lazy-loaded and do not require a discrete GPU
- [ ] Validate degraded-network handling, reconnect flow, and forced logout behavior on desktop
- [ ] Confirm the desktop release never starts local BFF or ML sidecar services

### P24 - Windows Release Readiness and Docs Alignment ✅ DONE
- [x] Add a Windows release workflow for building, signing, hashing, and publishing desktop artifacts
- [x] Add install, update, rollback, and uninstall runbooks for the Windows desktop client
- [x] Add QA/UAT checks for install, login, admin block, forced logout, self-update, repair, and uninstall
- [x] Keep desktop rollout blocked on both backend 24x7 readiness and signed desktop release readiness
- [x] Keep Stage P as the only section updated for the Windows desktop rollout

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
- [x] S1-01 — Create `ml-engine/config/trading_sessions.yaml`
- [x] S1-02 — Create `ml-engine/infrastructure/timezone_utils.py`
- [x] S1-03 — Create `ml-engine/infrastructure/session_state_machine.py`
- [x] S1-04 — Create `ml-engine/infrastructure/session_loader.py`
- [x] S1-05 — Update `ml-engine/config.py`
- [x] S1-06 — Update `ml-engine/features/feature_pipeline.py`
- [x] S1-07 — Update `ml-engine/session/session_probability.py`
- [x] S1-08 — Update `ml-engine/models/session/time_probability.py`
- [x] S1-09 — Update `ml-engine/data/schema.sql`
- [x] S1-10 — Add `infrastructure/` to `ml-engine/` directory
- [x] S1-11 — Write DST transition test suite

### Phase S2 — BFF Multi-Instrument Routing
- [x] S2-01 — Create `bff/services/instrumentRegistry.mjs`
- [x] S2-02 — Create `bff/services/circuitBreakerRegistry.mjs`
- [x] S2-03 — Rewrite `bff/routes/consensusRoutes.mjs`
- [x] S2-04 — Create `bff/routes/calendarRoutes.mjs`
- [x] S2-05 — Register routes in `bff/server.mjs`
- [x] S2-06 — Update `bff/services/consensusEngine.mjs`
- [x] S2-07 — Create `bff/services/calendarService.mjs`

### Phase S3 — Frontend Dashboard Redesign
- [x] S3-01 — Create `src/features/dashboard/ActiveInstrumentContext.jsx`
- [x] S3-02 — Create `src/features/dashboard/InstrumentSwitcher.jsx`
- [x] S3-03 — Create `src/features/dashboard/MarketTimelineClock.jsx`
- [x] S3-04 — Create `src/features/dashboard/SessionStatusPanel.jsx`
- [x] S3-05 — Create `src/features/calendar/EventCalendarCompact.jsx`
- [x] S3-06 — Create `src/features/calendar/ExpiryCalendarPanel.jsx`
- [x] S3-07 — Redesign `src/pages/CollectiveConsciousness.jsx`
- [x] S3-08 — Create `src/pages/CollectiveConsciousness.css`
- [x] S3-09 — Update `src/features/consensus/consensusGateway.js`
- [x] S3-10 — Create `src/services/calendarGateway.js`
- [x] S3-11 — Update `src/features/consensus/SessionProbabilityPanel.jsx`
- [x] S3-12 — Create pre-session briefing component
- [x] S3-13 — Create `src/features/dashboard/InstrumentQuickStats.jsx`

### Phase S4 — Options Module (Greenfield)
- [x] S4-01 — Create `src/features/options/optionsGateway.js` (Dhan API)
- [x] S4-02 — Create `src/features/options/OptionsStrikePanel.jsx`
- [x] S4-03 — Create `src/features/options/GreeksDisplayPanel.jsx`
- [x] S4-04 — Create `src/features/options/ExpiryAdvisor.jsx`
- [x] S4-05 — Create `src/features/options/PositionRiskCard.jsx`
- [x] S4-06 — Create `src/features/options/VolRegimeIndicator.jsx`
- [x] S4-07 — Update position sizing panel for options

### Phase S5 — Economic Calendar & Expiry Calendar
- [x] S5-01 — Create `bff/services/expiryCalendar.mjs`
- [x] S5-02 — Create `ml-engine/calendar/_seeds.py`
- [x] S5-03 — Create `ml-engine/calendar/forex_seeds.py`
- [x] S5-04 — Create `bff/services/forexFactoryScraper.mjs`
- [x] S5-05 — Update `bff/services/breakingNewsService.mjs`

### Phase S6 — Database + Trade Logging
- [x] S6-01 — Run ALTER TABLE migration for session metadata
- [x] S6-02 — Create `ml-engine/data/candle_db.py` trade log insert
- [x] S6-03 — Implement partial exit tracking
- [x] S6-04 — Create paper trade log view

---

## STAGES ML1–ML8 — ML Engine Research & Implementation
*See: `ml_engine_research_foundation.md` for full reading list and architecture*

- [x] ML1 — Volatility Surface建模 (Bergomi-like)
- [x] ML2 — HMM Regime Detection (upgrade from FP-FK)
- [x] ML3 — Anomalous Diffusion (Lévy processes)
- [x] ML4 — Mamba Sequence Model
- [x] ML5 — PFHedge for Greeks-aware hedging
- [x] ML6 — Alpha Signal Ensemble
- [x] ML7 — Continual Learning (EWC + replay buffer)
- [x] ML8 — Backtesting rig (kernc-backtesting)

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
Generated: `2026-04-24 01:42`  -  Run `python scripts/update_todo_progress.py --once` to update

```text
Stage P Backlog  95.9%  [#######################-]
Sections        done 020 | active 000 | blocked 000 | archived 000 | pending 001 | total 022
Checklist       done 116 | open 005 | total 121
```

| Section | Tasks | Progress | Status |
|---|---|---:|---|
| P01 - OCI Compute Instance ✅ DONE | [4/4] | 100.0% | DONE |
| P02 - k3s Installation & Configuration ✅ DONE | [6/6] | 100.0% | DONE |
| P03 - k3s Auto-Restart on Boot ✅ DONE | [6/6] | 100.0% | DONE |
| P04 - OCI Security Configuration ✅ DONE | [3/3] | 100.0% | DONE |
| P05 - kubeconfig Secret (KUBECONFIG_B64) ✅ DONE | [4/4] | 100.0% | DONE |
| P06 - CI/CD Pipeline (`deploy-k8s.yml`) DONE - minimal direct-apply path | [12/12] | 100.0% | DONE |
| P07 - k3s Namespace + Secrets Bootstrap ✅ DONE | [3/3] | 100.0% | DONE |
| P08 - Helm Chart Values ✅ DONE | [4/4] | 100.0% | DONE |
| P26 - Architecture Freeze | [4/4] | 100.0% | DONE |
| P26 - Repo-Side Contabo Execution | [11/11] | 100.0% | DONE |
| P26 - Live Cutover ✅ DONE | [17/17] | 100.0% | DONE |
| P10 - Stateful Services Inside Free Limits ✅ DONE | [5/5] | 100.0% | DONE |
| P14 - Observability ✅ DONE | [3/3] | 100.0% | DONE |
| P17 - Documentation Alignment ✅ DONE | [4/4] | 100.0% | DONE |
| P18 - Windows Desktop Architecture Freeze | [5/5] | 100.0% | DONE |
| P19 - Windows Installer Wizard | [5/5] | 100.0% | DONE |
| P20 - Desktop Auth, Access Control, and Admin Kill Switch | [5/5] | 100.0% | DONE |
| P21 - Self-Update System | [5/5] | 100.0% | DONE |
| P22 - Desktop Security and IP Hardening | [5/5] | 100.0% | DONE |
| P23 - 4 GB Performance and Compatibility Certification | [0/5] |   0.0% | PENDING |
| P24 - Windows Release Readiness and Docs Alignment ✅ DONE | [5/5] | 100.0% | DONE |

<!-- live-status:end -->
