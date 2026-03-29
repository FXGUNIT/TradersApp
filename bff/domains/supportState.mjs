import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const DATA_PATH = resolve(process.cwd(), "bff/data/support-domain.json");
const DEFAULT_STATE = {
  threads: {},
};

function readState() {
  if (!existsSync(DATA_PATH)) {
    return { ...DEFAULT_STATE };
  }

  try {
    const raw = readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      threads: parsed?.threads || {},
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  writeFileSync(DATA_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeMessage(message = {}) {
  return {
    id: message.id || randomUUID(),
    text: String(message.text || "").trim(),
    sender: message.sender || "user",
    senderName: message.senderName || null,
    email: message.email || null,
    type: message.type || "message",
    timestamp: Number(message.timestamp || Date.now()),
    read: Boolean(message.read),
  };
}

export function getSupportThread(uid) {
  const state = readState();
  return state.threads?.[uid] || null;
}

export function listSupportThreads() {
  const state = readState();
  return Object.values(state.threads || {});
}

export function appendSupportMessage(uid, message = {}) {
  const state = readState();
  const existing = state.threads?.[uid] || {
    uid,
    threadId: uid,
    status: "open",
    messages: [],
    updatedAt: nowIso(),
  };

  const normalizedMessage = normalizeMessage(message);
  const nextThread = {
    ...existing,
    uid,
    threadId: existing.threadId || uid,
    status: existing.status || "open",
    messages: [...(existing.messages || []), normalizedMessage],
    updatedAt: nowIso(),
  };

  state.threads = {
    ...(state.threads || {}),
    [uid]: nextThread,
  };
  writeState(state);
  return nextThread;
}

export default {
  appendSupportMessage,
  getSupportThread,
  listSupportThreads,
};
