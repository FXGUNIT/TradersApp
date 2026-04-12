# Board Room — Design Specification

**Version:** 1.1
**Date:** 2026-04-13
**Status:** Draft — pending CEO approval

> **Changelog v1.1:** Renamed `linkedCommit`/`linkedPR` on Thread → `closureCommit`/`closurePR` (clarity). Added server-side 3-hour acknowledgment enforcer. Added `validateContent()` JSON schema check. Defined cron infra for weekly digest. Added `BOARD_ROOM_GITHUB_WEBHOOK_SECRET` + HMAC verification for webhook.

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
         ├──► board-room/logs/         ← daily .jsonl append-only audit log
         │        board_2026-04-13.jsonl
         │        board_2026-04-14.jsonl
         │
         └──► board-room/cron/
              boardRoomCron.mjs         ← 3hr ack enforcer + weekly digest

Frontend: AdminDashboardScreen → BoardRoom.jsx (embedded tab)
Telegram: fires on HIGH|CRITICAL priority events → CEO chat
```

**No new infrastructure.** BFF owns all logic. Firebase is the cloud data store (already used). JSONL files are the audit log (disk, git-versionable). Cron jobs run inside BFF process (node-cron, already available).

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
  closureCommit: string | null             // set when thread is closed (git commit hash)
  closurePR: string | null                 // set when thread is closed (PR link)
  tags: string[]                           // ["ml-engine", "performance", "bug"]
  description: string                       // initial post / context
  staleWarningSent: boolean                // for auto-stale logic
  lastActivityAt: firebase_timestamp       // updated on every post, used for stale detection
```

**Note:** `closureCommit` and `closurePR` are set ONLY at thread closure (by CEO). Post-level `linkedCommit`/`linkedPR` on milestone/plan posts are independent — they track per-post artifacts. The two levels are intentionally distinct.

### 3.2 Post
```
/board-room/threads/{threadId}/posts/{postId}/
  author: "ceo" | string                   // process name e.g. "Predictor"
  authorType: "human" | "agent"
  content: string                          // structured JSON string — MUST be valid JSON
  type: "comment" | "chat" | "plan" | "decision" | "milestone" | "heartbeat"
  timestamp: firebase_timestamp
  mentions: string[]                       // agent process names tagged
  acknowledgmentRequired: boolean
  acknowledgedBy: string | null
  acknowledgedAt: firebase_timestamp | null
  acknowledgmentDeadline: firebase_timestamp | null  // set at suggestion post time = now + 3hrs
  acknowledgedLate: boolean | null        // true if acknowledged after deadline (late ack flag)
  planStatus: "draft" | "pending_approval" | "approved" | "rejected" | null
  linkedCommit: string | null              // per-post artifact (plan/milestone posts)
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
  pendingAcknowledgments: string[]         // postIds this agent must acknowledge
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
   → lastActivityAt = now
   → If priority HIGH|CRITICAL → Telegram msg to CEO immediately

2. Discussion happens
   → Agents post comments, chat messages, suggestions
   → Suggestions tag target agent → acknowledgmentRequired = true
   → acknowledgmentDeadline = now + 3 hours (set in boardRoomService.mjs)
   → Target agent has 3 hours to acknowledge or auto-escalate to CEO

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
   → Git commit hash recorded in thread as closureCommit
   → PR link recorded in thread as closurePR (if applicable)
   → CEO closes thread → status = CLOSED, immutable

7. Stale thread handling
   → If no activity for 7 days → warning post added automatically (by cron)
   → If no activity for 14 days → thread auto-flagged in weekly digest
```

---

## 5. Agent Board Integration API

`bff/services/boardRoomService.mjs` exposes these methods. All agents call these.

### 5.0 Content Validation (applied to every post)
```javascript
// All content passed to board room is validated before Firebase write
boardRoom.validateContent(content) {
  // content must be a string
  // If it looks like JSON (starts with '{' or '['), parse it — must not throw
  // If it's plain text, store as-is (truncated to 10,000 chars)
  // Returns { valid: true } or { valid: false, reason: string }
}
```
Every API method (postComment, postSuggestion, postPlan, etc.) calls `validateContent()` before writing to Firebase. If invalid, the post is rejected with error and nothing is written.

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
- Logs to JSONL + updates Firebase agent-memory (`lastHeartbeat`)
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
- `lastActivityAt` initialized to now

