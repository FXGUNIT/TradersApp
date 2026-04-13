import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWeeklyDigest,
  runAcknowledgmentDeadlineCheck,
  runStaleThreadCheck,
} from "../board-room/cron/boardRoomCron.mjs";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

test("buildWeeklyDigest summarizes CEO action, stale threads, late acks, and inactive agents", async () => {
  const now = Date.parse("2026-04-13T12:00:00.000Z");
  const threads = [
    {
      threadId: "T00001",
      ownerAgent: "ConsensusEngine",
      createdBy: "ceo",
      createdAt: now - (2 * MS_PER_DAY),
      lastActivityAt: now - (1 * MS_PER_DAY),
    },
    {
      threadId: "T00002",
      ownerAgent: "NewsService",
      createdBy: "ceo",
      createdAt: now - (20 * MS_PER_DAY),
      lastActivityAt: now - (15 * MS_PER_DAY),
    },
  ];

  const postsByThread = {
    T00001: [
      {
        postId: "T00001-P00001",
        type: "plan",
        planStatus: "pending_approval",
        author: "ConsensusEngine",
      },
    ],
    T00002: [
      {
        postId: "T00002-P00001",
        type: "suggestion",
        author: "ceo",
        mentions: ["NewsService"],
        acknowledgmentRequired: true,
        acknowledgmentDeadline: now - 1,
      },
      {
        postId: "T00002-P00002",
        type: "comment",
        author: "NewsService",
        acknowledgedLate: true,
        acknowledgedAt: now - (2 * MS_PER_DAY),
        acknowledgedBy: "NewsService",
      },
    ],
  };

  const service = {
    async getAllOpenThreads() {
      return threads;
    },
    async getThreadPosts(threadId) {
      return postsByThread[threadId] || [];
    },
    async getAgentMemory(agent) {
      if (agent === "ConsensusEngine") {
        return { lastHeartbeat: now - (2 * MS_PER_HOUR) };
      }
      if (agent === "NewsService") {
        return { lastHeartbeat: now - (30 * MS_PER_HOUR) };
      }
      return { lastHeartbeat: now };
    },
  };

  const digest = await buildWeeklyDigest(service, now);

  assert.equal(digest.date, "2026-04-13");
  assert.equal(digest.activeCount, 2);
  assert.deepEqual(digest.needsAction, ["T00001", "T00002"]);
  assert.deepEqual(digest.staleThreads, [{ id: "T00002", days: 15 }]);
  assert.deepEqual(digest.inactiveAgents, ["NewsService"]);
  assert.equal(digest.lateAcks.length, 1);
  assert.equal(digest.lateAcks[0].agent, "NewsService");
  assert.equal(digest.lateAcks[0].threadId, "T00002");
});

test("runStaleThreadCheck warns once for newly stale threads", async () => {
  const now = Date.parse("2026-04-13T12:00:00.000Z");
  const createdPosts = [];
  const updatedThreads = [];
  const alerts = [];

  const service = {
    async getAllOpenThreads() {
      return [
        {
          threadId: "T00010",
          title: "Needs follow-up",
          createdAt: now - (10 * MS_PER_DAY),
          lastActivityAt: now - (8 * MS_PER_DAY),
          staleWarningSent: false,
        },
        {
          threadId: "T00011",
          title: "Already warned",
          createdAt: now - (12 * MS_PER_DAY),
          lastActivityAt: now - (9 * MS_PER_DAY),
          staleWarningSent: true,
        },
      ];
    },
    async createPost(payload) {
      createdPosts.push(payload);
      return payload;
    },
    async updateThread(threadId, updates) {
      updatedThreads.push({ threadId, updates });
      return { threadId, ...updates };
    },
  };

  const telegram = {
    async sendAlert(payload) {
      alerts.push(payload);
      return { ok: true };
    },
  };

  const result = await runStaleThreadCheck(service, telegram, now);

  assert.deepEqual(result.warnedThreadIds, ["T00010"]);
  assert.equal(createdPosts.length, 1);
  assert.equal(createdPosts[0].threadId, "T00010");
  assert.equal(updatedThreads.length, 1);
  assert.deepEqual(updatedThreads[0], {
    threadId: "T00010",
    updates: { staleWarningSent: true },
  });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].threadId, "T00010");
});

test("runAcknowledgmentDeadlineCheck escalates only overdue acknowledgments", async () => {
  const now = Date.parse("2026-04-13T12:00:00.000Z");
  const createdPosts = [];
  const escalations = [];

  const service = {
    async getPendingAcknowledgments() {
      return [
        {
          postId: "T00020-P00001",
          threadId: "T00020",
          author: "ConsensusEngine",
          content: "Need review",
          mentions: ["NewsService"],
          acknowledgmentDeadline: now - 1,
        },
        {
          postId: "T00021-P00001",
          threadId: "T00021",
          author: "ConsensusEngine",
          content: "Still within window",
          mentions: ["AlphaEngine"],
          acknowledgmentDeadline: now + MS_PER_HOUR,
        },
      ];
    },
    async getThread(threadId) {
      return { threadId, title: `Thread ${threadId}` };
    },
    async createPost(payload) {
      createdPosts.push(payload);
      return payload;
    },
  };

  const telegram = {
    async sendEscalation(payload) {
      escalations.push(payload);
      return { ok: true };
    },
  };

  const result = await runAcknowledgmentDeadlineCheck(service, telegram, now);

  assert.deepEqual(result.escalatedPostIds, ["T00020-P00001"]);
  assert.equal(createdPosts.length, 1);
  assert.equal(createdPosts[0].threadId, "T00020");
  assert.equal(escalations.length, 1);
  assert.equal(escalations[0].threadId, "T00020");
  assert.equal(escalations[0].agent, "NewsService");
});
