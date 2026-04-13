import boardRoomService from "./boardRoomService.mjs";

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
  ensureAgentHeartbeat,
  openAgentThread,
  postAgentMilestone,
  refreshAgentHeartbeat,
  reportAgentError,
};
