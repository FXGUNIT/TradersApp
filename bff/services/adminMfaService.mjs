import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const DEV_ADMIN_EMAILS = [
  "admin-one@example.invalid",
  "admin-two@example.invalid",
  "admin-three@example.invalid",
];

const OTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const ADMIN_MFA_CHALLENGE_TTL_MS = Number.parseInt(
  process.env.ADMIN_MFA_CHALLENGE_TTL_MS || "300000",
  10,
);
const EMAIL_OTP_TTL_MS = Number.parseInt(
  process.env.ADMIN_EMAIL_OTP_TTL_MS || "600000",
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

const mfaChallenges = new Map();
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
  const csvRecipients = parseCsv(
    process.env.ADMIN_MFA_EMAILS || process.env.ADMIN_EMAIL_OTP_RECIPIENTS,
  ).map(normalizeEmail);
  if (csvRecipients.length >= 3) return csvRecipients.slice(0, 3);

  const individualRecipients = [
    process.env.ADMIN_MFA_EMAIL_1 || process.env.ADMIN_EMAIL_OTP_1,
    process.env.ADMIN_MFA_EMAIL_2 || process.env.ADMIN_EMAIL_OTP_2,
    process.env.ADMIN_MFA_EMAIL_3 || process.env.ADMIN_EMAIL_OTP_3,
  ]
    .map(normalizeEmail)
    .filter(Boolean);
  if (individualRecipients.length >= 3) return individualRecipients.slice(0, 3);

  if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    return [];
  }
  return DEV_ADMIN_EMAILS;
}

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return "unknown";
  const visible =
    name.length <= 2 ? name[0] || "*" : `${name[0]}${name.at(-1)}`;
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

function buildClientBinding(clientKey) {
  return String(clientKey || "unknown-client").trim() || "unknown-client";
}

function cleanupExpiredChallenges(now = Date.now()) {
  for (const [challengeId, challenge] of mfaChallenges.entries()) {
    if (!challenge || challenge.expiresAt <= now || challenge.consumedAt) {
      mfaChallenges.delete(challengeId);
    }
  }
  for (const [challengeId, challenge] of emailChallenges.entries()) {
    if (!challenge || challenge.expiresAt <= now) {
      emailChallenges.delete(challengeId);
    }
  }
}

function createMfaChallenge({ method, clientKey }) {
  cleanupExpiredChallenges();
  const now = Date.now();
  const mfaChallengeId = randomUUID();
  const challenge = {
    mfaChallengeId,
    gate1Type: method,
    state: `${method}_verified`,
    clientBinding: buildClientBinding(clientKey),
    gate1VerifiedAt: now,
    emailChallengeId: "",
    createdAt: now,
    expiresAt: now + ADMIN_MFA_CHALLENGE_TTL_MS,
    consumedAt: 0,
  };
  mfaChallenges.set(mfaChallengeId, challenge);
  return challenge;
}

function getActiveMfaChallenge({ mfaChallengeId, clientKey }) {
  cleanupExpiredChallenges();
  const id = String(mfaChallengeId || "").trim();
  const challenge = mfaChallenges.get(id);
  if (!challenge) {
    return {
      ok: false,
      status: 400,
      error: "Admin MFA challenge expired. Restart verification.",
    };
  }
  if (challenge.consumedAt) {
    mfaChallenges.delete(id);
    return {
      ok: false,
      status: 400,
      error: "Admin MFA challenge was already used. Restart verification.",
    };
  }
  if (Date.now() > challenge.expiresAt) {
    mfaChallenges.delete(id);
    return {
      ok: false,
      status: 400,
      error: "Admin MFA challenge expired. Restart verification.",
    };
  }
  const binding = buildClientBinding(clientKey);
  if (challenge.clientBinding && binding && challenge.clientBinding !== binding) {
    mfaChallenges.delete(id);
    return {
      ok: false,
      status: 403,
      error: "Admin MFA challenge device mismatch. Restart verification.",
    };
  }
  return { ok: true, challenge };
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

export async function startAdminEmailOtp({ mfaChallengeId, clientKey }) {
  cleanupExpiredChallenges();
  const mfaResult = getActiveMfaChallenge({ mfaChallengeId, clientKey });
  if (!mfaResult.ok) return mfaResult;

  const recipients = getAdminEmailRecipients();
  if (recipients.length < 3) {
    return {
      ok: false,
      status: 503,
      error: "Admin email OTP recipients are not configured.",
    };
  }

  const now = Date.now();
  const emailDeliveryConfigured = isEmailDeliveryConfigured();
  if (!emailDeliveryConfigured && process.env.NODE_ENV === "production") {
    return {
      ok: false,
      status: 503,
      error: "Admin email OTP delivery is not configured.",
    };
  }

  const mfaChallenge = mfaResult.challenge;
  if (mfaChallenge.emailChallengeId) {
    emailChallenges.delete(mfaChallenge.emailChallengeId);
  }

  const challengeId = randomUUID();
  const codes = recipients.map(() => generateOtp());
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
    mfaChallengeId: mfaChallenge.mfaChallengeId,
    clientBinding: mfaChallenge.clientBinding,
    expiresAt: now + EMAIL_OTP_TTL_MS,
    attempts: 0,
    recipients,
    codeHashes: codes.map((code, index) => hashOtp(challengeId, index, code)),
    createdAt: now,
  });

  mfaChallenge.emailChallengeId = challengeId;
  mfaChallenge.state = "email_otp_sent";

  const payload = {
    ok: true,
    mfaChallengeId: mfaChallenge.mfaChallengeId,
    challengeId,
    emailChallengeId: challengeId,
    nextStep: "email_otp_verify",
    expiresInMs: EMAIL_OTP_TTL_MS,
    attemptLimit: EMAIL_OTP_ATTEMPT_LIMIT,
    emailDeliveryConfigured,
    delivery,
    recipients: recipients.map(maskEmail),
  };

  if (
    process.env.NODE_ENV !== "production" &&
    String(process.env.ADMIN_MFA_EXPOSE_DEV_CODES || "false").toLowerCase() ===
      "true"
  ) {
    payload.devCodes = recipients.reduce((acc, email, index) => {
      acc[maskEmail(email)] = codes[index];
      return acc;
    }, {});
  }

  return payload;
}

