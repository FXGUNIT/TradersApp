import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const DEFAULT_ADMIN_EMAILS = [
  "gunitsingh1994@gmail.com",
  "arkgproductions@gmail.com",
  "starg.unit@gmail.com",
];

const OTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const EMAIL_OTP_TTL_MS = Number.parseInt(
  process.env.ADMIN_EMAIL_OTP_TTL_MS || "300000",
  10,
);
const EMAIL_OTP_ATTEMPT_LIMIT = Number.parseInt(
  process.env.ADMIN_EMAIL_OTP_ATTEMPT_LIMIT || "3",
  10,
);
const ADMIN_MFA_SECRET =
  process.env.ADMIN_MFA_SECRET ||
  process.env.MASTER_SALT ||
  "tradersapp-admin-mfa-local-secret";
const ADMIN_TOTP_SECRET = String(
  process.env.ADMIN_TOTP_SECRET ||
    process.env.BFF_ADMIN_TOTP_SECRET ||
    "",
).trim();
const ADMIN_TOTP_ISSUER = String(
  process.env.ADMIN_TOTP_ISSUER || "TradersApp Admin",
).trim();
const ADMIN_TOTP_ACCOUNT_NAME = String(
  process.env.ADMIN_TOTP_ACCOUNT_NAME || getMasterAdminEmail() || "admin",
).trim();

const emailChallenges = new Map();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getAdminEmailRecipients() {
  const configured = parseCsv(
    process.env.ADMIN_MFA_EMAILS || process.env.ADMIN_EMAIL_OTP_RECIPIENTS,
  );
  return configured.length >= 3 ? configured.slice(0, 3) : DEFAULT_ADMIN_EMAILS;
}

function getMasterAdminEmail() {
  return normalizeEmail(process.env.ADMIN_MASTER_EMAIL || getAdminEmailRecipients()[0]);
}

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return "unknown";
  const visible = name.length <= 2 ? name[0] || "*" : `${name[0]}${name.at(-1)}`;
  return `${visible}${"*".repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}

function normalizeOtp(code) {
  return String(code || "").replace(/\D/g, "").slice(0, OTP_DIGITS);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function hashOtp(challengeId, slot, code) {
  return createHmac("sha256", ADMIN_MFA_SECRET)
    .update(`${challengeId}:${slot}:${normalizeOtp(code)}`)
    .digest("hex");
}

function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(OTP_DIGITS, "0");
}

function cleanupExpiredChallenges(now = Date.now()) {
  for (const [challengeId, challenge] of emailChallenges.entries()) {
    if (!challenge || challenge.expiresAt <= now) {
      emailChallenges.delete(challengeId);
    }
  }
}

function resolveEmailJsConfig() {
  const serviceId =
    process.env.ADMIN_EMAILJS_SERVICE_ID ||
    process.env.EMAILJS_SERVICE_ID ||
    process.env.VITE_EMAILJS_SERVICE_ID ||
    "";
  const templateId =
    process.env.ADMIN_EMAILJS_TEMPLATE_ID ||
    process.env.EMAILJS_TEMPLATE_ID ||
    process.env.VITE_EMAILJS_TEMPLATE_ID ||
    "";
  const publicKey =
    process.env.ADMIN_EMAILJS_PUBLIC_KEY ||
    process.env.EMAILJS_PUBLIC_KEY ||
    process.env.VITE_EMAILJS_PUBLIC_KEY ||
    "";
  const privateKey =
    process.env.ADMIN_EMAILJS_PRIVATE_KEY ||
    process.env.EMAILJS_PRIVATE_KEY ||
    "";
  return { serviceId, templateId, publicKey, privateKey };
}

function isEmailDeliveryConfigured() {
  const config = resolveEmailJsConfig();
  return Boolean(config.serviceId && config.templateId && config.publicKey);
}

async function sendEmailOtp({ email, code }) {
  const config = resolveEmailJsConfig();
  if (!config.serviceId || !config.templateId || !config.publicKey) {
    return { sent: false, reason: "email_provider_not_configured" };
  }

  const body = {
    service_id: config.serviceId,
    template_id: config.templateId,
    user_id: config.publicKey,
    template_params: {
      user_email: email,
      to_email: email,
      otp_code: code,
    },
  };

  if (config.privateKey) {
    body.accessToken = config.privateKey;
  }

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Email OTP delivery failed for ${maskEmail(email)}.`);
  }
  return { sent: true };
}

export async function startAdminEmailOtp({ masterEmail, clientKey }) {
  cleanupExpiredChallenges();
  if (normalizeEmail(masterEmail) !== getMasterAdminEmail()) {
    return {
      ok: false,
      status: 403,
      error: "Unauthorized admin identity.",
    };
  }

  const recipients = getAdminEmailRecipients();
  const challengeId = randomUUID();
  const codes = recipients.map(() => generateOtp());
  const now = Date.now();
  const emailDeliveryConfigured = isEmailDeliveryConfigured();
  if (!emailDeliveryConfigured && process.env.NODE_ENV === "production") {
    return {
      ok: false,
      status: 503,
      error: "Admin email OTP delivery is not configured.",
    };
  }

  const delivery = [];
  for (let index = 0; index < recipients.length; index += 1) {
    const email = recipients[index];
    if (emailDeliveryConfigured) {
      delivery.push(await sendEmailOtp({ email, code: codes[index] }));
    } else {
      delivery.push({ sent: false, reason: "email_provider_not_configured" });
    }
  }

  emailChallenges.set(challengeId, {
    challengeId,
    clientKey,
    expiresAt: now + EMAIL_OTP_TTL_MS,
    attempts: 0,
    recipients,
    codeHashes: codes.map((code, index) => hashOtp(challengeId, index, code)),
    createdAt: now,
  });

  return {
    ok: true,
    challengeId,
    expiresInMs: EMAIL_OTP_TTL_MS,
    attemptLimit: EMAIL_OTP_ATTEMPT_LIMIT,
    emailDeliveryConfigured,
    delivery,
    recipients: recipients.map(maskEmail),
    devCodes:
      process.env.NODE_ENV === "production"
        ? undefined
        : recipients.reduce((acc, email, index) => {
            acc[maskEmail(email)] = codes[index];
            return acc;
          }, {}),
  };
}

