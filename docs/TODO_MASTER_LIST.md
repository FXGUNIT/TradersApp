# TODO Master List
**Last Updated:** 2026-04-24
**Status:** P26 ACTIVE — Contabo VPS + Docker Compose is the production path
**Based on:** Stage P production deployment + Session Redesign + ML Research Foundation


<!-- master-progress:start -->
## Progress Dashboard
Generated: `2026-04-24 01:57`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Master Backlog   0.0%  [------------------------]
Tasks          done 000 | in progress 000 | blocked 000 | todo 010 | total 010
```

How to read this:
- `Master Backlog` counts every checkbox task across Stage P, Stage S, and ML research.
- Tier bars are strategic buckets and can overlap; phase bars are the exact checklist counts.

### By Area

| Area | Tasks | Progress | Status |
|---|---|---:|---|
| Stage P | [0/10] |   0.0% | IN PROGRESS |
| Stage S | [0/0] |   0.0% | DONE |
| ML Research | [0/0] |   0.0% | DONE |

### By Tier

| Tier | Scope | Progress | Status |
|---|---|---:|---|
| TIER 1 | Stage P overall |   0.0% | IN PROGRESS |
| TIER 2 | Active Contabo production path |   0.0% | DONE |
| TIER 3 | Archived OCI fallback / evidence |   0.0% | IN PROGRESS |
| TIER 4 | Stage S + ML backlog |   0.0% | DONE |

### By Phase

| Phase | Tasks | Progress | Status |
|---|---|---:|---|
| P23 - 4 GB Performance and Compatibility Certification | [0/5] |   0.0% | PENDING |
| P25 - NY Lunch Trading Block ✅ IN PROGRESS | [0/5] |   0.0% | IN PROGRESS |

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

### P06 - CI/CD Pipeline (`deploy-k8s.yml`) DONE - minimal direct-apply path

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

#### P26 — Repo-Side Contabo Execution

#### P26 — Live Cutover ✅ DONE

Fallback-host note: `sslip.io` hosts (`173.249.18.14.sslip.io`) remain the active Contabo runtime proof surface. The canonical public frontend is `https://tradergunit.pages.dev/`.


> Note: Contabo edge health is now verified. Jaeger OTLP spam is disabled in ml-engine. GitHub Actions log monitoring + webhook alerts are the current path.
- Prometheus + Grafana stack too heavy for E2.1.Micro (1GB RAM) — skipped for Contabo single-host


### P18 - Windows Desktop Architecture Freeze

### P19 - Windows Installer Wizard

### P20 - Desktop Auth, Access Control, and Admin Kill Switch

### P21 - Self-Update System

### P22 - Desktop Security and IP Hardening

### P23 - 4 GB Performance and Compatibility Certification
- Repo-side certification harness is now `scripts/windows/certify-desktop-performance.ps1`; it emits JSON/Markdown evidence for shell startup, idle RAM, OCR lazy-loading, GPU-free payload, and child-process checks
- Latest local baseline evidence was captured on `2026-04-22` at `.artifacts/windows/p23/desktop-p23-certification-20260422-164945.{json,md}`: shell ready `5.23s`, idle working set about `16.5 MB`, private memory about `3.3 MB`, and no child sidecar processes observed. This is useful prep evidence, but it is not the final 4 GB reference-machine sign-off.
- Full `P23` sign-off still requires manual runs on Windows 10 x64 and Windows 11 x64 `4 GB RAM` reference machines plus degraded-network and forced-logout proof
- [ ] Validate cold start to login screen at `<= 8s` on Windows 10/11 x64 4 GB reference machines
- [ ] Validate idle RAM at `<= 500 MB` after the shell and web UI fully load
- [ ] Confirm OCR and heavy modules remain lazy-loaded and do not require a discrete GPU
- [ ] Validate degraded-network handling, reconnect flow, and forced logout behavior on desktop
- [ ] Confirm the desktop release never starts local BFF or ML sidecar services

### P25 - NY Lunch Trading Block ✅ IN PROGRESS
- Implementation plan at `docs/superpowers/plans/2026-04-24-ny-lunch-trading-block.md`
- Block all trading signals during NY lunch (12:00–1:00 PM ET, 9:30–10:30 PM IST during DST / 10:30–11:30 PM IST outside DST)
- `isNyLunchBreakActive(istHour, istMinute)` gates `getMlConsensus` in BFF consensusEngine.mjs — returns NEUTRAL with lunch block reason
- `checkNyLunchVeto()` added to BFF boardRoomService.mjs — RiskOfficer fires veto during lunch
- `tradingHoursService.mjs` created as new BFF service with DST-aware time conversion
- DOMAIN-RULES.md and EDGE-CASES.md updated with lunch block as hard trading rule
- [ ] Task 1: Create `bff/services/tradingHoursService.mjs` + tests
- [ ] Task 2: Update `bff/services/consensusEngine.mjs` — block ML call during lunch
- [ ] Task 3: Update `bff/services/boardRoomService.mjs` — RiskOfficer lunch veto
- [ ] Task 4: Document in DOMAIN-RULES.md and EDGE-CASES.md
- [ ] Task 5: Verify end-to-end with BFF health check

### P24 - Windows Release Readiness and Docs Alignment ✅ DONE

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

### Phase S2 — BFF Multi-Instrument Routing

### Phase S3 — Frontend Dashboard Redesign

### Phase S4 — Options Module (Greenfield)

### Phase S5 — Economic Calendar & Expiry Calendar

### Phase S6 — Database + Trade Logging

---

## STAGES ML1–ML8 — ML Engine Research & Implementation
*See: `ml_engine_research_foundation.md` for full reading list and architecture*


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
Generated: `2026-04-24 01:57`  -  Run `python scripts/update_todo_progress.py --once` to update

```text
Stage P Backlog   0.0%  [------------------------]
Sections        done 000 | active 001 | blocked 000 | archived 000 | pending 001 | total 013
Checklist       done 000 | open 010 | total 010
```

| Section | Tasks | Progress | Status |
|---|---|---:|---|
| P23 - 4 GB Performance and Compatibility Certification | [0/5] |   0.0% | PENDING |
| P25 - NY Lunch Trading Block ✅ IN PROGRESS | [0/5] |   0.0% | IN PROGRESS |

<!-- live-status:end -->