### 5.3 Post Comment / Chat
```javascript
boardRoom.postComment({
  agent: "FrontendDev",
  threadId: "T01",
  content: "I've added Promise.all to the candle fetches. Testing now.",
  type: "comment"  // or "chat" for quick back-and-forth
});
```
- `lastActivityAt` on thread updated to now

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
- `acknowledgmentRequired: true`
- `acknowledgmentDeadline: now() + 3 hours` (stored in Firebase)
- If priority HIGH|CRITICAL → Telegram to CEO
- Target agent's `pendingAcknowledgments` in agent-memory updated
- `lastActivityAt` on thread updated to now

### 5.5 Acknowledge Suggestion
```javascript
boardRoom.acknowledgeSuggestion({
  agent: "Predictor",
  postId: "P05",
  response: "agreed, let's implement this"
});
```
- `acknowledgedAt` set, `acknowledgedBy` set
- `acknowledgedLate` flag set if `now() > acknowledgmentDeadline`
- Target agent's `pendingAcknowledgments` cleaned up
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
- `planStatus = "pending_approval"` → CEO notified via Telegram
- `lastActivityAt` on thread updated to now
- `validateContent()` called — plan JSON must be valid or post is rejected

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
- Post saved with `linkedCommit` and `linkedPR` (per-post, not thread-level)
- `lastActivityAt` on thread updated to now

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
- `lastActivityAt` on thread updated to now

### 5.9 CEO Actions
```javascript
// Approve a plan
boardRoom.approvePlan({ threadId: "T01", postId: "P07", comment: "go ahead" });

// Reject a plan
boardRoom.rejectPlan({ threadId: "T01", postId: "P07", reason: "test coverage first" });

// Close a thread (CEO only — server-side validated)
boardRoom.closeThread({
  threadId: "T01",
  closureCommit: "9f54553",
  closurePR: "https://github.com/...",
  note: "All tasks done, tests passing, merged to main"
});
// Sets: status=CLOSED, closedAt, closedBy, closureCommit, closurePR on thread document

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
{"ts":"2026-04-13T03:10:00Z","type":"suggestion","agent":"ConsensusEngine","threadId":"T01","target":"Predictor","priority":"HIGH","ackDeadline":"2026-04-13T06:10:00Z","content":{"what":"add index","why":"5ms vs 40ms query time","where":"candle_db.py"}}
{"ts":"2026-04-13T03:15:00Z","type":"acknowledgment","agent":"Predictor","postId":"P01","response":"agreed, drafting plan","late":false}
{"ts":"2026-04-13T03:20:00Z","type":"plan_posted","agent":"Predictor","threadId":"T01","planId":"P02","planStatus":"pending_approval"}
{"ts":"2026-04-13T03:30:00Z","type":"plan_approved","by":"ceo","threadId":"T01","planId":"P02"}
{"ts":"2026-04-13T04:00:00Z","type":"milestone","agent":"Predictor","threadId":"T01","milestone":"index added and benchmarked","commitHash":"9f54553","linkedPR":"https://github.com/..."}
{"ts":"2026-04-13T04:05:00Z","type":"thread_closed","by":"ceo","threadId":"T01","closureCommit":"9f54553","closurePR":"https://github.com/..."}
```

**Log rotation:** Daily files. Keep 90 days locally. Older files archived to cold storage or DVC.

---

## 7. Firebase Security Rules

- Read: admin users + agent service accounts only
- Write: CEO UID + agent service accounts
- Thread close: CEO UID only (validated server-side in BFF via `security.mjs`)
- Plan approval: CEO UID only (validated server-side in BFF via `security.mjs`)
- Agent memory: agent can write their own record only (validated by `author === agentProcess`)
- `acknowledgmentDeadline` and `lastActivityAt`: writeable by agents and CEO

---

## 8. Telegram Integration

Triggered automatically by BFF `boardRoomService.mjs` using `api.telegram.org` (already wired in `telegramRoutes.mjs`).

Events that fire Telegram:
- Thread opened with priority HIGH|CRITICAL
- Suggestion posted with priority HIGH|CRITICAL
- **3-hour acknowledgment timeout → auto-escalate to CEO** (via cron job, see Section 12)
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

