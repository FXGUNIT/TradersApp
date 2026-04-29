#!/usr/bin/env node
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const OTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;

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

function verifyTotp(secret, code, now = Date.now(), window = 1) {
  const secretBuffer = decodeBase32(secret);
  const cleanCode = String(code || "").replace(/\D/g, "").slice(0, OTP_DIGITS);
  if (!secretBuffer.length || cleanCode.length !== OTP_DIGITS) return false;
  const counter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = hotp(secretBuffer, counter + offset);
    const a = Buffer.from(cleanCode, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

function usage() {
  console.log(`Usage:
  node scripts/admin/admin-mfa-totp.mjs generate [issuer] [account]
  node scripts/admin/admin-mfa-totp.mjs verify <code>

Environment for verify:
  ADMIN_TOTP_SECRET or BFF_ADMIN_TOTP_SECRET

This script prints setup material only to the terminal. Store the secret in
Infisical/GitHub/VPS runtime env as ADMIN_TOTP_SECRET or BFF_ADMIN_TOTP_SECRET.
`);
}

const command = String(process.argv[2] || "").toLowerCase();

if (command === "generate") {
  const secret = encodeBase32(randomBytes(20));
  const issuer = String(process.argv[3] || "TradersApp Admin");
  const account = String(process.argv[4] || "admin");
  const issuerParam = encodeURIComponent(issuer);
  const accountParam = encodeURIComponent(account);
  const otpauthUri = `otpauth://totp/${issuerParam}:${accountParam}?secret=${secret}&issuer=${issuerParam}&algorithm=SHA1&digits=${OTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;

  console.log("ADMIN_TOTP_SECRET:");
  console.log(secret);
  console.log("");
  console.log("OTPAUTH_URI:");
  console.log(otpauthUri);
  console.log("");
  console.log("Store the secret as ADMIN_TOTP_SECRET or BFF_ADMIN_TOTP_SECRET in runtime secrets only.");
  process.exit(0);
}

if (command === "verify") {
  const code = process.argv[3];
  const secret = process.env.ADMIN_TOTP_SECRET || process.env.BFF_ADMIN_TOTP_SECRET || "";
  if (!secret) {
    console.error("ADMIN_TOTP_SECRET or BFF_ADMIN_TOTP_SECRET is required.");
    process.exit(2);
  }
  if (!verifyTotp(secret, code)) {
    console.error("TOTP code rejected.");
    process.exit(1);
  }
  console.log("TOTP code accepted.");
  process.exit(0);
}

usage();
process.exit(command ? 1 : 0);
