# TODO Master List

**Last updated:** 2026-04-13
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
  "M01": { "claimed_by": null, "claimed_at": null },
  "M02": { "claimed_by": null, "claimed_at": null },
  "M03": { "claimed_by": null, "claimed_at": null },
  "M04": { "claimed_by": null, "claimed_at": null },
  "M05": { "claimed_by": null, "claimed_at": null },
  "P01": { "claimed_by": null, "claimed_at": null },
  "P02": { "claimed_by": null, "claimed_at": null },
  "P03": { "claimed_by": null, "claimed_at": null },
  "P04": { "claimed_by": null, "claimed_at": null },
  "Q01": { "claimed_by": null, "claimed_at": null },
  "Q02": { "claimed_by": null, "claimed_at": null },
  "Q03": { "claimed_by": null, "claimed_at": null },
  "Q04": { "claimed_by": null, "claimed_at": null },
  "Q05": { "claimed_by": null, "claimed_at": null },
  "Q06": { "claimed_by": null, "claimed_at": null }
}
```

### Live Status Table (auto-generated â€” do not edit)

Run `python scripts/update_todo_progress.py --once` to regenerate.

<!-- live-status:start -->
## Live Status
Generated: `2026-04-13 17:27`  ·  Run `python scripts/update_todo_progress.py --once` to update

| Section | Tasks | Progress | Status |
|---|---|---:|---|
| Stage M | [5/5] | 100.0% | ✅ COMPLETE |
| Stage N | [5/5] | 100.0% | ✅ COMPLETE |
| Stage P | [4/4] | 100.0% | ✅ COMPLETE |
| Stage Q | [4/6] |  66.7% | 🔄 IN PROGRESS |
| Stage O | [25/25] | 100.0% | ✅ COMPLETE |

<!-- live-status:end -->

















## Stage M: Kubernetes HPA Live Scaling Validation

> **Claimed by:** (update the JSON coordination block above before starting)
> **Trigger (2026-04-12):** Validate HPA manifests for ml-engine and bff in `tradersapp-dev`.

> **Update (2026-04-13):**
> - `M01`, `M03`, and `M05` are now complete live.
> - `metrics-server` is installed, `v1beta1.metrics.k8s.io` is back to `Available=True`, and both HPAs now hold `ScalingActive: True` across the umbrella runner's clean preflight probe window.
> - `scripts/k8s/validate-hpa-ml-engine.sh` proved live ml-engine scale-up (`1` â†’ `3`) cleanly, and `scripts/k8s/run-hpa-scaling-test.sh` now uses real in-cluster `/predict` load plus baseline-aware scale-up detection.
> - `M04` closed live on 2026-04-13: `ml-engine` scaled from baseline `1` to `3` pods (`desired=4`) under sustained load and returned to baseline after idle.
> - Residual note: the Metrics API still dropped briefly twice during the long scale-down window, but it recovered and no longer blocks a clean Stage M pass.

- [x] `M01` Apply and validate HPA manifests for ml-engine and bff in `tradersapp-dev`.
  - updated: 2026-04-12 23:xx
  - **Blockers (2026-04-12):**
    - `metrics.k8s.io` not registered â€” `ScalingActive: False`
    - `ml-models-pvc` and `ml-state-pvc` both `Bound` but pods blocked by transient DNS failures on `tradersapp-postgres` and `redis`
    - Post-startup probe failures on `ml-engine` / `bff`
  - **Runbook:** `docs/HPA_SCALING_TEST_RUNBOOK.md`
  - **Test script:** `scripts/k8s/run-hpa-scaling-test.sh`
  - **Startup hardening:** repo updated â€” PostgreSQL bootstrap retries on first lookup miss
  - **Status:** M01 DONE (cluster assessed, HPAs applied, blockers documented, runbook created) â€” blocked on metrics-server + rebuild/redeploy to verify startup hardening live

- [x] `M02` Install metrics-server and verify `ScalingActive: True` on both HPAs.
  - updated: 2026-04-13 15:12
  - Live checks now show `kubectl get apiservice v1beta1.metrics.k8s.io` = `Available=True` and `kubectl top nodes` working again
  - The umbrella runner held a clean `3/3` preflight probe window with both `ml-engine-hpa` and `bff-hpa` reporting `ScalingActive=True`
  - **Status:** M02 DONE â€” metrics-server repair is live and sufficient for Stage M validation, with only brief transient flaps remaining under heavy cooldown polling

- [x] `M03` Fix ml-engine PVC issues (ml-models-pvc + ml-state-pvc) so pods reach Running state.
  - updated: 2026-04-12
  - Both PVCs `Bound` â€” blocker moved to transient startup DNS resolution
  - PostgreSQL bootstrap retry fix committed (ml-engine startup hardening)
  - **Status:** in progress â€” blocked on rebuild/redeploy of ml-engine with startup hardening fix

- [x] `M04` Run `scripts/k8s/run-hpa-scaling-test.sh` end-to-end; verify replicas scale up under load and scale down after idle.
  - updated: 2026-04-13 15:12
  - Umbrella runner fix: scale-up detection now compares against the live baseline instead of a hardcoded `> 1`, preventing false positives when `ml-engine` is already above floor
  - Live pass artifact: `.artifacts/hpa-scaling-test-live-20260413-092043/result.txt` = `PASS`
  - Verified cycle: baseline `1` â†’ scale-up detected at `replicas=3`, `desired=4` after `30s` of sustained `/predict` load â†’ scale-down returned to baseline `1`
  - **Status:** M04 DONE â€” end-to-end HPA validation passed on the live cluster

- [x] `M05` Verify bff HPA scales independently from ml-engine under BFF-targeted load.
  - updated: 2026-04-12
  - Live `bff-hpa` scaled independently from `2â†’3â†’2` â€” partial verification done
  - `ml-engine-hpa` scaled above floor live but scale-down noisy due to Metrics API flapping
  - **Status:** in progress â€” clean scale-down verification blocked on metrics-server stability

---

## Stage N: Training Data Eligibility Policy â€” COMPLETE

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

## Stage P: Residual Dev Cluster Reconciliation

> **Claimed by:** `codex`
> **Trigger (2026-04-13):** Stage M closed, but follow-up inspection found real leftover work that was never modeled in the master list.

> **Discovery summary (2026-04-13):**
> - `values.dev.yaml` disables the MLflow stack, but the dev config path still points `ml-engine` at `MLFLOW_TRACKING_URI=http://mlflow:5000`.
> - The live `tradersapp-dev` namespace still contains a broken `minio-setup` hook job that waits on `mlflow-runtime-secret`, even though no `mlflow` or `minio` services are currently deployed there.
> - The umbrella HPA runner still warns about `custom.metrics.k8s.io` during CPU/memory-only dev validation even when the validated HPAs do not use custom metrics.
> - `metrics.k8s.io` recovered enough for Stage M to pass, but transient drops still appear during very long scale-down windows and need follow-up hardening or a tighter operator procedure.

