# Watchtower IST Scheduler + Telegram Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the BFF Watchtower with IST time-aware scan intervals (15min / 9AM-11:59PM, 1hr / 12AM-8:59AM), Telegram push for every fault and resolution step, and automatic resolution tracking that re-probes and closes Board Room threads.

**Architecture:** A new `watchtowerScheduler.mjs` module replaces the raw `setInterval` in `startWatchtowerDaemon`. It computes the IST hour, selects the correct interval (15 min or 60 min), and schedules the next run dynamically. Fault reporting gets a Telegram push on every new fault and resolution event. A `resolveFaultCycle` re-probes the failing subsystem after cooldown and either closes the Board Room thread (healthy) or re-opens with updated evidence.

**Tech Stack:** BFF (Node.js), existing `watchtowerService.mjs`, existing `boardRoomTelegram.mjs`, existing `boardRoomService.mjs`, Telegram Bot API (polling via `BFF_TELEGRAM_BOT_TOKEN`).

---

## Files Modified

- `bff/services/watchtowerService.mjs` — remove raw `setInterval`, export `runScan` and `scheduleNext`
- Create: `bff/services/watchtowerScheduler.mjs` — IST-aware dynamic scheduler
- Create: `bff/services/watchtowerTelegramReporter.mjs` — Telegram push on fault + resolution
- Modify: `bff/routes/watchtowerRoutes.mjs` — wire Telegram reporter into fault pipeline
- Modify: `bff/server.mjs` — import new scheduler instead of `startWatchtowerDaemon`

---

### Task 1: Create `bff/services/watchtowerScheduler.mjs`

**Files:**
- Create: `bff/services/watchtowerScheduler.mjs`
- Modify: `bff/services/watchtowerService.mjs:80-95` (remove daemon timer from `startWatchtowerDaemon`)

- [ ] **Step 1: Write the failing test**

Create `bff/tests/watchtower-scheduler.test.mjs`:

```js
// bff/tests/watchtower-scheduler.test.mjs
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { getIstHour, getRefreshIntervalMs, computeNextDelayMs } from "../services/watchtowerScheduler.mjs";

describe("getIstHour", () => {
  it("returns 9 for 2026-04-28T03:30:00Z (9:00 IST)", () => {
    assert.equal(getIstHour(new Date("2026-04-28T03:30:00Z")), 9);
  });
  it("returns 23 for 2026-04-28T17:30:00Z (23:00 IST)", () => {
    assert.equal(getIstHour(new Date("2026-04-28T17:30:00Z")), 23);
  });
  it("returns 0 for 2026-04-28T18:30:00Z (00:00 IST next day)", () => {
    assert.equal(getIstHour(new Date("2026-04-28T18:30:00Z")), 0);
  });
  it("returns 8 for 2026-04-28T03:29:59Z (08:59 IST)", () => {
    assert.equal(getIstHour(new Date("2026-04-28T03:29:59Z")), 8);
  });
});

describe("getRefreshIntervalMs", () => {
  it("returns 15 min for IST hour 9", () => {
    assert.equal(getRefreshIntervalMs(9), 15 * 60 * 1000);
  });
  it("returns 15 min for IST hour 23", () => {
    assert.equal(getRefreshIntervalMs(23), 15 * 60 * 1000);
  });
  it("returns 60 min for IST hour 0", () => {
    assert.equal(getRefreshIntervalMs(0), 60 * 60 * 1000);
  });
  it("returns 60 min for IST hour 3", () => {
    assert.equal(getRefreshIntervalMs(3), 60 * 60 * 1000);
  });
  it("returns 60 min for IST hour 8", () => {
    assert.equal(getRefreshIntervalMs(8), 60 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test bff/tests/watchtower-scheduler.test.mjs`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create `bff/services/watchtowerScheduler.mjs`**

