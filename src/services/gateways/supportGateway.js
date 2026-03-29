import { bffFetch } from "./base.js";

export async function fetchSupportThreads() {
  return bffFetch("/support/threads");
}

export async function fetchSupportThread(uid) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/support/threads/${encodeURIComponent(uid)}`);
}

export async function createSupportMessage(uid, payload = {}) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/support/threads/${encodeURIComponent(uid)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export default {
  createSupportMessage,
  fetchSupportThread,
  fetchSupportThreads,
};
