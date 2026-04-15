from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]


def _run_node(script: str) -> dict:
    if shutil.which("node") is None:
        pytest.skip("Node.js is required for BFF route-contract checks.")

    completed = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(completed.stdout.strip())


def test_identity_route_blocks_cross_uid_patch_contract():
    result = _run_node(
        """
import { createIdentityRouteHandler } from "./bff/routes/identityRoutes.mjs";

const json = (res, status, payload) => {
  res.statusCode = status;
  res.payload = payload;
};

const handler = createIdentityRouteHandler({
  deleteSession: () => null,
  findUserByEmail: () => null,
  getUserByUid: () => ({ user: { uid: "user-a" }, sessions: {} }),
  getUserStatus: () => null,
  listTrainingEligibilityUsers: () => [],
  listSessions: () => ({}),
  patchUserAccess: () => ({ uid: "user-a" }),
  patchUserSecurity: () => ({ uid: "user-a" }),
  provisionUser: () => null,
  recordUserActiveDay: () => null,
  revokeOtherSessions: () => ({ success: false }),
  upsertSession: () => null,
  json,
  readJsonBody: async (req) => req.__body || {},
});

const req = {
  method: "PATCH",
  _authUid: "user-a",
  __body: { role: "ADMIN" },
};
const res = {};

const handled = await handler(
  req,
  res,
  new URL("http://localhost/identity/users/user-b/access"),
  "http://localhost",
);

console.log(JSON.stringify({ handled, status: res.statusCode, payload: res.payload }));
""".strip()
    )

    assert result["handled"] is True
    assert result["status"] == 403
    assert result["payload"] == {"ok": False, "error": "Access denied."}


def test_identity_revoke_others_validates_required_session_id():
    result = _run_node(
        """
import { createIdentityRouteHandler } from "./bff/routes/identityRoutes.mjs";

const json = (res, status, payload) => {
  res.statusCode = status;
  res.payload = payload;
};

const handler = createIdentityRouteHandler({
  deleteSession: () => null,
  findUserByEmail: () => null,
  getUserByUid: () => ({ user: { uid: "user-a" }, sessions: {} }),
  getUserStatus: () => null,
  listTrainingEligibilityUsers: () => [],
  listSessions: () => ({}),
  patchUserAccess: () => ({ uid: "user-a" }),
  patchUserSecurity: () => ({ uid: "user-a" }),
  provisionUser: () => null,
  recordUserActiveDay: () => null,
  revokeOtherSessions: (_uid, currentSessionId) => {
    if (!currentSessionId) {
      return { success: false, error: "currentSessionId is required." };
    }
    return { success: true, revokedCount: 0, sessions: {} };
  },
  upsertSession: () => null,
  json,
  readJsonBody: async (req) => req.__body || {},
});

const req = {
  method: "POST",
  __body: {},
};
const res = {};

await handler(
  req,
  res,
  new URL("http://localhost/identity/users/user-a/sessions/revoke-others"),
  "http://localhost",
);

console.log(JSON.stringify({ status: res.statusCode, payload: res.payload }));
""".strip()
    )

    assert result["status"] == 400
    assert result["payload"]["ok"] is False
    assert "currentSessionId is required" in result["payload"]["error"]


def test_identity_revoke_others_is_repeat_safe():
    result = _run_node(
        """
import { createIdentityRouteHandler } from "./bff/routes/identityRoutes.mjs";

const json = (res, status, payload) => {
  res.statusCode = status;
  res.payload = payload;
};

const sessionState = {
  "session-current": { id: "session-current" },
  "session-other": { id: "session-other" },
};

const revokeOtherSessions = (_uid, currentSessionId) => {
  if (!currentSessionId) {
    return { success: false, error: "currentSessionId is required." };
  }
  const allIds = Object.keys(sessionState);
  const revoked = allIds.filter((id) => id !== currentSessionId);
  for (const id of revoked) {
    delete sessionState[id];
  }
  return {
    success: true,
    revokedCount: revoked.length,
    sessions: { ...sessionState },
  };
};

const handler = createIdentityRouteHandler({
  deleteSession: () => null,
  findUserByEmail: () => null,
  getUserByUid: () => ({ user: { uid: "user-a" }, sessions: { ...sessionState } }),
  getUserStatus: () => null,
  listTrainingEligibilityUsers: () => [],
  listSessions: () => ({ ...sessionState }),
  patchUserAccess: () => ({ uid: "user-a" }),
  patchUserSecurity: () => ({ uid: "user-a" }),
  provisionUser: () => null,
  recordUserActiveDay: () => null,
  revokeOtherSessions,
  upsertSession: () => null,
  json,
  readJsonBody: async (req) => req.__body || {},
});

const callOnce = async () => {
  const req = {
    method: "POST",
    __body: { currentSessionId: "session-current" },
  };
  const res = {};
  await handler(
    req,
    res,
    new URL("http://localhost/identity/users/user-a/sessions/revoke-others"),
    "http://localhost",
  );
  return { status: res.statusCode, payload: res.payload };
};

const first = await callOnce();
const second = await callOnce();

console.log(JSON.stringify({ first, second }));
""".strip()
    )

    assert result["first"]["status"] == 200
    assert result["first"]["payload"]["ok"] is True
    assert result["first"]["payload"]["revokedCount"] == 1

    assert result["second"]["status"] == 200
    assert result["second"]["payload"]["ok"] is True
    assert result["second"]["payload"]["revokedCount"] == 0


def test_support_message_route_contract_shape():
    result = _run_node(
        """
import { createSupportRouteHandler } from "./bff/routes/supportRoutes.mjs";

const json = (res, status, payload) => {
  res.statusCode = status;
  res.payload = payload;
};

const threads = new Map();
const appendSupportMessage = (uid, body) => {
  const current = threads.get(uid) || { uid, messages: [] };
  const message = {
    id: `${uid}-${current.messages.length + 1}`,
    text: body.text || "",
    sender: body.sender || "user",
    timestamp: body.timestamp || Date.now(),
  };
  current.messages = [...current.messages, message];
  threads.set(uid, current);
  return current;
};

const handler = createSupportRouteHandler({
  appendSupportMessage,
  getSupportThread: (uid) => threads.get(uid) || null,
  listSupportThreads: () => Array.from(threads.values()),
  json,
  readJsonBody: async (req) => req.__body || {},
});

const req = {
  method: "POST",
  __body: { text: "Need support", sender: "user" },
};
const res = {};

await handler(
  req,
  res,
  new URL("http://localhost/support/threads/user-9/messages"),
  "http://localhost",
);

console.log(JSON.stringify({ status: res.statusCode, payload: res.payload }));
""".strip()
    )

    assert result["status"] == 200
    assert result["payload"]["ok"] is True
    assert result["payload"]["message"]["text"] == "Need support"
