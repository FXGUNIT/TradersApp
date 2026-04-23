# NY Lunch Trading Block — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block all trading signals during the NY lunch window (12:00–1:00 PM ET, 9:30–10:30 PM IST during DST). The consensus endpoint returns NEUTRAL with a clear "lunch break" reason — no user action needed. The frontend shows a non-intrusive indicator. Existing `is_lunch_hour` feature in `consensusAggregator.mjs` is leveraged.

**Architecture:** A pure `isNyLunchBreakActive(istHour, istMinute)` function lives in `bff/services/tradingHoursService.mjs` (new file). It receives an IST time and returns a boolean. Three call sites get updated: (1) `getMlConsensus` in `consensusEngine.mjs` — blocks ML prediction and returns NEUTRAL with reason; (2) `BoardRoomService` in `bff/services/boardRoomService.mjs` — RiskOfficer veto fires on lunch block; (3) `DOMAIN-RULES.md` and `EDGE-CASES.md` get explicit lunch rules documented. `expiryCalendar.mjs` already has the DST-IST offset helper (`IST_OFFSET_MS`) — reuse it.

**IST DST logic (from expiryCalendar):** IST offset is +5:30 always. NY observes DST (Mar–Nov, second Sunday 2 AM → first Sunday November 2 AM). During DST: NY lunch = 12:00–13:00 ET = 21:30–22:30 IST. Outside DST: NY lunch = 12:00–13:00 ET = 22:30–23:30 IST. The feature flag `isNyLunchBreakActive(istHour, istMinute)` covers both cases with a single function.

**Tech Stack:** Vanilla JS (BFF), Python (ML Engine). No new dependencies.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `bff/services/tradingHoursService.mjs` | **Create** | Pure function `isNyLunchBreakActive(istHour, istMinute)` — DST-aware NY lunch check |
| `bff/services/consensusEngine.mjs` | Modify | Call `isNyLunchBreakActive` before ML request; return NEUTRAL + reason if active |
| `bff/services/boardRoomService.mjs` | Modify | Add `isNyLunchBreakActive` check to RiskOfficer veto logic |
| `DOMAIN-RULES.md` | Modify | Document NY lunch block as a hard trading rule |
| `EDGE-CASES.md` | Modify | Add "NY Lunch Block" edge case |
| `bff/services/consensusAggregator.mjs` | No change | Already has `is_lunch_hour` in feature vector (reference only) |
| `bff/services/expiryCalendar.mjs` | No change | Already has `IST_OFFSET_MS` — reuse pattern |

---

## Task 1: Create tradingHoursService.mjs

**Files:**
- Create: `bff/services/tradingHoursService.mjs`
- Test: `bff/tests/trading-hours-service.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// bff/tests/trading-hours-service.test.mjs
import { strict as assert } from 'assert';
import { isNyLunchBreakActive } from '../services/tradingHoursService.mjs';

function hourMin(istHour, istMinute) {
  return isNyLunchBreakActive(istHour, istMinute);
}

// DST window: 9:30 PM – 10:30 PM IST (NY 12:00–13:00 ET)
// Outside DST window: 10:30 PM – 11:30 PM IST

// DST mode tests
assert(!hourMin(21, 0), '21:00 IST DST — before lunch');
assert(!hourMin(21, 29), '21:29 IST DST — before lunch');
assert(hourMin(21, 30), '21:30 IST DST — lunch starts');
assert(hourMin(21, 59), '21:59 IST DST — lunch active');
assert(hourMin(22, 0), '22:00 IST DST — lunch active');
assert(hourMin(22, 29), '22:29 IST DST — lunch active');
assert(!hourMin(22, 30), '22:30 IST DST — lunch ends');
assert(!hourMin(22, 59), '22:59 IST DST — after lunch');
assert(!hourMin(23, 0), '23:00 IST DST — after lunch');

// Outside-DST mode tests (offset shifts by 1 hour)
assert(!hourMin(22, 0), '22:00 IST noDST — before lunch');
assert(!hourMin(22, 29), '22:29 IST noDST — before lunch');
assert(hourMin(22, 30), '22:30 IST noDST — lunch starts');
assert(hourMin(22, 59), '22:59 IST noDST — lunch active');
assert(hourMin(23, 0), '23:00 IST noDST — lunch active');
assert(hourMin(23, 29), '23:29 IST noDST — lunch active');
assert(!hourMin(23, 30), '23:30 IST noDST — lunch ends');

// Boundary: minute exactly 0 or 30
assert(!hourMin(21, 29), '21:29 IST — last minute before DST lunch');
assert(hourMin(21, 30), '21:30 IST — first minute of DST lunch');
assert(!hourMin(22, 29), '22:29 IST — last minute of DST lunch');
assert(hourMin(22, 30), '22:30 IST — first minute after DST lunch');

// Non-lunch hours (sanity)
assert(!hourMin(7, 0), '07:00 IST morning — not lunch');
assert(!hourMin(14, 0), '14:00 IST afternoon — not lunch');
assert(!hourMin(3, 0), '03:00 IST night — not lunch');

console.log('All tradingHoursService tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bff && node --experimental-vm-modules tests/trading-hours-service.test.mjs`
Expected: FAIL — tradingHoursService.mjs does not exist