- [x] `P01` Reconcile dev MLflow mode in repo config and runtime.
  - updated: 2026-04-13 16:58
  - `values.dev.yaml`, `k8s/overlay/dev/config.yaml`, and `scripts/admin/k3s-dev-bootstrap.ps1` now use `MLFLOW_TRACKING_URI=disabled` for the current dev path
  - `ml-engine` MLflow client/runtime now treats disabled tracking as intentional, and `/mlflow/*` routes report disabled mode cleanly instead of implying a broken server
  - Helm `ml-engine` template now ties `MLFLOW_USE_REGISTRY` to `.Values.mlflow.enabled` instead of hardcoding registry mode on
  - **Status:** P01 DONE — the repo now has an explicit, internally consistent "MLflow disabled in dev" mode

- [x] `P02` Clean stale MLflow bootstrap drift from the live `tradersapp-dev` namespace.
  - updated: 2026-04-13 16:58
  - Live namespace patched so `ml-engine` now runs with `MLFLOW_TRACKING_URI=disabled` and `MLFLOW_USE_REGISTRY=false`
  - `ml-engine-config` and `ml-engine-secrets` were aligned to `disabled`, `deployment/ml-engine` rolled out successfully, and the orphaned `job/minio-setup` was deleted
  - Follow-up object sweep shows no remaining `mlflow` / `minio` jobs, services, or deployments in `tradersapp-dev`
  - **Status:** P02 DONE — live dev namespace now matches the current MLflow-disabled dev intent

- [x] `P03` Make HPA validation tooling dev-aware for resource-only HPAs.
  - updated: 2026-04-13 16:58
  - `scripts/k8s/run-hpa-scaling-test.sh` now inspects HPA metric types before checking `custom.metrics.k8s.io`
  - CPU/memory-only dev runs skip the custom-metrics warning and keep the existing metrics-server / `ScalingActive` preflight intact
  - **Status:** P03 DONE — HPA validation output is now aligned with the actual metric types under test

- [x] `P04` Stabilize or operationalize transient Metrics API flap handling beyond the Stage M pass.
  - updated: 2026-04-13 16:58
  - Added `scripts/k8s/diagnose-metrics-api-stability.sh` to sample APIService health, `kubectl top`, metrics-server readiness/restarts, and HPA `ScalingActive` over a timed window
  - Documented the new probe in `docs/HPA_SCALING_TEST_RUNBOOK.md`
  - Smoke validation artifact: `.artifacts/metrics-api-stability-smoke-20260413-102515/summary.txt` = `PASS`
  - **Status:** P04 DONE — cooldown-window diagnostics are now operationalized in the repo

---

## Stage Q: Effortless Local Dev + Model Registry Cleanup

> **Claimed by:** (update the JSON coordination block above before starting)
> **Trigger (2026-04-13):** No remaining tasks in master list, but "app runs effortlessly" requires local dev quickstart, health checks, and model registry TODO cleanup.

- [x] `Q01` Publish Local Dev Quickstart doc (docker-compose tiers + `dev-up.ps1`), and update docs index to reference it.
  - updated: 2026-04-13 22:35
  - Added `docs/LOCAL_DEV.md`; updated `docs/index.md` to point to it and clarify `SETUP.md` is prod deployment.

