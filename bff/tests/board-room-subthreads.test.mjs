import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { createBoardRoomRouteHandler } from "../routes/boardRoomRoutes.mjs";
import boardRoomService from "../services/boardRoomService.mjs";

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

function createJsonRequest({ method, url, body, headers = {} }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = {
    "content-type": "application/json",
    ...headers,
  };

  process.nextTick(() => {
    if (body !== undefined) {
      req.emit("data", JSON.stringify(body));
    }
    req.emit("end");
  });

  return req;
}

test("create thread accepts parentThreadId for linked sub-threads", async () => {
  const handler = createBoardRoomRouteHandler();
  const originalGetThread = boardRoomService.getThread;
  const originalCreateThread = boardRoomService.createThread;
  const createCalls = [];

  boardRoomService.getThread = async (threadId) => {
    if (threadId === "T00001") {
      return {
        threadId: "T00001",
        title: "Parent thread",
        ownerAgent: "ConsensusEngine",
        status: "OPEN",
      };
    }
    return null;
  };

  boardRoomService.createThread = async (payload) => {
    createCalls.push(payload);
    return {
      threadId: "T00002",
      title: payload.title,
      ownerAgent: payload.ownerAgent,
      parentThreadId: payload.parentThreadId,
      status: "OPEN",
    };
  };

  try {
    const req = createJsonRequest({
      method: "POST",
      url: "/board-room/threads",
      body: {
        title: "Child thread",
        description: "Investigate nested task",
        ownerAgent: "ConsensusEngine",
        createdBy: "ceo",
        parentThreadId: "T00001",
      },
    });
    const res = createMockResponse();

    const handled = await handler.handle(req, res, "/board-room/threads", "http://localhost");

    assert.equal(handled, true);
    assert.equal(res.statusCode, 201);
    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0].parentThreadId, "T00001");

    const parsed = JSON.parse(res.body);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.thread.threadId, "T00002");
    assert.equal(parsed.thread.parentThreadId, "T00001");
  } finally {
    boardRoomService.getThread = originalGetThread;
    boardRoomService.createThread = originalCreateThread;
  }
});

test("create thread rejects missing parentThreadId target", async () => {
  const handler = createBoardRoomRouteHandler();
  const originalGetThread = boardRoomService.getThread;
  const originalCreateThread = boardRoomService.createThread;
  let createCalled = false;

  boardRoomService.getThread = async () => null;
  boardRoomService.createThread = async () => {
    createCalled = true;
    return null;
  };

  try {
    const req = createJsonRequest({
      method: "POST",
      url: "/board-room/threads",
      body: {
        title: "Child thread",
        description: "Investigate nested task",
        ownerAgent: "ConsensusEngine",
        createdBy: "ceo",
        parentThreadId: "T99999",
      },
    });
    const res = createMockResponse();

    const handled = await handler.handle(req, res, "/board-room/threads", "http://localhost");

    assert.equal(handled, true);
    assert.equal(res.statusCode, 404);
    assert.equal(createCalled, false);

    const parsed = JSON.parse(res.body);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.error, "parent thread not found");
  } finally {
    boardRoomService.getThread = originalGetThread;
    boardRoomService.createThread = originalCreateThread;
  }
});

test("thread detail returns parent and child thread relations", async () => {
  const handler = createBoardRoomRouteHandler();
  const originalGetThread = boardRoomService.getThread;
  const originalGetThreadPosts = boardRoomService.getThreadPosts;
  const originalGetThreadTasks = boardRoomService.getThreadTasks;
  const originalGetChildThreads = boardRoomService.getChildThreads;

  boardRoomService.getThread = async (threadId) => {
    if (threadId === "T00002") {
      return {
        threadId: "T00002",
        title: "Child thread",
        ownerAgent: "ConsensusEngine",
        parentThreadId: "T00001",
        status: "OPEN",
      };
    }
    if (threadId === "T00001") {
      return {
        threadId: "T00001",
        title: "Parent thread",
        ownerAgent: "ConsensusEngine",
        status: "OPEN",
      };
    }
    return null;
  };
  boardRoomService.getThreadPosts = async () => [];
  boardRoomService.getThreadTasks = async () => [];
  boardRoomService.getChildThreads = async (threadId) => {
    if (threadId !== "T00002") return [];
    return [
      {
        threadId: "T00003",
        title: "Grandchild thread",
        ownerAgent: "NewsService",
        status: "OPEN",
      },
    ];
  };

  try {
    const req = createJsonRequest({
      method: "GET",
      url: "/board-room/threads/T00002",
    });
    const res = createMockResponse();

    const handled = await handler.handle(
      req,
      res,
      "/board-room/threads/T00002",
      "http://localhost",
    );

    assert.equal(handled, true);
    assert.equal(res.statusCode, 200);

    const parsed = JSON.parse(res.body);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.thread.threadId, "T00002");
    assert.equal(parsed.parentThread.threadId, "T00001");
    assert.equal(parsed.childThreads.length, 1);
    assert.equal(parsed.childThreads[0].threadId, "T00003");
  } finally {
    boardRoomService.getThread = originalGetThread;
    boardRoomService.getThreadPosts = originalGetThreadPosts;
    boardRoomService.getThreadTasks = originalGetThreadTasks;
    boardRoomService.getChildThreads = originalGetChildThreads;
  }
});
