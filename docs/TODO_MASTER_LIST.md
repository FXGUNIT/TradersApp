# TODO Master List
**Last Updated:** 2026-04-22
**Status:** P26 ACTIVE — Contabo VPS + Docker Compose is the production path
**Based on:** Stage P production deployment + Session Redesign + ML Research Foundation



<!-- master-progress:start -->
## Progress Dashboard
Generated: `2026-04-22 19:41`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Master Backlog  52.5%  [#############-----------]
Tasks          done 134 | in progress 000 | blocked 000 | todo 121 | total 255
```

How to read this:
- `Master Backlog` counts every checkbox task across Stage P, Stage S, and ML research.
- Tier bars are strategic buckets and can overlap; phase bars are the exact checklist counts.

### By Area

| Area | Tasks | Progress | Status |
|---|---|---:|---|
| Stage P | [134/200] |  67.0% | KNOWN ISSUE |
| Stage S | [0/47] |   0.0% | PENDING |
| ML Research | [0/8] |   0.0% | PENDING |

### By Tier

| Tier | Scope | Progress | Status |
|---|---|---:|---|
| TIER 1 | Stage P rollout path |  67.0% | KNOWN ISSUE |
| TIER 2 | Bootstrap + minimal core |  52.6% | IN PROGRESS |
| TIER 3 | OCI ingress + DNS cutover |   0.0% | PENDING |
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
| P09 - `kubectl apply tradersapp-deployments.yaml` on OCI E2.1.Micro (ARCHIVED — P26 is active) | [23/50] |  46.0% | IN PROGRESS |
| P10 - Stateful Services Inside Free Limits ✅ DONE | [5/5] | 100.0% | DONE |
| P11 - Archived OCI ingress / external access reference | [0/6] |   0.0% | PENDING |
| P12 - Archived OCI DNS + TLS reference | [0/5] |   0.0% | PENDING |
| P13 - Archived OCI frontend hosting reference | [0/4] |   0.0% | PENDING |
| P14 - Observability 🔴 KNOWN ISSUE | [0/3] |   0.0% | KNOWN ISSUE |
| P15 - Archived OCI backup & rollback reference | [0/3] |   0.0% | PENDING |
| P16 - Archived OCI go-live sign-off reference | [0/4] |   0.0% | PENDING |
| P17 - Documentation Alignment ✅ DONE | [4/4] | 100.0% | DONE |
| P18 - Windows Desktop Architecture Freeze | [5/5] | 100.0% | DONE |
| P19 - Windows Installer Wizard | [5/5] | 100.0% | DONE |
| P20 - Desktop Auth, Access Control, and Admin Kill Switch | [5/5] | 100.0% | DONE |
| P21 - Self-Update System | [5/5] | 100.0% | DONE |
| P22 - Desktop Security and IP Hardening | [5/5] | 100.0% | DONE |
| P23 - 4 GB Performance and Compatibility Certification | [0/5] |   0.0% | PENDING |
| P24 - Windows Release Readiness and Docs Alignment ✅ DONE | [5/5] | 100.0% | DONE |
| P25 - Ampere A1 / OVHcloud Migration (Archived Fallback) 🟡 ON HOLD | [0/7] |   0.0% | PENDING |
| P26 - Contabo VPS Docker Compose Production Path 🔴 ACTIVE | [30/32] |  93.8% | IN PROGRESS |
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

### TIER 1 — ACTIVE NOW: Deploy lands + public readiness verification
GitHub Actions deploy with vm.overcommit_memory fix is running. Once it lands, verify `traders.app`, `bff.traders.app`, and `api.traders.app` respond over HTTPS.

### TIER 2 — STAGING: runtime secrets + k6 envelope capture
Once public hosts are confirmed live, run the k6 public-edge suite to capture the first production concurrency envelope. Monitor for 24h stability before any further changes.

### TIER 3 — historical OCI archive / rollback path
P09 and the OCI-only follow-on phases P11-P16 stay here as archival rollback context. Do not treat any OCI phase as required for the current Contabo production path.

### TIER 4 — Backend ML Improvements
All Stages S1–S6, ML1–ML8 are background. Implement carefully, update live app when ready.

---

## PRODUCTION CONSTRAINTS

- Production topology is Contabo VPS single-host Docker Compose. OCI k3s is archival evidence and fallback only.
- `traders.app` is fully on Cloudflare and under repo control. `tradergunit.is-a.dev` (PR pending approval) is an optional supplementary domain — not required for go-live.
- Do not cut app features to fit the server. Reduce infrastructure overhead first; keep trading logic, accuracy checks, and robustness requirements intact.
- Robustness on a single VPS means deterministic boot, repeatable deploys, working health checks, backups, and recovery procedures. It does not imply multi-node HA.
- Public production hosts must terminate on the Contabo VPS edge. Use `sslip.io` fallback hosts only for pre-DNS-proof capture.

---

## STAGE P — Production Deployment (Live 24x7 on Contabo VPS + Docker Compose)
*Target: GitHub Actions → single Contabo VPS → Docker Compose → approved root frontend host + matching `bff` and `api` hosts*

### Current Checkpoint - 2026-04-20
- Production target is now Contabo VPS, not OCI k3s
- Repo-side Contabo deployment assets are the active workstream: Compose bundle, reverse proxy, bootstrap scripts, runtime env builder, and GitHub Actions deploy workflow
- Repo-side public verification is now wired three ways: local script, dedicated public-edge k6 suite, and GitHub Actions verification workflow
- OCI P09, P11-P16, and P25 remain in this file only as historical evidence and fallback, not as the current production plan
- The current hard blocker is resolved: Cloudflare DNS now points `traders.app`, `bff.traders.app`, `api.traders.app` to Contabo. Remaining blocker is the deploy landing with all health fixes applied.
- `traders.app` is under Cloudflare DNS and fully repo-controlled. `tradergunit.is-a.dev` (PR pending) is optional supplementary.
- Success now means: `git push main` builds/pushes images, SSHes to Contabo, runs Docker Compose, and leaves the public hosts healthy without laptop involvement


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

### P09 - Archived OCI recovery checkpoint
> ⚠️ P09 is ARCHIVED. Contabo VPS (P26) is the active production path. Do not work on P09 unless Contabo is abandoned.
- P09 is fully deprecated for active production. E2.1.Micro 1GB RAM cannot run k3s control plane + 4 pods without memory collapse. Ampere A1 Mumbai is capacity-exhausted. See P26 for the active Contabo VPS deployment path.
- No additional P09 work is required for the current Contabo production path. Resume this branch only if Contabo is abandoned or an OCI rollback lab is explicitly requested.

### P25 — Ampere A1 / OVHcloud Migration (Archived Fallback) 🟡 ON HOLD
> ⚠️ ARCHIVED FALLBACK — Contabo is active. This path is closed unless Contabo is abandoned.
*Historical fallback only. Do not treat this as the active production route.*

**Archived note:** the cloud selection work ended with Contabo as the active deployment target because A1 capacity remained unavailable and OCI k3s on E2.1.Micro stayed unstable. Keep the OCI/A1 notes below only as evidence and rollback context.

  - Fix already applied: core runtime Deployments use `Recreate` in the minimal profile so the node does not schedule two generations at once
  - Fix already applied: production CI builds and pushes current commit SHA images before deploy
  - Fix already applied: production CI now renders deterministic staged core manifests from the minimal Helm values, validates each slice, and applies them in the order `redis -> ml-engine -> bff -> frontend`
  - Fix already applied: automatic production CI defers `ingress-nginx` + `cert-manager` until after the core runtime stabilizes
  - Fix already applied: `scripts/k8s/recover-node-pressure.sh` now runs before the minimal apply and again on retry paths; it deletes terminal pods, removes stale kubelet/pod log directories by active pod UID, truncates oversized pod logs, avoids projected service-account mounts, and waits up to 300 seconds for the node taint to clear
  - Fix already applied: the minimal runtime now sets explicit `ephemeral-storage` requests/limits and `emptyDir` size limits for core services to reduce the chance of another uncontrolled disk-pressure cascade
  - Fix now added: when deploy diagnostics show overlayfs snapshot corruption, recovery switches from image pruning to a safer host-side runtime reset using the K3s `k3s-killall.sh` reset path plus `k3s` restart
  - Fix now added: `scripts/k8s/check-oci-core-preflight.sh` blocks the staged deploy if the node still shows pressure conditions or, when SSH metrics are configured, if remote memory, swap, or filesystem thresholds are below the provisional safety floor
  - Fix now added: `scripts/k8s/render-core-minimal-manifests.sh` now emits `05-core-budget.md` and `05-core-budget.json`, defining the current 1 GB node budget split as OS `160 MiB`, control-plane `190 MiB`, safe resident app budget `674 MiB`, summed core pod requests `512 MiB`, and residual headroom `162 MiB`
  - Fix now added: `scripts/k8s/deploy-core-minimal.sh` now persists per-stage rollout evidence under `artifacts/k8s/deploy-core-minimal/<timestamp>/`, including preflight output, cluster events, remote memory snapshots when SSH is configured, and pod logs/describes for each staged service; both deploy workflows upload that directory as a CI artifact
  - Fix now added: `scripts/k8s/run-core-isolation-matrix.sh` can execute the exact P09 validation order for singles, pairings, triple, and full-stack bring-up using the same staged deploy path and evidence capture, with `--dry-run` support and stop-on-first-failure behavior
  - Operational note: when the API will not stabilize, the existing cold-restart pattern is still `systemctl restart k3s` and, only if required, clearing the etcd data dir before recreating kubeconfig
- [ ] Clear both failure modes on the OCI node: `DiskPressure` and broken containerd overlayfs snapshot state
- [ ] Prove the safer runtime repair path restores sandbox creation after the overlayfs `failed to stat parent` failure
- [ ] values.minimal.yaml direct-apply deploy completes with exactly one Running/Ready pod each for `redis`, `ml-engine`, `bff`, and `frontend`
- [ ] Confirm the cluster is running the current CI commit SHA images for `bff`, `frontend`, and `ml-engine`
- [ ] Verify stale ReplicaSets / invalid-image pods are fully gone after the new cleanup path
- [ ] Smoke tests: `bff /health`, `ml-engine /health`, frontend `http://frontend:80`, `redis-cli ping`
- [ ] KUBECONFIG_B64 secret in GitHub updated after each k3s cold restart

### P26 — Contabo VPS Docker Compose Production Path 🔴 ACTIVE
*Supersedes P25 as the real production route. Single-host Contabo VPS with GitHub Actions deployment is now the target architecture.*

**Runbook:** See `docs/P26_Contabo_Deployment_Plan.md`
**Progress snapshot (2026-04-22):** Master backlog `133/255` complete (`52.2%`). Stage P `133/200` complete (`66.5%`). Active production phase `P26` is `29/32` complete (`90.6%`). OCI archive phases remain in this file for rollback evidence only and are not part of the active critical path.
**Current blocker:** Cloudflare DNS cutover done. Waiting on deploy to land with vm.overcommit_memory fix + remaining health hardening. `tradergunit.is-a.dev` PR still pending — monitor and execute cutover once approved.

#### P26 — Architecture Freeze
- [x] Freeze production target as `Contabo VPS` with `Docker Compose`, not OCI k3s
- [x] Freeze production delivery model as `GitHub Actions -> GHCR -> Contabo SSH deploy`
- [x] Freeze public host layout as `traders.app` + `bff.traders.app` + `api.traders.app` via Cloudflare → Contabo
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

#### P26 — Live Cutover ✅ IN PROGRESS
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
- [x] Run the Contabo public-edge k6 suite and record the first concurrency envelope — first fallback-host envelope captured against `173.249.18.14.sslip.io` / `bff.173.249.18.14.sslip.io` / `api.173.249.18.14.sslip.io` on `2026-04-21`; evidence lives in `.artifacts/k6-slo-20260421T131612Z/` and shows threshold breaches (`bff_ml_health` fail rate about `79.2%`, `ml_predict` p95 about `1346ms`, `edge-health` p95 about `788ms`, `bff /health` p95 about `740ms`)
- [x] **DNS CUTOVER** — `traders.app`, `bff.traders.app`, `api.traders.app` A records updated to Contabo `173.249.18.14` via Cloudflare (2026-04-22)
- [ ] Confirm public health for `https://traders.app`, `https://bff.traders.app/health`, and `https://api.traders.app/health` (pending deploy + DNS propagation)
- [ ] Archive the final OCI node details only after Contabo is stable for at least one clean redeploy cycle

Fallback-host note: DNS cutover to Cloudflare → Contabo done (2026-04-22). `traders.app`, `bff.traders.app`, `api.traders.app` now point to `173.249.18.14`. `sslip.io` fallback hosts still valid as secondary proof target. Public readiness verification pending deploy completion + DNS propagation.

#### P09-C - `kubectl apply tradersapp-deployments.yaml` on OCI E2.1.Micro (ARCHIVED — P26 is active)
> ⚠️ P09-C is ARCHIVED. Contabo VPS (P26) is the active production path. Do not work on P09-C unless Contabo is abandoned.
- Root cause to treat as authoritative until disproven: OCI E2.1.Micro `1 GB RAM` is too small for `k3s + etcd + kubelet + containerd + the TradersApp core-4 pods` when applied as one rollout step
- Goal: break the remaining P09 blocker into 50 atomic steps so memory pressure, runtime corruption, and rollout ordering can be debugged without another blind full-manifest retry
- Live OCI facts from 2026-04-19:
  - Current reachable OCI node is `tradersapp-oci` at `144.24.112.249` on `VM.Standard.E2.1.Micro`; working SSH key is `C:\Users\Asus\.ssh\id_ed25519`
  - Previous hard failure was not only RAM: `k3s` was crash-looping on `no space left on device` while creating `etcd-tmp`; `/var/lib/rancher/k3s/agent/containerd` had consumed the root filesystem and inodes
  - Host-side recovery cleared containerd/kubelet debris, dropped root usage from `100%` to roughly `32-40%`, and restored a healthy `k3s` API on `:6443`
  - Single-service live results are now real: `redis` passes, `bff` passes, `ml-engine` fails during rollout/ContainerCreating, and `frontend` fails even with `bff` running because `nginx.conf` had a startup-time `/ws` upstream resolution bug
  - Multi-service live runs are now trustworthy after fixing the staged-apply loop and SSH evidence capture; `bff + frontend` still causes `k3s` restarts, with journal showing `failed to start networking: unable to initialize network policy controller: error getting node subnet`
- [x] P09-C01 - Capture fresh baseline memory on the node before any repair: `free -m`, `vmstat 1 5`, and `/proc/meminfo`
- [x] P09-C02 - Capture current control-plane memory by process: `ps aux --sort=-%mem | head -20`
- [x] P09-C03 - Record `systemctl status k3s` and `journalctl -u k3s -n 300 --no-pager` from the failing node
- [x] P09-C04 - Record `kubectl get nodes -o wide` and `kubectl describe node tradersapp-oci` after a failed apply
- [x] P09-C05 - Record `kubectl get pods -A -o wide` with restart counts and current node placement
- [x] P09-C06 - Record `kubectl get events -A --sort-by=.lastTimestamp | tail -200` to preserve the exact failure sequence
- [x] P09-C07 - Capture current ephemeral storage usage with `df -h`, `df -i`, and `du -sh /var/lib/rancher/k3s/*`
- [x] P09-C08 - Save one full failure bundle under a dated runbook artifact path so later retries compare against the same evidence format
- [ ] P09-C09 - Quantify resident memory used by `etcd`, `kubelet`, `containerd`, and `k3s server` separately
- [ ] P09-C10 - Decide whether embedded `etcd` must remain or whether the node should switch to a lighter single-node k3s datastore path
- [ ] P09-C11 - If embedded `etcd` remains, document the exact minimum safe free-memory floor required before any application pods start
- [ ] P09-C12 - Audit current k3s server flags and remove any non-essential control-plane add-ons still consuming memory
- [ ] P09-C13 - Audit kubelet eviction thresholds and image-garbage-collection thresholds for better low-memory behavior on 1 GB RAM
- [ ] P09-C14 - Audit whether swap is actually active and helping under pressure instead of causing unusable thrash
- [ ] P09-C15 - Audit `systemd` service limits for k3s and confirm they are not making reclaim behavior worse
- [x] P09-C16 - Define a hard node-memory budget table for control-plane, OS, and each core TradersApp pod before another deploy attempt
- [x] P09-C17 - Extract the direct-apply CI manifest into per-service logical chunks instead of one all-at-once apply unit
- [x] P09-C18 - Create a dedicated `redis-only` manifest slice for isolated bring-up testing
- [x] P09-C19 - Create a dedicated `ml-engine-only` manifest slice for isolated bring-up testing
- [x] P09-C20 - Create a dedicated `bff-only` manifest slice for isolated bring-up testing
- [x] P09-C21 - Create a dedicated `frontend-only` manifest slice for isolated bring-up testing
- [x] P09-C22 - Add a reproducible manifest-generation command that emits the split apply order from the same source values as CI
- [x] P09-C23 - Make the split manifests deterministic so line diffs show only intentional resource changes between retries
- [x] P09-C24 - Add a dry-run validation step for every split manifest before the node sees a real apply
- [ ] P09-C25 - Measure real startup RSS and steady-state RSS for `redis` when deployed alone on the node
- [ ] P09-C26 - Measure real startup RSS and steady-state RSS for `ml-engine` when deployed alone on the node
- [ ] P09-C27 - Measure real startup RSS and steady-state RSS for `bff` when deployed alone on the node
- [ ] P09-C28 - Measure real startup RSS and steady-state RSS for `frontend` when deployed alone on the node
- [ ] P09-C29 - Lower `redis` requests and limits to the smallest stable envelope proven by isolated testing
- [ ] P09-C30 - Lower `ml-engine` requests and limits to the smallest stable envelope proven by isolated testing
- [ ] P09-C31 - Lower `bff` requests and limits to the smallest stable envelope proven by isolated testing
- [ ] P09-C32 - Lower `frontend` requests and limits to the smallest stable envelope proven by isolated testing
- [ ] P09-C33 - Re-check that `ml-engine` is not still pulling in hidden heavy dependencies at runtime such as Kafka, Triton, or model warm-load paths
- [ ] P09-C34 - Re-check that `bff` is not still depending on disabled services through startup probes, env wiring, or transport fallbacks
- [ ] P09-C35 - Re-check that `frontend` serves static assets only and does not trigger unnecessary sidecars or extra processes
- [ ] P09-C36 - Re-check that `redis` remains ephemeral and does not request storage classes or PVC-related init work
- [ ] P09-C37 - Harden the runtime repair script so overlayfs corruption recovery runs before any new pod scheduling attempt
- [x] P09-C38 - Add a preflight gate that aborts deployment immediately if free memory is below the minimum safe floor from P09-C16
- [x] P09-C39 - Add a preflight gate that aborts deployment immediately if `DiskPressure=True` or inode pressure is already present
- [x] P09-C40 - Apply the split manifests one service at a time in the exact order `redis -> ml-engine -> bff -> frontend`
- [x] P09-C41 - After each service apply, wait for either `Ready` or a failure event and record memory, events, and pod logs before moving on
- [x] P09-C42 - Identify the first exact service and lifecycle stage that re-triggers memory collapse or overlayfs corruption
- [ ] P09-C43 - If a single service alone breaks the node, stop full-stack testing and reduce that service further before any combined retry
- [ ] P09-C44 - If all four services run individually, test the minimal combined pairings `redis+bff`, `redis+ml-engine`, and `redis+frontend`
- [ ] P09-C45 - If pairings hold, test the three-service stack `redis + ml-engine + bff` before adding the frontend
- [ ] P09-C46 - Only after staged pair/triple validation, retry full `kubectl apply tradersapp-deployments.yaml`
- [ ] P09-C47 - Confirm the successful full-stack run keeps exactly one Ready pod each for `redis`, `ml-engine`, `bff`, and `frontend`
- [ ] P09-C48 - Confirm the successful full-stack run still leaves enough free memory headroom to survive one pod restart without node collapse
- [x] P09-C49 - Update the production deploy workflow so CI uses the proven staged-apply order instead of a blind one-shot core rollout
- [ ] P09-C50 - Rewrite the P09 checkpoint note with the final proven memory envelope, staged rollout order, and recovery procedure for future cold starts

### P10 — Stateful Services Inside Free Limits ✅ DONE
- [x] Audit each stateful component and classify it as required-for-production or removable-from-runtime
  *(PostgreSQL, MLflow, MinIO, Kafka, Feast, Triton, vLLM, Keycloak all disabled in `values.minimal.yaml`)*
- [x] Redis confirmed ephemeral (`persistence.enabled: false`, `emptyDir` cache) — not source-of-truth
- [x] No stale PVC baggage in `tradersapp-deployments.yaml` (the direct-apply CI manifest has zero PVCs)
- [x] `k8s/base/storage.yaml` has 4 PVCs (`ml-models-pvc`, `ml-state-pvc`, `mlflow-artifacts-pvc`, `redis-pvc`) — these are NOT in the direct-apply CI path
- [x] Defer MLflow/MinIO persistence until a genuinely free durable path is proven
  *(MLflow disabled in values.minimal.yaml — tracked as future Stage P improvement if RAM allows)*

### P11 - Archived OCI ingress / external access reference
> ⚠️ ARCHIVED — OCI-only. Not required for Contabo production path. Kept for rollback context only.
- OCI-only follow-on kept for rollback notes. Not required for the current Contabo go-live.
- k3s runs with `--disable traefik --disable servicelb`, so external traffic must be handled explicitly
- Automatic CI no longer bootstraps `ingress-nginx` / `cert-manager` before the core deploy on the free OCI node; edge bootstrap is now a separate post-core action to avoid destabilizing P09
- External access is intentionally downstream of core runtime stability; do not treat ingress as the primary blocker while P09 is still failing on node pressure
- [ ] Standardize on one free edge path: `ingress-nginx` on OCI k3s, not Vercel, Railway, or another proxy dependency
- [ ] Expose `ingress-nginx` on the OCI node with a free-compatible service path once P09 is stable (NodePort is acceptable for debugging; final production path must remain OCI-only)
- [ ] Route `traders.app`, `bff.traders.app`, and `api.traders.app` through the same OCI public IP and ingress controller
- [ ] Keep NodePort only as a temporary debugging fallback, not the final public architecture
- [ ] Prove frontend, BFF, and ML engine all answer through ingress before touching final DNS
- [ ] Ensure the ingress path is compatible with Let's Encrypt / cert-manager challenge flow

### P12 - Archived OCI DNS + TLS reference
> ⚠️ ARCHIVED — OCI-only. Not required for Contabo production path. Kept for rollback context only.
- OCI-only DNS/TLS notes kept for rollback context. Not required for the current Contabo cutover.
- Current live mismatch: `traders.app` resolves to the wrong edge, HTTPS is broken, and `api.traders.app` is still NXDOMAIN
- Current authoritative DNS is on the existing registrar nameservers; keep that path instead of introducing another paid DNS layer
- [ ] Fix the apex A record so `traders.app` points to the OCI ingress IP instead of the current wrong edge
- [ ] Create `bff.traders.app` and `api.traders.app` DNS records against the same OCI edge
- [ ] Remove or replace legacy DNS entries that still send traffic to the wrong AWS / old frontend path
- [ ] Issue and validate Let's Encrypt certificates for apex + API/BFF hosts through cert-manager on k3s
- [ ] Verify `https://traders.app`, `https://bff.traders.app/health`, and `https://api.traders.app/health`

### P13 - Archived OCI frontend hosting reference
> ⚠️ ARCHIVED — OCI-only. Not required for Contabo production path. Kept for rollback context only.
- OCI-only frontend hosting notes kept for rollback context. Not required for the current Contabo cutover.
- Production frontend must be served from OCI/k3s, not Vercel
- [ ] Remove Vercel from the production go-live path and treat `vercel.json` as non-production only unless explicitly needed for previews
- [ ] Serve the built frontend from the cluster alongside the backend stack
- [ ] Confirm `traders.app` no longer redirects to `stocks.news` or any legacy deployment
- [ ] Re-check CSP, API base URLs, and frontend environment wiring for the OCI-hosted domains

### P14 — Observability 🔴 KNOWN ISSUE
> Note: Contabo edge health is now verified. Jaeger OTLP spam is disabled in ml-engine. Lightweight GitHub Actions log monitoring is the current path.
- Prometheus + Grafana stack too heavy for E2.1.Micro (1GB RAM)
- [ ] Deploy lightweight alternatives: k8s event exporter, GitHub Actions log streaming
- [ ] Smoke test monitoring via GitHub Actions on each deploy
- [ ] Telegram/Discord alerts via CI/CD post-deploy hook

### P15 - Archived OCI backup & rollback reference
> ⚠️ ARCHIVED — OCI-only. Not required for Contabo production path. Kept for rollback context only.
- OCI-only rollback notes kept for rollback context. Not required for the current Contabo production cutover.
- [ ] Test `helm rollback tradersapp` on CI failure
- [ ] Database migration rollback strategy
- [ ] GitHub Actions `on_failure: rollback` job already wired in deploy-k8s.yml

### P16 - Archived OCI go-live sign-off reference
> ⚠️ ARCHIVED — OCI-only. Not required for Contabo production path. Kept for rollback context only.
- OCI-only sign-off notes kept for rollback context. Not required for the current Contabo production cutover.
- [ ] Manual smoke test: load traders.app, check consensus signal renders
- [ ] Manual smoke test: `bff.traders.app/health` and `api.traders.app/health` both return healthy over HTTPS
- [ ] Paper trade for 1 week before any real money
- [ ] Board Room deliberation rule applies to all signals

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
Generated: `2026-04-22 19:41`  -  Run `python scripts/update_todo_progress.py --once` to update

```text
Stage P Backlog  67.0%  [################--------]
Sections        done 018 | active 002 | blocked 000 | pending 008 | total 030
Checklist       done 134 | open 066 | total 200
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
| P25 - Ampere A1 / OVHcloud Migration (Archived Fallback) 🟡 ON HOLD | [0/7] |   0.0% | PENDING |
| P26 - Architecture Freeze | [4/4] | 100.0% | DONE |
| P26 - Repo-Side Contabo Execution | [11/11] | 100.0% | DONE |
| P26 - Live Cutover ✅ IN PROGRESS | [15/17] |  88.2% | IN PROGRESS |
| P09 - `kubectl apply tradersapp-deployments.yaml` on OCI E2.1.Micro (ARCHIVED — P26 is active) | [23/50] |  46.0% | IN PROGRESS |
| P10 - Stateful Services Inside Free Limits ✅ DONE | [5/5] | 100.0% | DONE |
| P11 - Archived OCI ingress / external access reference | [0/6] |   0.0% | PENDING |
| P12 - Archived OCI DNS + TLS reference | [0/5] |   0.0% | PENDING |
| P13 - Archived OCI frontend hosting reference | [0/4] |   0.0% | PENDING |
| P14 - Observability 🔴 KNOWN ISSUE | [0/3] |   0.0% | KNOWN ISSUE |
| P15 - Archived OCI backup & rollback reference | [0/3] |   0.0% | PENDING |
| P16 - Archived OCI go-live sign-off reference | [0/4] |   0.0% | PENDING |
| P17 - Documentation Alignment ✅ DONE | [4/4] | 100.0% | DONE |
| P18 - Windows Desktop Architecture Freeze | [5/5] | 100.0% | DONE |
| P19 - Windows Installer Wizard | [5/5] | 100.0% | DONE |
| P20 - Desktop Auth, Access Control, and Admin Kill Switch | [5/5] | 100.0% | DONE |
| P21 - Self-Update System | [5/5] | 100.0% | DONE |
| P22 - Desktop Security and IP Hardening | [5/5] | 100.0% | DONE |
| P23 - 4 GB Performance and Compatibility Certification | [0/5] |   0.0% | PENDING |
| P24 - Windows Release Readiness and Docs Alignment ✅ DONE | [5/5] | 100.0% | DONE |

<!-- live-status:end -->
