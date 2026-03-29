export function createTerminalRouteHandler({
  getWorkspace,
  patchWorkspaceAccountState,
  patchWorkspaceFirmRules,
  patchWorkspaceJournal,
  upsertWorkspaceRecord,
  json,
  readJsonBody,
}) {
  return async function handleTerminalRoute(req, res, url, origin) {
    const workspaceMatch = url.pathname.match(/^\/terminal\/workspaces\/([^/]+)$/);
    const journalMatch = url.pathname.match(
      /^\/terminal\/workspaces\/([^/]+)\/journal$/,
    );
    const accountStateMatch = url.pathname.match(
      /^\/terminal\/workspaces\/([^/]+)\/account-state$/,
    );
    const firmRulesMatch = url.pathname.match(
      /^\/terminal\/workspaces\/([^/]+)\/firm-rules$/,
    );

    if (req.method === "GET" && workspaceMatch) {
      const uid = decodeURIComponent(workspaceMatch[1]);
      const workspace = getWorkspace(uid);
      if (!workspace) {
        json(
          res,
          404,
          {
            ok: false,
            error: "Workspace not found.",
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
          workspace,
        },
        origin,
      );
      return true;
    }

    if (req.method === "PUT" && workspaceMatch) {
      const uid = decodeURIComponent(workspaceMatch[1]);
      const body = await readJsonBody(req, 200_000);
      const workspace = upsertWorkspaceRecord(uid, body || {});

      if (!workspace) {
        json(
          res,
          404,
          {
            ok: false,
            error: "Workspace not found.",
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
          workspace,
        },
        origin,
      );
      return true;
    }

    if (req.method === "PUT" && journalMatch) {
      const uid = decodeURIComponent(journalMatch[1]);
      const body = await readJsonBody(req, 200_000);
      const journal =
        body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "journal")
          ? body.journal
          : body;
      const workspace = patchWorkspaceJournal(uid, journal || {});
      if (!workspace) {
        json(
          res,
          404,
          {
            ok: false,
            error: "Workspace not found.",
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
          workspace,
        },
        origin,
      );
      return true;
    }

    if (req.method === "PUT" && accountStateMatch) {
      const uid = decodeURIComponent(accountStateMatch[1]);
      const body = await readJsonBody(req, 200_000);
      const accountState =
        body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "accountState")
          ? body.accountState
          : body;
      const workspace = patchWorkspaceAccountState(uid, accountState || {});
      if (!workspace) {
        json(
          res,
          404,
          {
            ok: false,
            error: "Workspace not found.",
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
          workspace,
        },
        origin,
      );
      return true;
    }

    if (req.method === "PUT" && firmRulesMatch) {
      const uid = decodeURIComponent(firmRulesMatch[1]);
      const body = await readJsonBody(req, 200_000);
      const firmRules =
        body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "firmRules")
          ? body.firmRules
          : body;
      const workspace = patchWorkspaceFirmRules(uid, firmRules || {});
      if (!workspace) {
        json(
          res,
          404,
          {
            ok: false,
            error: "Workspace not found.",
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
          workspace,
        },
        origin,
      );
      return true;
    }

    return false;
  };
}

export default createTerminalRouteHandler;
