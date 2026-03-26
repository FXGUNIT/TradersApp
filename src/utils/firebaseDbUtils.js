import { DATABASE_URL, FB_AUTH_URL, FB_KEY } from "../services/firebase.js";

export const dbR = async (p, t) => {
  try {
    const r = await fetch(`${DATABASE_URL}${p}.json${t ? `?auth=${t}` : ""}`);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
};

export const dbW = async (p, d, t) => {
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
  try {
    await fetch(`${DATABASE_URL}${p}.json?auth=${t}`, { method: "DELETE" });
  } catch {
    console.error("dbDel error");
  }
};

export const authPost = async (ep, body) => {
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
