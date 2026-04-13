import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, access, mkdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import boardRoomService from "../services/boardRoomService.mjs";

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

test("archiveOldLogs moves board room logs older than retention window", async () => {
  const originalLogDir = process.env.BOARD_ROOM_LOG_DIR;
  const originalArchiveDir = process.env.BOARD_ROOM_LOG_ARCHIVE_DIR;
  const tempRoot = await mkdtemp(join(tmpdir(), "board-room-log-rotation-"));
  const logDir = join(tempRoot, "logs");
  const archiveDir = join(tempRoot, "archive");

  process.env.BOARD_ROOM_LOG_DIR = logDir;
  process.env.BOARD_ROOM_LOG_ARCHIVE_DIR = archiveDir;

  try {
    await mkdir(logDir, { recursive: true });
    const oldFile = join(logDir, "board_2025-12-01.jsonl");
    const recentFile = join(logDir, "board_2026-04-01.jsonl");
    await writeFile(oldFile, '{"type":"old"}\n', "utf8");
    await writeFile(recentFile, '{"type":"recent"}\n', "utf8");

    const result = await boardRoomService.archiveOldLogs({
      now: new Date("2026-04-13T00:00:00.000Z"),
      retentionDays: 90,
    });

    assert.deepEqual(result.archived, ["board_2025-12-01.jsonl"]);
    assert.equal(await exists(join(archiveDir, "board_2025-12-01.jsonl")), true);
    assert.equal(await exists(oldFile), false);
    assert.equal(await exists(recentFile), true);
  } finally {
    if (originalLogDir === undefined) {
      delete process.env.BOARD_ROOM_LOG_DIR;
    } else {
      process.env.BOARD_ROOM_LOG_DIR = originalLogDir;
    }
    if (originalArchiveDir === undefined) {
      delete process.env.BOARD_ROOM_LOG_ARCHIVE_DIR;
    } else {
      process.env.BOARD_ROOM_LOG_ARCHIVE_DIR = originalArchiveDir;
    }
  }
});