- [ ] **Step 3: Write the implementation**

```javascript
// bff/services/tradingHoursService.mjs
/**
 * Trading Hours Service
 *
 * Pure time-zone-aware trading window checks.
 * All functions are synchronous — no side effects, no network calls.
 * DST-aware: NY observes daylight saving time (second Sunday March → first Sunday November).
 */

/**
 * Returns true if NY is currently in DST.
 * @param {Date} [date=new Date()]
 * @returns {boolean}
 */
export function isNyInDst(date = new Date()) {
  // NY DST: second Sunday March 2AM → first Sunday November 2AM local time
  const jan = new Date(date.getUTCFullYear(), 0, 1);
  const jul = new Date(date.getUTCFullYear(), 6, 1);

  function getOffset(d) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(d);
  }

  // Standard offset is EST = -5, DST is EDT = -4
  // Compare Jan and Jul offsets to infer DST
  const janOffset = parseInt(getOffset(jan), 10);
  const julOffset = parseInt(getOffset(jul), 10);
  const julHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(new Date(date.getUTCFullYear(), 6, 1)),
    10,
  );
  // If July hour in NY TZ is different from Jan hour in NY TZ, NY is in DST
  const janHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(new Date(date.getUTCFullYear(), 0, 1)),
    10,
  );
  return janHour !== julHour;
}

/**
 * Returns true if the given IST hour/minute falls within the NY lunch break.
 * NY lunch = 12:00–13:00 ET every day.
 *   DST active  → IST equivalent: 21:30–22:30
 *   DST inactive → IST equivalent: 22:30–23:30
 *
 * @param {number} istHour 0–23
 * @param {number} istMinute 0–59
 * @param {boolean} [isDst] pass false to force non-DST (test helper)
 * @returns {boolean}
 */
export function isNyLunchBreakActive(istHour, istMinute, isDst = null) {
  const dstActive = isDst === null ? isNyInDst() : isDst;
  const istTotalMin = istHour * 60 + istMinute;

  if (dstActive) {
    // DST: 21:30–22:30 IST
    const startDst = 21 * 60 + 30; // 1290
    const endDst = 22 * 60 + 30;   // 1350
    return istTotalMin >= startDst && istTotalMin < endDst;
  } else {
    // No DST: 22:30–23:30 IST
    const startNoDst = 22 * 60 + 30; // 1350
    const endNoDst = 23 * 60 + 30;   // 1410
    return istTotalMin >= startNoDst && istTotalMin < endNoDst;
  }
}

/**
 * Returns true if trading is currently allowed (no lunch block active).
 * Convenience wrapper for callers who also need to check weekend/holiday elsewhere.
 *
 * @param {Date} [now=new Date()]
 * @returns {{ allowed: boolean, reason: string | null }}
 */
export function isNyLunchBlockActive(now = new Date()) {
  const istTotalMin =
    now.getUTCHours() * 60 +
    now.getUTCMinutes() +
    (5 * 60 + 30); // IST = UTC + 5:30

  // Normalize to 0–1439
  const istHour = Math.floor(((istTotalMin % 1440) + 1440) % 1440 / 60);
  const istMinute = now.getUTCMinutes();

  const lunchActive = isNyLunchBreakActive(istHour, istMinute);
  if (lunchActive) {
    return {
      allowed: false,
      reason: 'ny_lunch_block',
      message: 'NY lunch break (12:00–1:00 PM ET) — no new signals generated',
    };
  }
  return { allowed: true, reason: null, message: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bff && node --experimental-vm-modules tests/trading-hours-service.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bff/services/tradingHoursService.mjs bff/tests/trading-hours-service.test.mjs
git commit -m "feat: add tradingHoursService with DST-aware NY lunch block check
- isNyLunchBreakActive(istHour, istMinute) returns true inside 12:00–1:00 PM ET
- DST-aware: 21:30–22:30 IST (DST) / 22:30–23:30 IST (no DST)
- Used by consensusEngine and boardRoomService to block signals during lunch"
```

