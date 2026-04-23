import test from "node:test";
import assert from "node:assert/strict";

import { getUpcomingExpiryDates } from "../services/expiryCalendar.mjs";

test("getUpcomingExpiryDates returns sorted, holiday-aware entries for NIFTY", () => {
  const result = getUpcomingExpiryDates({
    count: 4,
    symbol: "NIFTY",
    now: new Date("2026-04-10T06:00:00Z"),
  });

  assert.equal(result.length, 4);
  assert.deepEqual(
    result.map((entry) => entry.date),
    ["2026-04-16", "2026-04-23", "2026-04-30", "2026-05-07"],
  );
  assert.equal(result[0].type, "WEEKLY");
  assert.equal(result[2].type, "MONTHLY");
});
