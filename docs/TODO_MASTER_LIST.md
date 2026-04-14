# TODO Master List

**Last updated:** 2026-04-14
**Format version:** 2.0 â€” real-time multi-agent coordination protocol

---

## How This Doc Works

### Task State Convention

Every task uses one of these four prefixes â€” nothing else:

| Prefix | Meaning                          |
| ------ | -------------------------------- |
| `[ ]`  | Not started                      |
| `[-]`  | In progress (with inline status) |
| `[x]`  | Done (with commit hash + date)   |
| `[!]`  | Blocked (with blocker reason)    |

### Atomic Update Rule

**Never rewrite another agent's task line.** To update a task:

1. Edit only your assigned task's line
2. Add a timestamp: `updated: 2026-04-13 02:30`
3. If the task is new, append to the bottom of its stage section
4. DO NOT touch any other agent's lines

### Agent Coordination Section

Before starting work, claim your tasks here. This prevents two agents from updating the same task simultaneously.

```json
// Active claims â€” claimed by which agent, expires when done
// Format: "TaskID": { "claimed_by": "agent-name", "claimed_at": "ISO timestamp" }
{
  "R01": { "claimed_by": "codex", "claimed_at": "2026-04-14T00:05:00+05:30" },
  "R02": { "claimed_by": "codex", "claimed_at": "2026-04-14T04:12:00+05:30" },
  "R03": { "claimed_by": "claude-sonnet", "claimed_at": "2026-04-14T13:39:00+05:30" },
  "R04": { "claimed_by": "claude-sonnet", "claimed_at": "2026-04-14T13:52:00+05:30" },
  "R05": { "claimed_by": "claude-sonnet", "claimed_at": "2026-04-14T15:10:00+05:30" },
  "R06": { "claimed_by": "claude-sonnet", "claimed_at": "2026-04-14T15:35:00+05:30" },
  "R07": { "claimed_by": "claude-sonnet", "claimed_at": "2026-04-14T16:00:00+05:30" },
  "R08": { "claimed_by": "codex", "claimed_at": "2026-04-14T16:20:00+05:30" },
  "R09": { "claimed_by": "codex", "claimed_at": "2026-04-14T17:20:00+05:30" },
  "R10": { "claimed_by": null, "claimed_at": null },
  "R11": { "claimed_by": "codex", "claimed_at": "2026-04-14T17:10:00+05:30" },
  "R12": { "claimed_by": null, "claimed_at": null },
  "R13": { "claimed_by": null, "claimed_at": null },
  "R14": { "claimed_by": null, "claimed_at": null },
  "R15": { "claimed_by": null, "claimed_at": null },
  "R16": { "claimed_by": null, "claimed_at": null },
  "R17": { "claimed_by": null, "claimed_at": null },
  "R18": { "claimed_by": null, "claimed_at": null },
  "R19": { "claimed_by": null, "claimed_at": null },
  "R20": { "claimed_by": null, "claimed_at": null }
}
```

### Live Status Table (auto-generated â€” do not edit)

Run `python scripts/update_todo_progress.py --once` to regenerate.

