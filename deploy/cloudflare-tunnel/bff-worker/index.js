/**
 * TradersApp BFF Proxy — Cloudflare Worker
 * Proxies all /ml/*, /news/*, /identity/* etc. requests from the browser
 * to the Contabo BFF via an encrypted Cloudflare Tunnel.
 *
 * Why: Contabo VPS has a self-signed cert for *.sslip.io but NOT for *.pages.dev.
 * Devices whose DNS bypasses Cloudflare resolve tradergunit.pages.dev → Contabo IP
 * directly → browser rejects the cert → all BFF calls fail silently.
 *
 * Solution: Browser connects to this Worker at api.traders.app (Cloudflare-issued cert).
 * Worker forwards via Cloudflare Tunnel to Contabo BFF on the private network.
 * Browser sees Cloudflare's valid cert. Cert mismatch eliminated at the routing layer.
 *
 * Setup:
 *   1. Create Cloudflare Tunnel: dashboard.zero-trust.com → Networks → Tunnels
 *   2. Note the tunnel TOKEN (keep secret — goes in CONTABO_APP_ENV)
 *   3. Add DNS CNAME: api.traders.app → <tunnel-id>.cfargotunnel.com (Cloudflare Proxy enabled)
 *   4. Deploy this Worker to api.traders.app route
 *   5. Update VITE_BFF_URL in Pages deploy to: https://api.traders.app
 *   6. Add api.traders.app to BFF CORS ALLOWED_ORIGINS on Contabo
 *
 * Cloudflare Tunnel runs on Contabo (cloudflared daemon) and creates an encrypted
 * Wireguard-style path to Cloudflare's edge. No ports exposed to the public internet.
 */

const CONTABO_BFF_HOST = "localhost"; // Tunneled — cloudflared routes to this internally
const CONTABO_BFF_PORT = "8788";
const TUNNEL_HOST_HEADER = "bff-internal"; // Host header sent to Contabo Caddy

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only proxy BFF API paths — don't touch static assets or other routes
    if (!url.pathname.startsWith("/ml") &&
        !url.pathname.startsWith("/news") &&
        !url.pathname.startsWith("/identity") &&
        !url.pathname.startsWith("/terminal") &&
        !url.pathname.startsWith("/onboarding") &&
        !url.pathname.startsWith("/support") &&
        !url.pathname.startsWith("/content") &&
        !url.pathname.startsWith("/board-room") &&
        !url.pathname.startsWith("/calendar") &&
        !url.pathname.startsWith("/trade-calc") &&
        !url.pathname.startsWith("/telegram") &&
        !url.pathname.startsWith("/health") &&
        !url.pathname.startsWith("/ai-status") &&
        !url.pathname.startsWith("/terminal-analytics") &&
        !url.pathname.startsWith("/admin")) {
      return fetch(request);
    }

    // Build the upstream URL — preserve path and query
    const upstreamUrl = `http://${CONTABO_BFF_HOST}:${CONTABO_BFF_PORT}${url.pathname}${url.search}`;

    const headers = new Headers(request.headers);

    // Normalize Host so Contabo Caddy routes correctly
    headers.set("Host", TUNNEL_HOST_HEADER);

    // Remove headers that cloudflared or CF edge might add — let BFF control everything
    headers.delete("cf-connecting-ip"); // CF-specific, not needed by BFF
    headers.delete("cf-ray");
    headers.delete("cf-request-id");
    headers.delete("cf-visitor");
    headers.delete("cf-warp-tier");

    // Set correct origin for BFF CORS evaluation
    const origin = headers.get("origin") || "";
    if (origin) {
      // The upstream BFF on Contabo evaluates this origin against ALLOWED_ORIGINS
      headers.set("origin", origin);
    }

    try {
      const response = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "follow",
        // Short timeout — don't let the browser hang on tunnel issues
        signal: AbortSignal.timeout(15_000),
      });

      // Stream the response back — preserve all BFF headers (CORS, content-type, etc.)
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (err) {
      // Tunnel unreachable or BFF down — return a JSON error so callers can handle it
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      return new Response(
        JSON.stringify({
          ok: false,
          error: isTimeout ? "BFF service temporarily unreachable via proxy." : "Proxy error.",
          path: url.pathname,
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin || "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, X-Request-ID, x-tradersapp-install-id",
          },
        }
      );
    }
  },
};
