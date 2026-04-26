/**
 * IP Safe Zone Middleware
 *
 * Allows admin access only from:
 *   - Exact IP matches (office IP)
 *   - Meerut city, pin codes 250001/250002 (via ip-api.com)
 *
 * Geolocation results are cached in-memory for 24h per IP to avoid
 * hammering ip-api.com on repeated attempts.
 */

const geoCache = new Map(); // ip -> { data, timestamp }
const GEO_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function lookupGeo(ip) {
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.timestamp < GEO_TTL_MS) {
    return cached.data;
  }
  try {
    const res = await fetch(`https://ip-api.com/json/${ip}?fields=countryCode,regionName,city,zip`, {
      headers: { "User-Agent": "TradersApp-BFF/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    geoCache.set(ip, { data, timestamp: Date.now() });
    return data;
  } catch {
    return null;
  }
}

function extractClientIp(req) {
  // Cloudflare passes real IP in CF-Connecting-IP
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return cf.trim().split(",")[0].trim();

  // Standard reverse proxy headers
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.trim().split(",")[0].trim();

  const real = req.headers["x-real-ip"];
  if (real) return real.trim();

  // Direct connection
  return req.socket?.remoteAddress?.replace("::ffff:", "") || "unknown";
}

function maskIp(ip) {
  if (!ip || ip === "unknown") return "***";
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.${parts[3]}`;
  return ip;
}

/**
 * @param {object} opts
 * @param {string[]} opts.allowedIps - Exact IP addresses to allow (e.g. ["106.219.146.101"])
 * @param {string} opts.allowedCity - City name to allow (e.g. "Meerut")
 * @param {string[]} opts.allowedPinCodes - Pin codes to allow in the city (e.g. ["250001", "250002"])
 * @returns {function} Express-style middleware: (req, res) => boolean
 *   Returns true if request was handled (allowed or denied), false to continue.
 */
export function createIpSafeZoneMiddleware({
  allowedIps = [],
  allowedCity = "",
  allowedPinCodes = [],
} = {}) {
  return async function ipSafeZone(req, res, json) {
    const ip = extractClientIp(req);
    const ipLower = ip.toLowerCase();

    // Exact IP match — allow immediately
    if (allowedIps.map((p) => p.toLowerCase()).includes(ipLower)) {
      return false; // continue to handler
    }

    // Geolocation check
    const geo = await lookupGeo(ip);
    if (!geo || !geo.city) {
      // Geolocation lookup failed — log and allow (fail open, per plan)
      console.warn(`[ipSafeZone] Geolocation lookup failed for ${maskIp(ip)}. Allowing by default.`);
      return false;
    }

    const cityMatch = geo.city.toLowerCase() === allowedCity.toLowerCase();
    const pinMatch = allowedPinCodes.includes(String(geo.zip || ""));

    if (cityMatch && pinMatch) {
      return false; // allowed — continue to handler
    }

    // Denied
    console.warn(`[ipSafeZone] Blocked admin attempt from ${maskIp(ip)} (${geo.city}, ${geo.zip}).`);
    json(res, 403, {
      ok: false,
      error: "Admin access restricted. Your IP is not in the allowed safe zone.",
      ip: maskIp(ip),
    });
    return true;
  };
}
