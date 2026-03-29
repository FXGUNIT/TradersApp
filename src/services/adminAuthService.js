const resolveBffBaseUrl = () => {
  const configured = String(import.meta.env.VITE_BFF_URL || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return "/api";
};

export async function verifyAdminPassword(password) {
  if (
    typeof window !== "undefined" &&
    window.__TRADERS_AUDIT_DATA
  ) {
    return { verified: true, simulated: true };
  }

  const cleanPassword = String(password || "");
  if (!cleanPassword) {
    throw new Error("Admin password is required.");
  }

  let response;
  try {
    response = await fetch(`${resolveBffBaseUrl()}/admin/verify-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        password: cleanPassword,
      }),
    });
  } catch {
    throw new Error("Admin verification service is unavailable.");
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok || payload.verified !== true) {
    const retryAfterMs = Number(payload.retryAfterMs || 0);
    const retryMessage =
      retryAfterMs > 0
        ? ` Try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).`
        : "";
    throw new Error(
      `${payload.error || "Admin password verification failed."}${retryMessage}`,
    );
  }

  return payload;
}

export default {
  verifyAdminPassword,
};
