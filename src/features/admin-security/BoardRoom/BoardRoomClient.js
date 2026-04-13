import {
  bffFetch,
  createBffUnavailableResult,
  hasBff,
} from "../../../services/gateways/base.js";

function normalizeResult(result, operation, fallback = {}) {
  if (!result) {
    return createBffUnavailableResult(operation, fallback);
  }

  if (result._authError) {
    return {
      success: false,
      error: result.error || "Unauthorized",
      _authError: true,
      ...fallback,
    };
  }

  return {
    ...fallback,
    ...result,
    success: result.success !== false && result.ok !== false,
  };
}

function jsonOptions(method, payload) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  };
}

export async function listThreads({ status = "ALL" } = {}) {
  if (!hasBff()) {
    return createBffUnavailableResult("listBoardRoomThreads", { threads: [] });
  }

  const result = await bffFetch(`/board-room/threads?status=${encodeURIComponent(status)}`);
  const normalized = normalizeResult(result, "listBoardRoomThreads", { threads: [] });
  normalized.threads = Array.isArray(normalized.threads) ? normalized.threads : [];
  return normalized;
}

export async function getThread(threadId) {
  if (!hasBff()) {
    return createBffUnavailableResult("getBoardRoomThread", {
      thread: null,
      posts: [],
      tasks: [],
    });
  }

  const result = await bffFetch(`/board-room/threads/${encodeURIComponent(threadId)}`);
  const normalized = normalizeResult(result, "getBoardRoomThread", {
    thread: null,
    posts: [],
    tasks: [],
  });
  normalized.posts = Array.isArray(normalized.posts) ? normalized.posts : [];
  normalized.tasks = Array.isArray(normalized.tasks) ? normalized.tasks : [];
  return normalized;
}

export async function createThread(payload) {
  if (!hasBff()) {
    return createBffUnavailableResult("createBoardRoomThread", { thread: null });
  }

  const result = await bffFetch("/board-room/threads", jsonOptions("POST", payload));
  return normalizeResult(result, "createBoardRoomThread", { thread: null });
}

export async function createPost(threadId, payload) {
  if (!hasBff()) {
    return createBffUnavailableResult("createBoardRoomPost", { post: null });
  }

  const result = await bffFetch(
    `/board-room/threads/${encodeURIComponent(threadId)}/posts`,
    jsonOptions("POST", payload),
  );
  return normalizeResult(result, "createBoardRoomPost", { post: null });
}

export async function acknowledgePost(postId, payload) {
  if (!hasBff()) {
    return createBffUnavailableResult("acknowledgeBoardRoomPost", { post: null });
  }

  const result = await bffFetch(
    `/board-room/posts/${encodeURIComponent(postId)}/acknowledge`,
    jsonOptions("POST", payload),
  );
  return normalizeResult(result, "acknowledgeBoardRoomPost", { post: null });
}

export async function approvePlan(postId) {
  if (!hasBff()) {
    return createBffUnavailableResult("approveBoardRoomPlan", { post: null });
  }

  const result = await bffFetch(
    `/board-room/posts/${encodeURIComponent(postId)}/approve`,
    jsonOptions("POST"),
  );
  return normalizeResult(result, "approveBoardRoomPlan", { post: null });
}

export async function rejectPlan(postId) {
  if (!hasBff()) {
    return createBffUnavailableResult("rejectBoardRoomPlan", { post: null });
  }

  const result = await bffFetch(
    `/board-room/posts/${encodeURIComponent(postId)}/reject`,
    jsonOptions("POST"),
  );
  return normalizeResult(result, "rejectBoardRoomPlan", { post: null });
}

export async function createTask(threadId, payload) {
  if (!hasBff()) {
    return createBffUnavailableResult("createBoardRoomTask", { task: null });
  }

  const result = await bffFetch(
    `/board-room/threads/${encodeURIComponent(threadId)}/tasks`,
    jsonOptions("POST", payload),
  );
  return normalizeResult(result, "createBoardRoomTask", { task: null });
}

export async function toggleTask(taskId, payload) {
  if (!hasBff()) {
    return createBffUnavailableResult("toggleBoardRoomTask", { task: null });
  }

  const result = await bffFetch(
    `/board-room/tasks/${encodeURIComponent(taskId)}`,
    jsonOptions("PATCH", payload),
  );
  return normalizeResult(result, "toggleBoardRoomTask", { task: null });
}

export async function getAgentMemory(agent) {
  if (!hasBff()) {
    return createBffUnavailableResult("getBoardRoomAgentMemory", { memory: null });
  }

  const result = await bffFetch(`/board-room/agents/${encodeURIComponent(agent)}`);
  return normalizeResult(result, "getBoardRoomAgentMemory", { memory: null });
}

export async function getTemplates() {
  if (!hasBff()) {
    return createBffUnavailableResult("getBoardRoomTemplates", { templates: [] });
  }

  const result = await bffFetch("/board-room/templates");
  const normalized = normalizeResult(result, "getBoardRoomTemplates", { templates: [] });
  normalized.templates = Array.isArray(normalized.templates) ? normalized.templates : [];
  return normalized;
}

export async function closeThread(threadId, payload) {
  if (!hasBff()) {
    return createBffUnavailableResult("closeBoardRoomThread", { thread: null });
  }

  const result = await bffFetch(
    `/board-room/threads/${encodeURIComponent(threadId)}/close`,
    jsonOptions("POST", payload),
  );
  return normalizeResult(result, "closeBoardRoomThread", { thread: null });
}

export default {
  acknowledgePost,
  approvePlan,
  closeThread,
  createPost,
  createTask,
  createThread,
  getAgentMemory,
  getTemplates,
  getThread,
  listThreads,
  rejectPlan,
  toggleTask,
};
