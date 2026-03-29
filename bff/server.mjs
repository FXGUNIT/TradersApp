import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.BFF_PORT || 8788);
const HOST = process.env.BFF_HOST || "127.0.0.1";
const MASTER_SALT =
  process.env.MASTER_SALT ||
  process.env.VITE_MASTER_SALT ||
  "TR_SECURITY_SALT_2024_REGIMENT";
const ADMIN_PASS_HASH =
  process.env.BFF_ADMIN_PASS_HASH ||
  process.env.ADMIN_PASS_HASH ||
  process.env.VITE_ADMIN_PASS_HASH ||
  "";
const ALLOWED_ORIGINS = String(process.env.BFF_ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const ADMIN_ATTEMPT_LIMIT = 3;
const ADMIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const adminAttemptStore = new Map();

const json = (res, statusCode, payload, origin = "*") => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
};

const resolveOrigin = (req) => {
  const requestOrigin = req.headers.origin;
  if (!requestOrigin) {
    return "*";
  }

  if (ALLOWED_ORIGINS.length === 0) {
    return requestOrigin;
  }

  return ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 10_000) {
        reject(new Error("Payload too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON payload."));
      }
    });

    req.on("error", reject);
  });

const hashPassword = (password) =>
  createHash("sha256").update(`${password}${MASTER_SALT}`).digest("hex");

const constantTimeMatch = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const getClientKey = (req) =>
  String(
    req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown-client",
  )
    .split(",")[0]
    .trim();

const getAttemptState = (clientKey) => {
  const current = adminAttemptStore.get(clientKey);
  if (!current) {
    return {
      attempts: 0,
      lockoutUntil: 0,
    };
  }

  if (current.lockoutUntil && current.lockoutUntil <= Date.now()) {
    adminAttemptStore.delete(clientKey);
    return {
      attempts: 0,
      lockoutUntil: 0,
    };
  }

  return current;
};

const registerFailedAttempt = (clientKey) => {
  const current = getAttemptState(clientKey);
  const attempts = Number(current.attempts || 0) + 1;
  const lockoutUntil =
    attempts >= ADMIN_ATTEMPT_LIMIT
      ? Date.now() + ADMIN_LOCKOUT_WINDOW_MS
      : 0;

  adminAttemptStore.set(clientKey, {
    attempts,
    lockoutUntil,
  });

  return {
    attempts,
    lockoutUntil,
  };
};

const clearFailedAttempts = (clientKey) => {
  adminAttemptStore.delete(clientKey);
};

const server = createServer(async (req, res) => {
  const origin = resolveOrigin(req);

  if (req.method === "OPTIONS") {
    json(res, 204, {}, origin);
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    json(
      res,
      200,
      {
        ok: true,
        service: "tradersapp-bff",
        adminPasswordConfigured: Boolean(ADMIN_PASS_HASH),
        adminRateLimit: {
          attempts: ADMIN_ATTEMPT_LIMIT,
          windowMs: ADMIN_LOCKOUT_WINDOW_MS,
        },
      },
      origin,
    );
    return;
  }

  if (req.method === "POST" && req.url === "/admin/verify-password") {
    const clientKey = getClientKey(req);
    const attemptState = getAttemptState(clientKey);

    if (attemptState.lockoutUntil && attemptState.lockoutUntil > Date.now()) {
      json(
        res,
        429,
        {
          ok: false,
          verified: false,
          error: "Too many attempts. Try again later.",
          retryAfterMs: attemptState.lockoutUntil - Date.now(),
        },
        origin,
      );
      return;
    }

    if (!ADMIN_PASS_HASH) {
      json(
        res,
        503,
        {
          ok: false,
          verified: false,
          error: "Admin password secret is not configured on the BFF.",
        },
        origin,
      );
      return;
    }

    try {
      const body = await readJsonBody(req);
      const password = String(body.password || "");

      if (!password) {
        json(
          res,
          400,
          {
            ok: false,
            verified: false,
            error: "Admin password is required.",
          },
          origin,
        );
        return;
      }

      const isValid = constantTimeMatch(hashPassword(password), ADMIN_PASS_HASH);

      if (!isValid) {
        const nextAttemptState = registerFailedAttempt(clientKey);
        json(
          res,
          401,
          {
            ok: false,
            verified: false,
            error: "Invalid admin password.",
            attemptsRemaining: Math.max(
              0,
              ADMIN_ATTEMPT_LIMIT - nextAttemptState.attempts,
            ),
            retryAfterMs:
              nextAttemptState.lockoutUntil > 0
                ? nextAttemptState.lockoutUntil - Date.now()
                : 0,
          },
          origin,
        );
        return;
      }

      clearFailedAttempts(clientKey);
      json(res, 200, { ok: true, verified: true }, origin);
      return;
    } catch (error) {
      json(
        res,
        400,
        {
          ok: false,
          verified: false,
          error: error.message || "Invalid request.",
        },
        origin,
      );
      return;
    }
  }

  json(
    res,
    404,
    {
      ok: false,
      error: "Route not found.",
    },
    origin,
  );
});

server.listen(PORT, HOST, () => {
  console.log(
    `[tradersapp-bff] listening on http://${HOST}:${PORT} (adminPasswordConfigured=${Boolean(
      ADMIN_PASS_HASH,
    )})`,
  );
});
