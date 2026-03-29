export function createIdentityRouteHandler({
  deleteSession,
  findUserByEmail,
  getUserByUid,
  getUserStatus,
  listSessions,
  patchUserAccess,
  patchUserSecurity,
  revokeOtherSessions,
  upsertSession,
  json,
  readJsonBody,
}) {
  return async function handleIdentityRoute(req, res, url, origin) {
    const userMatch = url.pathname.match(/^\/identity\/users\/([^/]+)$/);
    const statusMatch = url.pathname.match(/^\/identity\/users\/([^/]+)\/status$/);
    const emailMatch = url.pathname.match(/^\/identity\/users\/by-email\/([^/]+)$/);
    const accessMatch = url.pathname.match(/^\/identity\/users\/([^/]+)\/access$/);
    const securityMatch = url.pathname.match(/^\/identity\/users\/([^/]+)\/security$/);
    const sessionsMatch = url.pathname.match(/^\/identity\/users\/([^/]+)\/sessions$/);
    const sessionItemMatch = url.pathname.match(
      /^\/identity\/users\/([^/]+)\/sessions\/([^/]+)$/,
    );
    const revokeMatch = url.pathname.match(
      /^\/identity\/users\/([^/]+)\/sessions\/revoke-others$/,
    );

    if (req.method === "GET" && userMatch) {
      const uid = decodeURIComponent(userMatch[1]);
      const record = getUserByUid(uid);
      if (!record) {
        json(
          res,
          404,
          {
            ok: false,
            error: "User not found.",
          },
          origin,
        );
        return true;
      }

      json(
        res,
        200,
        {
          ok: true,
          user: record.user,
          sessions: record.sessions,
        },
        origin,
      );
      return true;
    }

    if (req.method === "GET" && statusMatch) {
      const uid = decodeURIComponent(statusMatch[1]);
      const status = getUserStatus(uid);
      if (!status) {
        json(
          res,
          404,
          {
            ok: false,
            error: "User not found.",
          },
          origin,
        );
        return true;
      }

      json(
        res,
        200,
        {
          ok: true,
          ...status,
        },
        origin,
      );
      return true;
    }

    if (req.method === "GET" && emailMatch) {
      const email = decodeURIComponent(emailMatch[1]);
      const record = findUserByEmail(email);
      if (!record) {
        json(
          res,
          404,
          {
            ok: false,
            error: "User not found.",
          },
          origin,
        );
        return true;
      }

      json(
        res,
        200,
        {
          ok: true,
          user: record.user,
          sessions: record.sessions,
        },
        origin,
      );
      return true;
    }

    if (req.method === "PATCH" && accessMatch) {
      const uid = decodeURIComponent(accessMatch[1]);
      const body = await readJsonBody(req, 20_000);
      const user = patchUserAccess(uid, body || {});

      if (!user) {
        json(
          res,
          404,
          {
            ok: false,
            error: "User not found.",
          },
          origin,
        );
        return true;
      }

      json(
        res,
        200,
        {
          ok: true,
          user,
        },
        origin,
      );
      return true;
    }

    if (req.method === "PATCH" && securityMatch) {
      const uid = decodeURIComponent(securityMatch[1]);
      const body = await readJsonBody(req, 20_000);
      const user = patchUserSecurity(uid, body || {});

      if (!user) {
        json(
          res,
          404,
          {
            ok: false,
            error: "User not found.",
          },
          origin,
        );
        return true;
      }

      json(
        res,
        200,
        {
          ok: true,
          user,
        },
        origin,
      );
      return true;
    }

    if (req.method === "GET" && sessionsMatch) {
      const uid = decodeURIComponent(sessionsMatch[1]);
      const record = getUserByUid(uid);
      if (!record) {
        json(
          res,
          404,
          {
            ok: false,
            error: "User not found.",
          },
          origin,
        );
        return true;
      }

      const sessions = listSessions(uid);

      json(
        res,
        200,
        {
          ok: true,
          uid,
          sessions,
        },
        origin,
      );
      return true;
    }

    if (req.method === "PUT" && sessionItemMatch) {
      const uid = decodeURIComponent(sessionItemMatch[1]);
      const sessionId = decodeURIComponent(sessionItemMatch[2]);
      const body = await readJsonBody(req, 30_000);
      if (!getUserByUid(uid)) {
        json(
          res,
          404,
          {
            ok: false,
            error: "User not found.",
          },
          origin,
        );
        return true;
      }

      const session = upsertSession(uid, sessionId, body || {});

      if (!session) {
        json(
          res,
          404,
          {
            ok: false,
            error: "User not found.",
          },
          origin,
        );
        return true;
      }

      json(
        res,
        200,
        {
          ok: true,
          session,
        },
        origin,
      );
      return true;
    }

    if (req.method === "DELETE" && sessionItemMatch) {
      const uid = decodeURIComponent(sessionItemMatch[1]);
      const sessionId = decodeURIComponent(sessionItemMatch[2]);
      if (!getUserByUid(uid)) {
        json(
          res,
          404,
          {
            ok: false,
            error: "User not found.",
          },
          origin,
        );
        return true;
      }

      const deleted = deleteSession(uid, sessionId);

      if (!deleted) {
        json(
          res,
          404,
          {
            ok: false,
            error: "Session not found.",
          },
          origin,
        );
        return true;
      }

      json(
        res,
        200,
        {
          ok: true,
          deleted: true,
        },
        origin,
      );
      return true;
    }

    if (req.method === "POST" && revokeMatch) {
      const uid = decodeURIComponent(revokeMatch[1]);
      const body = await readJsonBody(req, 20_000);
      const currentSessionId = String(
        body.currentSessionId || body.sessionId || "",
      ).trim();
      if (!getUserByUid(uid)) {
        json(
          res,
          404,
          {
            ok: false,
            error: "User not found.",
          },
          origin,
        );
        return true;
      }

      const result = revokeOtherSessions(uid, currentSessionId || null);

      if (!result.success) {
        json(
          res,
          400,
          {
            ok: false,
            error: result.error || "Failed to revoke sessions.",
          },
          origin,
        );
        return true;
      }

      json(
        res,
        200,
        {
          ok: true,
          revokedCount: result.revokedCount,
          sessions: result.sessions,
        },
        origin,
      );
      return true;
    }

    return false;
  };
}

export default createIdentityRouteHandler;
