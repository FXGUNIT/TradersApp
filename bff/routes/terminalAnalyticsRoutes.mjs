const TERMINAL_ANALYTICS_ROUTES = new Set([
  "/terminal/analytics/chat",
  "/terminal/analytics/tc-parse",
  "/terminal/analytics/screenshot-extract",
  "/terminal/analytics/premarket-analysis",
  "/terminal/analytics/trade-plan",
]);

export function createTerminalAnalyticsRouteHandler({
  invokeDeepSeekChat,
  json,
  readJsonBody,
}) {
  return async function handleTerminalAnalyticsRoute(req, res, url, origin) {
    if (req.method !== "POST" || !TERMINAL_ANALYTICS_ROUTES.has(url.pathname)) {
      return false;
    }

    try {
      const body = await readJsonBody(req, 20_000_000);
      const data = await invokeDeepSeekChat(body || {});
      json(res, 200, data, origin);
      return true;
    } catch (error) {
      json(
        res,
        400,
        {
          ok: false,
          error: error.message || "Terminal analytics request failed.",
        },
        origin,
      );
      return true;
    }
  };
}

export default createTerminalAnalyticsRouteHandler;