export function verifyAdminEmailOtp({
  mfaChallengeId,
  challengeId,
  codes,
  clientKey,
}) {
  cleanupExpiredChallenges();
  const mfaResult = getActiveMfaChallenge({ mfaChallengeId, clientKey });
  if (!mfaResult.ok) return mfaResult;

  const mfaChallenge = mfaResult.challenge;
  const emailChallenge = emailChallenges.get(String(challengeId || ""));
  if (!emailChallenge) {
    return { ok: false, status: 400, error: "OTP session expired." };
  }

  if (emailChallenge.mfaChallengeId !== mfaChallenge.mfaChallengeId) {
    emailChallenges.delete(emailChallenge.challengeId);
    return {
      ok: false,
      status: 403,
      error: "OTP session does not match the active admin challenge.",
    };
  }

  const binding = buildClientBinding(clientKey);
  if (
    emailChallenge.clientBinding &&
    binding &&
    emailChallenge.clientBinding !== binding
  ) {
    emailChallenges.delete(emailChallenge.challengeId);
    mfaChallenges.delete(mfaChallenge.mfaChallengeId);
    return { ok: false, status: 403, error: "OTP session device mismatch." };
  }

  if (Date.now() > emailChallenge.expiresAt) {
    emailChallenges.delete(emailChallenge.challengeId);
    return { ok: false, status: 400, error: "OTP codes expired." };
  }

  const provided = Array.isArray(codes)
    ? codes
    : [codes?.otp1, codes?.otp2, codes?.otp3];
  if (
    provided.length < 3 ||
    provided.some((code) => normalizeOtp(code).length !== OTP_DIGITS)
  ) {
    return {
      ok: false,
      status: 400,
      error: "All three email OTP codes are required.",
    };
  }

  const valid = emailChallenge.codeHashes.every((expected, index) =>
    safeEqual(expected, hashOtp(emailChallenge.challengeId, index, provided[index])),
  );

  if (!valid) {
    emailChallenge.attempts += 1;
    if (emailChallenge.attempts >= EMAIL_OTP_ATTEMPT_LIMIT) {
      emailChallenges.delete(emailChallenge.challengeId);
      mfaChallenge.emailChallengeId = "";
      mfaChallenge.state = "email_otp_required";
      return {
        ok: false,
        status: 429,
        error: "Too many OTP attempts. Request new codes.",
      };
    }
    return {
      ok: false,
      status: 401,
      error: "Invalid verification codes.",
      attemptsRemaining: EMAIL_OTP_ATTEMPT_LIMIT - emailChallenge.attempts,
    };
  }

  emailChallenges.delete(emailChallenge.challengeId);
  mfaChallenge.consumedAt = Date.now();
  mfaChallenge.state = "admin_session_issued";
  mfaChallenges.delete(mfaChallenge.mfaChallengeId);
  return { ok: true, method: `${mfaChallenge.gate1Type}_email_otp_3` };
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

export function verifyAdminTotp({
  code,
  clientKey,
  now = Date.now(),
  window = 1,
}) {
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
      const challenge = createMfaChallenge({ method: "totp", clientKey });
      return {
        ok: true,
        verified: true,
        method: "totp",
        mfaChallengeId: challenge.mfaChallengeId,
        expiresInMs: ADMIN_MFA_CHALLENGE_TTL_MS,
        nextStep: "email_otp_start",
        recipients: getAdminEmailRecipients().map(maskEmail),
      };
    }
  }

  return { ok: false, status: 401, error: "Invalid authenticator code." };
}

export function getAdminMfaStatus() {
  const recipients = getAdminEmailRecipients();
  return {
    passwordLoginEnabled:
      String(process.env.ADMIN_PASSWORD_LOGIN_ENABLED || "false")
        .trim()
        .toLowerCase() === "true",
    totpConfigured: Boolean(ADMIN_TOTP_SECRET),
    totpSetupFrontendEnabled: false,
    emailOtpEnabled: true,
    emailDeliveryConfigured: isEmailDeliveryConfigured(),
    emailRecipientsConfigured: recipients.length >= 3,
    emailRecipients: recipients.map(maskEmail),
    emailOtpAttemptLimit: EMAIL_OTP_ATTEMPT_LIMIT,
    emailOtpTtlMs: EMAIL_OTP_TTL_MS,
    mfaChallengeTtlMs: ADMIN_MFA_CHALLENGE_TTL_MS,
  };
}

export function getAdminTotpSetup() {
  return {
    ok: false,
    status: 410,
    error: "Authenticator setup is backend-only.",
  };
}

function encodeBase32(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += alphabet[Number.parseInt(chunk, 2)];
  }
  return output;
}

export function generateAdminTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export default {
  generateAdminTotpSecret,
  getAdminMfaStatus,
  getAdminTotpSetup,
  startAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminTotp,
};
