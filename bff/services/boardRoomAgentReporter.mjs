import boardRoomService from "./boardRoomService.mjs";
import { isNyLunchBreakActive } from "./tradingHoursService.mjs";

const HEARTBEAT_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.BOARD_ROOM_HEARTBEAT_MS || 90 * 60 * 1000),
);
const ERROR_THROTTLE_MS = Math.max(
  30_000,
  Number(process.env.BOARD_ROOM_ERROR_THROTTLE_MS || 5 * 60 * 1000),
);

const heartbeatLoops = new Map();
const errorCooldowns = new Map();

/**
 * RiskOfficer lunch block check — called before any agent milestone is posted.
 * If NY lunch break is active, logs a veto and returns early.
 * Returns { veto: true, reason: string } if blocked, { veto: false } otherwise.
 */
export function checkNyLunchVeto() {
  const now = new Date();
  const istHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(now),
    10,
  );
  const istMinute = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      minute: "numeric",
      hour12: false,
    }).format(now),
    10,
  );
  if (isNyLunchBreakActive(istHour, istMinute)) {
    return {
      veto: true,
      reason:
        "NY lunch break (12:00–1:00 PM ET) — RiskOfficer veto. No trading signals during this window.",
      vetoSource: "ny_lunch_riskofficer",
      timestamp: new Date().toISOString(),
    };
  }
  return { veto: false };
}

function isEnabled() {
  return String(process.env.BOARD_ROOM_AGENT_REPORTING || "true").toLowerCase() !== "false";
}

function normalizeError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || error.toString();
  return String(error);
}

function normalizeStack(error, stack = null) {
  if (stack) return String(stack).slice(0, 4000);
  if (error instanceof Error && error.stack) {
    return String(error.stack).slice(0, 4000);
  }
  return null;
}

function shouldThrottle(agent, message) {
  const key = `${agent}:${message}`;
  const now = Date.now();
  const previous = errorCooldowns.get(key) || 0;
  if (now - previous < ERROR_THROTTLE_MS) {
    return true;
  }
  errorCooldowns.set(key, now);
  return false;
}

function fireAndForget(action) {
  Promise.resolve()
    .then(action)
    .catch(() => {});
}

