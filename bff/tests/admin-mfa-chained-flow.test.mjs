import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.ADMIN_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
process.env.ADMIN_MFA_SECRET = "test-admin-mfa-secret";
process.env.ADMIN_MFA_EMAILS =
  "admin-one@example.invalid,admin-two@example.invalid,admin-three@example.invalid";
process.env.ADMIN_MFA_EXPOSE_DEV_CODES = "true";

const {
  getAdminMfaStatus,
  getAdminTotpSetup,
  startAdminEmailOtp,
  verifyAdminEmailOtp,
  verifyAdminTotp,
} = await import("../services/adminMfaService.mjs");
const {
  startAdminPasskeyAuthentication,
  verifyAdminPasskeyAuthentication,
} = await import("../services/adminPasskeyService.mjs");

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
  return String(binary % 1_000_000).padStart(6, "0");
}

function currentTotp() {
  const counter = Math.floor(Date.now() / 1000 / 30);
  return hotp(decodeBase32(process.env.ADMIN_TOTP_SECRET), counter);
}

function codesFromStartResult(result) {
  return Object.values(result.devCodes || {});
}

test("admin TOTP success returns challenge only, not an admin token", async () => {
  const result = await verifyAdminTotp({
    code: currentTotp(),
    clientKey: "client-a",
  });

  assert.equal(result.ok, true);
  assert.equal(result.verified, true);
  assert.equal(result.method, "totp");
  assert.equal(result.nextStep, "email_otp_start");
  assert.match(result.mfaChallengeId, /^[0-9a-f-]{36}$/i);
  assert.equal(result.token, undefined);
});

test("email OTP cannot start without prior TOTP challenge", async () => {
  const result = await startAdminEmailOtp({
    mfaChallengeId: "",
    clientKey: "client-b",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("email OTP verify cannot create session without prior TOTP challenge", async () => {
  const result = await verifyAdminEmailOtp({
    mfaChallengeId: "",
    challengeId: "missing",
    codes: ["111111", "222222", "333333"],
    clientKey: "client-c",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("admin session is allowed only after TOTP challenge and all three email OTPs", async () => {
  const totpResult = await verifyAdminTotp({
    code: currentTotp(),
    clientKey: "client-d",
  });
  assert.equal(totpResult.ok, true);

  const emailStart = await startAdminEmailOtp({
    mfaChallengeId: totpResult.mfaChallengeId,
    clientKey: "client-d",
  });
  assert.equal(emailStart.ok, true);
  assert.match(emailStart.challengeId, /^[0-9a-f-]{36}$/i);

  const finalResult = await verifyAdminEmailOtp({
    mfaChallengeId: totpResult.mfaChallengeId,
    challengeId: emailStart.challengeId,
    codes: codesFromStartResult(emailStart),
    clientKey: "client-d",
  });

  assert.equal(finalResult.ok, true);
  assert.equal(finalResult.method, "totp_email_otp_3");
});

test("consumed MFA challenge cannot be reused", async () => {
  const totpResult = await verifyAdminTotp({
    code: currentTotp(),
    clientKey: "client-e",
  });
  const emailStart = await startAdminEmailOtp({
    mfaChallengeId: totpResult.mfaChallengeId,
    clientKey: "client-e",
  });
  const first = await verifyAdminEmailOtp({
    mfaChallengeId: totpResult.mfaChallengeId,
    challengeId: emailStart.challengeId,
    codes: codesFromStartResult(emailStart),
    clientKey: "client-e",
  });
  const second = await verifyAdminEmailOtp({
    mfaChallengeId: totpResult.mfaChallengeId,
    challengeId: emailStart.challengeId,
    codes: codesFromStartResult(emailStart),
    clientKey: "client-e",
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
});

test("frontend TOTP setup payload is disabled", () => {
  const setup = getAdminTotpSetup();
  assert.equal(setup.ok, false);
  assert.equal(setup.status, 410);
  assert.equal("secret" in setup, false);
  assert.equal("otpauthUri" in setup, false);
});

test("passkey gate cannot create admin session when no passkey is configured", async () => {
  const start = await startAdminPasskeyAuthentication({ clientKey: "client-passkey" });
  assert.equal(start.ok, false);
  assert.equal(start.status, 503);
  assert.equal(start.token, undefined);

  const verify = await verifyAdminPasskeyAuthentication({
    challengeId: "missing",
    response: {},
    clientKey: "client-passkey",
  });
  assert.equal(verify.ok, false);
  assert.equal(verify.token, undefined);
});

test("MFA status masks recipients", () => {
  const status = getAdminMfaStatus();
  assert.equal(status.totpSetupFrontendEnabled, false);
  assert.equal(status.emailRecipients.length, 3);
  assert.equal(status.emailRecipients.some((email) => email.includes("admin-one")), false);
  assert.equal(status.challengeStorage, "session-store");
  assert.equal(status.passkeyRegistrationBackendOnly, true);
});
