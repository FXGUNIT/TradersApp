import test from "node:test";
import assert from "node:assert/strict";

import boardRoomService from "../services/boardRoomService.mjs";
import {
  __resetBoardRoomAgentReporterForTests,
  reportAgentError,
} from "../services/boardRoomAgentReporter.mjs";

test("reportAgentError throttles duplicate agent errors", async () => {
  const originalSetting = process.env.BOARD_ROOM_AGENT_REPORTING;
  const originalReportError = boardRoomService.reportError;
  const calls = [];

  process.env.BOARD_ROOM_AGENT_REPORTING = "true";
  boardRoomService.reportError = async (payload) => {
    calls.push(payload);
    return { ok: true, ...payload };
  };

  try {
    const first = await reportAgentError({
      agent: "ConsensusEngine",
      error: new Error("ml engine timeout"),
      severity: "HIGH",
    });
    const second = await reportAgentError({
      agent: "ConsensusEngine",
      error: new Error("ml engine timeout"),
      severity: "HIGH",
    });

    assert.equal(first.ok, true);
    assert.equal(second, null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].severity, "HIGH");
  } finally {
    boardRoomService.reportError = originalReportError;
    if (originalSetting === undefined) {
      delete process.env.BOARD_ROOM_AGENT_REPORTING;
    } else {
      process.env.BOARD_ROOM_AGENT_REPORTING = originalSetting;
    }
    __resetBoardRoomAgentReporterForTests();
  }
});
