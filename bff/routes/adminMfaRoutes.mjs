function resolveAdminDevice(body = {}, req = {}) {
  return {
    fingerprint: String(body.deviceFingerprint || "unknown"),
    browser: String(
      body.deviceBrowser || req.headers?.["user-agent"] || "Unknown",
    ).substring(0, 80),
    os: String(body.deviceOs || "unknown"),
    device: String(body.deviceType || "unknown"),
    ip: req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"] || "unknown",
    rememberDevice: !!body.rememberDevice,
    authMethod: String(body.authMethod || "mfa"),
  };
}

export function createAdminMfaRouteHandler({
  createAdminSession,
  getAdminMfaStatus,
  getClientKey,
  json,
  readJsonBody,
  rolesAdmin,
  startAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminTotp,
}) {
  const createSessionPayload = async (req, body = {}, authMethod = "mfa") => {
    const ttlMs = Math.min(
      Number(body.ttlMs) || 8 * 3600 * 1000,
      24 * 3600 * 1000,
    );
    const token = await createAdminSession(
      rolesAdmin,
      ttlMs,
      resolveAdminDevice({ ...body, authMethod }, req),
    );
    return {
      ok: true,
      verified: true,
      token,
      expiresInMs: ttlMs,
      role: rolesAdmin,
      authMethod,
    };
  };

  return async function adminMfaHandler(req, res, url, origin) {
    const pathname = url.pathname;
    const method = req.method || "GET";

    if (method === "GET" && pathname === "/auth/admin/options") {
      json(res, 200, { ok: true, adminMfa: getAdminMfaStatus() }, origin);
      return true;
    }

    if (method === "POST" && pathname === "/auth/admin/email-otp/start") {
      try {
        const body = await readJsonBody(req);
        const result = await startAdminEmailOtp({
          masterEmail: body.masterEmail || body.email,
          clientKey: getClientKey(req),
        });
        json(res, result.ok ? 200 : result.status || 400, result, origin);
        return true;
      } catch (error) {
        json(res, 400, { ok: false, error: error.message || "Email OTP request failed." }, origin);
        return true;
      }
    }

    if (method === "POST" && pathname === "/auth/admin/email-otp/verify") {
      try {
        const body = await readJsonBody(req);
        const result = verifyAdminEmailOtp({
          challengeId: body.challengeId,
          codes: body.codes || { otp1: body.otp1, otp2: body.otp2, otp3: body.otp3 },
          clientKey: getClientKey(req),
        });
        if (!result.ok) {
          json(res, result.status || 401, result, origin);
          return true;
        }
        json(res, 200, await createSessionPayload(req, body, result.method), origin);
        return true;
      } catch (error) {
        json(res, 400, { ok: false, error: error.message || "Email OTP verification failed." }, origin);
        return true;
      }
    }

    if (method === "POST" && pathname === "/auth/admin/totp/verify") {
      try {
        const body = await readJsonBody(req);
        const result = verifyAdminTotp({
          code: body.code || body.totp || body.authenticatorCode,
        });
        if (!result.ok) {
          json(res, result.status || 401, result, origin);
          return true;
        }
        json(res, 200, await createSessionPayload(req, body, result.method), origin);
        return true;
      } catch (error) {
        json(res, 400, { ok: false, error: error.message || "Authenticator verification failed." }, origin);
        return true;
      }
    }

    return false;
  };
}

export default createAdminMfaRouteHandler;