export function ensureAgentHeartbeat({
  agent,
  focus = "",
  status = "idle",
  currentThreadId = null,
} = {}) {
  if (!isEnabled() || !agent || heartbeatLoops.has(agent)) {
    return false;
  }

  const sendHeartbeat = (nextStatus = status, nextFocus = focus) =>
    boardRoomService.recordHeartbeat({
      agent,
      status: nextStatus,
      focus: nextFocus,
      currentThreadId,
    });

  fireAndForget(() => sendHeartbeat("active", focus));

  const timer = setInterval(() => {
    fireAndForget(() => sendHeartbeat(status, focus));
  }, HEARTBEAT_INTERVAL_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  heartbeatLoops.set(agent, timer);
  return true;
}

export function refreshAgentHeartbeat({
  agent,
  focus = "",
  status = "active",
  currentThreadId = null,
} = {}) {
  if (!isEnabled() || !agent) {
    return;
  }

  fireAndForget(() =>
    boardRoomService.recordHeartbeat({
      agent,
      status,
      focus,
      currentThreadId,
    }),
  );
}

export async function reportAgentError({
  agent,
  error,
  severity = "MEDIUM",
  threadId = null,
  stack = null,
} = {}) {
  if (!isEnabled() || !agent || !error) {
    return null;
  }

  const lunchVeto = checkNyLunchVeto();
  if (lunchVeto.veto) {
    return null;
  }

  const message = normalizeError(error);
  if (shouldThrottle(agent, message)) {
    return null;
  }

  return boardRoomService.reportError({
    agent,
    error: message,
    severity,
    threadId,
    stack: normalizeStack(error, stack),
  });
}

export async function reportGovernanceIncident({
  agent,
  subsystem = null,
  ruleId,
  title = null,
  expected = "",
  evidence = "",
  correctiveAction = "",
  severity = "MEDIUM",
  tags = [],
  stack = null,
  source = "Watchtower",
} = {}) {
  if (!isEnabled() || !agent || !ruleId || !evidence) {
    return null;
  }

  const lunchVeto = checkNyLunchVeto();
  if (lunchVeto.veto) {
    return null;
  }

  const message = `${ruleId}:${agent}:${normalizeError(evidence)}`;
  if (shouldThrottle(agent, message)) {
    return null;
  }

  const normalizedSeverity = String(severity || "MEDIUM").toUpperCase();
  const content = JSON.stringify({
    type: "governance_violation",
    source,
    ownerAgent: agent,
    subsystem,
    ruleId,
    severity: normalizedSeverity,
    expected,
    evidence,
    correctiveAction,
    respectProtocol:
      "Correct firmly without abuse: acknowledge the miss, isolate the cause, fix it, add a guard, and report proof before closure.",
  });

  const thread = await boardRoomService.createThread({
    title: title || `[${agent}] ${ruleId} violation`,
    description: content,
    priority: normalizedSeverity,
    tags: [
      "governance",
      "watchtower",
      String(normalizedSeverity).toLowerCase(),
      String(agent).toLowerCase(),
      String(ruleId).toLowerCase(),
      ...(subsystem ? [String(subsystem).toLowerCase()] : []),
      ...tags,
    ],
    ownerAgent: agent,
    createdBy: source,
    tasks: [
      { description: "Acknowledge the violated rule in Board Room." },
      { description: "Identify the exact failing route, service, or dependency." },
      { description: "Ship or document the corrective action." },
      { description: "Add a regression guard, health probe, or test before closure." },
    ],
  });

  if (!thread?.threadId) {
    return null;
  }

  const post = await boardRoomService.createPost({
    threadId: thread.threadId,
    author: source,
    authorType: "agent",
    content,
    type: "error",
    mentions: [agent],
    acknowledgmentRequired: true,
    acknowledgmentDeadline: Date.now() + 3 * 60 * 60 * 1000,
    response: stack ? normalizeStack(null, stack) : null,
  });

  refreshAgentHeartbeat({
    agent,
    status: "remediation_required",
    currentThreadId: thread.threadId,
    focus: `${ruleId}: ${String(evidence).slice(0, 160)}`,
  });

  return { thread, post, threadId: thread.threadId };
}

export async function openAgentThread({
  agent,
  title,
  description,
  priority = "MEDIUM",
  tags = [],
  tasks = [],
} = {}) {
  if (!isEnabled() || !agent || !title) {
    return null;
  }

  const lunchVeto = checkNyLunchVeto();
  if (lunchVeto.veto) {
    return null;
  }

  return boardRoomService.createThread({
    title,
    description: description || "",
    priority,
    tags,
    ownerAgent: agent,
    createdBy: agent,
    tasks,
  });
}

export async function postAgentMilestone({
  agent,
  threadId,
  content,
  linkedCommit = null,
  linkedPR = null,
} = {}) {
  if (!isEnabled() || !agent || !threadId || !content) {
    return null;
  }

  const lunchVeto = checkNyLunchVeto();
  if (lunchVeto.veto) {
    // Veto fires silently — do not post milestone during NY lunch
    return null;
  }

  return boardRoomService.createPost({
    threadId,
    author: agent,
    authorType: "agent",
    content,
    type: "milestone",
    linkedCommit,
    linkedPR,
  });
}

export function __resetBoardRoomAgentReporterForTests() {
  for (const timer of heartbeatLoops.values()) {
    clearInterval(timer);
  }
  heartbeatLoops.clear();
  errorCooldowns.clear();
}

export default {
  checkNyLunchVeto,
  ensureAgentHeartbeat,
  openAgentThread,
  postAgentMilestone,
  refreshAgentHeartbeat,
  reportAgentError,
  reportGovernanceIncident,
};
