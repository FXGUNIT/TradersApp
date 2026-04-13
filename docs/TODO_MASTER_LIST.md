# TODO Master List

**Last updated:** 2026-04-13
**Format version:** 2.0 — real-time multi-agent coordination protocol

---

## How This Doc Works

### Task State Convention

Every task uses one of these four prefixes — nothing else:

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
// Active claims — claimed by which agent, expires when done
// Format: "TaskID": { "claimed_by": "agent-name", "claimed_at": "ISO timestamp" }
{
  "M01": { "claimed_by": null, "claimed_at": null },
  "M02": { "claimed_by": null, "claimed_at": null },
  "M03": { "claimed_by": null, "claimed_at": null },
  "M04": { "claimed_by": null, "claimed_at": null },
  "M05": { "claimed_by": null, "claimed_at": null }
}
```

### Live Status Table (auto-generated — do not edit)

Run `python scripts/update_todo_progress.py --once` to regenerate.

<!-- live-status:start -->
## Live Status
Generated: `2026-04-13 03:37`  ·  Run `python scripts/update_todo_progress.py --once` to update

| Section | Tasks | Progress | Status |
|---|---|---:|---|
| Stage M | [3/5] |  60.0% | 🔄 IN PROGRESS |
| Stage N | [5/5] | 100.0% | ✅ COMPLETE |
| Stage O | [0/25] |   0.0% | 🔄 IN PROGRESS |

<!-- live-status:end -->




## Stage M: Kubernetes HPA Live Scaling Validation

> **Claimed by:** (update the JSON coordination block above before starting)
> **Trigger (2026-04-12):** Validate HPA manifests for ml-engine and bff in `tradersapp-dev`.

> **Update (2026-04-13):**
> - `M01`, `M03`, and `M05` are now complete live.
> - `metrics-server` is installed and both HPAs reached `ScalingActive: True`, but `M02` stays partial because the Metrics API can still briefly flap under aggressive end-to-end load.
> - `scripts/k8s/validate-hpa-ml-engine.sh` now proves live ml-engine scale-up (`1` → `3`) cleanly, and `scripts/k8s/run-hpa-scaling-test.sh` was upgraded to use real in-cluster `/predict` load.
> - `M04` is near-complete but still needs one clean umbrella-script rerun for the final scale-down phase after the Metrics API stabilizes fully.
> - Additional 2026-04-13 validation showed the umbrella runner now fails accurately instead of false-passing, but repeated `300s` scale-down stabilization windows still require a longer wait budget for a clean end-to-end closeout.

- [x] `M01` Apply and validate HPA manifests for ml-engine and bff in `tradersapp-dev`.
  - updated: 2026-04-12 23:xx
  - **Blockers (2026-04-12):**
    - `metrics.k8s.io` not registered — `ScalingActive: False`
    - `ml-models-pvc` and `ml-state-pvc` both `Bound` but pods blocked by transient DNS failures on `tradersapp-postgres` and `redis`
    - Post-startup probe failures on `ml-engine` / `bff`
  - **Runbook:** `docs/HPA_SCALING_TEST_RUNBOOK.md`
  - **Test script:** `scripts/k8s/run-hpa-scaling-test.sh`
  - **Startup hardening:** repo updated — PostgreSQL bootstrap retries on first lookup miss
  - **Status:** M01 DONE (cluster assessed, HPAs applied, blockers documented, runbook created) — blocked on metrics-server + rebuild/redeploy to verify startup hardening live

- [-] `M02` Install metrics-server and verify `ScalingActive: True` on both HPAs.
  - updated: 2026-04-12
  - `metrics-server` present but unhealthy — `FailedDiscoveryCheck`, `kubectl top` fails
  - `v1beta1.metrics.k8s.io` reports flapping health — both HPAs at `ScalingActive: False`
  - **Status:** in progress — needs metrics-server repair before M02 can close

- [x] `M03` Fix ml-engine PVC issues (ml-models-pvc + ml-state-pvc) so pods reach Running state.
  - updated: 2026-04-12
  - Both PVCs `Bound` — blocker moved to transient startup DNS resolution
  - PostgreSQL bootstrap retry fix committed (ml-engine startup hardening)
  - **Status:** in progress — blocked on rebuild/redeploy of ml-engine with startup hardening fix

- [-] `M04` Run `scripts/k8s/run-hpa-scaling-test.sh` end-to-end; verify replicas scale up under load and scale down after idle.
  - updated: 2026-04-12
  - Blocked by: M02 (metrics-server stability) + M03 (ml-engine rebuild)
  - **Status:** blocked — cannot verify until HPAs are `ScalingActive: True`

- [x] `M05` Verify bff HPA scales independently from ml-engine under BFF-targeted load.
  - updated: 2026-04-12
  - Live `bff-hpa` scaled independently from `2→3→2` — partial verification done
  - `ml-engine-hpa` scaled above floor live but scale-down noisy due to Metrics API flapping
  - **Status:** in progress — clean scale-down verification blocked on metrics-server stability

---

## Stage N: Training Data Eligibility Policy — COMPLETE

- [x] `N01` Add persisted eligibility-tracking fields for training data and user activity.
  - committed: 2026-04-12 | `days_used` / `daysUsed`, `last_active_day`, `is_training_eligible`
  - Admin-originated data always bypasses the 10-day gate

- [x] `N02` Increment `days_used` once per distinct day when a user opens the app.
  - committed: 2026-04-12 | duplicate opens in same calendar day do not increment

- [x] `N03` Gate retraining inputs so admin data always included; non-admin excluded until `days_used >= 10`.
  - committed: 2026-04-12 | pre-threshold data stored but filtered via `is_training_eligible`

- [x] `N04` Add user-facing data-policy messaging.
  - committed: 2026-04-12 | pre-day-10: "Unlock more AI accuracy after 10 days of usage" | day-10+: "Your data is now used for AI training"

- [x] `N05` Add verification coverage for all eligibility paths.
  - committed: 2026-04-12 | signup init, daily-open counting, admin bypass, day-10 transition, nightly batch, retrain-batch filtering

---

## Phase Summary (Historical — all complete)

| Phase | Tasks | Status |
|---|---|---|
| Phase 1: Audits | 3 | ✅ Complete |
| Phase 2: Stateless Service Layer | 10 | ✅ Complete |
| Phase 3: Kubernetes Infrastructure | 15 | ✅ Complete |
| Phase 4: Kafka Message Queue Architecture | 9 | ✅ Complete |
| Phase 5: Observability | 9 | ✅ Complete |
| Phase 6: Frontend/React Architecture | 14 | ✅ Complete |
| Phase 7: ML Pipeline & Training | 15 | ✅ Complete |
| Phase 8: Data Pipeline & DVC | 6 | ✅ Complete |
| Phase 9: Deployment & Infrastructure | 12 | ✅ Complete |
| Phase 10: Security & Secrets | 5 | ✅ Complete |
| Phase 11: Performance Optimization | 1 | ✅ Complete |
| Phase 12: Architecture Truth & Documentation | 12 | ✅ Complete |

---

## Notes

- Secrets: Infisical is upstream source of truth — verify Kubernetes Secrets exist and contain expected keys at runtime.
- For production storage: Longhorn. `shared-rwx` local-path is WSL/dev only.
- For Kafka: exactly-once semantics implemented (K02), consumer group IDs pod-aware (K01), DLQ with retry tracking in place (E06), symbol-based partition keys (K05), lag monitoring wired to Prometheus (K04).
- Local dev: Docker Compose (`docker-compose.dev.yml`). k3s for staging/production only.
- For 24/7 free hosting: Oracle Cloud Always Free (`docker-compose.oci.yml`).

---

## Change Log (append-only)

```
2026-04-13 02:24 | CLAUDE-CODE | REDESIGNED | Protocol v2.0 — atomic update rules, coordination JSON block, append-only change log, validation script
2026-04-12       | AI-AGENTS   | COMPLETE  | Phases 1-12 all 100%, Stage M in progress (M01-M05), Stage N complete (N01-N05)
```

## Stage O: Board Room — AI Agent Communication Layer

> **Spec:** `docs/superpowers/specs/2026-04-13-board-room-design.md`
> **Trigger (2026-04-13):** Notion-style workspace inside Admin Dashboard — all AI agents communicate via threads with CEO approval, Telegram escalation, JSONL audit log, Firebase backend.

**Phase O1 — Board Room Core**
- [-] `O01` Implement `bff/services/boardRoomService.mjs` — thread CRUD, post CRUD, agent memory, Firebase reads/writes, JSONL logger
- [-] `O02` Create `bff/routes/boardRoomRoutes.mjs` — HTTP API surface for all board room operations
- [-] `O03` Register board room routes in `bff/server.mjs`
- [-] `O04` Implement `bff/services/boardRoomTelegram.mjs` — Telegram alert sender for HIGH/CRITICAL events
- [-] `O05` Add board room auth to `bff/services/security.mjs` — CEO-only operations (close thread, approve plan) server-side validated

**Phase O2 — Frontend UI**
- [-] `O06` Create `src/features/admin-security/BoardRoom/` directory with BoardRoom.jsx, BoardRoomSidebar.jsx, BoardRoomThread.jsx, BoardRoomPost.jsx, BoardRoomTask.jsx
- [-] `O07` Create `BoardRoomClient.js` — BFF API calls for board room
- [-] `O08` Create `boardRoomStore.js` — Zustand state management for board room UI
- [-] `O09` Create `AgentScorecard.jsx` — bottom bar with per-agent stats
- [-] `O10` Embed BoardRoom as a tab inside `AdminDashboardScreen.jsx`
- [-] `O11` Implement thread filters: by priority, status, agent, tag
- [-] `O12` Implement thread templates: Bug Report, Feature Proposal, Architecture Decision, Performance Improvement

**Phase O3 — Agent Integration**
- [-] `O13` Integrate board room into ML Engine agents: predictor.py, session_probability.py, alpha_engine.py, consensus_aggregator.py
- [-] `O14` Integrate board room into BFF agents: consensusEngine.mjs, newsService.mjs
- [-] `O15` Integrate board room into Frontend agents: ai-router.js all provider wrappers
- [-] `O16` Implement 1.5-hour heartbeat loop for all agents

**Phase O4 — Notification & Approval Flow**
- [-] `O17` Wire Telegram alerts: HIGH/CRITICAL on thread open, suggestion, error, 3hr ack timeout auto-escalation
- [-] `O18` Implement plan approval flow — CEO approves/rejects plans, agent notified
- [-] `O19` Implement 3-hour acknowledgment window with timer display in UI

**Phase O5 — Git Auto-Link & Automation**
- [-] `O20` BFF git webhook handler — detect `[T{ticketId}]` in commit messages, auto-link commit to thread, post milestone
- [-] `O21` Implement weekly digest (Sunday 9 AM IST) — active threads, needs CEO action, stale threads, inactive agents
- [-] `O22` Stale thread handling — auto-warning at day 7, flag at day 14 in digest

**Phase O6 — Agent Scorecard & Advanced Features**
- [-] `O23` Agent scorecard: avg ack time, plans approved/rejected ratio, last heartbeat, active task count
- [-] `O24` Sub-threads: agents can open sub-thread linked to parent thread
- [-] `O25` JSONL log rotation: daily files, keep 90 days, archive older to DVC