Auto-escalation format (when 3hr deadline missed):
```
🚨 BOARD ROOM ESCALATION
Agent: Predictor missed acknowledgment deadline
Thread: T01 — reduce consensus latency
Suggestion from: ConsensusEngine
What: add index on candle.timestamp
Deadline: 2026-04-13 06:10 IST
Action required from CEO
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
│ ○ T02 MED    │  [Tasks: 3/5] [Closure Commit: 9f54553]       │
│ ○ T03 LOW    │  Last activity: 2h ago                        │
│              │                                               │
│ FILTERS      │  ──────────────────────────────────────────  │
│ [priority]   │  Predictor · 10:00 · milestone               │
│ [status]     │  "Index added. Benchmark: 5ms query ✓"        │
│ [agent]      │  commit: 9f54553 (linked to post, not thread) │
│ [tag]        │                                               │
│              │  ConsensusEngine · 09:55 · plan (PENDING)    │
│ TEMPLATES    │  "What: add index on candle.timestamp..."     │
│ [Bug Report] │  [ ] Run migration script                      │
│ [Feature]    │  [ ] Benchmark before/after                    │
│ [Decision]   │  [CEO: review → approve/reject]               │
│              │                                               │
│              │  ConsensusEngine · 09:45 · suggestion        │
│              │  → Predictor must acknowledge (2h 45m left)  │
│              │  "What: add index..."                         │
├──────────────┴──────────────────────────────────────────────┤
│ AGENT SCOREBOARD: Predictor (avg ack: 12m) · ConsensusEngine │
└─────────────────────────────────────────────────────────────┘
```

### Agent Scorecard (bottom bar)
- Per-agent: avg ack time, plans approved/rejected, last heartbeat
- CEO can spot inactive agents instantly
- Late ack count highlighted in red (agents who missed 3hr deadline)

---

## 10. Git Auto-Link

When an agent commits with `[T{ticketId}]` in the commit message:
```
feat: add candle timestamp index [T01]
```
The BFF webhook handler at `POST /board-room/git-webhook`:
1. **Verify HMAC-SHA256 signature** using `BOARD_ROOM_GITHUB_WEBHOOK_SECRET` env var
   - If signature invalid → reject with 401
2. Extract `[T{ticketId}]` pattern from commit message
3. Fetch thread from Firebase → update `closureCommit` if thread is OPEN and not yet set
4. Post automatic milestone to thread: `Git commit detected: ${commitHash} on branch ${branch}`
5. If thread is OPEN → Telegram notification to CEO
6. Log event to JSONL

**Environment variables required:**
```
BOARD_ROOM_GITHUB_WEBHOOK_SECRET=<github webhook secret>
```

**HMAC verification (pseudo-code):**
```
expected = HMAC_SHA256(BOARD_ROOM_GITHUB_WEBHOOK_SECRET, raw_body)
if (!timingSafeEqual(headers['x-hub-signature-256'], `sha256=${expected}`)) {
  return 401 Unauthorized
}
```

---

## 11. Weekly Digest

**Cron infra:** `board-room/cron/boardRoomCron.mjs` — runs inside BFF process using `node-cron`. No external scheduler needed.

Schedule:
- **Escalation check:** every 10 minutes
- **Weekly digest:** Sunday 9:00 AM IST (`TZ=Asia/Kolkata`)

### 11.1 Weekly Digest (Sunday 9 AM IST)

```javascript
// board-room/cron/boardRoomCron.mjs
import cron from 'node-cron';
import { boardRoomService } from '../bff/services/boardRoomService.mjs';
import { boardRoomTelegram } from '../bff/services/boardRoomTelegram.mjs';

// Every Sunday at 09:00 IST
cron.schedule('0 9 * * 0', async () => {
  const threads = await boardRoomService.getAllOpenThreads();
  const digest = categorizeThreads(threads);
  await boardRoomTelegram.sendDigest(digest);
}, { timezone: 'Asia/Kolkata' });
```

Digest sent to CEO via Telegram:
```
📋 BOARD ROOM WEEKLY DIGEST — 2026-04-13
Active: 4 threads
Needs your action: 2 (T01 — plan pending, T03 — plan pending)
Stale: 1 (T02 — 9 days inactive, warning sent)
Late acks this week: 1 (Predictor on T01)
Agents inactive >24h: ConsensusEngine
```

### 11.2 Stale Thread Auto-Handling (by cron)

```javascript
// Every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  const threads = await boardRoomService.getAllOpenThreads();
  for (const thread of threads) {
    const inactiveDays = daysSince(thread.lastActivityAt);
    if (inactiveDays >= 7 && !thread.staleWarningSent) {
      await boardRoomService.addSystemPost(thread.id, {
        type: 'system',
        content: { warning: 'stale_thread', days: inactiveDays, message: 'No activity for 7 days. CEO will review for closure.' }
      });
      await boardRoomService.updateThread(thread.id, { staleWarningSent: true });
      await boardRoomTelegram.sendAlert('STALE_THREAD_WARNING', thread);
    }
    // Day 14 → no extra post, just flags in weekly digest
  }
});
```

---

## 12. Server-Side 3-Hour Acknowledgment Enforcer

