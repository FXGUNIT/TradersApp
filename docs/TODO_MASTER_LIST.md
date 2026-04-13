# TODO Master List

**Last updated:** 2026-04-14
**Format version:** 2.0 â€” real-time multi-agent coordination protocol

---

## How This Doc Works

### Task State Convention

Every task uses one of these four prefixes â€” nothing else:

| Prefix | Meaning |
| ------ | ------- |
| `[ ]` | Not started |
| `[-]` | In progress (with inline status) |
| `[x]` | Done (with commit hash + date) |
| `[!]` | Blocked (with blocker reason) |

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
  "R01": { "claimed_by": null, "claimed_at": null },
  "R02": { "claimed_by": null, "claimed_at": null },
  "R03": { "claimed_by": null, "claimed_at": null },
  "R04": { "claimed_by": null, "claimed_at": null },
  "R05": { "claimed_by": null, "claimed_at": null },
  "R06": { "claimed_by": null, "claimed_at": null },
  "R07": { "claimed_by": null, "claimed_at": null },
  "R08": { "claimed_by": null, "claimed_at": null },
  "R09": { "claimed_by": null, "claimed_at": null },
  "R10": { "claimed_by": null, "claimed_at": null },
  "R11": { "claimed_by": null, "claimed_at": null },
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
Generated: `2026-04-14 00:01`  ·  Run `python scripts/update_todo_progress.py --once` to update

```text
Active Backlog    0.0%  [------------------------]
Stage Progress  00/01 complete
Task Counts     done 000 | in progress 000 | blocked 000 | todo 020 | total 020
```

| Section | Tasks | Progress | Status |
|---|---|---:|---|
| Stage R | [0/20] |   0.0% | PENDING |

<!-- live-status:end -->








































## Phase Summary (Historical â€” all complete)

