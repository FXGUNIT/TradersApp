from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]


def _run_node(script: str) -> dict:
    if shutil.which("node") is None:
        pytest.skip("Node.js is required for BFF privilege-contract checks.")

    completed = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(completed.stdout.strip())


def test_board_room_route_requires_admin_before_handler_executes():
    result = _run_node(
        """
import { registerDispatchRoutes } from "./bff/_dispatchRoutes.mjs";

const json = (res, status, payload) => {
  res.statusCode = status;
  res.payload = payload;
};

let boardRoomCalls = 0;

const dispatchRoutes = registerDispatchRoutes({
  json,
  readJsonBody: async () => ({}),
  getClientKey: () => "client",
  hashPassword: () => "",
  constantTimeMatch: () => false,
  invokeProvider: async () => "ok",
  getOriginFallback: () => "http://localhost",
  buildAiStatusPayload: () => [],
  randomUUID: () => "req-id",
  authorizeRequest: async () => ({
    authorized: false,
    error: "Insufficient permissions. Required: ADMIN",
  }),
  validateAdminToken: async () => ({ valid: false }),
  createAdminSession: async () => "token",
  revokeAdminSession: async () => {},
  listAdminSessions: async () => [],
  revokeSessionById: async () => false,
  getAdminPasswordAttemptState: () => ({ attempts: 0, lockoutUntil: 0 }),
  registerAdminPasswordFailedAttempt: () => ({ attempts: 1, lockoutUntil: 0 }),
  clearAdminPasswordFailedAttempts: () => {},
  consumeCollectiveConsciousnessQuestion: () => ({ ok: true, usage: {} }),
  contentHandler: () => false,
  terminalHandler: async () => false,
  terminalAnalyticsHandler: async () => false,
  identityHandler: async () => false,
  onboardingHandler: async () => false,
  supportHandler: async () => false,
  consensusHandler: async () => false,
  newsHandler: async () => false,
  tradeCalcHandler: async () => false,
  adminHandler: async () => false,
  boardRoomHandler: {
    handle: async () => {
      boardRoomCalls += 1;
      return true;
    },
  },
  ADMIN_PASS_HASH: "",
  ALLOWED_ORIGINS: [],
  ROLES_ADMIN: "ADMIN",
  ADMIN_ATTEMPT_LIMIT: 3,
  ADMIN_LOCKOUT_WINDOW_MS: 1000,
  handleTelegramSendMessage: async () => {},
  handleTelegramSendForensicAlert: async () => {},
});

const req = {
  method: "POST",
  url: "/board-room/threads",
  headers: {},
};
const res = {};
const url = new URL("http://localhost/board-room/threads");

await dispatchRoutes(req, res, url, url.pathname, req.method, "http://localhost");

console.log(JSON.stringify({ status: res.statusCode, payload: res.payload, boardRoomCalls }));
""".strip()
    )

    assert result["status"] == 403
    assert result["payload"] == {
        "ok": False,
        "error": "Insufficient permissions. Required: ADMIN",
    }
    assert result["boardRoomCalls"] == 0
