import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import {
  generateAdminTotpSecret,
  OTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  verifyTotpCode,
} from "./adminTotpUtils.mjs";
import {
  createSession,
  deleteSession,
  getSession,
  updateSession,
} from "./redis-session-store.mjs";
import { getAdminPasskeyStatus } from "./adminPasskeyService.mjs";

const DEV_ADMIN_EMAILS = [
  "admin-one@example.invalid",
  "admin-two@example.invalid",
  "admin-three@example.invalid",
];

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
const MFA_CHALLENGE_PREFIX = "admin-mfa-challenge:";
const EMAIL_CHALLENGE_PREFIX = "admin-email-otp:";

function ttlSeconds(ms) {
  return Math.max(1, Math.ceil(Number(ms || 0) / 1000));
}

const MFA_CHALLENGE_STORE_OPTIONS = {
  prefix: MFA_CHALLENGE_PREFIX,
  ttlSeconds: ttlSeconds(ADMIN_MFA_CHALLENGE_TTL_MS),
};
const EMAIL_CHALLENGE_STORE_OPTIONS = {
  prefix: EMAIL_CHALLENGE_PREFIX,
  ttlSeconds: ttlSeconds(EMAIL_OTP_TTL_MS),
};

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

async function deleteMfaChallenge(challengeId) {
  return deleteSession(challengeId, MFA_CHALLENGE_STORE_OPTIONS);
}

async function updateMfaChallenge(challengeId, updates) {
  return updateSession(challengeId, updates, MFA_CHALLENGE_STORE_OPTIONS);
}

async function deleteEmailChallenge(challengeId) {
  return deleteSession(challengeId, EMAIL_CHALLENGE_STORE_OPTIONS);
}

async function updateEmailChallenge(challengeId, updates) {
  return updateSession(challengeId, updates, EMAIL_CHALLENGE_STORE_OPTIONS);
}

async function createMfaChallenge({ method, clientKey }) {
  const now = Date.now();
  const challenge = {
    gate1Type: method,
    state: `${method}_verified`,
    clientBinding: buildClientBinding(clientKey),
    gate1VerifiedAt: now,
    emailChallengeId: "",
    createdAt: now,
    expiresAt: now + ADMIN_MFA_CHALLENGE_TTL_MS,
    consumedAt: 0,
  };
  const mfaChallengeId = await createSession(
    challenge,
    MFA_CHALLENGE_STORE_OPTIONS,
  );
  if (!mfaChallengeId) return null;
  const storedChallenge = { ...challenge, mfaChallengeId };
  await updateMfaChallenge(mfaChallengeId, storedChallenge);
  return storedChallenge;
}

export async function createVerifiedAdminMfaChallenge({ method, clientKey }) {
  const challenge = await createMfaChallenge({ method, clientKey });
  if (!challenge) {
    return {
      ok: false,
      status: 503,
      error: "Admin MFA challenge store is unavailable.",
    };
  }
  return {
    ok: true,
    verified: true,
    method,
    mfaChallengeId: challenge.mfaChallengeId,
    expiresInMs: ADMIN_MFA_CHALLENGE_TTL_MS,
    nextStep: "email_otp_start",
    recipients: getAdminEmailRecipients().map(maskEmail),
  };
}