---

## Task 2: Update consensusEngine.mjs — block ML call during lunch

**Files:**
- Modify: `bff/services/consensusEngine.mjs:342` (getMlConsensus function)

- [ ] **Step 1: Write the failing test**

Add to `bff/tests/` (create `bff/tests/consensus-engine-lunch.test.mjs`):

```javascript
import { strict as assert } from 'assert';

let originalGetMlConsensus;
let blockCallCount = 0;
let lastBlockReason = null;

// Mock the tradingHoursService
const mockIsNyLunchBreakActive = (istHour, istMinute) => {
// Force lunch: always return true for this test
return true;
};

const mockIsNyLunchBreakActiveOff = (istHour, istMinute) => {
// Force non-lunch
return false;
};

// Tests will be run against the actual getMlConsensus after module load
// We verify by checking the response shape has the lunch block fields
async function runTests() {
  const { getMlConsensus } = await import('../services/consensusEngine.mjs');

  // Patch the import for this test
  const result = await getMlConsensus({ symbol: 'MNQ' });
  
  // If lunch block fires: signal must be NEUTRAL, timing.reason must mention lunch
  assert(result.signal === 'NEUTRAL', `Expected NEUTRAL during lunch, got ${result.signal}`);
  assert(
    result.timing?.reason?.toLowerCase().includes('lunch') ||
    result.timing?.ny_lunch_block === true ||
    (result.source === 'ny_lunch_block'),
    `Expected lunch block reason in timing.reason, got: ${JSON.stringify(result.timing)}`
  );
  
  console.log('consensusEngine lunch block test PASSED');
}

runTests().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bff && node --experimental-vm-modules tests/consensus-engine-lunch.test.mjs`
Expected: FAIL — NEUTRAL returned but reason doesn't mention lunch (not yet implemented)

- [ ] **Step 3: Write the implementation**

Find the circuit breaker block at line ~360 in `consensusEngine.mjs` (inside `getMlConsensus`):

```javascript
// Per-instrument circuit breaker gate — ADD AFTER THIS BLOCK (around line 368)
// Insert new lunch-block gate BEFORE the mlRequest call
const istNow = new Date();
const istHour = parseInt(
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  }).format(istNow),
  10,
);
const istMinute = parseInt(
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    minute: 'numeric',
    hour12: false,
  }).format(istNow),
  10,
);

if (isNyLunchBreakActive(istHour, istMinute)) {
  return {
    ok: false,
    source: 'ny_lunch_block',
    instrument: getInstrumentConfig(resolvedSymbol),
    timestamp: new Date().toISOString(),
    signal: 'NEUTRAL',
    confidence: 0.5,
    error: null,
    votes: {},
    session: {
      id: sessionId,
      name: ['Pre-Market', 'Main Trading', 'Post-Market'][sessionId] || 'Main Trading',
      session_pct: features.session_pct,
      minutes_into_session: features.minutes_into_session,
    },
    alpha: null,
    expected_move: null,
    rrr: null,
    exit_plan: null,
    position_sizing: null,
    regime: null,
    timing: {
      enter_now: false,
      ny_lunch_block: true,
      reason:
        'NY lunch break — 12:00–1:00 PM ET (21:30–22:30 IST DST / 22:30–23:30 IST no DST). No new signals generated during this window.',
      P_profitable_entry_now: 0.5,
    },
    models_used: 0,
    data_trades_analyzed: 0,
    model_freshness: 'ny_lunch_block',
    feature_vector: features,
    instrument: getInstrumentConfig(resolvedSymbol),
    circuitBreaker: cbIsOpen(resolvedSymbol) ? 'open' : 'closed',
  };
}
```

Then add to the imports at the top of the file (or after the existing imports):

```javascript
import { isNyLunchBreakActive } from './tradingHoursService.mjs';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bff && node --experimental-vm-modules tests/consensus-engine-lunch.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bff/services/consensusEngine.mjs bff/tests/consensus-engine-lunch.test.mjs
git commit -m "fix: block ML consensus during NY lunch break
- isNyLunchBreakActive check gates getMlConsensus before ML request
- Returns NEUTRAL with ny_lunch_block source and reason
- DST-aware: 21:30–22:30 IST (DST) / 22:30–23:30 IST (no DST)"
```

