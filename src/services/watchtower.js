import {
  bffFetch,
  getBffGatewayState,
  hasBff,
  probeBffHealth,
} from "./gateways/base.js";
import {
  fetchNewsSystemStatus,
  getInitialNewsSystemStatus,
} from "./clients/NewsStatusClient.js";
import { resolveBffBaseUrl } from "./runtimeConfig.js";

export const WATCHTOWER_REFRESH_MS = 15 * 60 * 1000;

const WATCHTOWER_AGENT = "Watchtower";
const BOARD_ROOM_REPORT_COOLDOWN_MS = 60 * 60 * 1000;
const USER_ERROR_RETENTION_MS = 15 * 60 * 1000;
const MAX_USER_ERRORS = 10;

let watchtowerInterval = null;
let watchtowerInflight = null;
let userFacingErrors = [];
let userErrorListenerCleanup = null;
const reportedFaults = new Map();
let boardRoomSyncState = {
  connected: false,
  lastHeartbeatAt: null,
  lastReportAt: null,
  lastSyncError: null,
  currentThreadId: null,
};

const WATCHTOWER_RULES = {
  BFF_HEALTH_FAILED: {
    ownerAgent: "BFFGateway",
    ruleId: "board-room.always-connected",
    expected:
      "Board Room, AI services, ML, consensus, news, and Watchtower must share a reachable BFF bridge.",
    remediation:
      "Restore the BFF process or gateway URL, rerun health, and keep the fault open until the bridge is reachable.",
  },
  AI_STATUS_FAILED: {
    ownerAgent: "FrontendAI.Router",
    ruleId: "ai.status-accountability",
    expected: "Every configured AI provider must expose a clear online/offline status.",
    remediation:
      "Refresh provider status, identify the failing engine, and add a regression guard for that provider path.",
  },
  AI_KEYS_MISSING: {
    ownerAgent: "FrontendAI.Router",
    ruleId: "ai.provider-readiness",
    expected: "The AI council must not appear ready when no provider key is configured.",
    remediation:
      "Mark providers as unconfigured, surface the missing-key state, and avoid pretending the council can deliberate.",
  },
  AI_ALL_OFFLINE: {
    ownerAgent: "FrontendAI.Router",
    ruleId: "ai.provider-availability",
    expected: "At least one configured AI provider must be online before council work is accepted.",
    remediation:
      "Reprobe each configured provider, isolate the shared outage, and fail over only after status is verified.",
  },
  AI_PARTIAL_OFFLINE: {
    ownerAgent: "FrontendAI.Router",
    ruleId: "ai.provider-availability",
    expected: "All configured AI providers must truthfully report their online state.",
    remediation:
      "Name the offline provider, keep the council degraded, and require a clean probe before restoring full status.",
  },
  ML_HEALTH_FAILED: {
    ownerAgent: "MLEngine",
    ruleId: "ml.health-before-use",
    expected: "ML features must prove engine health before serving model-dependent decisions.",
    remediation:
      "Restart or repair the ML engine, then verify /ml/health and the dependent feature path.",
  },
  ML_CONSENSUS_DEGRADED: {
    ownerAgent: "ConsensusEngine",
    ruleId: "consensus.no-silent-fallback",
    expected: "Consensus must disclose degraded ML inputs instead of silently producing weak results.",
    remediation:
      "Keep the consensus result flagged as fallback, fix the missing data/model cause, and add a test for the failure mode.",
  },
  NEWS_LIVE_OFFLINE: {
    ownerAgent: "NewsIntelligence",
    ruleId: "news.live-feed-required",
    expected: "Breaking-news status must be live, explicit, and visible to the user.",
    remediation:
      "Restore the live news source or keep the news bar in a clear offline state with the failing endpoint named.",
  },
  NEWS_CALENDAR_OFFLINE: {
    ownerAgent: "NewsIntelligence",
    ruleId: "news.calendar-required",
    expected: "Scheduled economic news must show a truthful live/offline state.",
    remediation:
      "Restore the calendar source or keep the scheduled-news bar offline with the failing endpoint named.",
  },
  USER_FACING_ERROR: {
    ownerAgent: "UserExperience.Watchtower",
    ruleId: "watchtower.user-error-capture",
    expected: "Every user-facing error must be captured and sent to Board Room for corrective ownership.",
    remediation:
      "Record the user-visible message, assign an owner, fix the path, and add a guard so the same error does not recur.",
  },
  USER_RUNTIME_ERROR: {
    ownerAgent: "UserExperience.Watchtower",
    ruleId: "watchtower.runtime-error-capture",
    expected: "Unhandled browser runtime errors must be captured and sent to Board Room.",
    remediation:
      "Preserve the stack/context, isolate the crashing component, and add a regression guard.",
  },
};