export function verifyAdminEmailOtp({ challengeId, codes, clientKey }) {
  cleanupExpiredChallenges();
  const challenge = emailChallenges.get(String(challengeId || ""));
  if (!challenge) {
    return { ok: false, status: 400, error: "OTP session expired." };
  }

  if (challenge.clientKey && clientKey && challenge.clientKey !== clientKey) {
    emailChallenges.delete(challenge.challengeId);
    return { ok: false, status: 403, error: "OTP session device mismatch." };
  }

  if (Date.now() > challenge.expiresAt) {
    emailChallenges.delete(challenge.challengeId);
    return { ok: false, status: 400, error: "OTP codes expired." };
  }

  const provided = Array.isArray(codes)
    ? codes
    : [codes?.otp1, codes?.otp2, codes?.otp3];
  if (provided.length < 3 || provided.some((code) => normalizeOtp(code).length !== OTP_DIGITS)) {
    return { ok: false, status: 400, error: "All three email OTP codes are required." };
  }

  const valid = challenge.codeHashes.every((expected, index) =>
    safeEqual(expected, hashOtp(challenge.challengeId, index, provided[index])),
  );

  if (!valid) {
    challenge.attempts += 1;
    if (challenge.attempts >= EMAIL_OTP_ATTEMPT_LIMIT) {
      emailChallenges.delete(challenge.challengeId);
      return { ok: false, status: 429, error: "Too many OTP attempts. Request new codes." };
    }
    return {
      ok: false,
      status: 401,
      error: "Invalid verification codes.",
      attemptsRemaining: EMAIL_OTP_ATTEMPT_LIMIT - challenge.attempts,
    };
  }

  emailChallenges.delete(challenge.challengeId);
  return { ok: true, method: "email_otp_3" };
}

function decodeBase32(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(secret || "")
    .toUpperCase()
    .replace(/[\s=-]/g, "");
  let bits = "";
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretBuffer, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);
  const digest = createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(OTP_DIGITS, "0");
}

export function verifyAdminTotp({ code, now = Date.now(), window = 1 }) {
  if (!ADMIN_TOTP_SECRET) {
    return {
      ok: false,
      status: 503,
      error: "Authenticator login is not configured.",
    };
  }

  const cleanCode = normalizeOtp(code);
  if (cleanCode.length !== OTP_DIGITS) {
    return { ok: false, status: 400, error: "Authenticator code is required." };
  }

  const secretBuffer = decodeBase32(ADMIN_TOTP_SECRET);
  if (!secretBuffer.length) {
    return {
      ok: false,
      status: 503,
      error: "Authenticator secret is invalid.",
    };
  }

  const counter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -window; offset <= window; offset += 1) {
    if (safeEqual(cleanCode, hotp(secretBuffer, counter + offset))) {
      return { ok: true, method: "totp" };
    }
  }

  return { ok: false, status: 401, error: "Invalid authenticator code." };
}

export function getAdminMfaStatus() {
  return {
    passwordLoginEnabled:
      String(process.env.ADMIN_PASSWORD_LOGIN_ENABLED || "false")
        .trim()
        .toLowerCase() === "true",
    totpConfigured: Boolean(ADMIN_TOTP_SECRET),
    emailOtpEnabled: true,
    emailDeliveryConfigured: isEmailDeliveryConfigured(),
    emailRecipients: getAdminEmailRecipients().map(maskEmail),
    emailOtpAttemptLimit: EMAIL_OTP_ATTEMPT_LIMIT,
    emailOtpTtlMs: EMAIL_OTP_TTL_MS,
  };
}

export function getAdminTotpSetup() {
  if (!ADMIN_TOTP_SECRET) {
    return {
      ok: false,
      status: 503,
      error: "Authenticator secret is not configured.",
    };
  }

  const accountLabel = encodeURIComponent(ADMIN_TOTP_ACCOUNT_NAME);
  const issuer = encodeURIComponent(ADMIN_TOTP_ISSUER);
  return {
    ok: true,
    issuer: ADMIN_TOTP_ISSUER,
    accountName: ADMIN_TOTP_ACCOUNT_NAME,
    secret: ADMIN_TOTP_SECRET,
    periodSeconds: TOTP_PERIOD_SECONDS,
    digits: OTP_DIGITS,
    otpauthUri: `otpauth://totp/${issuer}:${accountLabel}?secret=${ADMIN_TOTP_SECRET}&issuer=${issuer}&algorithm=SHA1&digits=${OTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`,
  };
}

export default {
  getAdminMfaStatus,
  getAdminTotpSetup,
  startAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminTotp,
};
