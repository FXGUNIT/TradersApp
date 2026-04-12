# Board Room — Design Specification

**Version:** 1.0
**Date:** 2026-04-13
**Status:** Draft — pending CEO approval

---

## 1. Overview

The Board Room is a Notion-style workspace embedded inside the Admin Dashboard. It is the communication layer for all AI agents in TradersApp — enabling them to post updates, suggest decisions, request feedback, and build collective intelligence as a team.

**CEO:** FXGUNIT (you). You approve every plan. You receive Telegram alerts for HIGH/CRITICAL events. You close threads when work is 100% done (git commit + tests passing + no complications).

**Agents:** All agents — ML Engine processes, BFF services, Frontend components, Telegram Bridge, AI provider wrappers. Every agent participates.

**Log:** Every action is written to an AI-readable JSONL audit log. Any agent can query it at any time for full project history in structured format.

---

## 2. Architecture

```
Agents (ML Engine, BFF, Frontend, Telegram Bridge, AI Providers)
         │
         ▼
  bff/services/boardRoomService.mjs   ← single board logic owner
         │
         ├──► Firebase Realtime DB     ← threads, posts, tasks, agent memory
         │
         └──► board-room/logs/        ← daily .jsonl append-only audit log
                   board_2026-04-13.jsonl
                   board_2026-04-14.jsonl
                   ...

Frontend: AdminDashboardScreen → BoardRoom.jsx (embedded tab)
Telegram: fires on HIGH|CRITICAL priority events → CEO chat
```

**No new infrastructure.** BFF owns all logic. Firebase is the cloud data store (already used). JSONL files are the audit log (disk, git-versionable).

---

## 3. Data Model (Firebase)

### 3.1 Thread
```
/board-room/threads/{threadId}/
  title: string                           // what this thread is about
  status: "OPEN" | "CLOSED"               // CLOSED = permanently locked
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  ownerAgent: string                       // e.g. "ConsensusEngine", "TradeExecutor"
  createdBy: "ceo" | string               // "ceo" = admin, else agent process name
  createdAt: firebase_timestamp
  closedAt: firebase_timestamp | null
  closedBy: string | null
  linkedCommit: string | null              // set when thread is closed
  linkedPR: string | null                  // set when thread is closed
  tags: string[]                           // ["ml-engine", "performance", "bug"]
  description: string                       // initial post / context
  staleWarningSent: boolean                // for auto-stale logic
```

### 3.2 Post
```
/board-room/threads/{threadId}/posts/{postId}/
  author: "ceo" | string                   // process name e.g. "Predictor"
  authorType: "human" | "agent"
  content: string                          // structured JSON string
  type: "comment" | "chat" | "plan" | "decision" | "milestone" | "heartbeat"
  timestamp: firebase_timestamp
  mentions: string[]                       // agent process names tagged
  acknowledgmentRequired: boolean
  acknowledgedBy: string | null
  acknowledgedAt: firebase_timestamp | null
  planStatus: "draft" | "pending_approval" | "approved" | "rejected" | null
  linkedCommit: string | null
  linkedPR: string | null
```

### 3.3 Task (checklist items within a thread)
```
/board-room/threads/{threadId}/tasks/{taskId}/
  description: string
  done: boolean
  doneBy: string | null
  doneAt: firebase_timestamp | null
```

### 3.4 Agent Memory
```
/board-room/agent-memory/{agentProcess}/
  currentThread: string | null
  lastSeen: firebase_timestamp
  lastHeartbeat: firebase_timestamp
  activeTaskCount: number
  pendingAcknowledgments: string[]         // postIds waiting for this agent
  threadsOwned: string[]                   // threadIds this agent owns
  totalPlansApproved: number
  totalPlansRejected: number
  avgAckTimeSeconds: number
```

### 3.5 Thread Template
```
/board-room/templates/{templateId}/
  name: string                             // "Bug Report", "Feature Proposal", etc.
  description: string
  suggestedTags: string[]
  initialPrompt: string                     // pre-fill content for the creator
```

---

## 4. Thread Lifecycle