const DEFAULT_RULE = {
  ownerAgent: WATCHTOWER_AGENT,
  ruleId: "watchtower.general-accountability",
  expected:
    "Every detected malfunction must be assigned to a responsible owner with evidence and a corrective action.",
  remediation:
    "Acknowledge the issue, isolate the cause, apply the fix, and add a regression guard before closing it.",
};

function getFaultRule(code) {
  return WATCHTOWER_RULES[code] || DEFAULT_RULE;
}

function createFault(code, title, detail, severity = "medium", extra = {}) {
  const rule = getFaultRule(code);
  return {
    code,
    title,
    detail,
    severity,
    ownerAgent: extra.ownerAgent || rule.ownerAgent,
    ruleId: extra.ruleId || rule.ruleId,
    expected: extra.expected || rule.expected,
    remediation: extra.remediation || rule.remediation,
    observedAt: extra.observedAt || new Date().toISOString(),
    source: extra.source || null,
    stack: extra.stack || null,
    reportToBoardRoom: extra.reportToBoardRoom !== false,
  };
}

function buildUrl(path) {
  const base = resolveBffBaseUrl();
  if (!base) return path;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

async function fetchJson(path, { timeoutMs = 6000 } = {}) {
  try {
    const response = await fetch(buildUrl(path), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json().catch(() => ({}));
    return {
      ok: response.ok && data?.ok !== false,
      httpOk: response.ok,
      status: response.status,
      data,
      error: response.ok
        ? data?.error || null
        : data?.error || data?.message || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      httpOk: false,
      status: 0,
      data: null,
      error: error?.message || "Request failed.",
    };
  }
}

function normalizeErrorMessage(error) {
  if (!error) return "Unknown user-facing error.";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || error.toString();
  if (typeof error?.message === "string") return error.message;
  return String(error);
}

function normalizeStack(error, stack = null) {
  if (typeof stack === "string" && stack.trim()) {
    return stack.slice(0, 4000);
  }
  if (error instanceof Error && typeof error.stack === "string") {
    return error.stack.slice(0, 4000);
  }
  if (typeof error?.stack === "string") {
    return error.stack.slice(0, 4000);
  }
  return null;
}

function severityToBoardRoom(severity) {
  const normalized = String(severity || "medium").toLowerCase();
  if (normalized === "critical") return "CRITICAL";
  if (normalized === "high") return "HIGH";
  if (normalized === "low") return "LOW";
  return "MEDIUM";
}

function getBoardRoomSyncSnapshot() {
  return { ...boardRoomSyncState };
}

async function postBoardRoomJson(path, payload) {
  if (!hasBff()) {
    return null;
  }

  return bffFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

function buildBoardRoomError(fault) {
  return [
    `Rule violation: ${fault.ruleId}`,
    `Owner: ${fault.ownerAgent}`,
    `Fault: ${fault.title}`,
    `Evidence: ${fault.detail}`,
    `Expected behavior: ${fault.expected}`,
    `Corrective coaching: ${fault.remediation}`,
  ].join("\n");
}

function getFaultReportKey(fault) {
  return [
    fault.ownerAgent || WATCHTOWER_AGENT,
    fault.code,
    String(fault.detail || "").slice(0, 240),
  ].join(":");
}

function shouldReportFault(fault, { force = false } = {}) {
  if (!fault?.reportToBoardRoom) return false;
  if (force) return true;

  const key = getFaultReportKey(fault);
  const now = Date.now();
  const previous = reportedFaults.get(key) || 0;
  return now - previous >= BOARD_ROOM_REPORT_COOLDOWN_MS;
}

async function reportFaultToBoardRoom(fault, options = {}) {
  if (!fault || !hasBff() || !shouldReportFault(fault, options)) {
    return null;
  }

  const result = await postBoardRoomJson("/board-room/error", {
    agent: fault.ownerAgent || WATCHTOWER_AGENT,
    error: buildBoardRoomError(fault),
    severity: severityToBoardRoom(fault.severity),
    stack: fault.stack || null,
    threadId: null,
  });

  if (result?.ok) {
    reportedFaults.set(getFaultReportKey(fault), Date.now());
    boardRoomSyncState = {
      ...boardRoomSyncState,
      connected: true,
      lastReportAt: new Date().toISOString(),
      lastSyncError: null,
      currentThreadId: result.threadId || boardRoomSyncState.currentThreadId,
    };
  }

  return result;
}

async function syncWatchtowerWithBoardRoom(status) {
  if (!hasBff()) {
    boardRoomSyncState = {
      ...boardRoomSyncState,
      connected: false,
      lastSyncError: "BFF unavailable.",
    };
    return null;
  }

  const focus =
    status.status === "healthy"
      ? "Watching BFF, AI, ML, consensus, news, and user-facing errors."
      : `Investigating ${status.faults.length} active Watchtower fault${
          status.faults.length === 1 ? "" : "s"
        }.`;

  const heartbeat = await postBoardRoomJson("/board-room/heartbeat", {
    agent: WATCHTOWER_AGENT,
    status: status.status === "healthy" ? "active" : "investigating",
    currentThreadId: boardRoomSyncState.currentThreadId || null,
    focus,
  });

  if (heartbeat?.ok) {
    boardRoomSyncState = {
      ...boardRoomSyncState,
      connected: true,
      lastHeartbeatAt: new Date().toISOString(),
      lastSyncError: null,
      currentThreadId:
        heartbeat.heartbeat?.currentThreadId ||
        boardRoomSyncState.currentThreadId ||
        null,
    };
  } else {
    boardRoomSyncState = {
      ...boardRoomSyncState,
      connected: false,
      lastSyncError: heartbeat?._authError
        ? "Board Room reporter rejected the heartbeat."
        : "Board Room heartbeat failed.",
    };
  }

  await Promise.all(
    status.faults
      .filter((fault) => fault.reportToBoardRoom !== false)
      .map((fault) => reportFaultToBoardRoom(fault)),
  );

  return getBoardRoomSyncSnapshot();
}

function pruneUserFacingErrors(now = Date.now()) {
  userFacingErrors = userFacingErrors.filter((fault) => {
    const observedAt = Date.parse(fault.observedAt || "");
    return Number.isFinite(observedAt) && now - observedAt <= USER_ERROR_RETENTION_MS;
  });
}

export function recordWatchtowerUserError(error, context = {}) {
  const message = normalizeErrorMessage(error);
  const fault = createFault(
    context.code || "USER_FACING_ERROR",
    context.title || "User-facing error observed",
    message,
    context.severity || "high",
    {
      source: context.source || "app",
      stack: normalizeStack(error, context.stack),
      ownerAgent: context.ownerAgent,
    },
  );

  userFacingErrors = [fault, ...userFacingErrors].slice(0, MAX_USER_ERRORS);
  pruneUserFacingErrors();
  void reportFaultToBoardRoom(fault, { force: true });
  return fault;
}

function installUserErrorListeners() {
  if (userErrorListenerCleanup || typeof window === "undefined") {
    return;
  }

  const onError = (event) => {
    recordWatchtowerUserError(event?.error || event?.message, {
      code: "USER_RUNTIME_ERROR",
      title: "Runtime error reached the user session",
      source: event?.filename || "window.error",
      stack: event?.error?.stack || null,
      severity: "high",
    });
  };

  const onUnhandledRejection = (event) => {
    recordWatchtowerUserError(event?.reason, {
      code: "USER_RUNTIME_ERROR",
      title: "Unhandled promise rejection reached the user session",
      source: "window.unhandledrejection",
      severity: "high",
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  userErrorListenerCleanup = () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    userErrorListenerCleanup = null;
  };
}

function summarizeAi(aiResult) {
  const engines = Array.isArray(aiResult?.data?.engines)
    ? aiResult.data.engines
    : [];
  const configured = engines.filter((engine) => engine?.configured).length;
  const online = engines.filter((engine) => engine?.online).length;

  return {
    ok: Boolean(aiResult?.ok),
    engines,
    configured,
    online,
    total: engines.length,
  };
}

function summarizeNewsFaults(newsStatus) {
  const faults = [];
  if (newsStatus?.liveNews?.state === "offline") {
    faults.push(
      createFault(
        "NEWS_LIVE_OFFLINE",
        "Live news offline",
        newsStatus.liveNews.detail || "Breaking-news endpoint is not reachable.",
        "medium",
      ),
    );
  }
  if (newsStatus?.scheduledNews?.state === "offline") {
    faults.push(
      createFault(
        "NEWS_CALENDAR_OFFLINE",
        "Scheduled news offline",
        newsStatus.scheduledNews.detail ||
          "Economic-calendar endpoint is not reachable.",
        "medium",
      ),
    );
  }
  return faults;
}

function buildStatus(faults) {
  if (faults.some((fault) => fault.severity === "critical")) {
    return "fault";
  }
  if (faults.length > 0) {
    return "degraded";
  }
  return "healthy";
}

export function getInitialWatchtowerStatus() {
  return {
    status: "checking",
    label: "WATCHTOWER CHECKING",
    faults: [],
    corrections: [],
    systems: {
      boardRoom: getBoardRoomSyncSnapshot(),
      userErrors: [],
    },
    news: getInitialNewsSystemStatus(),
    refreshedAt: null,
  };
}

export async function runWatchtowerScan() {
  const startedAt = Date.now();
  const faults = [];
  const corrections = [];
  const gatewayBefore = getBffGatewayState();
  const health = await probeBffHealth({ timeoutMs: 4000 });
  const gatewayAfter = getBffGatewayState();

  if (gatewayBefore.inCooldown && health.ok && !gatewayAfter.inCooldown) {
    corrections.push({
      code: "BFF_COOLDOWN_CLEARED",
      title: "Cleared stale BFF cooldown",
      detail: `${gatewayAfter.baseUrl}/health is reachable again.`,
    });
  }

  if (!health.ok) {
    faults.push(
      createFault(
        "BFF_HEALTH_FAILED",
        "BFF health failed",
        health.error || "Frontend cannot reach the BFF health endpoint.",
        "critical",
      ),
    );
  }

  let aiResult = null;
  let mlResult = null;
  let consensusResult = null;
  let newsStatus = getInitialNewsSystemStatus();

  if (health.ok && hasBff()) {
    [aiResult, mlResult, consensusResult, newsStatus] = await Promise.all([
      fetchJson("/ai/status", { timeoutMs: 5000 }),
      fetchJson("/ml/health", { timeoutMs: 6000 }),
      fetchJson("/ml/consensus?session=1&symbol=MNQ", { timeoutMs: 15000 }),
      fetchNewsSystemStatus(),
    ]);
  } else if (!gatewayAfter.auditRuntime && gatewayAfter.baseUrl) {
    newsStatus = await fetchNewsSystemStatus();
  }

  const ai = summarizeAi(aiResult);
  if (health.ok && !aiResult?.ok) {
    faults.push(
      createFault(
        "AI_STATUS_FAILED",
        "AI status check failed",
        aiResult?.error || "BFF /ai/status did not return usable data.",
        "high",
      ),
    );
  } else if (ai.total > 0 && ai.configured === 0) {
    faults.push(
      createFault(
        "AI_KEYS_MISSING",
        "All AI engines need keys",
        "No provider key is configured, so the AI council cannot run.",
        "high",
      ),
    );
  } else if (ai.configured > 0 && ai.online === 0) {
    faults.push(
      createFault(
        "AI_ALL_OFFLINE",
        "Configured AI engines are offline",
        "Provider keys exist, but none of the configured engines are online.",
        "high",
      ),
    );
  } else if (ai.configured > 0 && ai.online < ai.configured) {
    faults.push(
      createFault(
        "AI_PARTIAL_OFFLINE",
        "Some AI engines are offline",
        `${ai.online}/${ai.configured} configured engines are online.`,
        "medium",
      ),
    );
  }

  if (health.ok && !mlResult?.ok) {
    faults.push(
      createFault(
        "ML_HEALTH_FAILED",
        "ML engine health failed",
        mlResult?.error || "BFF /ml/health did not return ok=true.",
        "high",
      ),
    );
  }

  if (health.ok && consensusResult && !consensusResult.ok) {
    faults.push(
      createFault(
        "ML_CONSENSUS_DEGRADED",
        "ML consensus degraded",
        consensusResult?.data?.error ||
          consensusResult?.error ||
          "BFF /ml/consensus returned a fallback response.",
        "medium",
      ),
    );
  }

  faults.push(...summarizeNewsFaults(newsStatus));
  pruneUserFacingErrors();
  faults.push(...userFacingErrors);

  const statusPayload = {
    status: buildStatus(faults),
    label: "",
    faults,
    corrections,
    systems: {
      bff: {
        ok: Boolean(health.ok),
        status: health.status,
        baseUrl: gatewayAfter.baseUrl,
        inCooldown: gatewayAfter.inCooldown,
      },
      ai,
      ml: {
        ok: Boolean(mlResult?.ok),
        status: mlResult?.status || 0,
        data: mlResult?.data || null,
      },
      consensus: {
        ok: Boolean(consensusResult?.ok),
        status: consensusResult?.status || 0,
        data: consensusResult?.data || null,
      },
      boardRoom: getBoardRoomSyncSnapshot(),
      userErrors: userFacingErrors,
    },
    news: newsStatus,
    refreshedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
  };

  await syncWatchtowerWithBoardRoom(statusPayload);
  statusPayload.systems.boardRoom = getBoardRoomSyncSnapshot();

  if (!statusPayload.systems.boardRoom.connected && health.ok) {
    statusPayload.faults.push(
      createFault(
        "BOARD_ROOM_SYNC_FAILED",
        "Board Room sync failed",
        statusPayload.systems.boardRoom.lastSyncError ||
          "Watchtower could not post heartbeat/error telemetry to Board Room.",
        "high",
        { reportToBoardRoom: false },
      ),
    );
    statusPayload.status = buildStatus(statusPayload.faults);
  }

  statusPayload.label =
    statusPayload.status === "healthy"
      ? "WATCHTOWER OK"
      : `WATCHTOWER ${statusPayload.faults.length} FAULT${
          statusPayload.faults.length === 1 ? "" : "S"
        }`;

  return statusPayload;
}

export function startWatchtower(onStatusChange, options = {}) {
  const intervalMs = Number(options.intervalMs || WATCHTOWER_REFRESH_MS);
  installUserErrorListeners();

  if (watchtowerInterval) {
    clearInterval(watchtowerInterval);
    watchtowerInterval = null;
  }

  const run = async () => {
    if (watchtowerInflight) {
      return watchtowerInflight;
    }

    watchtowerInflight = runWatchtowerScan();
    try {
      const status = await watchtowerInflight;
      onStatusChange?.(status);
      return status;
    } finally {
      watchtowerInflight = null;
    }
  };

  void run();
  watchtowerInterval = setInterval(() => {
    void run();
  }, intervalMs);
}

export function stopWatchtower() {
  if (watchtowerInterval) {
    clearInterval(watchtowerInterval);
    watchtowerInterval = null;
  }
  userErrorListenerCleanup?.();
}

export default {
  getInitialWatchtowerStatus,
  recordWatchtowerUserError,
  runWatchtowerScan,
  startWatchtower,
  stopWatchtower,
  WATCHTOWER_REFRESH_MS,
};
