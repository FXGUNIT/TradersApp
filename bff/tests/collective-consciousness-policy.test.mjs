import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cwd, chdir } from "node:process";

const originalCwd = cwd();

async function withTempWorkspace(run) {
  const dir = await mkdtemp(join(tmpdir(), "tradersapp-stage-o-"));
  await mkdir(join(dir, "bff", "data"), { recursive: true });
  chdir(dir);
  try {
    const identityUrl = new URL("../domains/identityState.mjs", import.meta.url);
    const dispatchUrl = new URL("../_dispatch.mjs", import.meta.url);
    const identityState = await import(
      `${identityUrl.href}?ts=${Date.now()}-${Math.random()}`
    );
    const dispatch = await import(
      `${dispatchUrl.href}?ts=${Date.now()}-${Math.random()}`
    );
    await run({ identityState, dispatch });
  } finally {
    chdir(originalCwd);
  }
}

function createMockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    _finishHandlers: [],
    setHeader(name, value) {
      this.headers[name] = value;
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = {
        ...this.headers,
        ...headers,
      };
    },
    end(body = "") {
      this.body = String(body || "");
      this._finishHandlers.forEach((handler) => handler());
    },
    once(event, handler) {
      if (event === "finish") {
        this._finishHandlers.push(handler);
      }
    },
  };
}

function createFalseHandler() {
  return function falseHandler() {
    return false;
  };
}

test("standard plan uses rolling 24-hour window with lazy reset", async () => {
  await withTempWorkspace(async ({ identityState }) => {
    const { provisionUser, consumeCollectiveConsciousnessQuestion } = identityState;
    provisionUser("standard-1", {
      role: "user",
      email: "standard@example.com",
    });

    const windowStart = new Date("2026-04-12T00:00:00.000Z");

    for (let index = 0; index < 10; index += 1) {
      const result = consumeCollectiveConsciousnessQuestion(
        "standard-1",
        {},
        { now: new Date(windowStart.getTime() + index * 1000) },
      );
      assert.equal(result.ok, true);
      assert.equal(result.usage.questionCount, index + 1);
      assert.equal(result.usage.questionsAllowed, 10);
    }

    const blocked = consumeCollectiveConsciousnessQuestion(
      "standard-1",
      {},
      { now: new Date(windowStart.getTime() + 11_000) },
    );
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "COLLECTIVE_CONSCIOUSNESS_LIMIT_REACHED");
    assert.equal(blocked.usage.questionCount, 10);
    assert.equal(blocked.usage.currentTier, "standard");

    const afterReset = consumeCollectiveConsciousnessQuestion(
      "standard-1",
      {},
      {
        now: new Date(
          windowStart.getTime() + 24 * 60 * 60 * 1000 + 1_000,
        ),
      },
    );
    assert.equal(afterReset.ok, true);
    assert.equal(afterReset.usage.questionCount, 1);
    assert.equal(afterReset.usage.isBlocked, false);
  });
});

test("premium plan allows 50 questions per rolling window", async () => {
  await withTempWorkspace(async ({ identityState }) => {
    const { provisionUser, consumeCollectiveConsciousnessQuestion } = identityState;
    provisionUser("premium-1", {
      role: "user",
      email: "premium@example.com",
      plan: "premium",
    });

    const now = new Date("2026-04-12T08:00:00.000Z");
    let finalAllowed = null;

    for (let index = 0; index < 50; index += 1) {
      finalAllowed = consumeCollectiveConsciousnessQuestion(
        "premium-1",
        {},
        { now: new Date(now.getTime() + index * 1000) },
      );
    }

    assert.ok(finalAllowed);
    assert.equal(finalAllowed.ok, true);
    assert.equal(finalAllowed.usage.questionCount, 50);
    assert.equal(finalAllowed.usage.questionsAllowed, 50);

    const blocked = consumeCollectiveConsciousnessQuestion(
      "premium-1",
      {},
      { now: new Date(now.getTime() + 60_000) },
    );
    assert.equal(blocked.ok, false);
    assert.equal(blocked.usage.currentTier, "premium");
  });
});

test("admin role remains unlimited", async () => {
  await withTempWorkspace(async ({ identityState }) => {
    const { provisionUser, consumeCollectiveConsciousnessQuestion } = identityState;
    provisionUser("admin-1", {
      role: "admin",
      email: "admin@example.com",
    });

    let latest = null;
    for (let index = 0; index < 75; index += 1) {
      latest = consumeCollectiveConsciousnessQuestion(
        "admin-1",
        {},
        { now: new Date(`2026-04-12T12:${String(index % 60).padStart(2, "0")}:00.000Z`) },
      );
    }

    assert.ok(latest);
    assert.equal(latest.ok, true);
    assert.equal(latest.usage.currentTier, "admin");
    assert.equal(latest.usage.questionsAllowed, null);
    assert.equal(latest.usage.isAdminBypass, true);
  });
});

test("email alone does not grant admin bypass", async () => {
  await withTempWorkspace(async ({ identityState }) => {
    const { provisionUser, consumeCollectiveConsciousnessQuestion } = identityState;
    provisionUser("user-1", {
      role: "user",
      email: "cricgunit@gmail.com",
    });

    const start = new Date("2026-04-12T14:00:00.000Z");
    for (let index = 0; index < 10; index += 1) {
      const allowed = consumeCollectiveConsciousnessQuestion(
        "user-1",
        {},
        { now: new Date(start.getTime() + index * 1000) },
      );
      assert.equal(allowed.ok, true);
      assert.equal(allowed.usage.questionsAllowed, 10);
      assert.equal(allowed.usage.currentTier, "standard");
      assert.equal(allowed.usage.isAdminBypass, false);
    }

    const blocked = consumeCollectiveConsciousnessQuestion(
      "user-1",
      {},
      { now: new Date(start.getTime() + 20_000) },
    );
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "COLLECTIVE_CONSCIOUSNESS_LIMIT_REACHED");
    assert.equal(blocked.usage.currentTier, "standard");
    assert.equal(blocked.usage.isAdminBypass, false);
  });
});

