import { bffFetch } from "./base.js";

function normalizeUser(response) {
  if (!response) {
    return null;
  }

  return response.user || response.data || response;
}

function normalizeUsersCollection(response) {
  const users =
    response?.users || response?.data?.users || response?.data || response;

  if (!users) {
    return {};
  }

  if (Array.isArray(users)) {
    return users.reduce((acc, user) => {
      if (user?.uid) {
        acc[user.uid] = user;
      }
      return acc;
    }, {});
  }

  return users;
}

function normalizeSessionsCollection(response) {
  const sessions =
    response?.sessions ||
    response?.data?.sessions ||
    response?.data ||
    response;

  if (!sessions) {
    return {};
  }

  if (Array.isArray(sessions)) {
    return sessions.reduce((acc, session) => {
      if (session?.sessionId) {
        acc[session.sessionId] = session;
      }
      return acc;
    }, {});
  }

  return sessions;
}

export async function fetchIdentityUser(uid) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/identity/users/${encodeURIComponent(uid)}`);
}

export async function fetchIdentityUserStatus(uid) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/identity/users/${encodeURIComponent(uid)}/status`);
}

export async function fetchIdentityUserByEmail(email) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  return bffFetch(
    `/identity/users/by-email/${encodeURIComponent(normalizedEmail)}`,
  );
}

export async function provisionIdentityUser(uid, payload = {}) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/identity/users/${encodeURIComponent(uid)}/provision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function recordIdentityUserActivity(uid, payload = {}) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/identity/users/${encodeURIComponent(uid)}/activity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function patchIdentityUserSecurity(uid, payload = {}) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/identity/users/${encodeURIComponent(uid)}/security`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function patchIdentityUserAccess(uid, payload = {}) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/identity/users/${encodeURIComponent(uid)}/access`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchIdentitySessions(uid) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/identity/users/${encodeURIComponent(uid)}/sessions`);
}

export async function upsertIdentitySession(uid, sessionId, sessionData = {}) {
  if (!uid || !sessionId) {
    return null;
  }

  return bffFetch(
    `/identity/users/${encodeURIComponent(uid)}/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionData),
    },
  );
}

export async function deleteIdentitySession(uid, sessionId) {
  if (!uid || !sessionId) {
    return null;
  }

  return bffFetch(
    `/identity/users/${encodeURIComponent(uid)}/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function revokeOtherIdentitySessions(uid, currentSessionId) {
  if (!uid) {
    return null;
  }

  return bffFetch(
    `/identity/users/${encodeURIComponent(uid)}/sessions/revoke-others`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentSessionId: currentSessionId || null,
      }),
    },
  );
}

export { normalizeSessionsCollection, normalizeUser, normalizeUsersCollection };

export default {
  deleteIdentitySession,
  fetchIdentitySessions,
  fetchIdentityUser,
  fetchIdentityUserByEmail,
  fetchIdentityUserStatus,
  patchIdentityUserAccess,
  patchIdentityUserSecurity,
  provisionIdentityUser,
  recordIdentityUserActivity,
  revokeOtherIdentitySessions,
  upsertIdentitySession,
};