| Phase | Tasks | Status |
|---|---|---|
| Phase 1: Audits | 3 | âœ… Complete |
| Phase 2: Stateless Service Layer | 10 | âœ… Complete |
| Phase 3: Kubernetes Infrastructure | 15 | âœ… Complete |
| Phase 4: Kafka Message Queue Architecture | 9 | âœ… Complete |
| Phase 5: Observability | 9 | âœ… Complete |
| Phase 6: Frontend/React Architecture | 14 | âœ… Complete |
| Phase 7: ML Pipeline & Training | 15 | âœ… Complete |
| Phase 8: Data Pipeline & DVC | 6 | âœ… Complete |
| Phase 9: Deployment & Infrastructure | 12 | âœ… Complete |
| Phase 10: Security & Secrets | 5 | âœ… Complete |
| Phase 11: Performance Optimization | 1 | âœ… Complete |
| Phase 12: Architecture Truth & Documentation | 12 | âœ… Complete |

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
```

## Stage R: Flawless Proof Gate

> **Claimed by:** (update the JSON coordination block above before starting)
> **Trigger (2026-04-13):** User requested a complete, explicit checklist of everything still required before the app could honestly be called "flawless."
> **Definition:** This stage is not cosmetic cleanup. It is the proof burden that would need to be satisfied before making an absolute-quality claim.
> **Rule of interpretation:** A task in this stage is only done when the proof artifacts exist, the checks are repeatable, and the result survives reruns without hidden manual fixes.

- [ ] `R01` Prove fresh-clone reproducibility from a clean environment.
  - **Why this exists:** A system cannot be called flawless if it only works on the current machine because of cached dependencies, leftover secrets, manual fixes, or hidden environment state.
  - **Step 1:** Create a truly clean environment: no existing `node_modules`, no prebuilt `dist`, no warmed Python virtualenv, no cached browser profile, and no manually pre-seeded app state.
  - **Step 2:** Use only documented setup steps from repo docs. If any undocumented command, file edit, environment variable, or retry is required, record it as a gap immediately.
  - **Step 3:** Verify the clean environment can complete install, build, lint, service startup, and smoke verification without ad-hoc intervention.
  - **Step 4:** Capture exact tool versions for Node, npm, Python, Docker, and OS so success is tied to a reproducible baseline rather than memory.
  - **Step 5:** Repeat the same process in at least one second disposable environment so the repo is not accidentally "working once."
  - **Exit criteria:** Two clean-environment passes with zero undocumented manual interventions and a written install/bootstrap artifact.

- [ ] `R02` Prove all real frontend flows work end to end, not just the audited subset.
  - **Why this exists:** Passing build and smoke checks is not the same as proving every user-facing flow behaves correctly.
  - **Step 1:** Build a screen and route inventory that includes login, Google auth, password reset, signup, waiting room, hub, terminal, collective consciousness, sessions, admin dashboard, Board Room, footer links, and any hidden modal or drawer flows.
  - **Step 2:** For each screen, record entry conditions, expected visible states, allowed actions, exit paths, and error states.
  - **Step 3:** Add deterministic UI verification for all missing routes or interactions that are not currently covered by `audit:ui` and `audit:ui:mobile`.
  - **Step 4:** Verify back navigation, refresh behavior, stale state recovery, repeated open/close cycles, and tab changes.
  - **Step 5:** Confirm empty-state, loading-state, success-state, and failure-state rendering for each major screen.
  - **Exit criteria:** A complete flow matrix exists and every listed user path is automated or explicitly manually verified with proof.

- [ ] `R03` Prove authentication, session lifecycle, and account recovery are correct.
  - **Why this exists:** A single auth edge-case bug can invalidate any claim of flawless behavior.
  - **Step 1:** Verify email/password login success, invalid credentials, locked/disabled user behavior, and partial-input validation.
  - **Step 2:** Verify Google auth success, cancellation, popup failure, blocked popup, and audit-mode fallback do not leave corrupted auth state.
  - **Step 3:** Verify forgot-password flow, password reset token handling, forced password reset, repeat reset attempts, and post-reset session state.
  - **Step 4:** Verify logout, logout-all-other-devices, expired session, stale token, and refresh-after-expiry behavior.
  - **Step 5:** Verify duplicate logins from multiple devices/tabs do not create inconsistent sessions or silent privilege leakage.
  - **Exit criteria:** Auth lifecycle tests cover success, expected failure, forced recovery, expiry, and multi-session edge cases.

- [ ] `R04` Prove admin-only and CEO-only permissions cannot be bypassed.
  - **Why this exists:** If a normal user can reach or trigger a privileged action, the app is not flawless regardless of UI polish.
  - **Step 1:** Enumerate every privileged UI entry point and every privileged BFF route, including admin dashboard, Board Room approvals, close-thread actions, invite flows, and any identity/admin endpoints.
  - **Step 2:** Verify normal users cannot open privileged screens via direct URL, client-side state mutation, cached UI state, or stale tokens.
  - **Step 3:** Verify server-side rejection for unauthorized requests even when the frontend tries to force the action.
  - **Step 4:** Verify role downgrade, role change mid-session, and expired-admin-session behavior.
  - **Step 5:** Verify all denial paths are safe: correct status code, no sensitive data leak, and no partial side effects.
  - **Exit criteria:** Every privileged action is proven to fail safely for non-privileged identities and succeed only for the correct role.

- [ ] `R05` Prove file-upload, screenshot, and OCR flows are robust.
  - **Why this exists:** Upload surfaces are common sources of crashes, stale state, silent truncation, and security bugs.
  - **Step 1:** Verify happy-path upload for screenshots, MP chart, and VWAP chart across supported file types and normal file sizes.
  - **Step 2:** Verify rejection behavior for oversized files, unsupported file types, corrupted files, duplicate uploads, and too-many-files conditions.
  - **Step 3:** Verify OCR fallback behavior, partial OCR failure handling, and user-visible messaging when recognition quality is poor or unavailable.
  - **Step 4:** Verify deletion/replacement of uploaded files does not leave stale previews, stale counts, or orphaned temp state.
  - **Step 5:** Verify retry behavior and recovery after refresh or service interruption during upload.
  - **Exit criteria:** Upload/OCR flows are deterministic, safe on invalid input, and free of stale UI or silent data loss.

- [ ] `R06` Prove trading, journal, account, and displayed metrics are numerically correct.
  - **Why this exists:** A polished UI with wrong balances, wrong P&L, or inconsistent journal state is still broken.
  - **Step 1:** Enumerate every displayed numeric field in terminal, journal, account, analytics, and any admin summaries.
  - **Step 2:** Build reference fixtures with known expected totals, averages, win/loss ratios, balances, and edge-case values.
  - **Step 3:** Verify create/edit/delete flows for journal entries and confirm all dependent summaries update immediately and correctly.
  - **Step 4:** Verify rounding, sign handling, zero values, negative values, and large values do not render incorrectly.
  - **Step 5:** Verify refresh, route change, and service restart do not change computed results unexpectedly.
  - **Exit criteria:** Every user-visible trading number is traceable to a known-good reference and stays correct across interaction cycles.

- [ ] `R07` Prove all BFF routes satisfy their contracts under success and failure.
  - **Why this exists:** If route behavior is undefined or inconsistently validated, the frontend may appear stable while the backend is not.
  - **Step 1:** Inventory all BFF routes and group them by domain: identity, Board Room, health, integration, admin, and auxiliary service calls.
  - **Step 2:** For each route, define required auth, accepted payload shape, expected response shape, failure status codes, and side effects.
  - **Step 3:** Add or expand tests for malformed payloads, missing fields, duplicate submissions, unauthorized access, and upstream dependency failures.
  - **Step 4:** Verify route handlers do not leak stack traces, internal config, or sensitive values in error responses.
  - **Step 5:** Verify idempotency or duplicate-request behavior where repeated requests are likely.
  - **Exit criteria:** Every BFF route has explicit contract coverage for happy path, validation failures, auth failures, and upstream faults.

- [ ] `R08` Prove ML Engine routes, models, and workflow contracts are stable.
  - **Why this exists:** An app that "looks fine" but produces unstable inference or route behavior is not flawless.
  - **Step 1:** Inventory ML Engine health, prediction, workflow, metrics, exporter, and any auxiliary routes exposed to the stack.
  - **Step 2:** Verify model loading, schema compatibility, serialized artifact compatibility, and fallback behavior after restart.
  - **Step 3:** Add coverage for invalid payloads, missing fields, large payloads, incompatible schema versions, and degraded-dependency modes.
  - **Step 4:** Verify deterministic behavior for fixtures where outputs should be stable or bounded.
  - **Step 5:** Verify route-level latency regressions, startup time regressions, and health endpoint truthfulness.
  - **Exit criteria:** ML Engine behavior is contract-tested, artifact-compatible, and stable under both normal and invalid inputs.

- [ ] `R09` Prove cross-service integration works under real orchestration, not just isolated tests.
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

- [ ] `R11` Prove error handling and graceful degradation across expected failure modes.
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
