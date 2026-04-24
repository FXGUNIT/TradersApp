/**
 * Optional TradersApp BFF proxy for Cloudflare's free workers.dev hostname.
 *
 * Current production already works with:
 *   https://bff.173.249.18.14.sslip.io
 *
 * Do not use api.traders.app or bff.traders.app here; traders.app is not owned.
 * This Worker simply forwards selected BFF paths to the active free sslip.io BFF.
 */

const DEFAULT_UPSTREAM_BFF_URL = "https://bff.173.249.18.14.sslip.io";

const PROXY_PATH_PREFIXES = [
  "/admin",
  "/ai-status",
  "/board-room",
  "/calendar",
  "/content",
  "/health",
  "/identity",
  "/ml",
  "/news",
  "/onboarding",
  "/support",
  "/telegram",
  "/terminal",
  "/terminal-analytics",
  "/trade-calc",
];

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Idempotency-Key, X-Request-ID, x-tradersapp-install-id",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!PROXY_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      return new Response("Not found", {
        status: 404,
        headers: { "Content-Type": "text/plain", ...corsHeaders(origin) },
      });
    }

    const base = String(env.UPSTREAM_BFF_URL || DEFAULT_UPSTREAM_BFF_URL).replace(/\/+$/, "");
    const upstreamUrl = `${base}${url.pathname}${url.search}`;
    const headers = new Headers(request.headers);

    headers.delete("cf-connecting-ip");
    headers.delete("cf-ray");
    headers.delete("cf-request-id");
    headers.delete("cf-visitor");
    headers.delete("cf-warp-tier");
    headers.set("host", new URL(base).host);

    try {
      const response = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });

      const responseHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders(origin))) {
        responseHeaders.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      return new Response(
        JSON.stringify({
          ok: false,
          error: isTimeout ? "BFF service temporarily unreachable via proxy." : "Proxy error.",
          path: url.pathname,
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        }
      );
    }
  },
};