- [x] `Q02` Add a dev smoke script to validate frontend/BFF/ML Engine health endpoints in one command.
  - updated: 2026-04-13 22:35
  - Added `scripts/dev-smoke.ps1`.

- [x] `Q03` Reconcile MODEL_REGISTRY TODOs with actual artifacts; document AMD ONNX + Mamba TorchScript status.
  - updated: 2026-04-13 22:35
  - Updated `docs/MODEL_REGISTRY.md` to remove TODOs, document AMD ONNX status, and add `mamba_ssm` to repo layout.

- [!] `Q04` Install local dependencies and run a baseline frontend build for quick-start verification.
  - updated: 2026-04-13 22:35
  - Frontend + BFF `npm install` completed; `npm run build` now passes after fixing missing imports/exports.
  - **Blocker:** `python -m pip install -r ml-engine/requirements.txt` timed out (network access).

- [x] `Q05` Fix frontend container health endpoint (nginx) so Docker dev stack starts cleanly.
  - updated: 2026-04-13 22:35
  - Replaced unsupported `health_check;` with a `/health` route returning 200 OK.

- [-] `Q06` Remove frontend Docker build-network dependency from the dev stack so `dev-up.ps1` boots cleanly.
  - updated: 2026-04-13 22:57
  - `docker-compose.dev.yml` still builds the frontend image with `npm ci` inside Docker; the latest clean-stack run failed on registry timeout during that step.

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
```

## Stage O: Board Room â€” AI Agent Communication Layer

> **Spec:** `docs/superpowers/specs/2026-04-13-board-room-design.md`
> **Trigger (2026-04-13):** Notion-style workspace inside Admin Dashboard â€” all AI agents communicate via threads with CEO approval, Telegram escalation, JSONL audit log, Firebase backend.

**Phase O1 â€” Board Room Core**
- [x] `O01` Implement `bff/services/boardRoomService.mjs` â€” thread CRUD, post CRUD, agent memory, Firebase reads/writes, JSONL logger
- [x] `O02` Create `bff/routes/boardRoomRoutes.mjs` â€” HTTP API surface for all board room operations
- [x] `O03` Register board room routes in `bff/server.mjs`
- [x] `O04` Implement `bff/services/boardRoomTelegram.mjs` â€” Telegram alert sender for HIGH/CRITICAL events
- [x] `O05` Add board room auth to `bff/services/security.mjs` â€” CEO-only operations (close thread, approve plan) server-side validated

**Phase O2 â€” Frontend UI**
- [x] `O06` Create `src/features/admin-security/BoardRoom/` directory with BoardRoom.jsx, BoardRoomSidebar.jsx, BoardRoomThread.jsx, BoardRoomPost.jsx, BoardRoomTask.jsx
- [x] `O07` Create `BoardRoomClient.js` â€” BFF API calls for board room
- [x] `O08` Create `boardRoomStore.js` â€” Zustand state management for board room UI
- [x] `O09` Create `AgentScorecard.jsx` â€” bottom bar with per-agent stats
- [x] `O10` Embed BoardRoom as a tab inside `AdminDashboardScreen.jsx`
- [x] `O11` Implement thread filters: by priority, status, agent, tag
- [x] `O12` Implement thread templates: Bug Report, Feature Proposal, Architecture Decision, Performance Improvement

**Phase O3 â€” Agent Integration**
- [x] `O13` Integrate board room into ML Engine agents: predictor.py, session_probability.py, alpha_engine.py, consensus_aggregator.py
- [x] `O14` Integrate board room into BFF agents: consensusEngine.mjs, newsService.mjs
- [x] `O15` Integrate board room into Frontend agents: ai-router.js all provider wrappers
- [x] `O16` Implement 1.5-hour heartbeat loop for all agents

**Phase O4 â€” Notification & Approval Flow**
- [x] `O17` Wire Telegram alerts: HIGH/CRITICAL on thread open, suggestion, error, 3hr ack timeout auto-escalation
- [x] `O18` Implement plan approval flow â€” CEO approves/rejects plans, agent notified
- [x] `O19` Implement 3-hour acknowledgment window with timer display in UI

**Phase O5 â€” Git Auto-Link & Automation**
- [x] `O20` BFF git webhook handler â€” detect `[T{ticketId}]` in commit messages, auto-link commit to thread, post milestone
- [x] `O21` Implement weekly digest (Sunday 9 AM IST) â€” active threads, needs CEO action, stale threads, inactive agents
- [x] `O22` Stale thread handling â€” auto-warning at day 7, flag at day 14 in digest

**Phase O6 â€” Agent Scorecard & Advanced Features**
- [x] `O23` Agent scorecard: avg ack time, plans approved/rejected ratio, last heartbeat, active task count
- [x] `O24` Sub-threads: agents can open sub-thread linked to parent thread
- [x] `O25` JSONL log rotation: daily files, keep 90 days, archive older to DVC
