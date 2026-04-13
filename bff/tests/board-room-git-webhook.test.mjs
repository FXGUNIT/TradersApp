import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHmac } from "node:crypto";

import { createBoardRoomRouteHandler } from "../routes/boardRoomRoutes.mjs";
import boardRoomService from "../services/boardRoomService.mjs";
import boardRoomTelegram from "../services/boardRoomTelegram.mjs";

function createMockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = {
        ...this.headers,
        ...headers,
      };
    },
    end(body = "") {
      this.body = String(body || "");
    },
  };
}

function createSignedRequest({ body, signature, url = "/board-room/git-webhook" }) {
  const req = new EventEmitter();
  req.method = "POST";
  req.url = url;
  req.headers = {
    "x-hub-signature-256": signature,
  };

  process.nextTick(() => {
    req.emit("data", body);
    req.emit("end");
  });

  return req;
}

test("git webhook links commit to normalized thread id and notifies CEO", async () => {
  const handler = createBoardRoomRouteHandler();
  const originalSecret = process.env.BOARD_ROOM_GITHUB_WEBHOOK_SECRET;
  const originalGetThread = boardRoomService.getThread;
  const originalLinkCommitToThread = boardRoomService.linkCommitToThread;
  const originalSendAlert = boardRoomTelegram.sendAlert;

  const linkedCalls = [];
  const alerts = [];
  process.env.BOARD_ROOM_GITHUB_WEBHOOK_SECRET = "board-room-secret";

  boardRoomService.getThread = async (threadId) => {
    if (threadId === "T00001") {
      return {
        threadId: "T00001",
        title: "Webhook Thread",
        status: "OPEN",
        priority: "HIGH",
      };
    }
    return null;
  };

  boardRoomService.linkCommitToThread = async (payload) => {
    linkedCalls.push(payload);
    return {
      thread: {
        threadId: payload.threadId,
        title: "Webhook Thread",
        status: "OPEN",
        priority: "HIGH",
      },
      post: { postId: "T00001-P00001" },
    };
  };

  boardRoomTelegram.sendAlert = async (payload) => {
    alerts.push(payload);
    return { ok: true };
  };

  try {
    const payload = JSON.stringify({
      ref: "refs/heads/feature/board-room",
      commits: [
        {
          id: "9f54553abcdeffedcba",
          message: "feat: link commit [T01]",
          url: "https://example.test/commit/9f54553",
          author: { name: "Codex" },
        },
      ],
    });
    const signature = `sha256=${createHmac("sha256", process.env.BOARD_ROOM_GITHUB_WEBHOOK_SECRET).update(payload).digest("hex")}`;
    const req = createSignedRequest({ body: payload, signature });
    const res = createMockResponse();

    const handled = await handler.handle(
      req,
      res,
      "/board-room/git-webhook",
      "http://localhost",
    );

    assert.equal(handled, true);
    assert.equal(res.statusCode, 200);

    const parsed = JSON.parse(res.body);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.linked.length, 1);
    assert.equal(parsed.linked[0].threadId, "T00001");
    assert.equal(linkedCalls.length, 1);
    assert.equal(linkedCalls[0].threadId, "T00001");
    assert.equal(linkedCalls[0].branch, "board-room");
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, "GIT_COMMIT");
  } finally {
    boardRoomService.getThread = originalGetThread;
    boardRoomService.linkCommitToThread = originalLinkCommitToThread;
    boardRoomTelegram.sendAlert = originalSendAlert;
    if (originalSecret === undefined) {
      delete process.env.BOARD_ROOM_GITHUB_WEBHOOK_SECRET;
    } else {
      process.env.BOARD_ROOM_GITHUB_WEBHOOK_SECRET = originalSecret;
    }
  }
});

test("git webhook rejects invalid github signatures", async () => {
  const handler = createBoardRoomRouteHandler();
  const originalSecret = process.env.BOARD_ROOM_GITHUB_WEBHOOK_SECRET;

  process.env.BOARD_ROOM_GITHUB_WEBHOOK_SECRET = "board-room-secret";

  try {
    const payload = JSON.stringify({
      ref: "refs/heads/main",
      commits: [],
    });
    const req = createSignedRequest({
      body: payload,
      signature: "sha256=invalid",
    });
    const res = createMockResponse();

    const handled = await handler.handle(
      req,
      res,
      "/board-room/git-webhook",
      "http://localhost",
    );

    assert.equal(handled, true);
    assert.equal(res.statusCode, 401);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.ok, false);
  } finally {
    if (originalSecret === undefined) {
      delete process.env.BOARD_ROOM_GITHUB_WEBHOOK_SECRET;
    } else {
      process.env.BOARD_ROOM_GITHUB_WEBHOOK_SECRET = originalSecret;
    }
  }
});
