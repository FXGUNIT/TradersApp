# TODO Master List

**Last Updated:** 2026-04-24
**Status:** P26 DONE — Contabo VPS live | P25 DONE — NY Lunch Block | P23 repo-side cert ready, reference-machine sign-off pending



<!-- master-progress:start -->
## Progress Dashboard
Generated: `2026-04-24 03:43`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Master Backlog  50.0%  [############------------]
Tasks          done 005 | in progress 000 | blocked 000 | todo 005 | total 010
```

How to read this:
- `Master Backlog` counts every checkbox task across Stage P, Stage S, and ML research.
- Tier bars are strategic buckets and can overlap; phase bars are the exact checklist counts.

### By Area

| Area | Tasks | Progress | Status |
|---|---|---:|---|
| Stage P | [5/10] |  50.0% | PENDING |
| Stage S | [0/0] |   0.0% | DONE |
| ML Research | [0/0] |   0.0% | DONE |

### By Tier

| Tier | Scope | Progress | Status |
|---|---|---:|---|
| TIER 1 | Stage P overall |  50.0% | PENDING |
| TIER 2 | Active Contabo production path |   0.0% | DONE |
| TIER 3 | Archived OCI fallback / evidence | 100.0% | DONE |
| TIER 4 | Stage S + ML backlog |   0.0% | DONE |

### By Phase

| Phase | Tasks | Progress | Status |
|---|---|---:|---|
| P23 - 4 GB Performance and Compatibility Certification | [0/5] |   0.0% | PENDING |
| P25 - NY Lunch Trading Block ✅ DONE | [5/5] | 100.0% | DONE |

<!-- master-progress:end -->

---

## EXECUTION PRIORITY

### TIER 1 — ACTIVE NOW: P23 Windows Desktop Cert reference-machine sign-off
Repo-side harness, runbook, and local baseline are ready. Remaining work is the real Windows 10/11 x64 4 GB certification pass.

### TIER 2 — STAGING: performance hardening + k6 envelope capture
Reduce `bff_ml_health` failure burst, keep public-proof artifacts ready for domain cutover.

### TIER 3 — Archived OCI fallback / evidence
OCI k3s artifacts kept as rollback/reference only. If reopened: see archived runbooks.

### TIER 4 — Stage S + ML backlog
All Stages S1–S6 and ML1–ML8 are background. Implement carefully, update live app when ready.

---

## PRODUCTION CONSTRAINTS

- Canonical public frontend: `https://tradergunit.pages.dev/`
- Backend runtime edge: single Contabo VPS (`173.249.18.14`) via Docker Compose + GitHub Actions
- `sslip.io` hosts are the Contabo runtime proof surface (bff, api, frontend)
- Do not treat `traders.app` or `tradergunit.is-a.dev` as active targets unless explicitly reopened
- `isNyLunchBreakActive` gates all trading signals (12:00–1:00 PM ET, DST-aware IST conversion)

---

## STAGE P — Live Backlog

### P23 - 4 GB Performance and Compatibility Certification
- Repo-side harness: `scripts/windows/certify-desktop-performance.ps1` — shell startup, idle RAM, OCR lazy-load, GPU-free payload, child-process checks
- Harness path resolution (2026-04-24): auto-detects packaged `webapp` beside the target EXE, then falls back to `dist/desktop-web` or repo `desktop/windows/TradersApp.Desktop/webapp`
- Local baseline (2026-04-22): shell ready 5.23s, idle WS ~16.5 MB, private memory ~3.3 MB, no sidecar processes
- Runbook: `docs/windows/WINDOWS_P23_REFERENCE_MACHINE_RUNBOOK.md`
- Full sign-off still requires manual runs on Windows 10/11 x64 4 GB reference machines and signed-payload reruns
- [ ] Validate cold start to login screen at `<= 8s` on 4 GB reference machines
- [ ] Validate idle RAM at `<= 500 MB` after shell + web UI fully load
- [ ] Confirm OCR and heavy modules remain lazy-loaded, no discrete GPU required
- [ ] Validate degraded-network handling, reconnect flow, forced logout on desktop
- [ ] Confirm desktop release never starts local BFF or ML sidecar services

### P25 - NY Lunch Trading Block ✅ DONE
- Plan: `docs/superpowers/plans/2026-04-24-ny-lunch-trading-block.md`
- Blocks all trading signals during NY lunch (12:00–1:00 PM ET)
  - DST active (Mar–Nov): 21:30–22:30 IST
  - DST inactive (Nov–Mar): 22:30–23:30 IST
- `isNyLunchBreakActive(istHour, istMinute)` in `bff/services/tradingHoursService.mjs`
- `getMlConsensus` in `bff/services/consensusEngine.mjs` returns NEUTRAL + reason during block
- `checkNyLunchVeto()` in `bff/services/boardRoomAgentReporter.mjs` fires RiskOfficer veto during block
- [x] Task 1: Create `bff/services/tradingHoursService.mjs` + tests ✅ DONE
- [x] Task 2: Update `bff/services/consensusEngine.mjs` — block ML call during lunch ✅ DONE
- [x] Task 3: Update `bff/services/boardRoomAgentReporter.mjs` — RiskOfficer lunch veto ✅ DONE
- [x] Task 4: Document in `DOMAIN-RULES.md` and `EDGE-CASES.md` ✅ DONE
- [x] Task 5: Verify end-to-end — BFF /health verified ✅ DONE

> **Archived OCI / A1 fallback scope:** If that path reopens, see `docs/OCI-DEPLOYMENT-RUNBOOK.md`, `docs/SETUP.md`, `docs/STAGE_P_DNS_SETUP.md`, `docs/STAGE_P_24X7_EXECUTION_CHECKLIST.md`

---

## Git History Rewrite — COMPLETED 2026-04-17
- `.venv-research/` (253 MB, torch_cpu.dll) removed via `git-filter-repo`, history force-pushed
- If cloned before this rewrite: `git fetch --all && git reset --hard origin/main`

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

- ML1 — Volatility Surface建模 (Bergomi-like)
- ML2 — HMM Regime Detection
- ML3 — Anomalous Diffusion (Levy processes)
- ML4 — Mamba Sequence Model
- ML5 — PFHedge for Greeks-aware hedging
- ML6 — Alpha Signal Ensemble
- ML7 — Continual Learning (EWC + replay buffer)
- ML8 — Backtesting rig (kernc-backtesting)

---

## KEY LESSONS LEARNED

### k3s on E2.1.Micro (Always Free, 1GB RAM)
- RPM install OOMs — use binary directly
- 2 GB swap required for k3s runtime
- Disable as many controllers as possible
- k3s server process must NOT have `KUBECONFIG` env var set

### TLS Certificates
- External access requires `--tls-san=<public_ip>` on k3s server
- Regenerate kubeconfig after adding TLS SAN (token also changes)

### GitHub Actions kubeconfig
- SSH stderr on Oracle Linux includes warning text that pollutes stdout
- Fix: `ssh -q ... sudo cat file.txt > local.txt 2>/dev/null`
- Set secret via: `cat file | gh secret set SECRET_NAME --repo owner/repo`

### Git LFS
- Never commit `.venv-research/` or any virtualenv to git
- Solution: `git-filter-repo --path .venv-research --invert-paths`


<!-- live-status:start -->
## Live Status
Generated: `2026-04-24 03:43`  -  Run `python scripts/update_todo_progress.py --once` to update

```text
Stage P Backlog  50.0%  [############------------]
Sections        done 001 | active 000 | blocked 000 | archived 000 | pending 001 | total 002
Checklist       done 005 | open 005 | total 010
```

| Section | Tasks | Progress | Status |
|---|---|---:|---|
| P23 - 4 GB Performance and Compatibility Certification | [0/5] |   0.0% | PENDING |
| P25 - NY Lunch Trading Block ✅ DONE | [5/5] | 100.0% | DONE |

<!-- live-status:end -->