test("dispatcher blocks limit-hit requests before provider calls", async () => {
  await withTempWorkspace(async ({ identityState, dispatch }) => {
    const { createDispatcher } = dispatch;
    const {
      provisionUser,
      consumeCollectiveConsciousnessQuestion,
    } = identityState;

    provisionUser("limited-user", {
      role: "user",
      email: "limited@example.com",
    });

    const baseTime = new Date("2026-04-12T00:00:00.000Z");
    for (let index = 0; index < 10; index += 1) {
      consumeCollectiveConsciousnessQuestion(
        "limited-user",
        {},
        { now: new Date(baseTime.getTime() + index * 1000) },
      );
    }

    let invokeProviderCalls = 0;
    const dispatcher = createDispatcher({
      HOST: "127.0.0.1",
      PORT: 8788,
      ADMIN_PASS_HASH: "",
      ALLOWED_ORIGINS: [],
      ADMIN_ATTEMPT_LIMIT: 3,
      ADMIN_LOCKOUT_WINDOW_MS: 1000,
      json(res, statusCode, payload) {
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      },
      resolveOrigin() {
        return "*";
      },
      async readJsonBody() {
        return {
          uid: "limited-user",
          email: "limited@example.com",
          userPrompt: "Should I long MNQ here?",
          systemPrompt: "You are a trading assistant.",
        };
      },
      getClientKey() {
        return "test-client";
      },
      hashPassword() {
        return "";
      },
      constantTimeMatch() {
        return false;
      },
      async invokeProvider() {
        invokeProviderCalls += 1;
        return "should not run";
      },
      sendTelegramMessage: null,
      buildAiStatusPayload() {
        return [];
      },
      getOriginFallback() {
        return "https://example.test";
      },
      invokeTerminalAnalyticsChat: null,
      getProviderConfig: null,
      recordHttpRequest() {},
      randomUUID() {
        return "request-id";
      },
      getRateLimitConfig() {
        return { name: "global", maxRequests: 100, windowMs: 60_000 };
      },
      async checkRateLimit() {
        return { allowed: true, remaining: 99, resetMs: 60_000 };
      },
      async authorizeRequest() {
        return { authorized: true, role: "TRADER" };
      },
      async validateAdminToken() {
        return { valid: false };
      },
      async createAdminSession() {
        return "token";
      },
      async revokeAdminSession() {},
      async listAdminSessions() {
        return [];
      },
      async revokeSessionById() {
        return false;
      },
      getAdminPasswordAttemptState() {
        return { attempts: 0, lockoutUntil: 0 };
      },
      registerAdminPasswordFailedAttempt() {
        return { attempts: 1, lockoutUntil: 0 };
      },
      clearAdminPasswordFailedAttempts() {},
      createTerminalAnalyticsService: null,
      getHubContent: null,
      getDocumentMeta: null,
      listDocumentMeta: null,
      getWorkspace: null,
      replaceWorkspaceAccountState: null,
      replaceWorkspaceFirmRules: null,
      replaceWorkspaceJournal: null,
      upsertWorkspace: null,
      getApplication: null,
      getApplicationStatus: null,
      mergeApplicationConsent: null,
      upsertApplication: null,
      deleteSession: null,
      findUserByEmail: null,
      getUserByUid: null,
      getUserStatus: null,
      listTrainingEligibilityUsers: null,
      listSessions: null,
      patchUserAccess: null,
      patchUserSecurity: null,
      provisionUser,
      recordUserActiveDay: null,
      consumeCollectiveConsciousnessQuestion(uid, patch) {
        return identityState.consumeCollectiveConsciousnessQuestion(uid, patch, {
          now: new Date(baseTime.getTime() + 11_000),
        });
      },
      revokeOtherSessions: null,
      upsertSession: null,
      appendSupportMessage: null,
      getSupportThread: null,
      listSupportThreads: null,
      approveAdminUser: null,
      blockAdminUser: null,
      lockAdminUser: null,
      recordAdminAuditEvent: null,
      toggleMaintenanceState: null,
      getMaintenanceState: null,
      listAdminUsers: null,
      createAdminRouteHandler: () => createFalseHandler(),
      createContentRouteHandler: () => createFalseHandler(),
      createConsensusRouteHandler: () => createFalseHandler(),
      createNewsRouteHandler: () => createFalseHandler(),
      createTradeCalcRouteHandler: () => createFalseHandler(),
      createIdentityRouteHandler: () => createFalseHandler(),
      createTerminalAnalyticsRouteHandler: () => createFalseHandler(),
      createTerminalRouteHandler: () => createFalseHandler(),
      createOnboardingRouteHandler: () => createFalseHandler(),
      createSupportRouteHandler: () => createFalseHandler(),
      handleTelegramSendMessage: async () => {},
      handleTelegramSendForensicAlert: async () => {},
    });

    const req = {
      method: "POST",
      url: "/ai/deliberate",
      headers: { host: "localhost:8788" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await dispatcher(req, res);

    assert.equal(res.statusCode, 429);
    assert.equal(invokeProviderCalls, 0);
    const payload = JSON.parse(res.body);
    assert.equal(payload.code, "COLLECTIVE_CONSCIOUSNESS_LIMIT_REACHED");
    assert.equal(payload.currentTier, "standard");
    assert.equal(payload.questionsUsed, 10);
    assert.equal(payload.questionsAllowed, 10);
  });
});