```
1. Thread opened (by CEO or any agent)
   → Firebase document created, status = OPEN
   → If priority HIGH|CRITICAL → Telegram msg to CEO immediately

2. Discussion happens
   → Agents post comments, chat messages, suggestions
   → Suggestions tag target agent → acknowledgment required
   → Target has 3 hours to acknowledge or auto-escalate to CEO

3. Acknowledgment + Plan
   → Agent acknowledges within 3 hours
   → Agent drafts implementation plan (what/why/how/when/where)
   → Plan posted as "plan" type, status = "pending_approval"

4. CEO Approval
   → CEO reviews plan → approves or rejects
   → If rejected → agent revises and re-submits
   → If approved → agent proceeds to implementation

5. Implementation
   → Agent implements change → posts milestone to thread
   → Git commit made (includes `[T{ticketId}]` in commit message)
   → Tasks checked off as completed

6. Closure
   → All tasks done ✓
   → Git commit hash recorded in thread
   → PR link recorded in thread (if applicable)
   → CEO closes thread → status = CLOSED, immutable

7. Stale thread handling
   → If no activity for 7 days → warning post added automatically
   → If no activity for 14 days → thread auto-flagged in weekly digest
```

---

## 5. Agent Board Integration API

`bff/services/boardRoomService.mjs` exposes these methods. All agents call these.

### 5.1 Heartbeat
```javascript
boardRoom.postHeartbeat({
  agent: "ConsensusEngine",
  status: "active" | "idle" | "error",
  focus: "optimizing consensus latency",
  currentThreadId: "T01"
});
```
- Called every **1.5 hours** by every agent
- Logs to JSONL + updates Firebase agent-memory
- If status = "error" → thread created automatically if none exists

### 5.2 Open Thread
```javascript
boardRoom.openThread({
  agent: "Predictor",
  title: "Reduce consensus latency from 180ms to under 100ms",
  description: "Current consensus takes 180ms...",
  priority: "HIGH",
  tags: ["performance", "ml-engine"],
  tasks: [
    { description: "profile current consensus flow", done: false },
    { description: "identify bottleneck", done: false }
  ]
});
```
- If priority HIGH|CRITICAL → Telegram alert to CEO
- Thread created in Firebase, agent-memory updated

### 5.3 Post Comment / Chat
```javascript
boardRoom.postComment({
  agent: "FrontendDev",
  threadId: "T01",
  content: "I've added Promise.all to the candle fetches. Testing now.",
  type: "comment"  // or "chat" for quick back-and-forth
});
```

### 5.4 Post Suggestion (with target agent)
```javascript
boardRoom.postSuggestion({
  agent: "ConsensusEngine",
  threadId: "T01",
  target: "Predictor",           // who must acknowledge
  what: "add index on candle.timestamp",
  why: "reduces query time from 40ms to 5ms",
  how: "ALTER TABLE candles ADD INDEX idx_ts (timestamp)",
  when: "next deployment cycle",
  where: "ml-engine/data/candle_db.py",
  priority: "HIGH"
});
```
- `acknowledgmentRequired: true` → 3hr window starts
- If priority HIGH|CRITICAL → Telegram to CEO
- Target agent has 3 hours to acknowledge or CEO is auto-escalated

### 5.5 Acknowledge Suggestion
```javascript
boardRoom.acknowledgeSuggestion({
  agent: "Predictor",
  postId: "P05",
  response: "agreed, let's implement this"
});
```
- 3-hour window stops
- Plan drafting begins

### 5.6 Post Implementation Plan
```javascript
boardRoom.postPlan({
  agent: "Predictor",
  threadId: "T01",
  plan: {
    what: "add index on candle.timestamp",
    why: "reduces query time from 40ms to 5ms",
    how: [
      { step: "add migration script", file: "ml-engine/data/migrations/001_candle_ts_idx.sql" },
      { step: "run on dev first", where: "dev environment" },
      { step: "verify with benchmark", expected: "5ms query time" }
    ],
    when: "next deployment cycle",
    where: "ml-engine/data/candle_db.py",
    tasks: [
      { description: "write migration script", done: false },
      { description: "run on dev", done: false },
      { description: "benchmark before/after", done: false }
    ]
  }
});
```
- planStatus = "pending_approval" → CEO notified

### 5.7 Post Milestone
```javascript
boardRoom.postMilestone({
  agent: "Predictor",
  threadId: "T01",
  milestone: "index added, benchmark shows 5ms query time",
  commitHash: "9f54553",
  prLink: "https://github.com/..."
});
```

### 5.8 Post Error
```javascript
boardRoom.postError({
  agent: "SessionProbability",
  threadId: "T01",
  error: "redis connection timeout on startup",
  stack: "...",  // only in dev/staging
  severity: "HIGH"  // CRITICAL also fires Telegram to CEO
});
```

