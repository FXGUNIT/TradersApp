import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const OTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;

export function decodeBase32(secret) {
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

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function hotp(secretBuffer, counter) {
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

export function verifyTotpCode({
  secret,
  code,
  now = Date.now(),
  window = 1,
}) {
  const cleanCode = String(code || "").replace(/\D/g, "").slice(0, OTP_DIGITS);
  if (cleanCode.length !== OTP_DIGITS) {
    return {
      ok: false,
      status: 400,
      error: "Authenticator code is required.",
    };
  }

  const secretBuffer = decodeBase32(secret);
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
      return { ok: true };
    }
  }
  return { ok: false, status: 401, error: "Invalid authenticator code." };
}

export function generateAdminTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export { OTP_DIGITS, TOTP_PERIOD_SECONDS };
