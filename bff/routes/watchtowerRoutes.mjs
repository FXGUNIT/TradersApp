import {
  getWatchtowerStatus,
  runWatchtowerScan,
} from "../services/watchtowerService.mjs";

export function createWatchtowerRouteHandler({
  authorizeRequest,
  json,
} = {}) {
  return async function handleWatchtowerRoute(req, res, url, origin) {
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/watchtower/status") {
      json(res, 200, { ok: true, watchtower: getWatchtowerStatus() }, origin);
      return true;
    }

    if (req.method === "POST" && pathname === "/watchtower/scan") {
      const auth = authorizeRequest ? await authorizeRequest(req) : { authorized: false };
      if (!auth.authorized) {
        json(res, 403, { ok: false, error: auth.error || "Authentication required." }, origin);
        return true;
      }

      const watchtower = await runWatchtowerScan();
      json(res, 200, { ok: true, watchtower }, origin);
      return true;
    }

    return false;
  };
}

export default createWatchtowerRouteHandler;