async function getActiveMfaChallenge({ mfaChallengeId, clientKey }) {
  const id = String(mfaChallengeId || "").trim();
  const challenge = await getSession(id, {
    ...MFA_CHALLENGE_STORE_OPTIONS,
    touch: false,
  });
  if (!challenge) {
    return {
      ok: false,
      status: 400,
      error: "Admin MFA challenge expired. Restart verification.",
    };
  }
  if (challenge.consumedAt) {
    await deleteMfaChallenge(id);
    return {
      ok: false,
      status: 400,
      error: "Admin MFA challenge was already used. Restart verification.",
    };
  }
  if (Date.now() > challenge.expiresAt) {
    await deleteMfaChallenge(id);
    return {
      ok: false,
      status: 400,
      error: "Admin MFA challenge expired. Restart verification.",
    };
  }
  const binding = buildClientBinding(clientKey);
  if (challenge.clientBinding && binding && challenge.clientBinding !== binding) {
    await deleteMfaChallenge(id);
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
  const mfaResult = await getActiveMfaChallenge({ mfaChallengeId, clientKey });
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
    await deleteEmailChallenge(mfaChallenge.emailChallengeId);
  }

  const challengeId = await createSession(
    {
      mfaChallengeId: mfaChallenge.mfaChallengeId,
      clientBinding: mfaChallenge.clientBinding,
      expiresAt: now + EMAIL_OTP_TTL_MS,
      attempts: 0,
      recipients,
      codeHashes: [],
      createdAt: now,
    },
    EMAIL_CHALLENGE_STORE_OPTIONS,
  );
  if (!challengeId) {
    return {
      ok: false,
      status: 503,
      error: "Admin email OTP challenge store is unavailable.",
    };
  }

  const codes = recipients.map(() => generateOtp());
  const delivery = [];
  try {
    for (let index = 0; index < recipients.length; index += 1) {
      const email = recipients[index];
      if (emailDeliveryConfigured) {
        delivery.push(await sendEmailOtp({ email, code: codes[index] }));
      } else {
        delivery.push({ sent: false, reason: "email_provider_not_configured" });
      }
    }
  } catch (error) {
    await deleteEmailChallenge(challengeId);
    throw error;
  }

  await updateEmailChallenge(challengeId, {
    challengeId,
    mfaChallengeId: mfaChallenge.mfaChallengeId,
    clientBinding: mfaChallenge.clientBinding,
    expiresAt: now + EMAIL_OTP_TTL_MS,
    attempts: 0,
    recipients,
    codeHashes: codes.map((code, index) => hashOtp(challengeId, index, code)),
    createdAt: now,
  });

  await updateMfaChallenge(mfaChallenge.mfaChallengeId, {
    emailChallengeId: challengeId,
    state: "email_otp_sent",
  });

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

export async function verifyAdminEmailOtp({
  mfaChallengeId,
  challengeId,
  codes,
  clientKey,
}) {
  const mfaResult = await getActiveMfaChallenge({ mfaChallengeId, clientKey });
  if (!mfaResult.ok) return mfaResult;

  const mfaChallenge = mfaResult.challenge;
  const emailChallenge = await getSession(String(challengeId || ""), {
    ...EMAIL_CHALLENGE_STORE_OPTIONS,
    touch: false,
  });
  if (!emailChallenge) {
    return { ok: false, status: 400, error: "OTP session expired." };
  }

  if (emailChallenge.mfaChallengeId !== mfaChallenge.mfaChallengeId) {
    await deleteEmailChallenge(emailChallenge.challengeId);
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
    await deleteEmailChallenge(emailChallenge.challengeId);
    await deleteMfaChallenge(mfaChallenge.mfaChallengeId);
    return { ok: false, status: 403, error: "OTP session device mismatch." };
  }

  if (Date.now() > emailChallenge.expiresAt) {
    await deleteEmailChallenge(emailChallenge.challengeId);
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
    const attempts = Number(emailChallenge.attempts || 0) + 1;
    if (attempts >= EMAIL_OTP_ATTEMPT_LIMIT) {
      await deleteEmailChallenge(emailChallenge.challengeId);
      await updateMfaChallenge(mfaChallenge.mfaChallengeId, {
        emailChallengeId: "",
        state: "email_otp_required",
      });
      return {
        ok: false,
        status: 429,
        error: "Too many OTP attempts. Request new codes.",
      };
    }
    await updateEmailChallenge(emailChallenge.challengeId, { attempts });
    return {
      ok: false,
      status: 401,
      error: "Invalid verification codes.",
      attemptsRemaining: EMAIL_OTP_ATTEMPT_LIMIT - attempts,
    };
  }

  await deleteEmailChallenge(emailChallenge.challengeId);
  await updateMfaChallenge(mfaChallenge.mfaChallengeId, {
    consumedAt: Date.now(),
    state: "admin_session_issued",
  });
  await deleteMfaChallenge(mfaChallenge.mfaChallengeId);
  return { ok: true, method: `${mfaChallenge.gate1Type}_email_otp_3` };
}

export async function verifyAdminTotp({
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

  const verified = verifyTotpCode({
    secret: ADMIN_TOTP_SECRET,
    code,
    now,
    window,
  });
  if (!verified.ok) return verified;

  return createVerifiedAdminMfaChallenge({ method: "totp", clientKey });
}

export function getAdminMfaStatus() {
  const recipients = getAdminEmailRecipients();
  const passkey = getAdminPasskeyStatus();
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
    challengeStorage: "session-store",
    challengeStorageMode: String(process.env.SESSION_STORAGE_MODE || "file")
      .trim()
      .toLowerCase(),
    passkeyConfigured: passkey.passkeyConfigured,
    passkeyCredentialCount: passkey.passkeyCredentialCount,
    passkeyRpId: passkey.passkeyRpId,
    passkeyRegistrationBackendOnly: passkey.passkeyRegistrationBackendOnly,
  };
}

export function getAdminTotpSetup() {
  return {
    ok: false,
    status: 410,
    error: "Authenticator setup is backend-only.",
  };
}

export { generateAdminTotpSecret };

export default {
  createVerifiedAdminMfaChallenge,
  generateAdminTotpSecret,
  getAdminMfaStatus,
  getAdminTotpSetup,
  startAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminTotp,
};