**Critical:** UI timers are cosmetic. Server-side enforcement is the real mechanism.

```javascript
// board-room/cron/boardRoomCron.mjs
// Runs every 10 minutes alongside stale thread check

async function checkAcknowledgmentDeadlines() {
  const pendingPosts = await boardRoomService.getPendingAcknowledgments();
  // pendingPosts = posts where acknowledgmentRequired=true AND acknowledgedBy=null

  for (const post of pendingPosts) {
    if (Date.now() > post.acknowledgmentDeadline) {
      // Deadline missed → auto-escalate
      await boardRoomService.markAcknowledgmentMissed(post);
      const thread = await boardRoomService.getThread(post.threadId);
      await boardRoomTelegram.sendEscalation(thread, post);
      await boardRoomService.appendPost(post.threadId, {
        type: 'system',
        author: 'board-room-cron',
        content: {
          warning: 'ack_timeout',
          targetAgent: post.mentions[0],
          deadline: post.acknowledgmentDeadline,
          message: `Acknowledgment deadline missed. CEO auto-escalated.`
        }
      });
    }
  }
}
```

Firebase query for pending acks:
```javascript
// Firebase: posts where acknowledgmentRequired == true AND acknowledgedBy == null
db.ref('/board-room/threads').orderByChild('posts').on('value', ...)
```
Implementation: Firebase Realtime Database query with compound filters on `acknowledgmentRequired=true` and `acknowledgedBy=null`.

---

## 13. Frontend: Board Room UI (same as Section 9)

(See Section 9 — unchanged from v1.0)

---

## 14. Dependencies & Changes

### New Files
```
bff/
  services/
    boardRoomService.mjs      ← core logic + validateContent()
    boardRoomTelegram.mjs     ← Telegram alert sender

board-room/
  logs/                       ← JSONL audit files
  templates/
    defaults.json             ← default templates
  cron/
    boardRoomCron.mjs         ← 3hr ack enforcer + weekly digest + stale handler
```

### Modified Files
```
bff/server.mjs                ← register board room routes + cron start on init
bff/routes/boardRoomRoutes.mjs  ← HTTP API surface + git webhook handler
bff/services/security.mjs     ← add CEO-only guards (closeThread, approvePlan)
scripts/update_todo_progress.py ← hook to board room

# ML Engine agents:
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

### New Environment Variables
```
BOARD_ROOM_GITHUB_WEBHOOK_SECRET=   # HMAC secret for git webhook verification
```

---

## 15. Implementation Order

1. **Phase O1:** Board Room core — `boardRoomService.mjs` + `boardRoomTelegram.mjs` + Firebase data model + API routes + `validateContent()`
2. **Phase O2:** Frontend UI — BoardRoom.jsx inside Admin Dashboard (sidebar, thread view, post, scorecard)
3. **Phase O3:** Agent integration — all agents post heartbeats + open threads
4. **Phase O4:** Notification layer — Telegram alerts for HIGH/CRITICAL + 3hr enforcer cron
5. **Phase O5:** Plan approval flow — CEO approve/reject on plan posts
6. **Phase O6:** Git auto-link (with HMAC) + weekly digest + stale thread cron
7. **Phase O7:** Agent scorecard + sub-threads + thread templates + JSONL log rotation

---

## 16. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| CEO becomes bottleneck | 3-hour ack window + agents draft plans in advance |
| Agent overhead (too much posting) | Heartbeat only every 1.5hrs. Board is structured, not a chat room. |
| Firebase cost at scale | BFF caches thread list. Firebase free tier generous. |
| JSONL log bloat | Daily rotation. Archive >90 days to DVC. |
| Notification fatigue | Only HIGH/CRITICAL fire Telegram. |
| Thread proliferation | Auto-stale after 7 days with warning. CEO closes when done. |
| **Server-side ack enforcement missing** | Fixed in v1.1: `boardRoomCron.mjs` runs every 10 minutes |
| **Malformed content crashes UI** | Fixed in v1.1: `validateContent()` called before every Firebase write |
| **Git webhook unauthenticated** | Fixed in v1.1: HMAC-SHA256 verification with `BOARD_ROOM_GITHUB_WEBHOOK_SECRET` |
| **No cron infra for digest** | Fixed in v1.1: `node-cron` inside BFF with TZ=Asia/Kolkata |
| **linkedCommit/linkedPR ambiguous** | Fixed in v1.1: renamed Thread fields to `closureCommit`/`closurePR` |

---

*Spec v1.1 — all review issues fixed. Ready for CEO approval and implementation.*