import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cwd, chdir } from "node:process";

const originalCwd = cwd();

async function withTempWorkspace(run) {
  const dir = await mkdtemp(join(tmpdir(), "tradersapp-stage-n-"));
  await mkdir(join(dir, "bff", "data"), { recursive: true });
  chdir(dir);
  try {
    const moduleUrl = new URL("../domains/identityState.mjs", import.meta.url);
    const identityState = await import(
      `${moduleUrl.href}?ts=${Date.now()}-${Math.random()}`
    );
    await run(identityState, dir);
  } finally {
    chdir(originalCwd);
  }
}

test("provisionUser initializes training eligibility tracking", async () => {
  await withTempWorkspace(async ({ provisionUser, getUserStatus }) => {
    const record = provisionUser("user-1", {
      email: "user-1@gmail.com",
      fullName: "User One",
      role: "user",
    });

    assert.equal(record.user.daysUsed, 0);
    assert.equal(record.user.days_used, 0);
    assert.equal(record.user.lastActiveDay, null);
    assert.equal(record.user.isTrainingEligible, false);
    assert.equal(
      record.user.trainingEligibilityMessage,
      "Unlock more AI accuracy after 10 days of usage",
    );

    const status = getUserStatus("user-1");
    assert.equal(status.daysUsed, 0);
    assert.equal(status.days_used, 0);
    assert.equal(status.isTrainingEligible, false);
  });
});

test("recordUserActiveDay counts distinct days only once", async () => {
  await withTempWorkspace(async ({ provisionUser, recordUserActiveDay }) => {
    provisionUser("user-2", { role: "user" });

    const first = recordUserActiveDay("user-2", { activeDay: "2026-04-01" });
    const second = recordUserActiveDay("user-2", { activeDay: "2026-04-01" });
    const third = recordUserActiveDay("user-2", { activeDay: "2026-04-02" });

    assert.equal(first.user.daysUsed, 1);
    assert.equal(second.user.daysUsed, 1);
    assert.equal(third.user.daysUsed, 2);
    assert.equal(third.user.lastActiveDay, "2026-04-02");
  });
});

test("recordUserActiveDay flips user eligibility at day ten", async () => {
  await withTempWorkspace(async ({ provisionUser, recordUserActiveDay }) => {
    provisionUser("user-3", { role: "user" });

    let result = null;
    for (let day = 1; day <= 10; day += 1) {
      result = recordUserActiveDay("user-3", {
        activeDay: `2026-04-${String(day).padStart(2, "0")}`,
      });
    }

    assert.ok(result);
    assert.equal(result.user.daysUsed, 10);
    assert.equal(result.user.isTrainingEligible, true);
    assert.equal(
      result.user.trainingEligibilityMessage,
      "Future uploads are now eligible for training",
    );
  });
});

test("admin users are always training eligible", async () => {
  await withTempWorkspace(async ({ provisionUser, recordUserActiveDay }) => {
    const record = provisionUser("admin-1", {
      role: "admin",
      email: "admin@gmail.com",
    });

    assert.equal(record.user.isTrainingEligible, true);
    assert.equal(
      record.user.trainingEligibilityMessage,
      "Future uploads are now eligible for training",
    );

    const result = recordUserActiveDay("admin-1", { activeDay: "2026-04-01" });
    assert.equal(result.user.daysUsed, 1);
    assert.equal(result.user.isTrainingEligible, true);
  });
});