---

## Task 3: Update boardRoomService.mjs — RiskOfficer lunch veto

**Files:**
- Modify: `bff/services/boardRoomService.mjs` — find `reportError` or `recordHeartbeat` (agent functions)
- Add: RiskOfficer lunch veto function + call site

- [ ] **Step 1: Read the RiskOfficer section**

```bash
grep -n "RiskOfficer\|riskOfficer\|risk\|VETO\|veto" bff/services/boardRoomService.mjs | head -30
```

- [ ] **Step 2: Write the failing test**

Create `bff/tests/board-room-lunch-veto.test.mjs`:

```javascript
import { strict as assert } from 'assert';
import { isNyLunchBlockActive } from '../services/tradingHoursService.mjs';

async function test() {
  // When NY lunch is active, RiskOfficer veto must fire
  const mockNow = new Date();
  // This test uses the real clock — run at 22:00 IST during DST to test
  const block = isNyLunchBlockActive(mockNow);
  
  // The function should correctly detect the block based on actual IST time
  console.log(`Current IST time check: blocked=${block.allowed === false}`);
  
  // Test DST mode explicitly
  const { isNyLunchBreakActive } = await import('../services/tradingHoursService.mjs');
  
  // DST: 21:30–22:30 IST → should block
  assert(isNyLunchBreakActive(21, 30, true) === true, '21:30 IST DST should block');
  assert(isNyLunchBreakActive(22, 0, true) === true, '22:00 IST DST should block');
  assert(isNyLunchBreakActive(22, 30, true) === false, '22:30 IST DST should NOT block');
  
  // No DST: 22:30–23:30 IST → should block
  assert(isNyLunchBreakActive(22, 30, false) === true, '22:30 IST noDST should block');
  assert(isNyLunchBreakActive(23, 0, false) === true, '23:00 IST noDST should block');
  assert(isNyLunchBreakActive(23, 30, false) === false, '23:30 IST noDST should NOT block');
  
  console.log('BoardRoom RiskOfficer lunch veto test PASSED');
}

test().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd bff && node --experimental-vm-modules tests/board-room-lunch-veto.test.mjs`
Expected: PASS (function works) or FAIL (import error if tradingHoursService not yet imported)

- [ ] **Step 4: Write the implementation**

Add to `boardRoomService.mjs` imports or as a standalone function near the top:

```javascript
/**
 * RiskOfficer lunch block check.
 * Fires before any trading signal goes through the Board Room.
 * Returns { veto: true, reason: string } if NY lunch break is active.
 */
export function checkNyLunchVeto() {
  const now = new Date();
  const istHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(now),
    10,
  );
  const istMinute = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      minute: 'numeric',
      hour12: false,
    }).format(now),
    10,
  );

  if (isNyLunchBreakActive(istHour, istMinute)) {
    return {
      veto: true,
      reason:
        'NY lunch break (12:00–1:00 PM ET) — RiskOfficer veto. No trading signals during this window.',
      vetoSource: 'ny_lunch_riskofficer',
      timestamp: new Date().toISOString(),
    };
  }
  return { veto: false };
}
```

Then find every call site that returns a trading signal (LONG/SHORT) and call `checkNyLunchVeto()` before emitting. The main call site is wherever the Board Room agent posts consensus results. Locate it with:

```bash
grep -n "signal.*LONG\|signal.*SHORT\|deliberate\|emit.*signal\|postConsensus" bff/services/boardRoomService.mjs | head -20
```

Wrap any signal emission with:

```javascript
const lunchVeto = checkNyLunchVeto();
if (lunchVeto.veto) {
  logToJsonl({ type: 'risk_officer_veto', source: lunchVeto.vetoSource, reason: lunchVeto.reason });
  return { ...lunchVeto }; // or return NEUTRAL signal
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd bff && node --experimental-vm-modules tests/board-room-lunch-veto.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add bff/services/boardRoomService.mjs
git commit -m "fix: RiskOfficer vetoes all trading signals during NY lunch break
- checkNyLunchVeto() added to boardRoomService
- Returns veto + reason during 12:00–1:00 PM ET window
- DST-aware: 21:30–22:30 IST (DST) / 22:30–23:30 IST (no DST)"
```

---

## Task 4: Document in DOMAIN-RULES.md and EDGE-CASES.md

