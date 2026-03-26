import { DATABASE_URL, FB_AUTH_URL, FB_KEY } from "../services/firebase.js";

const hasWindow = typeof window !== "undefined";

const getAuditData = () => {
  if (!hasWindow) return null;
  return window.__TRADERS_AUDIT_DATA || null;
};

const clone = (value) => {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
};

const normalizePath = (path) => String(path || "").replace(/^\//, "").replace(/\.json$/i, "");

const getAuditValue = (path) => {
  const data = getAuditData();
  if (!data) return null;

  const normalized = normalizePath(path);
  if (!normalized) return clone(data);

  const segments = normalized.split("/").filter(Boolean);
  if (segments[0] === "users") {
    const uid = segments[1];
    const field = segments[2];
    const users = data.users || {};
    const userProfile = data.userProfile || data.adminProfile || null;
    const user = users[uid] || null;

    if (!uid) return clone(users);
    if (!user) {
      if (userProfile && userProfile.uid === uid) {
        return clone(userProfile);
      }
      return null;
    }

    if (!field) return clone({ ...userProfile, ...user });
    if (field === "profile") return clone(userProfile || user);
    if (field === "journal") return clone(userProfile?.journal || {});
    if (field === "accountState") return clone(userProfile?.accountState || {});
    if (field === "firmRules") return clone(userProfile?.firmRules || {});
    if (field === "sessions") return clone(data.sessions || {});
    if (field === "otps") return clone(data.otps || {});
    return clone(user[field] ?? userProfile?.[field] ?? null);
  }

  if (segments[0] === "sessions") return clone(data.sessions || {});
  if (segments[0] === "otps") return clone(data.otps || {});
  if (segments[0] === "profile") return clone(data.userProfile || data.adminProfile || {});
  if (segments[0] === "firmRules") return clone(data.userProfile?.firmRules || {});
  if (segments[0] === "accountState") return clone(data.userProfile?.accountState || {});

  return clone(data[segments[0]] ?? null);
};

const applyAuditWrite = (path, payload, merge = false) => {
  const data = getAuditData();
  if (!data) return;

  const normalized = normalizePath(path);
  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length) return;

  if (segments[0] === "users" && segments[1]) {
    const uid = segments[1];
    const field = segments[2];
    data.users = data.users || {};
    data.users[uid] = data.users[uid] || {};

    if (!field) {
      data.users[uid] = merge ? { ...data.users[uid], ...clone(payload) } : clone(payload);
      return;
    }

    data.users[uid][field] = merge
      ? { ...(data.users[uid][field] || {}), ...clone(payload) }
      : clone(payload);

    if (uid === data.userAuth?.uid && data.userProfile) {
      data.userProfile = {
        ...data.userProfile,
        ...(field === "profile" ? clone(payload) : { [field]: clone(payload) }),
      };
    }
    return;
  }

  if (segments[0] === "sessions") {
    data.sessions = merge ? { ...(data.sessions || {}), ...clone(payload) } : clone(payload);
    return;
  }

  if (segments[0] === "otps") {
    data.otps = merge ? { ...(data.otps || {}), ...clone(payload) } : clone(payload);
  }
};

export const dbR = async (p, t) => {
  const auditValue = getAuditValue(p);
  if (auditValue !== null) return auditValue;
  if (!DATABASE_URL) return null;

  try {
    const r = await fetch(`${DATABASE_URL}${p}.json${t ? `?auth=${t}` : ""}`);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
};

export const dbW = async (p, d, t) => {
  if (getAuditData()) {
    applyAuditWrite(p, d, false);
    return;
  }
  if (!DATABASE_URL) return;

  try {
    await fetch(`${DATABASE_URL}${p}.json?auth=${t}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
  } catch {
    console.error("dbW error");
  }
};

export const dbM = async (p, d, t) => {
  if (getAuditData()) {
    applyAuditWrite(p, d, true);
    return;
  }
  if (!DATABASE_URL) return;

  try {
    await fetch(`${DATABASE_URL}${p}.json?auth=${t}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
  } catch {
    console.error("dbM error");
  }
};

export const dbDel = async (p, t) => {
  if (getAuditData()) {
    applyAuditWrite(p, null, false);
    return;
  }
  if (!DATABASE_URL) return;

  try {
    await fetch(`${DATABASE_URL}${p}.json?auth=${t}`, { method: "DELETE" });
  } catch {
    console.error("dbDel error");
  }
};

export const authPost = async (ep, body) => {
  if (!FB_KEY) {
    throw new Error("Firebase auth is unavailable in this workspace");
  }

  const r = await fetch(`${FB_AUTH_URL}:${ep}?key=${FB_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d;
};

export const fbSignUp = (e, p) =>
  authPost("signUp", { email: e, password: p, returnSecureToken: true });

export const fbSignIn = (e, p) =>
  authPost("signInWithPassword", {
    email: e,
    password: p,
    returnSecureToken: true,
  });

export const genOTP = () => String(Math.floor(100000 + Math.random() * 900000));
