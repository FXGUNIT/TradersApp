// index.js
var PROXY_PATH_PREFIXES = [
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
  "/trade-calc"
];
function addCorsHeaders(headers, origin) {
  origin = origin || "*";
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key, X-Request-ID, x-tradersapp-install-id");
  return headers;
}
function makeCorsResponse(origin) {
  origin = origin || "*";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, X-Request-ID, x-tradersapp-install-id"
    }
  });
}
var index_default = {
  async fetch(request, env) {
    const DEFAULT_UPSTREAM_BFF_URL = "http://173.249.18.14";
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "*";
    if (request.method === "OPTIONS") {
      return makeCorsResponse(origin);
    }
    if (!PROXY_PATH_PREFIXES.some((p) => url.pathname.startsWith(p))) {
      return new Response("Not found", {
        status: 404,
        headers: addCorsHeaders(new Headers({ "Content-Type": "text/plain" }), origin)
      });
    }
    const base = (env.UPSTREAM_BFF_URL || DEFAULT_UPSTREAM_BFF_URL).replace(/\/+$/, "");
    const upstreamUrl = base + url.pathname + url.search;
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
        signal: AbortSignal.timeout
      });
      const outHeaders = addCorsHeaders(new Headers(), origin);
      response.headers.forEach((v, k) => outHeaders.set(k, v));
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: outHeaders
      });
    } catch (err) {
      const isTimeout = err.name === "TimeoutError";
      return new Response(JSON.stringify({
        ok: false,
        error: isTimeout ? "BFF service temporarily unreachable via proxy." : "Proxy error.",
        path: url.pathname
      }), {
        status: 502,
        headers: addCorsHeaders(new Headers({ "Content-Type": "application/json" }), origin)
      });
    }
  }
};
export {
  index_default as default
};