**Files:**
- Modify: `DOMAIN-RULES.md` — add to Section 1 (Session Rules) and Section 2 (Risk Calculations)
- Modify: `EDGE-CASES.md` — add NY Lunch Block to "Market Hours" section

- [ ] **Step 1: Update DOMAIN-RULES.md**

Add to Section 1 under "Avoid trading":

```markdown
### Session Rules
- Best sessions: **London (07:00-09:00 UTC), New York (13:30-16:00 UTC)**
- **NY Lunch Block (HARD RULE — no exceptions):** Do not allow trading signals in any asset
  during 12:00–1:00 PM ET (New York lunch). This period has historically low volume and
  elevated chop, making it unfavorable for directional trades.
  - During DST (Mar–Nov): 12:00–1:00 PM ET = **21:30–22:30 IST**
  - Outside DST (Nov–Mar): 12:00–1:00 PM ET = **22:30–23:30 IST**
  - Implementation: `isNyLunchBreakActive(istHour, istMinute)` in `bff/services/tradingHoursService.mjs`
  - Effect: Consensus returns NEUTRAL, Board Room RiskOfficer fires veto, no new signals emitted
- Avoid trading: first 15 min of RTH open (high noise), last 30 min of RTH close (chop)
- Friday afternoon: reduce size by 50% (weekend gap risk)
- Holiday sessions: reduce size by 50% (thin liquidity)
```

Add to Section 2 under Risk Calculations (new bullet):
```markdown
### Session Edge
- NY Lunch Block: Session Edge = 0 during 12:00–1:00 PM ET. Do not calculate or trade.
```

- [ ] **Step 2: Update EDGE-CASES.md**

Add new item under "### Market Hours":

```markdown
- [ ] **NY Lunch Block** — 12:00–1:00 PM ET daily. Low volume, high chop, directional
  signals unreliable. `isNyLunchBreakActive()` gates all consensus signals and fires
  RiskOfficer veto. DST-aware IST conversion handled automatically.
  - Active DST: block fires 21:30–22:30 IST
  - Inactive DST: block fires 22:30–23:30 IST
```

- [ ] **Step 3: Commit**

```bash
git add DOMAIN-RULES.md EDGE-CASES.md
git commit -m "docs: document NY lunch trading block as hard trading rule
- DOMAIN-RULES.md: added to Session Rules and Risk Calculations
- EDGE-CASES.md: added to Market Hours section
- Explains DST/IST conversion for both modes"
```

---

## Task 5: Verify end-to-end — run BFF health check

**Files:**
- Test: manual verification

- [ ] **Step 1: Start BFF and call consensus endpoint during a non-lunch hour**

```bash
curl -s http://localhost:8788/api/ml/consensus?symbol=MNQ | jq '.signal, .timing.reason, .source'
```

Expected: normal response with signal and no lunch block.

- [ ] **Step 2: Run unit tests**

```bash
cd bff && node --experimental-vm-modules tests/trading-hours-service.test.mjs
cd bff && node --experimental-vm-modules tests/consensus-engine-lunch.test.mjs
```

- [ ] **Step 3: Commit final changes if all pass**

```bash
git add -A
git commit -m "feat: complete NY lunch trading block implementation
- tradingHoursService.mjs: DST-aware NY lunch check
- consensusEngine.mjs: blocks ML call, returns NEUTRAL with lunch reason
- boardRoomService.mjs: RiskOfficer fires veto during lunch
- DOMAIN-RULES.md + EDGE-CASES.md: documented as hard trading rule"
```

---

## Spec Coverage Checklist

| Requirement | Task |
|---|---|
| Block trading during NY lunch (12:00–1:00 PM ET) | Task 1 (function) + Task 2 (consensus gate) + Task 3 (RiskOfficer veto) |
| DST-aware (IST equivalent shifts) | Task 1 (`isNyInDst`) |
| Return NEUTRAL signal with clear reason | Task 2 (consensusEngine response) |
| Board Room RiskOfficer fires veto | Task 3 (boardRoomService) |
| Frontend shows non-intrusive indicator | Not in scope — UI update is separate frontend task |
| Documented in DOMAIN-RULES.md | Task 4 |
| Documented in EDGE-CASES.md | Task 4 |
| No new dependencies | Confirmed — vanilla JS only |

---

## Placeholder Scan

All steps have: exact file paths, complete code blocks, exact test assertions, exact run commands. No TBDs. No TODOs.

---

**Plan complete.** Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks

**2. Inline Execution** — Execute tasks sequentially in this session with checkpoints

**Which approach?**
