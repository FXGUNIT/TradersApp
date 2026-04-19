# TODO Master List
**Last Updated:** 2026-04-19
**Based on:** Stage P production deployment + Session Redesign + ML Research Foundation



<!-- master-progress:start -->
## Progress Dashboard
Generated: `2026-04-19 19:24`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Master Backlog  36.3%  [#########---------------]
Tasks          done 081 | in progress 000 | blocked 000 | todo 142 | total 223
```

How to read this:
- `Master Backlog` counts every checkbox task across Stage P, Stage S, and ML research.
- Tier bars are strategic buckets and can overlap; phase bars are the exact checklist counts.

### By Area

| Area | Tasks | Progress | Status |
|---|---|---:|---|
| Stage P | [81/168] |  48.2% | CURRENT BLOCKER |
| Stage S | [0/47] |   0.0% | PENDING |
| ML Research | [0/8] |   0.0% | PENDING |

### By Tier

| Tier | Scope | Progress | Status |
|---|---|---:|---|
| TIER 1 | Stage P rollout path |  48.2% | CURRENT BLOCKER |
| TIER 2 | Bootstrap + minimal core |  10.9% | CURRENT BLOCKER |
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
| P09 - Core Deployment CURRENT BLOCKER | [0/57] |   0.0% | CURRENT BLOCKER |
| P10 - Stateful Services Inside Free Limits ✅ DONE | [5/5] | 100.0% | DONE |
| P11 - Ingress / External Access BLOCKED BY P09 | [0/6] |   0.0% | BLOCKED |
| P12 - DNS + TLS on Current Registrar ⏳ BLOCKED BY P11 | [0/5] |   0.0% | BLOCKED |
| P13 - Frontend on OCI k3s BLOCKED BY P11 | [0/4] |   0.0% | BLOCKED |
| P14 - Observability 🔴 KNOWN ISSUE | [0/3] |   0.0% | KNOWN ISSUE |
| P15 - Backup & Rollback ⏳ BLOCKED BY P09 | [0/3] |   0.0% | BLOCKED |
| P16 - Go-Live Sign-Off 🔴 BLOCKED BY P09 | [0/4] |   0.0% | BLOCKED |
| P17 - Documentation Alignment ✅ DONE | [4/4] | 100.0% | DONE |
| P18 - Windows Desktop Architecture Freeze | [5/5] | 100.0% | DONE |
| P19 - Windows Installer Wizard | [5/5] | 100.0% | DONE |
| P20 - Desktop Auth, Access Control, and Admin Kill Switch | [5/5] | 100.0% | DONE |
| P21 - Self-Update System | [5/5] | 100.0% | DONE |
| P22 - Desktop Security and IP Hardening | [5/5] | 100.0% | DONE |
| P23 - 4 GB Performance and Compatibility Certification | [0/5] |   0.0% | PENDING |
| P24 - Windows Release Readiness and Docs Alignment ✅ DONE | [5/5] | 100.0% | DONE |
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
- Latest completed failed deploy: GitHub Actions run `24618145954`
- New repo-side mitigation prepared after that failure: stronger node-pressure recovery now deletes terminal pods, avoids projected API-token mounts in the cleanup job, removes stale kubelet/pod log directories by active pod UID, prunes dangling container log symlinks, truncates oversized pod logs, and gives kubelet a longer 300-second window to clear `DiskPressure`
- Production deploy concurrency is already serialized in CI with `group: deploy-production-main`; upstream test/build jobs can overlap, but the production deploy job is not supposed to run in parallel
- GHCR images are present; `ghcr.io/fxgunit/bff:latest`, `ghcr.io/fxgunit/frontend:latest`, and `ghcr.io/fxgunit/ml-engine:latest` all exist
- The current hard blocker is not missing images; it is OCI node runtime instability during the core rollout
- Exact latest failure: pod sandbox creation failed repeatedly with `failed to stat parent: stat /var/lib/rancher/k3s/agent/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1/fs: no such file or directory`
- Highest-confidence interpretation: the node moved from plain `DiskPressure` into broken containerd overlayfs snapshot state after aggressive cleanup on the single free-tier node
- New mitigation now added in the deploy path: pre-deploy recovery no longer prunes container images; it now detects overlayfs snapshot corruption separately and schedules a host-side `k3s-killall.sh` + `k3s` restart repair before retrying
- New mitigation prepared for the next production cycle: the minimal profile now caps pod ephemeral storage and `emptyDir` usage for `bff`, `frontend`, `ml-engine`, and `redis` so a single pod cannot silently consume enough local disk to re-trigger node-wide `DiskPressure`
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
- Current hard failure mode on the OCI free node is containerd / overlayfs runtime corruption after earlier node-pressure cleanup, not missing GHCR images
  - Run `24618145954` passed the upstream unit/build gates, then failed during the real production deploy
  - Verified from GHCR: `ghcr.io/fxgunit/bff:latest`, `ghcr.io/fxgunit/frontend:latest`, and `ghcr.io/fxgunit/ml-engine:latest` exist
  - Earlier runs did confirm rollout-time `DiskPressure=True` and taint `node.kubernetes.io/disk-pressure:NoSchedule`
  - Exact latest runtime outcome from the failed deploy diagnostics: kubelet raised repeated `FailedCreatePodSandBox` events with `failed to stat parent ... overlayfs/snapshots/1/fs: no such file or directory`
  - Exact workload impact from the failed deploy diagnostics: `redis` and `ml-engine` pods remained stuck in `ContainerCreating` / `Pending` because the runtime could not create pod sandboxes
  - Exact control-plane outcome from the failed deploy diagnostics: the API was still reachable long enough to dump pod describes, but the node runtime itself could not start new sandboxes reliably
  - Windows-to-OCI `kubectl` TLS / handshake instability is still real, but it is a secondary symptom right now; GitHub Actions is reaching the cluster, and the cluster is collapsing during rollout
  - Fix already applied: `values.minimal.yaml` forces coherent core-only runtime settings (`bff` HTTP transport, `ml-engine` Kafka off, required DB off, security extras off)
  - Fix already applied: core runtime Deployments use `Recreate` in the minimal profile so the node does not schedule two generations at once
  - Fix already applied: production CI builds and pushes current commit SHA images before deploy
  - Fix already applied: production CI deploys the rendered minimal manifest via direct `kubectl apply`
  - Fix already applied: automatic production CI defers `ingress-nginx` + `cert-manager` until after the core runtime stabilizes
  - Fix already applied: `scripts/k8s/recover-node-pressure.sh` now runs before the minimal apply and again on retry paths; it deletes terminal pods, removes stale kubelet/pod log directories by active pod UID, truncates oversized pod logs, avoids projected service-account mounts, and waits up to 300 seconds for the node taint to clear
  - Fix already applied: the minimal runtime now sets explicit `ephemeral-storage` requests/limits and `emptyDir` size limits for core services to reduce the chance of another uncontrolled disk-pressure cascade
  - Fix now added: when deploy diagnostics show overlayfs snapshot corruption, recovery switches from image pruning to a safer host-side runtime reset using the K3s `k3s-killall.sh` reset path plus `k3s` restart
  - Operational note: when the API will not stabilize, the existing cold-restart pattern is still `systemctl restart k3s` and, only if required, clearing the etcd data dir before recreating kubeconfig
- [ ] Clear both failure modes on the OCI node: `DiskPressure` and broken containerd overlayfs snapshot state
- [ ] Prove the safer runtime repair path restores sandbox creation after the overlayfs `failed to stat parent` failure
- [ ] values.minimal.yaml direct-apply deploy completes with exactly one Running/Ready pod each for `redis`, `ml-engine`, `bff`, and `frontend`
- [ ] Confirm the cluster is running the current CI commit SHA images for `bff`, `frontend`, and `ml-engine`
- [ ] Verify stale ReplicaSets / invalid-image pods are fully gone after the new cleanup path
- [ ] Smoke tests: `bff /health`, `ml-engine /health`, frontend `http://frontend:80`, `redis-cli ping`
- [ ] KUBECONFIG_B64 secret in GitHub updated after each k3s cold restart

#### P09-C - `kubectl apply tradersapp-deployments.yaml` on OCI E2.1.Micro
- Root cause to treat as authoritative until disproven: OCI E2.1.Micro `1 GB RAM` is too small for `k3s + etcd + kubelet + containerd + the TradersApp core-4 pods` when applied as one rollout step
- Goal: break the remaining P09 blocker into 50 atomic steps so memory pressure, runtime corruption, and rollout ordering can be debugged without another blind full-manifest retry
- [ ] P09-C01 - Capture fresh baseline memory on the node before any repair: `free -m`, `vmstat 1 5`, and `/proc/meminfo`
- [ ] P09-C02 - Capture current control-plane memory by process: `ps aux --sort=-%mem | head -20`
- [ ] P09-C03 - Record `systemctl status k3s` and `journalctl -u k3s -n 300 --no-pager` from the failing node
- [ ] P09-C04 - Record `kubectl get nodes -o wide` and `kubectl describe node tradersapp-oci` after a failed apply
- [ ] P09-C05 - Record `kubectl get pods -A -o wide` with restart counts and current node placement
- [ ] P09-C06 - Record `kubectl get events -A --sort-by=.lastTimestamp | tail -200` to preserve the exact failure sequence
- [ ] P09-C07 - Capture current ephemeral storage usage with `df -h`, `df -i`, and `du -sh /var/lib/rancher/k3s/*`
- [ ] P09-C08 - Save one full failure bundle under a dated runbook artifact path so later retries compare against the same evidence format
- [ ] P09-C09 - Quantify resident memory used by `etcd`, `kubelet`, `containerd`, and `k3s server` separately
- [ ] P09-C10 - Decide whether embedded `etcd` must remain or whether the node should switch to a lighter single-node k3s datastore path
- [ ] P09-C11 - If embedded `etcd` remains, document the exact minimum safe free-memory floor required before any application pods start
- [ ] P09-C12 - Audit current k3s server flags and remove any non-essential control-plane add-ons still consuming memory
- [ ] P09-C13 - Audit kubelet eviction thresholds and image-garbage-collection thresholds for better low-memory behavior on 1 GB RAM
- [ ] P09-C14 - Audit whether swap is actually active and helping under pressure instead of causing unusable thrash
- [ ] P09-C15 - Audit `systemd` service limits for k3s and confirm they are not making reclaim behavior worse
- [ ] P09-C16 - Define a hard node-memory budget table for control-plane, OS, and each core TradersApp pod before another deploy attempt
- [ ] P09-C17 - Extract the direct-apply CI manifest into per-service logical chunks instead of one all-at-once apply unit
- [ ] P09-C18 - Create a dedicated `redis-only` manifest slice for isolated bring-up testing
- [ ] P09-C19 - Create a dedicated `ml-engine-only` manifest slice for isolated bring-up testing
- [ ] P09-C20 - Create a dedicated `bff-only` manifest slice for isolated bring-up testing
- [ ] P09-C21 - Create a dedicated `frontend-only` manifest slice for isolated bring-up testing
- [ ] P09-C22 - Add a reproducible manifest-generation command that emits the split apply order from the same source values as CI
- [ ] P09-C23 - Make the split manifests deterministic so line diffs show only intentional resource changes between retries
- [ ] P09-C24 - Add a dry-run validation step for every split manifest before the node sees a real apply
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
- [ ] P09-C38 - Add a preflight gate that aborts deployment immediately if free memory is below the minimum safe floor from P09-C16
- [ ] P09-C39 - Add a preflight gate that aborts deployment immediately if `DiskPressure=True` or inode pressure is already present
- [ ] P09-C40 - Apply the split manifests one service at a time in the exact order `redis -> ml-engine -> bff -> frontend`
- [ ] P09-C41 - After each service apply, wait for either `Ready` or a failure event and record memory, events, and pod logs before moving on
- [ ] P09-C42 - Identify the first exact service and lifecycle stage that re-triggers memory collapse or overlayfs corruption
- [ ] P09-C43 - If a single service alone breaks the node, stop full-stack testing and reduce that service further before any combined retry
- [ ] P09-C44 - If all four services run individually, test the minimal combined pairings `redis+bff`, `redis+ml-engine`, and `redis+frontend`
- [ ] P09-C45 - If pairings hold, test the three-service stack `redis + ml-engine + bff` before adding the frontend
- [ ] P09-C46 - Only after staged pair/triple validation, retry full `kubectl apply tradersapp-deployments.yaml`
- [ ] P09-C47 - Confirm the successful full-stack run keeps exactly one Ready pod each for `redis`, `ml-engine`, `bff`, and `frontend`
- [ ] P09-C48 - Confirm the successful full-stack run still leaves enough free memory headroom to survive one pod restart without node collapse
- [ ] P09-C49 - Update the production deploy workflow so CI uses the proven staged-apply order instead of a blind one-shot core rollout
- [ ] P09-C50 - Rewrite the P09 checkpoint note with the final proven memory envelope, staged rollout order, and recovery procedure for future cold starts

### P10 — Stateful Services Inside Free Limits ✅ DONE
- [x] Audit each stateful component and classify it as required-for-production or removable-from-runtime
  *(PostgreSQL, MLflow, MinIO, Kafka, Feast, Triton, vLLM, Keycloak all disabled in `values.minimal.yaml`)*
- [x] Redis confirmed ephemeral (`persistence.enabled: false`, `emptyDir` cache) — not source-of-truth
- [x] No stale PVC baggage in `tradersapp-deployments.yaml` (the direct-apply CI manifest has zero PVCs)
- [x] `k8s/base/storage.yaml` has 4 PVCs (`ml-models-pvc`, `ml-state-pvc`, `mlflow-artifacts-pvc`, `redis-pvc`) — these are NOT in the direct-apply CI path
- [x] Defer MLflow/MinIO persistence until a genuinely free durable path is proven
  *(MLflow disabled in values.minimal.yaml — tracked as future Stage P improvement if RAM allows)*

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
Generated: `2026-04-19 19:24`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Active Backlog    0.0%  [------------------------]
Stage Progress  00/00 complete
Task Counts     done 000 | in progress 000 | blocked 000 | todo 000 | total 000
```

| Section | Tasks | Progress | Status |
|---|---|---:|---|


<!-- live-status:end -->
