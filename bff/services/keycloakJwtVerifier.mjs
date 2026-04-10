/**
 * Keycloak OIDC JWT Verifier — BFF service (H06)
 *
 * Validates bearer tokens issued by a Keycloak realm using the realm's
 * JWKS endpoint.  Activated only when KEYCLOAK_REALM_URL is set in the
 * environment; otherwise the function returns null and the existing
 * security.mjs session-based auth path is used without change.
 *
 * Usage (in authorizeRequest or _dispatch.mjs):
 *   import { verifyKeycloakToken } from "./services/keycloakJwtVerifier.mjs";
 *   const claims = await verifyKeycloakToken(req);
 *   if (claims) { ... } // Keycloak-authenticated
 *
 * Environment variables:
 *   KEYCLOAK_REALM_URL   e.g. https://keycloak.example.com/realms/tradersapp
 *   KEYCLOAK_CLIENT_ID   e.g. bff-service
 *   KEYCLOAK_AUDIENCE    (optional) override audience claim check
 */

import { createHash, createVerify } from "node:crypto";

// ---------------------------------------------------------------------------
// In-memory JWKS cache (TTL = 10 min)
// ---------------------------------------------------------------------------

const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
/** @type {{ keys: JWK[], fetchedAt: number } | null} */
let _jwksCache = null;

/**
 * Fetch JWKS from Keycloak realm.  Cached for 10 minutes.
 * @returns {Promise<JWK[]>}
 */
async function _fetchJwks() {
  const realmUrl = process.env.KEYCLOAK_REALM_URL;
  if (!realmUrl) return [];

  const now = Date.now();
  if (_jwksCache && now - _jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return _jwksCache.keys;
  }

  const jwksUrl = `${realmUrl.replace(/\/$/, "")}/protocol/openid-connect/certs`;
  const res = await fetch(jwksUrl, {
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`JWKS fetch failed: ${res.status} ${res.statusText}`);
  }
  const { keys } = await res.json();
  _jwksCache = { keys: keys ?? [], fetchedAt: now };
  return _jwksCache.keys;
}

// ---------------------------------------------------------------------------
// JWT parsing helpers — no external dependencies
// ---------------------------------------------------------------------------

function _base64urlDecode(str) {
  const padded = str
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

/**
 * Parse a raw JWT string into {header, payload, signature, signingInput}.
 * Returns null on any format error.
 * @param {string} token
 */
function _parseJwt(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(_base64urlDecode(parts[0]).toString("utf8"));
    const payload = JSON.parse(_base64urlDecode(parts[1]).toString("utf8"));
    return {
      header,
      payload,
      signature: _base64urlDecode(parts[2]),
      signingInput: `${parts[0]}.${parts[1]}`,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// RSA-SHA256 signature verification via Node.js crypto
// ---------------------------------------------------------------------------

/**
 * Convert a JWK (RSA public key) to PEM string.
 * Only supports RS256 keys (as issued by Keycloak).
 * @param {{ n: string, e: string }} jwk
 * @returns {string} PEM
 */
function _rsaJwkToPem(jwk) {
  // Build a DER-encoded SubjectPublicKeyInfo for RSA
  const n = _base64urlDecode(jwk.n);
  const e = _base64urlDecode(jwk.e);

  // ASN.1 INTEGER encoding helper
  const encodeInt = (buf) => {
    const needsLeadingZero = buf[0] >= 0x80;
    const payload = needsLeadingZero
      ? Buffer.concat([Buffer.from([0x00]), buf])
      : buf;
    return Buffer.concat([Buffer.from([0x02, payload.length]), payload]);
  };

  const modulus = encodeInt(n);
  const exponent = encodeInt(e);

  // SEQUENCE { INTEGER n, INTEGER e }
  const seqContent = Buffer.concat([modulus, exponent]);
  const seq = Buffer.concat([
    Buffer.from([0x30]),
    _encodeLength(seqContent.length),
    seqContent,
  ]);

  // BIT STRING wrapper
  const bitString = Buffer.concat([
    Buffer.from([0x03]),
    _encodeLength(seq.length + 1),
    Buffer.from([0x00]),
    seq,
  ]);

  // RSA AlgorithmIdentifier: SEQUENCE { OID rsaEncryption, NULL }
  const rsaOid = Buffer.from("300d06092a864886f70d0101010500", "hex");

  // SubjectPublicKeyInfo SEQUENCE
  const spkiContent = Buffer.concat([rsaOid, bitString]);
  const spki = Buffer.concat([
    Buffer.from([0x30]),
    _encodeLength(spkiContent.length),
    spkiContent,
  ]);

  const b64 = spki
    .toString("base64")
    .match(/.{1,64}/g)
    .join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----`;
}

function _encodeLength(len) {
  if (len < 128) return Buffer.from([len]);
  const bytes = [];
  let remaining = len;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/**
 * Verify RS256 signature.
 * @param {string} signingInput  — "header.payload" raw string
 * @param {Buffer}  signature
 * @param {string}  pem          — RSA public key PEM
 * @returns {boolean}
 */
function _verifyRs256(signingInput, signature, pem) {
  try {
    const verifier = createVerify("SHA256");
    verifier.update(signingInput);
    return verifier.verify(pem, signature);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Claims validation
// ---------------------------------------------------------------------------

const CLOCK_SKEW_S = 30;

function _validateClaims(payload) {
  const now = Math.floor(Date.now() / 1000);
  const clientId = process.env.KEYCLOAK_CLIENT_ID;
  const audience = process.env.KEYCLOAK_AUDIENCE ?? clientId;
  const realmUrl = process.env.KEYCLOAK_REALM_URL?.replace(/\/$/, "");

  if (!payload || typeof payload !== "object") return "invalid payload";
  if (payload.exp && payload.exp + CLOCK_SKEW_S < now) return "token expired";
  if (payload.nbf && payload.nbf - CLOCK_SKEW_S > now)
    return "token not yet valid";
  if (realmUrl && payload.iss && payload.iss !== realmUrl)
    return `issuer mismatch: ${payload.iss}`;
  if (audience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(audience)) return `audience mismatch: ${aud.join(",")}`;
  }
  return null; // valid
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a Keycloak-issued bearer token from an incoming HTTP request.
 *
 * Returns the decoded payload (claims) on success, or null if:
 *   - KEYCLOAK_REALM_URL is not set (feature disabled)
 *   - No Authorization header is present
 *   - Token is invalid / expired / signature-fails
 *
 * Throws if the JWKS fetch itself errors (caller should return 503).
 *
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<object | null>}
 */
export async function verifyKeycloakToken(req) {
  if (!process.env.KEYCLOAK_REALM_URL) return null;

  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const rawToken = authHeader.slice(7).trim();
  const parsed = _parseJwt(rawToken);
  if (!parsed) return null;

  const { header, payload, signature, signingInput } = parsed;

  if (header.alg !== "RS256") {
    // Only RS256 supported — reject other algs (avoid alg:none attacks)
    return null;
  }

  const keys = await _fetchJwks();
  const jwk = keys.find(
    (k) =>
      (!header.kid || k.kid === header.kid) &&
      k.kty === "RSA" &&
      k.use !== "enc",
  );

  if (!jwk) return null;

  const pem = _rsaJwkToPem(jwk);
  if (!_verifyRs256(signingInput, signature, pem)) return null;

  const claimsError = _validateClaims(payload);
  if (claimsError) return null;

  return payload;
}

/**
 * Invalidate the JWKS cache — call after key rotation or in tests.
 */
export function invalidateJwksCache() {
  _jwksCache = null;
}
