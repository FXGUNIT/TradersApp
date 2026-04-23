import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeAtomic } from "../domains/atomicWrite.mjs";

test("writeAtomic creates parent directories before writing", () => {
  const root = mkdtempSync(join(tmpdir(), "tradersapp-atomic-write-"));
  const target = join(root, "bff", "data", "admin-domain.json");

  try {
    writeAtomic(target, {
      maintenanceActive: false,
      passwordAttempts: {
        "127.0.0.1": {
          attempts: 1,
          lockoutUntil: 0,
        },
      },
    });

    assert.equal(existsSync(target), true);
    const persisted = JSON.parse(readFileSync(target, "utf8"));
    assert.equal(persisted.passwordAttempts["127.0.0.1"].attempts, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
