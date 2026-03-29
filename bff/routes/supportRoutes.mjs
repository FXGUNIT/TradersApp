export function createSupportRouteHandler({
  appendSupportMessage,
  getSupportThread,
  listSupportThreads,
  json,
  readJsonBody,
}) {
  return async function handleSupportRoute(req, res, url, origin) {
    if (req.method === "GET" && url.pathname === "/support/threads") {
      json(
        res,
        200,
        {
          ok: true,
          threads: listSupportThreads(),
        },
        origin,
      );
      return true;
    }

    const threadMatch = url.pathname.match(/^\/support\/threads\/([^/]+)$/);
    if (req.method === "GET" && threadMatch) {
      const uid = decodeURIComponent(threadMatch[1]);
      const thread = getSupportThread(uid);

      if (!thread) {
        json(
          res,
          404,
          {
            ok: false,
            error: "Support thread not found.",
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
          thread,
        },
        origin,
      );
      return true;
    }

    const messageMatch = url.pathname.match(
      /^\/support\/threads\/([^/]+)\/messages$/,
    );
    if (req.method === "POST" && messageMatch) {
      const uid = decodeURIComponent(messageMatch[1]);
      const body = await readJsonBody(req, 50_000);
      const thread = appendSupportMessage(uid, body);

      json(
        res,
        200,
        {
          ok: true,
          thread,
          message: thread.messages[thread.messages.length - 1] || null,
        },
        origin,
      );
      return true;
    }

    return false;
  };
}

export default createSupportRouteHandler;
