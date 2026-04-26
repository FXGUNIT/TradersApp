# TODO Master List

**Last Updated:** 2026-04-26
**Status:** P26 LIVE - Contabo VPS live | P27 TODO - Vibing Finance hidden backtesting engine added to master backlog | web app is canonical | desktop proof archived/optional



<!-- master-progress:start -->
## Progress Dashboard
Generated: `2026-04-26 17:26`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Master Backlog  49.0%  [############------------]
Tasks          done 024 | in progress 000 | blocked 009 | todo 016 | total 049
```

How to read this:
- `Master Backlog` counts every checkbox task across Stage P, Stage S, and ML research.
- Tier bars are strategic buckets and can overlap; phase bars are the exact checklist counts.

### By Area

| Area | Tasks | Progress | Status |
|---|---|---:|---|
| Stage P | [24/49] |  49.0% | IN PROGRESS |
| Stage S | [0/0] |   0.0% | DONE |
| ML Research | [0/0] |   0.0% | DONE |

### By Tier

| Tier | Scope | Progress | Status |
|---|---|---:|---|
| TIER 1 | Stage P overall |  49.0% | IN PROGRESS |
| TIER 2 | Active Contabo production path |  80.0% | BLOCKED |

### By Phase

| Phase | Tasks | Progress | Status |
|---|---|---:|---|
| P23 - 4 GB Performance and Compatibility Certification | [5/5] | 100.0% | DONE |
| P25 - NY Lunch Trading Block ✅ DONE | [5/5] | 100.0% | DONE |
| P26 - Pages Root Live + Critical Bug Fixes — LIVE, 2 BLOCKED FOLLOW-UPS | [8/10] |  80.0% | BLOCKED |
| P27 - Vibing Finance Backtesting Engine - Hidden MVP + Post-MVP Automation | [6/29] |  20.7% | IN PROGRESS |

<!-- master-progress:end -->

---

## MASTER TO-DO LIST RULES

- This file is the single master backlog for active repo work.
- The generated progress dashboard above is the source of truth for task counts, phase status, and progress bars.
- Do not manually edit anything between `<!-- master-progress:start -->` and `<!-- master-progress:end -->`; run `python scripts/update_todo_progress.py --once` after changing checkbox tasks.
- Use `[ ]` for todo, `[x]` for done, and `[!]` for blocked tasks.
- Add new implementation work as a numbered Stage P phase unless it clearly belongs to Stage S or ML Research.
- Keep completed production history in place; append new phases instead of replacing older records.
- Every major planning/spec task must point to its canonical document.
- Every implementation task must name the milestone, target files/modules, and required verification when known.
- Blocked tasks must say exactly what unblocks them.
- Vibing Finance work is tracked under `P27`; the canonical technical spec remains `docs/VIBING_FINANCE_BACKTESTING_ENGINE_SPEC.md`.
- The active open spec will not show this dashboard unless this file is opened directly.

---

## EXECUTION PRIORITY

### TIER 1 — ACTIVE NOW: web app remains the only canonical product path
Desktop proof is closed and retained only as optional local evidence. Resume Windows release/signing work only if public desktop distribution becomes a real requirement.

### TIER 2 — STAGING: performance hardening + k6 envelope capture
Reduce `bff_ml_health` failure burst, keep public-proof artifacts ready for domain cutover.

### TIER 3 — Archived OCI fallback / evidence
OCI k3s artifacts kept as rollback/reference only. If reopened: see archived runbooks.

### TIER 4 — Stage S + ML backlog
All Stages S1–S6 and ML1–ML8 are background. Implement carefully, update live app when ready.

---

## PRODUCTION CONSTRAINTS

- Canonical public frontend: `https://tradergunit.pages.dev/`
- Canonical product path: web app first; Windows desktop packaging is optional and non-blocking
- Backend runtime edge: single Contabo VPS (`173.249.18.14`) via Docker Compose + GitHub Actions
- `sslip.io` hosts are the Contabo runtime proof surface (bff, api, frontend)
- Do not treat `traders.app` or `tradergunit.is-a.dev` as active targets unless explicitly reopened
- `isNyLunchBreakActive` gates all trading signals (12:00–1:00 PM ET, DST-aware IST conversion)

## LAUNCH READINESS AUDIT - 2026-04-24

- Web production build: `npm.cmd run build` PASS.
- Lint gate: `npm.cmd run lint` PASS at error level; 11 non-blocking warnings remain for later cleanup.
- Cross-browser Playwright suite: `npm.cmd run test:e2e:playwright` PASS, 54 passed / 42 skipped by existing test gates.
- Desktop UI audit sweep: [report-2026-04-24T00-57-25-676Z.json](/e:/TradersApp/artifacts/ui-audit/report-2026-04-24T00-57-25-676Z.json:1) PASS, 10/10 scenarios, 0 issues, 0 page errors, 0 request failures.
- Mobile UI audit sweep: [report-2026-04-24T01-00-06-171Z.json](/e:/TradersApp/artifacts/ui-audit/report-2026-04-24T01-00-06-171Z.json:1) PASS, 10/10 scenarios, 0 issues, 0 page errors, 0 request failures.
- Audit runner hardening: navigation timeout is now configurable via `UI_AUDIT_NAVIGATION_TIMEOUT_MS` and defaults to 90 seconds to avoid false failures on cold Vite starts.

---

## STAGE P - Production Record + Active Backlog

### P23 - 4 GB Performance and Compatibility Certification
- Non-blocking for the current product direction: retained as optional desktop evidence, not as active web-app work
- Repo-side harness: `scripts/windows/certify-desktop-performance.ps1` — shell startup, idle RAM, OCR lazy-load, GPU-free payload, child-process checks
- Harness path resolution (2026-04-24): auto-detects packaged `webapp` beside the target EXE, then falls back to `dist/desktop-web` or repo `desktop/windows/TradersApp.Desktop/webapp`
- Local baseline (2026-04-22): shell ready 5.23s, idle WS ~16.5 MB, private memory ~3.3 MB, no sidecar processes
- Assumed local reference-equivalent evidence (2026-04-24): [desktop-p23-certification-20260424-043343.md](/e:/TradersApp/.artifacts/windows/p23/desktop-p23-certification-20260424-043343.md:1) — shell ready 0.58s, idle WS 26.1 MB, OCR lazy-load PASS, no sidecar processes, manual gates recorded PASS per user instruction on this laptop
- Runbook: `docs/windows/WINDOWS_P23_REFERENCE_MACHINE_RUNBOOK.md`
- Local signed-release proof (2026-04-24): [desktop-local-signed-release-proof-20260424-052600.md](/e:/TradersApp/.artifacts/windows/release-proof/desktop-local-signed-release-proof-20260424-052600.md:1) — desktop EXE, MSI, and setup bundle now carry an embedded Authenticode signer on this laptop; MSI/setup SHA-256 sidecars were regenerated after signing
- Production/public trust caveat: this local proof uses a self-signed laptop-generated certificate, so `Get-AuthenticodeSignature` reports `UnknownError` instead of a publicly trusted chain
- [x] Validate cold start to login screen at `<= 8s` on the assumed local reference-equivalent laptop
- [x] Validate idle RAM at `<= 500 MB` after shell + web UI fully load on the assumed local reference-equivalent laptop
- [x] Confirm OCR and heavy modules remain lazy-loaded, no discrete GPU required on the assumed local reference-equivalent laptop
- [x] Validate degraded-network handling, reconnect flow, forced logout on desktop on the assumed local reference-equivalent laptop
- [x] Confirm desktop release never starts local BFF or ML sidecar services on the assumed local reference-equivalent laptop

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

### P26 - Pages Root Live + Critical Bug Fixes — LIVE, 2 BLOCKED FOLLOW-UPS
- Plan: `C:\Users\Asus\.claude\plans\partitioned-coalescing-snowglobe.md`
- Canonical app now serves at `https://tradergunit.pages.dev` (full trading app, not developer landing)
- `tradergunit.pages.dev` removed from `DEV_ROOT_HOSTS` in `src/App.jsx`
- Cloudflare Pages direct upload with `_headers` CSP + `connect-src` allowlist for all BFF/AI hosts

**Bug 1 — DNS/CERT error on other devices (NOT YET RESOLVED — human action required):**
- Symptom: `NET::ERR_CERT_COMMON_NAME_INVALID` on devices whose DNS resolves `tradergunit.pages.dev` to Contabo IP instead of Cloudflare
- Root cause: Device DNS cache resolves directly to Contabo VPS (173.249.18.14), which has a cert for `*.sslip.io`, not for `*.pages.dev`
- Fix: Flush DNS on affected devices — `ipconfig /flushdns` (Windows) or equivalent. Cloudflare DNS (1.1.1.1) resolves correctly to 172.66.45.30/172.66.46.226
- Local laptop DNS flush completed on 2026-04-25 with `ipconfig /flushdns`; any remaining cert error is on that specific device's DNS/cache path.
- Cloudflare DNS is working correctly — confirmed via `nslookup tradergunit.pages.dev 1.1.1.1` → Cloudflare IPs
- DNS propagation is a client-side issue, not a server or code issue

**No-owned-domain backend path (CORRECTED):**
- We do not own or pay for `traders.app`; do not use `api.traders.app`, `bff.traders.app`, or any other `traders.app` hostname as an active target.
- Keep Pages pointed at the working free backend host: `https://bff.173.249.18.14.sslip.io`
- If a Cloudflare Worker proxy is needed later without buying a domain, use a free `workers.dev` hostname after Cloudflare/Wrangler authentication is available. Do not switch `VITE_BFF_URL` until the new free Worker URL returns `/health` successfully.
- Cleanup note (2026-04-25): active build defaults, CSP, runtime examples, k6 public-edge defaults, Vercel CSP, GitHub workflow defaults, setup scripts, and optional Worker docs/config now point at the free `pages.dev` + `sslip.io` path instead of unpaid `traders.app` hostnames.
- Worker proxy note (2026-04-25): `.github/workflows/deploy-bff-worker.yml` now exists and local `wrangler deploy --dry-run` passes. GitHub run `24928501312` failed because the stored `CLOUDFLARE_API_TOKEN` is authenticated but lacks Cloudflare Workers deploy permission (`Authentication error [code: 10000]`). Keep Pages on `https://bff.173.249.18.14.sslip.io` until that token is replaced with one that can deploy Workers and the workflow verifies `/health` + news endpoints.

**Bug 2 — LIVE NEWS + SCHEDULED NEWS showing OFFLINE (FIXED):**
- Root cause: Browser extension injects `x-tradersapp-install-id` header into all cross-origin XHR/fetch requests
- Extension header not in BFF CORS `Access-Control-Allow-Headers` whitelist → preflight fails → request blocked
- Fix A (frontend): Strip all `x-tradersapp-*` headers before fetch in `src/services/gateways/base.js`
- Fix B (BFF): Add `x-tradersapp-install-id` to CORS allowlist in `bff/server.mjs`
- NewsStatusClient fallback: Added `/news/breaking?fresh=true` + `/news/upcoming` direct fallback when `/ml/consensus` returns null (no candle data yet)
- NewsStatusClient shape fix: Handle `/news/upcoming` direct response shape (`trade_allowed`, `next_event`) vs ML consensus shape (`news.trade_allowed`)
- Live verification (2026-04-24T21:59Z): `https://tradergunit.pages.dev` serves `index-RY75e0Pd.js`; the bundle contains `https://bff.173.249.18.14.sslip.io` and the news direct fetch fallback marker; BFF `/news/breaking?fresh=true`, `/news/upcoming`, and `/ml/consensus?session=1` all return usable JSON for the NewsStatusClient path.

- [x] Task 1: Remove `tradergunit.pages.dev` from `DEV_ROOT_HOSTS` → full app renders on Pages ✅ DONE
- [x] Task 2: Fix edge healthcheck HTTP/80 (was probing HTTPS/443) in `deploy/contabo/docker-compose.yml` ✅ DONE
- [x] Task 3: Remove dead `is-a.dev` Caddyfile blocks in `deploy/contabo/Caddyfile` ✅ DONE
- [x] Task 4: Update workflow input defaults to sslip.io hosts (domain-free strategy) ✅ DONE
- [x] Task 5: Deploy Contabo — BFF image baked with all 9 API keys from GitHub Secrets/Infisical ✅ DONE
- [x] Task 6: Fix NewsStatusClient fallback chain — direct `/news/breaking` + `/news/upcoming` when ML consensus fails ✅ DONE
- [x] Task 7: Strip `x-tradersapp-*` extension headers in `bffFetch` (`src/services/gateways/base.js`) ✅ DONE
- [x] Task 8: Add `x-tradersapp-install-id` to BFF CORS allowlist (`bff/server.mjs`) ✅ DONE
- [!] Task 9: Bug 1 — BLOCKED on other affected devices only. This laptop DNS cache was flushed on 2026-04-25; phone/browser cert errors still require flushing or changing DNS on that device.

- [!] Task 10: Optional no-owned-domain Worker proxy: BLOCKED on Cloudflare token permission. Workflow exists, dry-run passes, deploy failed until `CLOUDFLARE_API_TOKEN` can deploy Workers.

### P27 - Vibing Finance Backtesting Engine - Hidden MVP + Post-MVP Automation
- Canonical spec: `docs/VIBING_FINANCE_BACKTESTING_ENGINE_SPEC.md`
- Rule: preserve the spec's Build Now / Build Later / Do Not Build Yet split.
- MVP stops at M7 local proof. M8+ stays post-MVP until M1-M7 pass fixtures, reports, and proof checks.
- No paid API, hosted compute, public chain, raw CSV upload, live trading, or LLM-generated numerical truth is allowed in the MVP.

**Spec and governance tasks already merged:**
- [x] Task 1: Lock the single canonical Vibing Finance spec and keep all product, architecture, security, data, ML, blockchain, UX, launch, and open-question details in it.
- [x] Task 2: Add the Build Now / Build Later / Do Not Build Yet control panel with M1-M7 as MVP and M8+ as post-MVP.
- [x] Task 3: Lock first user, first benchmark, user promise, forbidden promises, unacceptable MVP failures, and non-regression rules.
- [x] Task 4: Lock instrument metadata, CSV import profiles, setup detector state machine, and golden fixture definitions.
- [x] Task 5: Lock metric formulas, verdict rules, claim guardrails, compliance wording, proof canonicalization, and `run-package.v1`.
- [x] Task 6: Lock whole-engine architecture, microservice-ready boundaries, service contracts, capability manifests, ADRs, evidence ladder, and best-in-class scorecard.

**Build-now MVP tasks:**
- [ ] Task 7: PR1 / `MVP-M1-HIDDEN-SHELL` - add hidden admin Vibing Finance workbench behind `VITE_ENABLE_VIBING_FINANCE`, register `screen === "vibingFinance"`, enforce admin-only access, and render the agent-style empty workspace.
- [ ] Task 8: PR2 / `MVP-M2-CSV-INTAKE` - implement local CSV parser, importer profiles, data-quality report, row-level validation, timeframe/timezone inference, IndexedDB metadata, and no-server-upload guarantee.
- [ ] Task 9: PR3 / `MVP-M3-FEATURES` - implement session tagging, MNQ/NIFTY session rules, IB high/low, incremental VWAP, swing levels, and no-future-bar feature tests.
- [ ] Task 10: PR4 / `MVP-M4-SETUP-DETECTOR` - implement caught buyer/seller inventory detection, structure change, pullback detection, long/short setup state machine, reason codes, and `GF-*` golden fixture tests.
- [ ] Task 11: PR5 / `MVP-M5-SIMULATOR` - implement Web Worker backtest execution, conservative OHLC fill policy, fees/slippage hooks, 0.2% risk sizing, trade ledger, equity curve, cancellation, and metric formula tests.
- [ ] Task 12: PR6 / `MVP-M6-REPORT` - implement report schema, verdict engine, caveats, "what would break live" section, next experiments, low-sample warnings, and forbidden-claim tests.
- [ ] Task 13: PR7 / `MVP-M7-PROOF` - implement canonical JSON, artifact hashes, local proof block, Merkle report root, proof mismatch failure path, export/import verification, and offline verification.

**Cross-cutting MVP quality tasks:**
- [ ] Task 14: Add P0/P1 test traceability so fixtures, metrics, proof, storage, report claims, CLI contracts, runner security, memory, and provider redaction have matching test categories.
- [ ] Task 15: Implement IndexedDB schema versioning, migrations, quota handling, corruption recovery, export-before-delete, and failure/recovery events.
- [ ] Task 16: Keep an implementation evidence ledger for each milestone with commands, artifacts, results, and remaining risk.
- [ ] Task 17: Run the full launch-readiness red-team questions before marking each milestone complete.

**Build-later automation tasks:**
- [ ] Task 18: PR8 / `POST-M8-AGENT-EXPORT` - create compact Codex/Claude review export with strategy spec, dataset metadata only, metrics, reason-code counts, proof hashes, open questions, and no raw rows.
- [ ] Task 19: PR9 / `POST-M9-CLI` - extract deterministic `core/*`, implement `vibing doctor`, `validate-data`, `run`, `report`, `proof verify`, `export`, typed events, machine-readable exit codes, and browser/CLI contract tests.
- [ ] Task 20: PR10 / `POST-M10-RUNNER` - implement `vibing serve`, localhost pairing, `/health`, `/capabilities`, `/runs`, SSE events, cancellation, workspace scope checks, and visible runner status.
- [ ] Task 21: PR11 / `POST-M11-PYTHON-PARITY` - add optional Python engine behind the CLI with parity tolerances, mismatch report, fixture replay, and no separate product surface.
- [ ] Task 22: PR12 / `POST-M12-BROWSER-AUTOMATION` - add Playwright-backed `vibing browser smoke`, screenshot, and inspect commands with allowed-origin policy and screenshot redaction rules.

**Blocked / do-not-build-yet tasks:**
- [!] Task 23: BYOK provider gateway and embedded paid LLM routing are BLOCKED until deterministic M1-M7 pass and redaction, budget, provider error, and secret-storage tests exist.
- [!] Task 24: Multi-agent role team, autonomous watch mode, and unattended experiment queue are BLOCKED until CLI/local runner budgets, stop reasons, proof, memory controls, and recovery paths exist.
- [!] Task 25: Per-user adaptive memory and self-learning loops are BLOCKED until memory UX, evidence refs, delete/export/reset controls, and "why suggested" explanations are implemented.
- [!] Task 26: Cross-user/shared model training is BLOCKED until explicit user consent, model registry, eval protocol, rollback, drift monitoring, and governance are implemented.
- [!] Task 27: Public blockchain anchoring is BLOCKED until local proof chain is stable, public anchoring has a clear legal/product reason, and no raw strategy/report data is placed on chain.
- [!] Task 28: Public launch is BLOCKED until legal/compliance review, security review, data licensing, abuse controls, support process, independent methodology review, and launch gates pass.
- [!] Task 29: Live trading or broker execution is BLOCKED and explicitly out of scope until a separate regulated, risk-reviewed product plan exists.

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
Generated: `2026-04-26 17:26`  -  Run `python scripts/update_todo_progress.py --once` to update

```text
Stage P Backlog  49.0%  [############------------]
Sections        done 002 | active 001 | blocked 001 | archived 000 | pending 000 | total 004
Checklist       done 024 | in progress 000 | blocked 009 | todo 016 | total 049
```

| Section | Tasks | Progress | Status |
|---|---|---:|---|
| P23 - 4 GB Performance and Compatibility Certification | [5/5] | 100.0% | DONE |
| P25 - NY Lunch Trading Block ✅ DONE | [5/5] | 100.0% | DONE |
| P26 - Pages Root Live + Critical Bug Fixes — LIVE, 2 BLOCKED FOLLOW-UPS | [8/10] |  80.0% | BLOCKED |
| P27 - Vibing Finance Backtesting Engine - Hidden MVP + Post-MVP Automation | [6/29] |  20.7% | IN PROGRESS |

<!-- live-status:end -->
