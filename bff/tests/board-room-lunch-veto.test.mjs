import { strict as assert } from "assert";
import {
  checkNyLunchVeto,
} from "../services/boardRoomAgentReporter.mjs";
import { isNyLunchBreakActive } from "../services/tradingHoursService.mjs";

async function test() {
  // ── isNyLunchBreakActive boundary logic ──────────────────────────────────────
  // DST: 21:30–22:30 IST → blocks
  assert(isNyLunchBreakActive(21, 30, true) === true, "21:30 IST DST should block");
  assert(isNyLunchBreakActive(22, 0, true) === true, "22:00 IST DST should block");
  assert(isNyLunchBreakActive(22, 29, true) === true, "22:29 IST DST should still block");
  assert(isNyLunchBreakActive(22, 30, true) === false, "22:30 IST DST should NOT block");
  assert(isNyLunchBreakActive(21, 29, true) === false, "21:29 IST DST should NOT block");

  // No-DST: 22:30–23:30 IST → blocks
  assert(isNyLunchBreakActive(22, 30, false) === true, "22:30 IST noDST should block");
  assert(isNyLunchBreakActive(23, 0, false) === true, "23:00 IST noDST should block");
  assert(isNyLunchBreakActive(23, 29, false) === true, "23:29 IST noDST should still block");
  assert(isNyLunchBreakActive(23, 30, false) === false, "23:30 IST noDST should NOT block");
  assert(isNyLunchBreakActive(22, 29, false) === false, "22:29 IST noDST should NOT block");

  // Middle of the window
  assert(isNyLunchBreakActive(22, 0, true) === true, "22:00 IST DST mid-window should block");
  assert(isNyLunchBreakActive(23, 0, false) === true, "23:00 IST noDST mid-window should block");

  // ── checkNyLunchVeto smoke test ─────────────────────────────────────────────
  // checkNyLunchVeto() calls isNyLunchBreakActive internally with live IST.
  // We can't freeze time here without a test hook, so we just verify the
  // function returns an object with the expected shape — whether veto fires
  // or not depends on the current clock.
  const result = checkNyLunchVeto();
  assert(
    typeof result === "object" && typeof result.veto === "boolean",
    `checkNyLunchVeto() must return {veto: bool}, got: ${JSON.stringify(result)}`,
  );
  assert(
    !result.veto || typeof result.reason === "string",
    "when veto=true, a reason string must be present",
  );
  assert(
    !result.veto || typeof result.vetoSource === "string",
    "when veto=true, vetoSource must be present",
  );
  assert(
    !result.veto || typeof result.timestamp === "string",
    "when veto=true, timestamp must be present",
  );

  console.log("boardRoomAgentReporter lunch veto tests PASSED");
}

test().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});