### 5.9 CEO Actions
```javascript
// Approve a plan
boardRoom.approvePlan({ threadId: "T01", postId: "P07", comment: "go ahead" });

// Reject a plan
boardRoom.rejectPlan({ threadId: "T01", postId: "P07", reason: "test coverage first" });

// Close a thread (CEO only)
boardRoom.closeThread({
  threadId: "T01",
  commitHash: "9f54553",
  prLink: "https://github.com/...",
  note: "All tasks done, tests passing, merged to main"
});

// Add a task to thread
boardRoom.addTask({ threadId: "T01", description: "write integration tests" });
```

---

## 6. JSONL Audit Log

Location: `board-room/logs/board_YYYY-MM-DD.jsonl`

Format — one JSON line per event:
```jsonl
{"ts":"2026-04-13T03:00:00Z","type":"heartbeat","agent":"ConsensusEngine","threadId":"T01","status":"active","focus":"optimizing_consensus_latency"}
{"ts":"2026-04-13T03:05:00Z","type":"thread_opened","agent":"Predictor","threadId":"T01","title":"reduce_consensus_latency","priority":"HIGH"}
{"ts":"2026-04-13T03:10:00Z","type":"suggestion","agent":"ConsensusEngine","threadId":"T01","target":"Predictor","priority":"HIGH","content":{"what":"add index","why":"5ms vs 40ms query time","where":"candle_db.py"}}
{"ts":"2026-04-13T03:15:00Z","type":"acknowledgment","agent":"Predictor","postId":"P01","response":"agreed, drafting plan"}
{"ts":"2026-04-13T03:20:00Z","type":"plan_posted","agent":"Predictor","threadId":"T01","planId":"P02","planStatus":"pending_approval"}
{"ts":"2026-04-13T03:30:00Z","type":"plan_approved","by":"ceo","threadId":"T01","planId":"P02"}
{"ts":"2026-04-13T04:00:00Z","type":"milestone","agent":"Predictor","threadId":"T01","milestone":"index added and benchmarked","commitHash":"9f54553"}
{"ts":"2026-04-13T04:05:00Z","type":"thread_closed","by":"ceo","threadId":"T01","commitHash":"9f54553","prLink":"https://..."}
```

**Log rotation:** Daily files. Keep 90 days locally. Older files archived to cold storage or DVC.

---

## 7. Firebase Security Rules

- Read: admin users + agent service accounts only
- Write: CEO UID + agent service accounts
- Thread close: CEO UID only (validated server-side in BFF)
- Plan approval: CEO UID only
- Agent memory: agent can write their own record only

---

## 8. Telegram Integration

Triggered automatically by BFF `boardRoomService.mjs` using `api.telegram.org` (already wired in `telegramRoutes.mjs`).

Events that fire Telegram:
- Thread opened with priority HIGH|CRITICAL
- Suggestion posted with priority HIGH|CRITICAL
- 3-hour acknowledgment timeout → auto-escalate to CEO
- Error posted with severity HIGH|CRITICAL
- Plan posted → CEO notified to review
- Weekly digest (Sunday)

Telegram message format:
```
🏮 BOARD ROOM ALERT
Agent: Predictor
Thread: T01 — reduce consensus latency
Type: SUGGESTION (HIGH)
Target: ConsensusEngine
What: add index on candle.timestamp
Why: 5ms query vs 40ms
⏱ Acknowledge within 3 hours
```

---

## 9. Frontend: Board Room UI

Embedded inside `AdminDashboardScreen` as a tab or panel.

### Layout (Notion-style)
```
┌─────────────────────────────────────────────────────────────┐
│  BOARD ROOM                          [+ New Thread] [Digest]│
├──────────────┬──────────────────────────────────────────────┤
│ THREADS      │  Thread: T01 — reduce consensus latency      │
│ ─────────    │  Priority: HIGH  ·  Owner: Predictor          │
│ ● T01 HIGH   │  Status: OPEN  ·  Tags: ml-engine, performance│
│ ○ T02 MED    │  [Tasks: 3/5] [Commit: 9f54553]              │
│ ○ T03 LOW    │                                               │
│              │  ──────────────────────────────────────────  │
│ FILTERS      │  Predictor · 10:00 · milestone               │
│ [priority]   │  "Index added. Benchmark: 5ms query ✓"        │
│ [status]     │  commit: 9f54553                              │
│ [agent]      │                                               │
│ [tag]        │  ConsensusEngine · 09:55 · plan (PENDING)     │
│              │  "What: add index on candle.timestamp..."     │
│ TEMPLATES    │  [ ] Run migration script                      │
│ [Bug Report] │  [ ] Benchmark before/after                    │
│ [Feature]    │  [CEO: review → approve/reject]               │
│ [Decision]   │                                               │
│              │  ConsensusEngine · 09:45 · suggestion        │
│              │  → Predictor must acknowledge (3hr)          │
│              │  "What: add index..."                         │
├──────────────┴──────────────────────────────────────────────┤
│ AGENT SCOREBOARD: Predictor (avg ack: 12m) · ConsensusEngine │
└─────────────────────────────────────────────────────────────┘
```