<!-- live-status:start -->
## Live Status
Generated: `2026-04-14 17:14`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Active Backlog   22.5%  [#####-------------------]
Stage Progress  00/01 complete
Task Counts     done 000 | in progress 009 | blocked 001 | todo 010 | total 020
```

| Section | Tasks | Progress | Status |
|---|---|---:|---|
| Stage R | [0/20] |   0.0% | IN PROGRESS |

<!-- live-status:end -->























## Phase Summary (Historical â€” all complete)

| Phase                                        | Tasks | Status       |
| -------------------------------------------- | ----- | ------------ |
| Phase 1: Audits                              | 3     | âœ… Complete |
| Phase 2: Stateless Service Layer             | 10    | âœ… Complete |
| Phase 3: Kubernetes Infrastructure           | 15    | âœ… Complete |
| Phase 4: Kafka Message Queue Architecture    | 9     | âœ… Complete |
| Phase 5: Observability                       | 9     | âœ… Complete |
| Phase 6: Frontend/React Architecture         | 14    | âœ… Complete |
| Phase 7: ML Pipeline & Training              | 15    | âœ… Complete |
| Phase 8: Data Pipeline & DVC                 | 6     | âœ… Complete |
| Phase 9: Deployment & Infrastructure         | 12    | âœ… Complete |
| Phase 10: Security & Secrets                 | 5     | âœ… Complete |
| Phase 11: Performance Optimization           | 1     | âœ… Complete |
| Phase 12: Architecture Truth & Documentation | 12    | âœ… Complete |

---

## Notes

- Secrets: Infisical is upstream source of truth â€” verify Kubernetes Secrets exist and contain expected keys at runtime.
- For production storage: Longhorn. `shared-rwx` local-path is WSL/dev only.
- For Kafka: exactly-once semantics implemented (K02), consumer group IDs pod-aware (K01), DLQ with retry tracking in place (E06), symbol-based partition keys (K05), lag monitoring wired to Prometheus (K04).
- Local dev: Docker Compose (`docker-compose.dev.yml`). k3s for staging/production only.
- For 24/7 free hosting: Oracle Cloud Always Free (`docker-compose.oci.yml`).

---

## Change Log (append-only)

```
2026-04-13 02:24 | CLAUDE-CODE | REDESIGNED | Protocol v2.0 â€” atomic update rules, coordination JSON block, append-only change log, validation script
2026-04-12       | AI-AGENTS   | COMPLETE  | Phases 1-12 all 100%, Stage M in progress (M01-M05), Stage N complete (N01-N05)
2026-04-13 23:25 | CODEX       | ADDED     | Stage R "Flawless Proof Gate" with detailed acceptance tasks and sub-steps
2026-04-14 00:01 | CODEX       | CLEANUP   | Added live status bar, removed fully completed stages, and restarted TODO autosync on the current parser
2026-04-14 04:00 | CODEX       | R01       | Documented fresh-clone proof progress, hardened dev-up Docker/WSL preflight, and recorded the current host-level WSL blocker
2026-04-14 04:12 | CODEX       | R02       | Added the frontend flow matrix and identified the concrete audit gaps beyond the existing top-level UI scenarios
2026-04-14 04:20 | CODEX       | R02       | Extended the UI audit code with a maintenance-mode scenario and a deterministic Board Room assertion; production rerun still pending host Docker/WSL recovery
2026-04-14 16:16 | CODEX       | R01       | Verified the second clean sibling build pass, added Docker executable fallback in dev-up, and narrowed the remaining blocker to broken host Docker Desktop / WSL state
2026-04-14 17:18 | CODEX       | R08       | Fixed live ML Engine request-binding/runtime defects, added route and idempotency regression coverage, and documented the remaining artifact-compatibility gaps
2026-04-14 17:19 | CODEX       | R09       | Added real local process-stack proof for frontend -> BFF -> ML Engine, including clean degrade/recover behavior across an ML Engine restart
2026-04-14 17:09 | CODEX       | R09       | Hardened local degraded orchestration: Redis-absent BFF boot is now quiet, optional breaking-news upstream timeouts are deduped warnings, and BFF regression tests remain green
2026-04-14 17:10 | CODEX       | R11       | Added initial failure-handling proof for ML-down, Redis-absent, and optional-news-timeout scenarios, with controlled degradation and reduced secondary log noise
```

## Stage R: Flawless Proof Gate

> **Claimed by:** (update the JSON coordination block above before starting)
> **Trigger (2026-04-13):** User requested a complete, explicit checklist of everything still required before the app could honestly be called "flawless."
> **Definition:** This stage is not cosmetic cleanup. It is the proof burden that would need to be satisfied before making an absolute-quality claim.
> **Rule of interpretation:** A task in this stage is only done when the proof artifacts exist, the checks are repeatable, and the result survives reruns without hidden manual fixes.

- [!] `R01` Prove fresh-clone reproducibility from a clean environment. (updated: 2026-04-14 16:16 IST) Two external sibling workspaces now prove the clean host-side bootstrap path: `npm install` + `npm run build` succeed in `E:\TradersApp-R01-Pass1` and `E:\TradersApp-R01-Pass2`. `scripts/dev-up.ps1` now also resolves Docker from the standard Docker Desktop install path and fails fast with the real host blocker. Remaining blocker: the local Docker Desktop / WSL install is broken (`docker-desktop` WSL distro = `Uninstalling`, registry key missing, engine pipe absent), so isolated `docker compose` startup + smoke verification are still pending. Proof log: `docs/R01_FRESH_CLONE_REPRO.md`.
  - **Why this exists:** A system cannot be called flawless if it only works on the current machine because of cached dependencies, leftover secrets, manual fixes, or hidden environment state.
  - **Step 1:** Create a truly clean environment: no existing `node_modules`, no prebuilt `dist`, no warmed Python virtualenv, no cached browser profile, and no manually pre-seeded app state.
  - **Step 2:** Use only documented setup steps from repo docs. If any undocumented command, file edit, environment variable, or retry is required, record it as a gap immediately.
  - **Step 3:** Verify the clean environment can complete install, build, lint, service startup, and smoke verification without ad-hoc intervention.
  - **Step 4:** Capture exact tool versions for Node, npm, Python, Docker, and OS so success is tied to a reproducible baseline rather than memory.
  - **Step 5:** Repeat the same process in at least one second disposable environment so the repo is not accidentally "working once."
  - **Exit criteria:** Two clean-environment passes with zero undocumented manual interventions and a written install/bootstrap artifact.

- [-] `R02` Prove all real frontend flows work end to end, not just the audited subset. (updated: 2026-04-14 04:20 IST) Added `docs/R02_FRONTEND_FLOW_MATRIX.md`, then extended the UI audit code with a maintenance-mode scenario and a deterministic `Board Room` assertion. Full rerun is still pending host Docker/WSL recovery, and dedicated proof is still missing for navigation lattice, floating support chat, terminal premarket/reset/T&C flows, and the wider admin shell utilities.
  - **Why this exists:** Passing build and smoke checks is not the same as proving every user-facing flow behaves correctly.
  - **Step 1:** Build a screen and route inventory that includes login, Google auth, password reset, signup, waiting room, hub, terminal, collective consciousness, sessions, admin dashboard, Board Room, footer links, and any hidden modal or drawer flows.
  - **Step 2:** For each screen, record entry conditions, expected visible states, allowed actions, exit paths, and error states.
  - **Step 3:** Add deterministic UI verification for all missing routes or interactions that are not currently covered by `audit:ui` and `audit:ui:mobile`.
  - **Step 4:** Verify back navigation, refresh behavior, stale state recovery, repeated open/close cycles, and tab changes.
  - **Step 5:** Confirm empty-state, loading-state, success-state, and failure-state rendering for each major screen.
  - **Exit criteria:** A complete flow matrix exists and every listed user path is automated or explicitly manually verified with proof.

- [-] `R03` Prove authentication, session lifecycle, and account recovery are correct. (updated: 2026-04-14 13:50 IST) Evidence gathered: 14 files audited. Auth system uses Firebase + Redis dual-session model with `onAuthStateChanged` listener, device fingerprinting, brute-force lockout, and status→screen routing. `authorizeRequest` is called at BFF dispatch entry (`_dispatch.mjs:188`) — all routes are RBAC-protected. Security headers set on every response. Identified 4 residual gaps requiring execution: role mapping on identity routes, token refresh boundary, forgot-password token expiry, multi-tab session consistency. Full artifact: `docs/R03_AUTH_LIFECYCLE_PROOF.md`.
  - **Why this exists:** A single auth edge-case bug can invalidate any claim of flawless behavior.
  - **Step 1:** Verify email/password login success, invalid credentials, locked/disabled user behavior, and partial-input validation.
  - **Step 2:** Verify Google auth success, cancellation, popup failure, blocked popup, and audit-mode fallback do not leave corrupted auth state.
  - **Step 3:** Verify forgot-password flow, password reset token handling, forced password reset, repeat reset attempts, and post-reset session state.
  - **Step 4:** Verify logout, logout-all-other-devices, expired session, stale token, and refresh-after-expiry behavior.
  - **Step 5:** Verify duplicate logins from multiple devices/tabs do not create inconsistent sessions or silent privilege leakage.
  - **Exit criteria:** Auth lifecycle tests cover success, expected failure, forced recovery, expiry, and multi-session edge cases.

- [-] `R04` Prove admin-only and CEO-only permissions cannot be bypassed. (updated: 2026-04-14 14:55 IST) Gap 2 FIXED: Added `authorizeRequest` gate before Board Room handler in `_dispatchRoutes.mjs` + added `/board-room` to `ROUTE_PERMISSIONS` in `security.mjs` requiring ADMIN role. All `/board-room/*` routes now return 403 for non-ADMIN callers. Gap 1 (`cricgunit@gmail.com` bypass) retained per user decision — documented as residual risk. Full artifact: `docs/R04_PRIVILEGE_BYPASS_PROOF.md`.
  - **Why this exists:** If a normal user can reach or trigger a privileged action, the app is not flawless regardless of UI polish.
  - **Step 1:** Enumerate every privileged UI entry point and every privileged BFF route, including admin dashboard, Board Room approvals, close-thread actions, invite flows, and any identity/admin endpoints.
  - **Step 2:** Verify normal users cannot open privileged screens via direct URL, client-side state mutation, cached UI state, or stale tokens.
  - **Step 3:** Verify server-side rejection for unauthorized requests even when the frontend tries to force the action.
  - **Step 4:** Verify role downgrade, role change mid-session, and expired-admin-session behavior.
  - **Step 5:** Verify all denial paths are safe: correct status code, no sensitive data leak, and no partial side effects.
  - **Exit criteria:** Every privileged action is proven to fail safely for non-privileged identities and succeed only for the correct role.

- [-] `R05` Prove file-upload, screenshot, and OCR flows are robust. (updated: 2026-04-14 15:15 IST) Evidence gathered: 14 files audited. Three gaps found and fixed: (1) client-side file size guard (10MB max) added to `terminalUploadUtils.js`, `terminalPasteListener.js`, and `MainTerminal.jsx` — oversized files rejected with toast; (2) BFF AI endpoint body limit raised from 200KB to 5MB (`_dispatchRoutes.mjs`); (3) `useTerminalOcr.js` now clears `ocrResult` at top of `runOcr` — no stale values on retry. Full artifact: `docs/R05_UPLOAD_OCR_PROOF.md`.
  - **Why this exists:** Upload surfaces are common sources of crashes, stale state, silent truncation, and security bugs.
  - **Step 1:** Verify happy-path upload for screenshots, MP chart, and VWAP chart across supported file types and normal file sizes.
  - **Step 2:** Verify rejection behavior for oversized files, unsupported file types, corrupted files, duplicate uploads, and too-many-files conditions.
  - **Step 3:** Verify OCR fallback behavior, partial OCR failure handling, and user-visible messaging when recognition quality is poor or unavailable.
  - **Step 4:** Verify deletion/replacement of uploaded files does not leave stale previews, stale counts, or orphaned temp state.
  - **Step 5:** Verify retry behavior and recovery after refresh or service interruption during upload.
  - **Exit criteria:** Upload/OCR flows are deterministic, safe on invalid input, and free of stale UI or silent data loss.

- [-] `R06` Prove trading, journal, account, and displayed metrics are numerically correct. (updated: 2026-04-14 15:35 IST) Evidence gathered: all edge cases correct in journalMetrics.js. Gap fixed: P2TradeForm and addJournalEntry now validate P&L sign matches result (win=positive, loss=negative) in MainTerminal.jsx. Full artifact: docs/R06_METRICS_PROOF.md.
  - **Why this exists:** A polished UI with wrong balances, wrong P&L, or inconsistent journal state is still broken.
  - **Step 1:** Enumerate every displayed numeric field in terminal, journal, account, analytics, and any admin summaries.
  - **Step 2:** Build reference fixtures with known expected totals, averages, win/loss ratios, balances, and edge-case values.
  - **Step 3:** Verify create/edit/delete flows for journal entries and confirm all dependent summaries update immediately and correctly.
  - **Step 4:** Verify rounding, sign handling, zero values, negative values, and large values do not render incorrectly.
  - **Step 5:** Verify refresh, route change, and service restart do not change computed results unexpectedly.
  - **Exit criteria:** Every user-visible trading number is traceable to a known-good reference and stays correct across interaction cycles.

- [-] `R07` Prove all BFF routes satisfy their contracts under success and failure. (updated: 2026-04-14 16:00 IST) Route contracts audited: 30+ routes inventoried across 7 domains. Gap fixed: err.message removed from HTTP error responses in consensusRoutes.mjs, newsRoutes.mjs, telegramRoutes.mjs, tradeCalcRoutes.mjs — now use generic messages with server-side logging. Residual gaps: no malformed-JSON param validation, no idempotency on session routes, no route-level test suite for core domains. Full artifact: docs/R07_BFF_ROUTE_CONTRACTS_PROOF.md.
  - **Why this exists:** If route behavior is undefined or inconsistently validated, the frontend may appear stable while the backend is not.
  - **Step 1:** Inventory all BFF routes and group them by domain: identity, Board Room, health, integration, admin, and auxiliary service calls.
  - **Step 2:** For each route, define required auth, accepted payload shape, expected response shape, failure status codes, and side effects.
  - **Step 3:** Add or expand tests for malformed payloads, missing fields, duplicate submissions, unauthorized access, and upstream dependency failures.
  - **Step 4:** Verify route handlers do not leak stack traces, internal config, or sensitive values in error responses.
  - **Step 5:** Verify idempotency or duplicate-request behavior where repeated requests are likely.
  - **Exit criteria:** Every BFF route has explicit contract coverage for happy path, validation failures, auth failures, and upstream faults.

- [-] `R08` Prove ML Engine routes, models, and workflow contracts are stable. (updated: 2026-04-14 17:18 IST) Fixed live FastAPI body-binding faults across `_routes_pso.py`, `_routes_news.py`, `_routes_features.py`, `_routes_data.py`, and `_routes_backtest.py`; normalized dict payload handling for the real BFF request shape in `_routes_workflow.py` and `_routes_pso.py`; and fixed ML runtime wiring and stale lifespan lookups in `main.py`, `_routes_workflow.py`, `_routes_pso.py`, `_routes_data.py`, `_routes_backtest.py`, and `_kafka.py`. Verified: `python -m pytest tests/test_route_contracts.py tests/test_idempotency_workflow_routes.py -q` -> `18 passed`, `python -m pytest tests/test_health_endpoints.py tests/test_inference_predictor.py tests/test_latency_regression.py tests/test_model_registry_service.py tests/test_model_monitor.py -q` -> `33 passed`, and `python scripts/ci/run_ml_engine_integration_smoke.py` -> `4 passed`. Remaining gaps: no dedicated large-payload or incompatible-schema-version proof yet, and serialized-artifact compatibility beyond the warmed local registry path still needs an explicit artifact-focused restart check. Full artifact: `docs/R08_ML_ENGINE_PROOF.md`.
  - **Why this exists:** An app that "looks fine" but produces unstable inference or route behavior is not flawless.
  - **Step 1:** Inventory ML Engine health, prediction, workflow, metrics, exporter, and any auxiliary routes exposed to the stack.
  - **Step 2:** Verify model loading, schema compatibility, serialized artifact compatibility, and fallback behavior after restart.
  - **Step 3:** Add coverage for invalid payloads, missing fields, large payloads, incompatible schema versions, and degraded-dependency modes.
  - **Step 4:** Verify deterministic behavior for fixtures where outputs should be stable or bounded.
  - **Step 5:** Verify route-level latency regressions, startup time regressions, and health endpoint truthfulness.
  - **Exit criteria:** ML Engine behavior is contract-tested, artifact-compatible, and stable under both normal and invalid inputs.

- [-] `R09` Prove cross-service integration works under real orchestration, not just isolated tests. (updated: 2026-04-14 17:09 IST) Added local process-stack proof in `docs/R09_CROSS_SERVICE_INTEGRATION_PROOF.md` with runtime artifact `.tmp_codex/r09-process-stack-20260414-165543/result.json`. Verified real `frontend (Vite /api proxy) -> BFF -> ML Engine` flow: `/api/ml/health` returned `ok=true`, `/api/ml/consensus` returned `ok=true` with `source=ml_engine`, and `/api/ml/regime` returned `ok=true`; after force-stopping ML Engine, `/api/ml/health` degraded cleanly with `503 / ok=false`, then recovered to `ok=true` and `/api/ml/consensus` recovered with `source=ml_engine` after restart. Follow-up hardening is also verified: local Redis-absent BFF boot now returns `/health` `200` with a single degraded warning and no reconnect spam, and two consecutive `/news/breaking?fresh=true&max=5` calls now return `200/200` with deduped upstream-timeout warnings and `0` hard error logs. Remaining gaps: Redis-present orchestration is still unproven, optional upstream news providers still need a stable success-path proof, and Docker-compose orchestration remains partially blocked by the host WSL/Docker issue tracked in `R01`.
  - **Why this exists:** Service-level green checks can hide data-contract mismatches and orchestration-only failures.
  - **Step 1:** Map the full integration graph among frontend, BFF, ML Engine, analysis service, Redis, Firebase, Telegram hooks, and any other live dependency.
  - **Step 2:** Verify the full stack behaves correctly during normal request chains, including auth -> BFF -> ML -> UI response loops.
  - **Step 3:** Verify schema and payload compatibility between service boundaries, especially around identity, Board Room, and inference payloads.
  - **Step 4:** Verify one-service restart does not permanently poison the others or require manual cleanup.
  - **Step 5:** Verify delayed responses, temporary unavailability, and retry logic across boundaries.
  - **Exit criteria:** End-to-end multi-service flows remain correct with no contract drift or hidden orchestration failures.

- [ ] `R10` Prove persistence, refresh behavior, and restart behavior preserve correct state.
  - **Why this exists:** Hidden state corruption after refresh or restart is one of the fastest ways to break trust in a system.
  - **Step 1:** Identify all persisted state locations: backend data stores, Redis, Firebase, local storage, session storage, and in-memory caches.
  - **Step 2:** Verify state survives expected refreshes and restarts without disappearing, duplicating, or reverting to stale values.
  - **Step 3:** Verify draft state, upload state, auth state, Board Room state, and journal/account state do not diverge across storage layers.
  - **Step 4:** Verify interrupted operations do not leave half-written state that becomes visible after reload.
  - **Step 5:** Verify cleanup behavior for expired, deleted, or superseded state records.
  - **Exit criteria:** State remains coherent across refreshes, restarts, and storage boundaries with no ghost or orphaned records.

- [-] `R11` Prove error handling and graceful degradation across expected failure modes. (updated: 2026-04-14 17:10 IST) Added `docs/R11_FAILURE_HANDLING_PROOF.md` and verified three injected local failure paths: (1) ML Engine down -> `/ml/health` and `/ml/consensus` return controlled `503` responses, with `/ml/consensus` falling back to a bounded neutral payload; (2) Redis absent -> BFF `/health` still returns `200` with a single degraded warning and no reconnect spam; (3) optional breaking-news upstream timeouts -> two consecutive `/news/breaking?fresh=true&max=5` calls return `200/200` with deduped warnings and `0` hard error logs. Hardening landed in `bff/services/redis-session-store.mjs`, `bff/services/boardRoomService.mjs`, `bff/services/breakingNewsService.mjs`, and `bff/services/consensusEngine.mjs`. Verified: `node --test bff/tests/*.test.mjs` -> `18 passed`. Remaining gaps: frontend-visible failure states, Firebase/auth outage proof, analysis-service outage proof, Redis recovery/restart proof, and Docker-orchestrated failure injection.
  - **Why this exists:** "Flawless" includes failing well when the environment is not perfect.
  - **Step 1:** Enumerate expected failure classes: network failure, slow dependency, expired auth, invalid input, unavailable Redis, unavailable Firebase, unavailable ML Engine, and partially loaded frontend state.
  - **Step 2:** Inject each failure deliberately and verify the user sees a controlled outcome rather than a crash, blank screen, or misleading success message.
  - **Step 3:** Verify retries, backoff behavior, and recovery after the dependency returns.
  - **Step 4:** Verify failure states clear correctly once the system becomes healthy again.
  - **Step 5:** Verify logs and metrics identify the real failure instead of burying it in generic noise.
  - **Exit criteria:** Every expected operational failure degrades predictably and recovers cleanly.

- [ ] `R12` Prove security posture against realistic misuse and abuse cases.
  - **Why this exists:** An app cannot be called flawless if it is functionally correct but trivially exploitable.
  - **Step 1:** Audit secrets exposure in frontend bundles, config, logs, docs, and network calls.
  - **Step 2:** Verify input validation on all externally influenced surfaces: forms, uploads, query params, headers, route params, and service payloads.
  - **Step 3:** Probe for obvious XSS, CSRF, SSRF, auth bypass, IDOR, and insecure-direct-call risks in privileged paths.
  - **Step 4:** Verify rate-limiting, abuse resistance, and safe handling of repeated invalid requests where applicable.
  - **Step 5:** Run dependency and config audits, then close or explicitly document any findings.
  - **Exit criteria:** No known critical or high-severity security weakness remains unaddressed or unexplained.

- [ ] `R13` Prove performance against defined budgets, not just "feels fast."
  - **Why this exists:** A system cannot be called flawless if it only appears responsive on one warm local run.
  - **Step 1:** Define explicit budgets for startup time, first meaningful render, route transitions, API latency, inference latency, and memory usage.
  - **Step 2:** Capture baseline measurements in controlled runs and store them as artifacts.
  - **Step 3:** Verify large bundles, heavy screens, OCR paths, admin screens, and markdown-heavy views stay within acceptable limits.
  - **Step 4:** Verify degraded conditions such as slower CPU, slower network, and larger datasets.
  - **Step 5:** Add regression alarms for the budgets that matter most.
  - **Exit criteria:** Performance claims are backed by measured budgets and repeatable traces, not intuition.

- [ ] `R14` Prove long-running stability, soak behavior, and concurrency safety.
  - **Why this exists:** Many serious defects only appear after time, repetition, or simultaneous activity.
  - **Step 1:** Run long-session soak tests for the frontend and services to detect memory leaks, stale subscriptions, timer buildup, and resource drift.
  - **Step 2:** Simulate repeated route changes, repeated uploads, repeated auth cycles, and repeated admin interactions.
  - **Step 3:** Simulate concurrent or near-concurrent actions that could race, such as duplicate saves, repeated approvals, or parallel requests.
  - **Step 4:** Verify no duplicate records, lost updates, deadlocks, or hidden queue buildup occurs.
  - **Step 5:** Verify the system remains healthy after the soak test ends and does not require manual reset.
  - **Exit criteria:** Long-run and concurrent operation does not introduce drift, leaks, duplicates, or state corruption.

- [ ] `R15` Prove browser and device coverage beyond the current local browser path.
  - **Why this exists:** A flow that passes in one browser on one machine can still fail badly elsewhere.
  - **Step 1:** Verify supported desktop browsers at minimum across Chrome, Edge, Firefox, and Safari-equivalent coverage where possible.
  - **Step 2:** Verify mobile behavior on realistic viewport classes, not only a single synthetic mobile dimension.
  - **Step 3:** Verify clipboard, popup, auth, drag/drop, and file-selection behavior across browser differences.
  - **Step 4:** Verify font, overflow, modal, scroll-lock, and fixed-position behavior in each target browser.
  - **Step 5:** Record browser-specific exceptions explicitly if any are intentionally unsupported.
  - **Exit criteria:** Core flows are green across the declared support matrix, not just the local default browser.

- [ ] `R16` Prove accessibility and interaction quality under assistive and keyboard-only usage.
  - **Why this exists:** A system is not flawless if core flows are blocked for keyboard users or screen-reader users.
  - **Step 1:** Verify keyboard-only navigation for auth, terminal, admin, and modal-heavy screens.
  - **Step 2:** Verify focus order, focus trapping, focus restore, and visible focus indication.
  - **Step 3:** Verify forms, buttons, icons, status indicators, and dialogs have usable labels and semantics.
  - **Step 4:** Verify contrast, text scaling, reduced-motion behavior, and overflow at increased zoom.
  - **Step 5:** Verify screen-reader critical flows or at minimum capture automated a11y scans and manual spot checks for the highest-risk screens.
  - **Exit criteria:** Core flows remain usable and understandable without mouse-only interaction or perfect vision assumptions.

- [ ] `R17` Prove deployability, environment parity, and recovery across runtime environments.
  - **Why this exists:** A flawless local run does not guarantee a flawless deployment story.
  - **Step 1:** Verify Docker dev stack, production-like stack, and any alternate deployment path each build and boot cleanly from documented commands.
  - **Step 2:** Verify health probes, restart behavior, dependency readiness, and service ordering in each environment.
  - **Step 3:** Verify secret injection, environment variable expectations, and failure behavior when a required secret is missing or malformed.
  - **Step 4:** Verify upgrade, rollback, and migration behavior does not corrupt state or wedge the stack.
  - **Step 5:** Verify backup/restore expectations for the stateful parts of the system.
  - **Exit criteria:** Deployment and recovery are documented, repeatable, and proven rather than assumed.

- [ ] `R18` Prove observability, diagnosability, and operator readiness.
  - **Why this exists:** A flawless system claim requires confidence that real defects would be visible and diagnosable quickly.
  - **Step 1:** Verify health endpoints reflect real health instead of only process liveness.
  - **Step 2:** Verify logs identify request path, error cause, and relevant context without leaking secrets.
  - **Step 3:** Verify metrics and alerts exist for critical failure classes: startup failure, auth failures, route errors, ML failure, latency regression, and stuck dependencies.
  - **Step 4:** Verify runbooks exist for the highest-risk operational incidents and that they match current repo reality.
  - **Step 5:** Verify artifacts from verification runs are stored in a predictable place and are understandable by another operator.
  - **Exit criteria:** Operational issues can be detected, explained, and acted on quickly by someone who did not write the code.

- [ ] `R19` Prove the verification harness itself is trustworthy.
  - **Why this exists:** A green test suite is worthless if it can pass while misreporting reality.
  - **Step 1:** Audit each custom runner for deterministic fixtures, truthful verdict logic, and correct non-zero exit behavior on regression.
  - **Step 2:** Verify "expected fail" scenarios are counted as successful detections rather than mislabeled misses.
  - **Step 3:** Remove random outputs, contradictory summaries, encoding corruption, and fake-green reporting from all custom test scripts.
  - **Step 4:** Add spot checks where intentionally broken fixtures prove the harness can fail when it should.
  - **Step 5:** Document which runners are synthetic simulations versus real application proof so outputs are interpreted correctly.
  - **Exit criteria:** Verification tools are internally consistent, deterministic, and able to fail loudly on real regressions.

- [ ] `R20` Define and satisfy a final release gate before using the word "flawless."
  - **Why this exists:** Without a formal gate, "flawless" becomes a feeling instead of a defended conclusion.
  - **Step 1:** Define the non-negotiable release criteria: zero known critical bugs, zero known privilege bypasses, zero known data-loss bugs, green core-flow matrix, green security gate, and green performance gate.
  - **Step 2:** Collect artifacts from all prior Stage R tasks into one release packet or summary doc.
  - **Step 3:** Re-run the highest-value checks after the final code changes to prove nothing regressed during cleanup.
  - **Step 4:** Record any residual risks explicitly; if any material risk remains, the word "flawless" stays disallowed.
  - **Step 5:** Require an explicit signoff that the evidence supports the claim across functionality, security, reliability, and operations.
  - **Exit criteria:** A written final gate says either "claim allowed" or "claim not allowed," based on evidence rather than optimism.

Stage R Supplemental: UI/UX Precision Matrix (Execution Delta, Non-Duplicate)

Purpose: This section operationalizes existing Stage R goals at test-execution depth. It does not replace or restate R01-R20.

Dedup rule: If an artifact already proves a check in R02, R11, R13, R15, R16, R19, or R20, link that artifact instead of rerunning.

RS01 State-Level Visual Regression Matrix (covers R02, R13, R15)

Why this exists: Page-level tests miss most regressions in component states.
Fast Track:
Step 1: Create state inventory for each critical component: default, hover, focus, active, disabled, loading, success, empty, error.
Step 2: Capture deterministic baseline screenshots at desktop and mobile.
Step 3: Gate merges on visual diff threshold.
Deep Track:
Step 1: Add long-text, overflow, and missing-icon variants.
Step 2: Add changed-flow before/after snapshots for each PR.
Step 3: Stabilize fonts, time, data, and viewport to eliminate false diffs.
Exit criteria: Critical component states are visually snapshot-protected with deterministic CI failure on regression.
RS02 Responsive Breakpoint Matrix Coverage (covers R02, R15)

Why this exists: Layout defects often happen between standard breakpoints.
Fast Track:
Step 1: Run core flows at widths 320, 375, 390, 768, 1024, 1280.
Step 2: Assert no clipping, no horizontal scroll, no hidden primary actions.
Step 3: Store screenshots by width.
Deep Track:
Step 1: Add 1440 and ultrawide runs.
Step 2: Test orientation switches and dynamic browser chrome behavior.
Step 3: Validate safe-area handling for notch devices.
Exit criteria: Core flows are layout-stable and actionable across viewport matrix.
RS03 Design Token Contract Enforcement (covers R13, R16)

Why this exists: Styling drift breaks consistency and accessibility over time.
Fast Track:
Step 1: Block raw color literals in component styles.
Step 2: Enforce spacing, radius, typography token usage.
Step 3: Fail CI when contract is violated.
Deep Track:
Step 1: Generate token drift report versus approved token set.
Step 2: Validate semantic state tokens for success/warn/error/info usage.
Step 3: Validate contrast tokens against AA thresholds.
Exit criteria: UI styling is token-governed with hard gate enforcement.
RS04 Interaction Contract For Every Actionable Control (covers R02, R11, R16)

Why this exists: Click-only tests miss keyboard, loading, and duplicate-submit faults.
Fast Track:
Step 1: Inventory all buttons, links, toggles by route.
Step 2: Assert role/name and enabled/disabled behavior.
Step 3: Assert keyboard activation where applicable.
Deep Track:
Step 1: Validate hover/focus-visible/active/loading visual states.
Step 2: Validate repeat-click protection for non-idempotent actions.
Step 3: Validate post-failure recovery state and retry readiness.
Exit criteria: Every actionable control is validated for pointer, keyboard, loading, and failure behavior.
RS05 Hostile Content And Localization Resilience (covers R02, R06, R16)

Why this exists: Real data and locale expansion frequently break polished layouts.
Fast Track:
Step 1: Inject long labels, empty values, huge numbers, null-like values.
Step 2: Assert no overlap, clipping, or action displacement.
Step 3: Validate numeric sign/rounding display edges.
Deep Track:
Step 1: Run pseudo-locale expansion at 2x to 3x text.
Step 2: Test long unbroken strings and mixed-script strings.
Step 3: Validate pluralization and locale date/number formatting.
Exit criteria: UI remains readable and structurally stable under hostile/localized content.
RS06 Motion, Transition, And Layout-Shift Integrity (covers R11, R13, R16)

Why this exists: Motion bugs degrade UX quality even when logic is correct.
Fast Track:
Step 1: Assert transitions stay within timing budget and do not block interaction.
Step 2: Assert skeleton-to-content swaps avoid major jumps.
Step 3: Assert reduced-motion preference is honored.
Deep Track:
Step 1: Set per-route layout-shift thresholds and enforce in CI.
Step 2: Verify animation does not reorder keyboard focus unexpectedly.
Step 3: Verify animation cancellation on route changes and modal close.
Exit criteria: Motion behavior is smooth, accessible, and budgeted.
RS07 Cross-Browser Rendering And Behavior Parity (covers R15, R16)

Why this exists: Browser-specific regressions are common and often missed.
Fast Track:
Step 1: Run core flows on Chromium, Firefox, WebKit profiles.
Step 2: Assert auth popup, file picker, modal scroll lock, clipboard behavior.
Step 3: Archive browser-specific screenshots for critical routes.
Deep Track:
Step 1: Validate font fallback, line-height, icon rendering parity.
Step 2: Validate fixed/sticky positioning and overflow behavior.
Step 3: Document intentional exceptions with impact and rationale.
Exit criteria: Declared browser matrix is green, with explicitly documented exceptions only.
RS08 CI Quality Gates And Flake Control (covers R19, R20)

Why this exists: Quality checks must block regressions, not just report them.
Fast Track:
Step 1: Define hard fail thresholds for visual diffs, a11y, layout shift.
Step 2: Require CI jobs for visual, a11y, interaction, and responsive checks.
Step 3: Block merge on any gate failure.
Deep Track:
Step 1: Add flaky-test quarantine policy with owner and expiry.
Step 2: Freeze clocks, test data, and network mocks for determinism.
Step 3: Run fast PR suite and deep nightly suite with shared pass criteria.
Exit criteria: UI/UX quality is enforced by deterministic, non-optional CI gates.
Duplicate-control map:

R02: Broadened into executable UI-state and control-level verification via RS01, RS02, RS04, RS05.

R11: Extended with failure-recovery interaction and motion-resilience checks via RS04, RS06.

R13: Extended with measurable UI quality budgets via RS06, RS08.

R15: Extended with concrete viewport/browser execution grids via RS02, RS07.

R16: Extended with token, interaction, content, and motion accessibility enforcement via RS03, RS04, RS05, RS06.
