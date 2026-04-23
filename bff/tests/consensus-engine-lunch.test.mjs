import { strict as assert } from "assert";
import { isNyLunchBreakActive } from "../services/tradingHoursService.mjs";

async function test() {
  const { getMlConsensus } = await import("../services/consensusEngine.mjs");

  // Force a fake IST time: 22:00 IST during DST → lunch block active
  const RealDate = global.Date;
  const fakeDate = new RealDate("2026-06-15T16:30:00Z"); // 22:00 IST DST
  global.Date = class extends RealDate {
    constructor(...args) {
      return args.length ? new RealDate(...args) : fakeDate;
    }
    static now() {
      return fakeDate.getTime();
    }
  };

  const result = await getMlConsensus({ symbol: "MNQ" });

  // Restore real Date
  global.Date = RealDate;

  assert(result.signal === "NEUTRAL", `Expected NEUTRAL, got ${result.signal}`);
  assert(
    result.source === "ny_lunch_block",
    `Expected ny_lunch_block source, got ${result.source}`
  );
  assert(
    result.timing?.ny_lunch_block === true,
    `Expected ny_lunch_block flag, got ${JSON.stringify(result.timing)}`
  );
  assert(
    result.timing?.reason?.toLowerCase().includes("lunch") ||
      result.timing?.reason?.includes("12:00") ||
      result.timing?.reason?.includes("IST"),
    `Expected lunch block reason, got: ${result.timing?.reason}`
  );
  assert(
    result.model_freshness === "ny_lunch_block",
    `Expected ny_lunch_block freshness, got ${result.model_freshness}`
  );

  console.log("consensusEngine lunch block test PASSED");
}

test().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});