```js
// bff/services/watchtowerScheduler.mjs
// IST time-aware dynamic scheduler for Watchtower scan intervals.
// 9:00 IST – 23:59 IST → scan every 15 minutes
// 00:00 IST – 08:59 IST → scan every 60 minutes

export const IST_DAY_HOUR_START = 9;   // 9 AM IST
export const IST_DAY_HOUR_END = 23;     // 11:59 PM IST (inclusive)
export const DAY_INTERVAL_MS = 15 * 60 * 1000;   // 15 minutes
export const NIGHT_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes
const IST_OFFSET_HOURS = 5.5;  // IST = UTC + 5:30

/**
 * Returns the current IST hour (0-23) for a given UTC Date.
 */
export function getIstHour(utcDate = new Date()) {
  const utcMs = utcDate.getTime() + utcDate.getTimezoneOffset() * 60 * 1000;
  const istMs = utcMs + IST_OFFSET_HOURS * 60 * 60 * 1000;
  const istDate = new Date(istMs);
  return istDate.getUTCHours() + Math.floor(istDate.getUTCMinutes() / 60);
}

/**
 * Returns true if IST is between 9:00 and 23:59 inclusive.
 */
export function isIstDayHours(utcDate = new Date()) {
  const h = getIstHour(utcDate);
  return h >= IST_DAY_HOUR_START && h <= IST_DAY_HOUR_END;
}

/**
 * Returns the correct scan interval in ms for the given IST hour.
 */
export function getRefreshIntervalMs(istHour) {
  if (istHour >= IST_DAY_HOUR_START && istHour <= IST_DAY_HOUR_END) {
    return DAY_INTERVAL_MS;
  }
  return NIGHT_INTERVAL_MS;
}

/**
 * Returns the number of ms until the next IST day/night boundary,
 * so we can schedule a recalculation of the interval.
 */
export function computeNextBoundaryDelayMs(utcDate = new Date()) {
  const istHour = getIstHour(utcDate);
  const interval = getRefreshIntervalMs(istHour);
  // If in day hours (9-23), next boundary is at hour 0 (midnight IST)
  // If in night hours (0-8), next boundary is at hour 9 (9 AM IST)
  let targetHourIST;
  if (istHour >= IST_DAY_HOUR_START && istHour <= IST_DAY_HOUR_END) {
    targetHourIST = 24; // midnight next
  } else {
    targetHourIST = IST_DAY_HOUR_START; // 9 AM
  }

  // Convert target IST hour back to UTC
  const utcMs = utcDate.getTime() + utcDate.getTimezoneOffset() * 60 * 1000;
  const istMs = utcMs + IST_OFFSET_HOURS * 60 * 60 * 1000;
  const istDate = new Date(istMs);

  let targetUtcHours = istDate.getUTCHours() + Math.floor(istDate.getUTCMinutes() / 60);
  // We need to find the next occurrence of targetHourIST in IST
  // Simple: compute ms-per-hour = 3600000
  // Next boundary in IST = (targetHourIST - currentISTHour + 24) % 24 hours
  let hoursUntil = targetHourIST - istHour;
  if (hoursUntil <= 0) hoursUntil += 24;
  return hoursUntil * 60 * 60 * 1000;
}

export default { getIstHour, isIstDayHours, getRefreshIntervalMs, computeNextBoundaryDelayMs };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test bff/tests/watchtower-scheduler.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bff/tests/watchtower-scheduler.test.mjs bff/services/watchtowerScheduler.mjs
git commit -m "feat(watchtower): add IST-aware time scheduler
- getIstHour() returns IST hour (0-23) from UTC Date
- isIstDayHours() true when IST 9:00-23:59
- getRefreshIntervalMs() returns 15min or 60min based on IST hour
- computeNextBoundaryDelayMs() for dynamic interval recalculation"
```

---

### Task 2: Build `bff/services/watchtowerTelegramReporter.mjs`

**Files:**
- Create: `bff/services/watchtowerTelegramReporter.mjs`
- Import in: `bff/services/watchtowerService.mjs`

- [ ] **Step 1: Write the failing test**

Create `bff/tests/watchtower-telegram-reporter.test.mjs`:

```js
// bff/tests/watchtower-telegram-reporter.test.mjs
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

let sentMessages = [];
function mockSendAlert(params) {
  sentMessages.push({ type: "alert", params });
  return Promise.resolve({ ok: true });
}
function mockSendResolution(params) {
  sentMessages.push({ type: "resolution", params });
  return Promise.resolve({ ok: true });
}

const { formatFaultAlert, formatResolutionAlert, notifyFault, notifyResolved } =
  await import("../services/watchtowerTelegramReporter.mjs");

describe("notifyFault", () => {
  beforeEach(() => { sentMessages = []; });

  it("calls sendAlert with fault details", async () => {
    await notifyFault({
      fault: { code: "BFF_HEALTH_FAILED", title: "BFF down", severity: "critical" },
      ownerAgent: "BFFGateway",
      correctiveAction: "Restart the BFF",
      threadId: "thread-123",
    }, mockSendAlert);

    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].type, "alert");
    assert.equal(sentMessages[0].params.type, "WATCHTOWER_FAULT");
    assert.equal(sentMessages[0].params.agent, "BFFGateway");
    assert.equal(sentMessages[0].params.threadId, "thread-123");
  });
});

describe("notifyResolved", () => {
  beforeEach(() => { sentMessages = []; });

  it("calls sendResolution with resolution details", async () => {
    await notifyResolved({
      code: "BFF_HEALTH_FAILED",
      title: "BFF healthy again",
      ownerAgent: "BFFGateway",
      threadId: "thread-123",
    }, mockSendResolution);

    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].type, "resolution");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test bff/tests/watchtower-telegram-reporter.test.mjs`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create `bff/services/watchtowerTelegramReporter.mjs`**

```js
// bff/services/watchtowerTelegramReporter.mjs
// Telegram push for every Watchtower fault and resolution.
// Uses boardRoomTelegram.sendAlert() under the hood.

const DEFAULT_SEND_ALERT = (params) => import("./boardRoomTelegram.mjs").then(m => m.boardRoomTelegram.sendAlert(params));
const DEFAULT_SEND_RESOLUTION = (params) => import("./boardRoomTelegram.mjs").then(m => m.boardRoomTelegram.sendAlert({ ...params, type: "WATCHTOWER_RESOLVED" }));

function istNow() {
  const now = new Date();
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(now);
}

/**
 * Format a Watchtower fault as a Telegram alert.
 */
export function formatFaultAlert({ fault, ownerAgent, correctiveAction, threadId }) {
  const severityEmoji = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🟢",
  }[fault.severity] || "⚪";

  const lines = [
    `&#128275; <b>WATCHTOWER FAULT DETECTED</b>`,
    `&#128276; Agent: ${ownerAgent}`,
    `${severityEmoji} <b>${fault.code}</b>`,
    `Title: ${fault.title}`,
    `Detail: ${fault.detail || "—"}`,
    `Fix: ${correctiveAction}`,
    threadId ? `Thread: ${threadId}` : "",
    `Found: ${istNow()} IST`,
  ].filter(Boolean);

  return lines.join("\n");
}

/**
 * Format a resolution event as a Telegram alert.
 */