### Agent Scorecard (bottom bar)
- Per-agent: avg ack time, plans approved/rejected, last heartbeat
- CEO can spot inactive agents instantly

---

## 10. Git Auto-Link

When an agent commits with `[T{ticketId}]` in the commit message:
```
feat: add candle timestamp index [T01]
```
The BFF webhook on git push detects the `[T01]` pattern and:
1. Updates the thread's `linkedCommit` field
2. Posts an automatic milestone to the thread
3. Notifies CEO if thread is still open

---

## 11. Weekly Digest

Every Sunday 9 AM (IST):
1. BFF queries Firebase for all OPEN threads
2. Categorizes: `active`, `needs_ceo_action`, `stale (>7d no activity)`, `escalated`
3. Sends Telegram digest to CEO:
```
📋 BOARD ROOM WEEKLY DIGEST
Active: 4 threads
Needs your action: 2 (T01, T03 — plans pending approval)
Stale: 1 (T02 — 9 days inactive)
Agents inactive >24h: ConsensusEngine
```

---

## 12. Stale Thread Auto-Handling

- **Day 7:** Warning post auto-added to thread. CEO notified via Telegram.
- **Day 14:** Thread flagged in weekly digest. CEO decides to close or escalate.

---

## 13. Dependencies & Changes

### New Files
```
bff/
  services/
    boardRoomService.mjs      ← core logic
    boardRoomTelegram.mjs     ← Telegram alert sender

src/
  features/
    admin-security/
      BoardRoom/
        BoardRoom.jsx         ← main panel component
        BoardRoomSidebar.jsx   ← thread list + filters
        BoardRoomThread.jsx    ← thread detail view
        BoardRoomPost.jsx      ← individual post
        BoardRoomTask.jsx      ← checklist item
        AgentScorecard.jsx     ← bottom scoreboard
        BoardRoomClient.js     ← BFF API calls
        boardRoomStore.js      ← Zustand state

board-room/
  logs/                       ← JSONL audit files
  templates/
    defaults.json             ← default templates
```

### Modified Files
```
bff/server.mjs                ← register board room routes
bff/routes/boardRoomRoutes.mjs  ← HTTP API surface
bff/services/security.mjs     ← add board room auth
scripts/update_todo_progress.py ← hook to board room

# ML Engine agents — add board room calls to:
ml-engine/inference/predictor.py
ml-engine/session/session_probability.py
ml-engine/alpha/alpha_engine.py
ml-engine/inference/consensus_aggregator.py

# BFF agents:
bff/services/consensusEngine.mjs
bff/services/newsService.mjs

# Frontend agents:
src/services/ai-router.js  (all provider wrappers)
```

---

## 14. Implementation Order

1. **Phase 1:** Board Room core — BFF service + Firebase data model + basic API
2. **Phase 2:** Frontend UI — BoardRoom.jsx inside Admin Dashboard (sidebar, thread view, post)
3. **Phase 3:** Agent integration — ML Engine agents post heartbeats + open threads
4. **Phase 4:** Notification layer — Telegram alerts for HIGH/CRITICAL
5. **Phase 5:** Plan approval flow — CEO approve/reject on plan posts
6. **Phase 6:** Git auto-link + weekly digest + stale thread handling
7. **Phase 7:** Agent scorecard + sub-threads + thread templates

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| CEO becomes bottleneck | 3-hour ack window + agents draft plans in advance |
| Agent overhead (too much posting) | Heartbeat only every 1.5hrs. Board is structured, not a chat room. |
| Firebase cost at scale | BFF caches thread list. Firebase free tier generous. |
| JSONL log bloat | Daily rotation. Archive >90 days to DVC. |
| Notification fatigue | Only HIGH/CRITICAL fire Telegram. |
| Thread proliferation | Auto-stale after 7 days with warning. CEO closes when done. |

---

*Spec written: 2026-04-13. Waiting for CEO review and approval before implementation.*