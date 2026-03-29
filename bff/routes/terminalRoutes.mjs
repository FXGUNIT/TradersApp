export function createTerminalRouteHandler({
  getWorkspace,
  json,
  readJsonBody,
  replaceWorkspaceAccountState,
  replaceWorkspaceFirmRules,
  replaceWorkspaceJournal,
  upsertWorkspace,
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
      const body = await readJsonBody(req, 100_000);
      const workspace = upsertWorkspace(uid, body || {});

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
      const body = await readJsonBody(req, 100_000);
      const workspace = replaceWorkspaceJournal(uid, body?.journal ?? body ?? {});

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
      const body = await readJsonBody(req, 100_000);
      const workspace = replaceWorkspaceAccountState(
        uid,
        body?.accountState ?? body ?? {},
      );

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
      const body = await readJsonBody(req, 100_000);
      const workspace = replaceWorkspaceFirmRules(
        uid,
        body?.firmRules ?? body ?? {},
      );

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