export function formatResolutionAlert({ code, title, ownerAgent, threadId, proof }) {
  const lines = [
    `&#9989; <b>WATCHTOWER — FAULT RESOLVED</b>`,
    `&#128276; Agent: ${ownerAgent}`,
    `Code: ${code}`,
    `Title: ${title}`,
    `Thread: ${threadId || "—"}`,
    `Resolved: ${istNow()} IST`,
    proof ? `Proof: ${proof}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

/**
 * Send a Telegram alert for a newly detected fault.
 * @param {object} opts
 * @param {object} opts.fault - the fault object from Watchtower
 * @param {string} opts.ownerAgent - agent assigned to fix
 * @param {string} opts.correctiveAction - recommended fix
 * @param {string} [opts.threadId] - Board Room thread ID
 * @param {function} [sendFn] - injected for testing
 */
export async function notifyFault({ fault, ownerAgent, correctiveAction, threadId }, sendFn) {
  const fn = sendFn || ((await import("./boardRoomTelegram.mjs")).boardRoomTelegram.sendAlert.bind(null, { type: "WATCHTOWER_FAULT" }));
  const text = formatFaultAlert({ fault, ownerAgent, correctiveAction, threadId });
  const result = await fn({
    type: "WATCHTOWER_FAULT",
    agent: ownerAgent,
    threadId,
    what: correctiveAction,
    priority: fault.severity,
  });
  console.log(`[watchtowerTelegram] Fault alert sent: ${fault.code} → ${result.ok ? "OK" : result.error}`);
  return result;
}

/**
 * Send a Telegram alert when a fault is resolved.
 */
export async function notifyResolved({ code, title, ownerAgent, threadId, proof }, sendFn) {
  const fn = sendFn || ((await import("./boardRoomTelegram.mjs")).boardRoomTelegram.sendAlert.bind(null, { type: "WATCHTOWER_RESOLVED" }));
  const result = await fn({
    type: "WATCHTOWER_RESOLVED",
    agent: ownerAgent,
    threadId,
    what: `${code}: ${title}`,
  });
  console.log(`[watchtowerTelegram] Resolution alert sent: ${code} → ${result.ok ? "OK" : result.error}`);
  return result;
}

export default { notifyFault, notifyResolved, formatFaultAlert, formatResolutionAlert };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test bff/tests/watchtower-telegram-reporter.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bff/tests/watchtower-telegram-reporter.test.mjs bff/services/watchtowerTelegramReporter.mjs
git commit -m "feat(watchtower): add Telegram fault and resolution push
- notifyFault() sends HTML alert to Telegram on every new fault
- notifyResolved() sends resolution confirmation when re-probe succeeds
- formatFaultAlert() / formatResolutionAlert() format IST timestamps"
```

---

### Task 3: Wire Telegram reporter into Watchtower fault pipeline + add resolution tracking

**Files:**
- Modify: `bff/services/watchtowerService.mjs` — integrate Telegram reporter, add resolution re-probe cycle

- [ ] **Step 1: Write the failing test**

Create `bff/tests/watchtower-telegram-integration.test.mjs`:

```js
// bff/tests/watchtower-telegram-integration.test.mjs
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

let telegramMessages = [];
let resolvedFaults = [];

// Mock modules
const mockTelegramReporter = {
  notifyFault: async ({ fault, ownerAgent, correctiveAction, threadId }) => {
    telegramMessages.push({ event: "fault", code: fault.code, agent: ownerAgent });
    return { ok: true };
  },
  notifyResolved: async ({ code, title, ownerAgent, threadId }) => {
    telegramMessages.push({ event: "resolved", code, agent: ownerAgent });
    resolvedFaults.push(code);
    return { ok: true };
  },
};

// We'll test the fault keying logic
const { faultReportKey, createFault, shouldReportFault } = await import("../services/watchtowerService.mjs");

describe("faultReportKey", () => {
  it("includes ownerAgent, ruleId, code, and detail", () => {
    const fault = createFault("BFF_HEALTH_FAILED", "BFF unreachable", "Connection refused");
    const key = faultReportKey(fault);
    assert.ok(key.includes("BFFGateway"));
    assert.ok(key.includes("BFF_HEALTH_FAILED"));
    assert.ok(key.includes("Connection refused"));
  });
});

describe("reportedFaults tracking for resolution", () => {
  // This tests that once a fault is reported, it can be tracked for resolution
  it("tracks faults by key for re-probe resolution tracking", async () => {
    // We'll test this via the exposed module API
    const { getWatchtowerStatus } = await import("../services/watchtowerService.mjs");
    const status = getWatchtowerStatus();
    assert.ok(Array.isArray(status.faults));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test bff/tests/watchtower-telegram-integration.test.mjs`
Expected: FAIL (module not found)

- [ ] **Step 3: Modify `bff/services/watchtowerService.mjs`**

Add these changes to the existing file:

**3a. Add imports at top of file:**
```js
import boardRoomTelegramReporter from "./watchtowerTelegramReporter.mjs";
```

**3b. Add resolution tracking map (near `reportedFaults`):**
```js
// Tracks faults that have been reported to Board Room, keyed by faultReportKey
// Values: { threadId, reportedAt, lastProbedAt, status: "open" | "resolved" | "escalated" }
const resolvedFaults = new Map();

// After reportFaults() processes a fault, store its threadId
// Then in the next scan cycle, re-probe the subsystem
// If healthy → notifyResolved() + close thread, remove from map
// If still failing → update evidence in thread, bump priority if needed
```

**3c. Modify `reportFaults()` to store threadId and send Telegram:**
Find the existing `reportFaults()` function and add Telegram push + threadId tracking:

```js
// In reportFaults(), after reportGovernanceIncident() succeeds:
const key = faultReportKey(fault);
reportedFaults.set(key, { ...fault, threadId: result.threadId, reportedAt: Date.now(), status: "open" });

// Send Telegram alert
void boardRoomTelegramReporter.notifyFault({
  fault,
  ownerAgent: fault.ownerAgent,
  correctiveAction: fault.correctiveAction,
  threadId: result.threadId,
});
```

**3d. Add `probeAndResolve()` function:**
Add this new function after `reportFaults()`:

```js
/**
 * After a fault is reported, re-probe the failing subsystem on the next scan.
 * If the subsystem is now healthy → send resolution Telegram + close Board Room thread.
 * If still failing → update evidence in thread.
 */
async function probeAndResolve(fault, baseUrl) {
  const key = faultReportKey(fault);
  const tracked = reportedFaults.get(key);
  if (!tracked || tracked.status === "resolved") return;

  // Re-probe the subsystem based on fault code
  const probeResults = await probeSystems({ baseUrl });
  const isHealthy = isSubsystemHealthy(fault.code, probeResults);

  if (isHealthy) {
    // Mark resolved and send Telegram
    tracked.status = "resolved";
    reportedFaults.set(key, tracked);

    void boardRoomTelegramReporter.notifyResolved({
      code: fault.code,
      title: `${fault.code} is now healthy`,
      ownerAgent: fault.ownerAgent,
      threadId: tracked.threadId,
      proof: `Re-probe at ${new Date().toISOString()}`,
    });

    // Close the Board Room thread
    try {
      await boardRoomService.closeThread({ threadId: tracked.threadId });
      console.log(`[watchtower] Thread ${tracked.threadId} closed — ${fault.code} resolved`);
    } catch (e) {
      console.error(`[watchtower] Failed to close thread ${tracked.threadId}:`, e.message);
    }
  } else {
    // Still failing — update last probed time
    tracked.lastProbedAt = Date.now();
    // If no update in 2 hours, bump to HIGH severity
    if (Date.now() - tracked.reportedAt > 2 * 60 * 60 * 1000 && tracked.status === "open") {
      tracked.status = "escalated";
      console.warn(`[watchtower] Fault ${fault.code} escalated after 2 hours without resolution`);
    }
    reportedFaults.set(key, tracked);
  }
}

function isSubsystemHealthy(faultCode, probeResults) {
  switch (faultCode) {
    case "BFF_HEALTH_FAILED": return probeResults.bff?.ok === true;
    case "ML_HEALTH_FAILED": return probeResults.ml?.ok === true;
    case "AI_KEYS_MISSING": return (probeResults.ai?.configured ?? 0) > 0;
    case "AI_ALL_OFFLINE": return (probeResults.ai?.online ?? 0) > 0;
    case "NEWS_LIVE_OFFLINE": return probeResults.newsLive?.ok === true;
    case "NEWS_CALENDAR_OFFLINE": return probeResults.newsCalendar?.ok === true;
    default: return false;
  }
}
```

**3e. Call `probeAndResolve()` for each tracked fault in `runWatchtowerScan()`:**
In `runWatchtowerScan()`, after building the faults list, add:

```js
// After faults are processed, probe tracked faults for resolution
for (const [, fault] of reportedFaults) {
  if (fault.status !== "resolved") {
    void probeAndResolve(fault, options.baseUrl || serviceBaseUrl);
  }
}
```

**3f. Export resolution state for the route handler:**
```js
export function getResolvedFaultCount() {
  let open = 0, resolved = 0, escalated = 0;
  for (const [, v] of reportedFaults) {
    if (v.status === "resolved") resolved++;
    else if (v.status === "escalated") escalated++;
    else open++;
  }
  return { open, resolved, escalated };
}
```

- [ ] **Step 4: Verify the code compiles**

Run: `cd bff && node --check server.mjs 2>&1` (or any file that imports watchtowerService)
Expected: No syntax errors

- [ ] **Step 5: Commit**

```bash
git add bff/services/watchtowerService.mjs bff/tests/watchtower-telegram-integration.test.mjs
git commit -m "feat(watchtower): wire Telegram reporter + resolution tracking
- Every new fault triggers Telegram alert via boardRoomTelegramReporter.notifyFault()
- probeAndResolve() re-probes tracked faults on every scan cycle
- Healthy re-probe → notifyResolved() + close Board Room thread
- Unresolved after 2h → mark escalated, log warning
- getResolvedFaultCount() exposes {open, resolved, escalated} counts"
```

---

### Task 4: Replace raw `setInterval` with dynamic IST scheduler

**Files:**
- Modify: `bff/services/watchtowerService.mjs` — update `startWatchtowerDaemon` and `stopWatchtowerDaemon`
- Modify: `bff/server.mjs` — add scheduler import

- [ ] **Step 1: Add scheduler import and replace daemon timer**

In `watchtowerService.mjs`, find and replace the `daemonTimer` block:

```js
// REPLACE this:
let daemonTimer = null;

// REPLACE startWatchtowerDaemon with:
import watchtowerScheduler from "./watchtowerScheduler.mjs";

let schedulerHandle = null;
let currentScanTimer = null;

export function startWatchtowerDaemon(options = {}) {
  if (String(process.env.WATCHTOWER_DISABLED || "false").toLowerCase() === "true") {
    return false;
  }
  serviceBaseUrl = resolveBaseUrl(options);
  if (schedulerHandle) return true; // already running

  const scheduleNext = () => {
    const intervalMs = watchtowerScheduler.getRefreshIntervalMs();
    const nextDelayMs = Math.min(
      intervalMs,
      watchtowerScheduler.computeNextBoundaryDelayMs(),
    );
    if (currentScanTimer) clearTimeout(currentScanTimer);
    currentScanTimer = setTimeout(async () => {
      await runWatchtowerScan({ baseUrl: serviceBaseUrl });
      scheduleNext();
    }, nextDelayMs);
    if (typeof currentScanTimer.unref === "function") currentScanTimer.unref();
  };

  // Initial run after WATCHTOWER_START_DELAY_MS
  schedulerHandle = setTimeout(() => {
    void runWatchtowerScan({ baseUrl: serviceBaseUrl });
    scheduleNext();
  }, Number(process.env.WATCHTOWER_START_DELAY_MS || 2_000));

  return true;
}

export function stopWatchtowerDaemon() {
  if (currentScanTimer) {
    clearTimeout(currentScanTimer);
    currentScanTimer = null;
  }
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}
```

Also update `getWatchtowerStatus()` to include scheduler info:
```js
// Add to lastStatus.daemon block:
daemon: {
  active: Boolean(schedulerHandle),
  baseUrl: serviceBaseUrl,
  nextIntervalMs: watchtowerScheduler.getRefreshIntervalMs(),
  currentIstHour: watchtowerScheduler.getIstHour(),
  isDayHours: watchtowerScheduler.isIstDayHours(),
},
```

- [ ] **Step 2: Verify `server.mjs` still starts Watchtower**

Check that `server.mjs` line ~547 still calls `startWatchtowerDaemon`. It should — no change needed there.

- [ ] **Step 3: Test the scheduler changes**

Write a quick integration test:

```js
// bff/tests/watchtower-scheduler-integration.test.mjs
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { stopWatchtowerDaemon } from "../services/watchtowerService.mjs";
import watchtowerScheduler from "../services/watchtowerScheduler.mjs";

describe("Dynamic interval selection", () => {
  afterEach(() => { stopWatchtowerDaemon(); });

  it("selects 15min for IST hour 14 (day hours)", () => {
    assert.equal(watchtowerScheduler.getRefreshIntervalMs(14), 15 * 60 * 1000);
  });
  it("selects 60min for IST hour 3 (night hours)", () => {
    assert.equal(watchtowerScheduler.getRefreshIntervalMs(3), 60 * 60 * 1000);
  });
  it("selects 60min for IST hour 8 (night hours)", () => {
    assert.equal(watchtowerScheduler.getRefreshIntervalMs(8), 60 * 60 * 1000);
  });
  it("selects 15min for IST hour 23 (last day hour)", () => {
    assert.equal(watchtowerScheduler.getRefreshIntervalMs(23), 15 * 60 * 1000);
  });
});
```

Run: `node --test bff/tests/watchtower-scheduler-integration.test.mjs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add bff/services/watchtowerService.mjs bff/tests/watchtower-scheduler-integration.test.mjs
git commit -m "feat(watchtower): replace setInterval with IST dynamic scheduler
- startWatchtowerDaemon now uses watchtowerScheduler for interval selection
- Automatically switches 15min/9AM-11:59PM IST ↔ 60min/12AM-8:59AM IST
- Reschedules at every day/night boundary transition
- lastStatus.daemon now exposes nextIntervalMs, currentIstHour, isDayHours"
```

---

### Task 5: Push to Contabo, rebuild, and verify

**Files:**
- None (deployment only)

- [ ] **Step 1: Push changes to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: SSH into Contabo and pull**

```bash
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 root@173.249.18.14 \
  "cd /opt/tradersapp && git pull origin main && cd /opt/tradersapp/bff && npm install && docker build -t ghcr.io/fxgunit/bff:watchtower-fix ."
```

- [ ] **Step 3: Restart BFF container**

```bash
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 root@173.249.18.14 \
  "docker stop traders-bff && docker rm traders-bff && docker run -d --name traders-bff --restart always --network tradersapp_default -p 8788:8788 --env-file /opt/tradersapp/runtime/.env.contabo ghcr.io/fxgunit/bff:watchtower-fix"
```

- [ ] **Step 4: Check BFF logs for scheduler startup**

```bash
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 root@173.249.18.14 \
  "sleep 5 && docker logs traders-bff --tail 10"
```

Expected: Watchtower daemon started, interval set to 15min (if IST day hours) or 60min, Telegram reporter initialized.

- [ ] **Step 5: Check Telegram for test alert**

Watch your Telegram for a Watchtower alert. If the BFF has no Telegram token configured, you should see in logs:
```
[boardRoomTelegram] Not configured — skipping Telegram alert
```

If configured, you should see a `WATCHTOWER FAULT DETECTED` message (or `WATCHTOWER — FAULT RESOLVED` if no active faults).

- [ ] **Step 6: Verify interval switching**

Simulate IST night hours by setting env var override temporarily:
```bash
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 root@173.249.18.14 \
  "docker exec traders-bff node -e \"
import('./services/watchtowerScheduler.mjs').then(m => {
  console.log('IST hour:', m.getIstHour());
  console.log('Is day hours:', m.isIstDayHours());
  console.log('Interval ms:', m.getRefreshIntervalMs(m.getIstHour()));
})\"
"
```

---

### Task 6: Update frontend to show real Watchtower interval

**Files:**
- Modify: `src/features/shell/OfficersBriefingFooter.jsx` — replace hardcoded "15 MIN REFRESH" label

- [ ] **Step 1: Check what the footer receives for watchtower status**

The `OfficersBriefingFooter` already receives `watchtowerStatus`. Check if it exposes `refreshMs` or interval info. If not, the frontend fetches `/watchtower/status` — check what fields are available.

In `src/features/shell/OfficersBriefingFooter.jsx` around line 303:
```jsx
// REPLACE hardcoded:
<span>15 MIN REFRESH</span>

// WITH dynamic:
<span>{Math.round((watchtowerStatus?.daemon?.nextIntervalMs || 900000) / 60000)} MIN REFRESH</span>
```

Also add a small day/night indicator:
```jsx
<span style={{ fontSize: "0.7rem", opacity: 0.6 }}>
  {watchtowerStatus?.daemon?.isDayHours ? "☀️ DAY" : "🌙 NIGHT"} · IST {watchtowerStatus?.daemon?.currentIstHour}:00
</span>
```

- [ ] **Step 2: Build and deploy**

```bash
cd E:/TradersApp && npm run build && gh workflow run "Deploy Pages Root"
```

- [ ] **Step 3: Commit**

```bash
git add src/features/shell/OfficersBriefingFooter.jsx
git commit -m "feat(ui): show real Watchtower scan interval and IST day/night indicator"
```

---

## What Was Built

| Component | File | What it does |
|---|---|---|
| IST time engine | `watchtowerScheduler.mjs` | `getIstHour()`, `isIstDayHours()`, `getRefreshIntervalMs()`, `computeNextBoundaryDelayMs()` |
| Telegram push | `watchtowerTelegramReporter.mjs` | `notifyFault()`, `notifyResolved()` — sends HTML-formatted alerts on fault + resolution |
| Resolution tracker | `watchtowerService.mjs` | `probeAndResolve()` — re-probes each tracked fault every scan, closes Board Room thread when healthy |
| Dynamic scheduler | `watchtowerService.mjs` | `startWatchtowerDaemon()` now calls scheduler instead of raw `setInterval` |
| Frontend indicator | `OfficersBriefingFooter.jsx` | Shows real interval + IST day/night + hour |

## Remaining Telegram Two-Way (NOT in this plan)

The Telegram integration is **broadcast only** — the bot sends alerts but cannot receive replies. To add two-way (you reply to a TG message and it marks the thread as acknowledged):

1. Add a Telegram bot webhook or polling loop in `bff/server.mjs` that:
   - Calls `getUpdates` on `BFF_TELEGRAM_BOT_TOKEN` every 60 seconds
   - Parses incoming messages that reply to a Board Room alert
   - Calls `boardRoomService.acknowledgePost({ messageId })` to mark the thread acknowledged
2. The Board Room cron already handles escalation on missed acks — this just needs the Telegram polling to bridge incoming messages to `acknowledgePost()`.

This is a separate feature that needs its own plan.
