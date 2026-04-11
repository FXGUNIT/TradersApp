export function createAdminRouteHandler({
  approveAdminUser,
  blockAdminUser,
  getMaintenanceState,
  listAdminUsers,
  lockAdminUser,
  recordAdminAuditEvent,
  toggleMaintenanceState,
  json,
  readJsonBody,
}) {
  return async function handleAdminRoute(req, res, url, origin) {
    const resolveActorUid = (body = {}) => {
      const candidate = String(body.adminUid || body.actorUid || "").trim();
      return candidate || null;
    };

    if (req.method === "GET" && url.pathname === "/admin/users") {
      json(
        res,
        200,
        {
          ok: true,
          users: listAdminUsers(),
        },
        origin,
      );
      return true;
    }

    if (req.method === "GET" && url.pathname === "/admin/maintenance") {
      json(
        res,
        200,
        {
          ok: true,
          maintenanceActive: getMaintenanceState(),
        },
        origin,
      );
      return true;
    }

    const approveMatch = url.pathname.match(/^\/admin\/users\/([^/]+)\/approve$/);
    if (req.method === "POST" && approveMatch) {
      const uid = decodeURIComponent(approveMatch[1]);
      const body = await readJsonBody(req, 20_000);
      const result = approveAdminUser(uid, resolveActorUid(body));

      if (!result.success) {
        json(
          res,
          400,
          {
            ok: false,
            error: result.error || "Approval failed.",
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
          user: result.user,
        },
        origin,
      );
      return true;
    }

    const blockMatch = url.pathname.match(/^\/admin\/users\/([^/]+)\/block$/);
    if (req.method === "POST" && blockMatch) {
      const uid = decodeURIComponent(blockMatch[1]);
      const body = await readJsonBody(req, 20_000);
      const result = blockAdminUser(uid, resolveActorUid(body));

      if (!result.success) {
        json(
          res,
          400,
          {
            ok: false,
            error: result.error || "Block failed.",
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
          user: result.user,
        },
        origin,
      );
      return true;
    }

    const lockMatch = url.pathname.match(/^\/admin\/users\/([^/]+)\/lock$/);
    if (req.method === "POST" && lockMatch) {
      const uid = decodeURIComponent(lockMatch[1]);
      const body = await readJsonBody(req, 20_000);
      const result = lockAdminUser(uid, resolveActorUid(body));

      if (!result.success) {
        json(
          res,
          400,
          {
            ok: false,
            error: result.error || "Lock failed.",
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
          user: result.user,
        },
        origin,
      );
      return true;
    }

    if (req.method === "POST" && url.pathname === "/admin/maintenance/toggle") {
      const body = await readJsonBody(req, 20_000);
      const nextState =
        typeof body.enabled === "boolean"
          ? body.enabled
          : typeof body.maintenanceActive === "boolean"
            ? body.maintenanceActive
            : undefined;
      const maintenanceActive = toggleMaintenanceState(nextState);

      recordAdminAuditEvent({
        actorUid: resolveActorUid(body),
        targetUid: null,
        success: true,
        type: "admin_maintenance_toggle",
        detail: {
          enabled: maintenanceActive,
        },
      });

      json(
        res,
        200,
        {
          ok: true,
          maintenanceActive,
        },
        origin,
      );
      return true;
    }

    return false;
  };
}

export default createAdminRouteHandler;
