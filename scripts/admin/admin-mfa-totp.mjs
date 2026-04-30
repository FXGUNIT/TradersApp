#!/usr/bin/env node
import {
  generateAdminTotpSecret,
  OTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  verifyTotpCode,
} from "../../bff/services/adminTotpUtils.mjs";

function buildOtpAuthUri(secret, issuer, account) {
  const issuerParam = encodeURIComponent(issuer);
  const accountParam = encodeURIComponent(account);
  return `otpauth://totp/${issuerParam}:${accountParam}?secret=${secret}&issuer=${issuerParam}&algorithm=SHA1&digits=${OTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}

function usage() {
  console.log(`Usage:
  node scripts/admin/admin-mfa-totp.mjs generate [issuer] [account]
  node scripts/admin/admin-mfa-totp.mjs verify <code>
  node scripts/admin/admin-mfa-totp.mjs verify-setup <secret> <code>
  node scripts/admin/admin-mfa-totp.mjs rotate [issuer] [account]

Environment for verify:
  ADMIN_TOTP_SECRET or BFF_ADMIN_TOTP_SECRET

This command prints setup material only to the terminal. Store active secrets in
Infisical/GitHub/VPS runtime env as ADMIN_TOTP_SECRET or BFF_ADMIN_TOTP_SECRET.
For rotation, set the generated value as ADMIN_TOTP_SECRET_NEXT, run
verify-setup, then promote it to ADMIN_TOTP_SECRET and redeploy.
`);
}

function printSetup(secret, issuer, account, mode) {
  console.log(`${mode}:`);
  console.log("");
  console.log("ADMIN_TOTP_SECRET:");
  console.log(secret);
  console.log("");
  console.log("OTPAUTH_URI:");
  console.log(buildOtpAuthUri(secret, issuer, account));
  console.log("");
  console.log("Runtime secret names to update:");
  console.log("- ADMIN_TOTP_SECRET");
  console.log("- BFF_ADMIN_TOTP_SECRET");
  if (mode === "ROTATE") {
    console.log("- ADMIN_TOTP_SECRET_NEXT (temporary verification value)");
  }
}

function verifySecret(secret, code) {
  return verifyTotpCode({
    secret,
    code,
    window: 1,
  });
}

const [command, ...args] = process.argv.slice(2);
const issuer = args[0] || "TradersApp Admin";
const account = args[1] || "admin";

if (command === "generate") {
  printSetup(generateAdminTotpSecret(), issuer, account, "GENERATE");
  process.exit(0);
}

if (command === "rotate") {
  printSetup(generateAdminTotpSecret(), issuer, account, "ROTATE");
  console.log("");
  console.log("Rotation flow:");
  console.log("1. Add the value above as ADMIN_TOTP_SECRET_NEXT in runtime secrets.");
  console.log("2. Run verify-setup with the new secret and an authenticator code.");
  console.log("3. Promote ADMIN_TOTP_SECRET_NEXT to ADMIN_TOTP_SECRET.");
  console.log("4. Redeploy and remove ADMIN_TOTP_SECRET_NEXT.");
  process.exit(0);
}

if (command === "verify") {
  const code = args[0];
  const secret =
    process.env.ADMIN_TOTP_SECRET || process.env.BFF_ADMIN_TOTP_SECRET || "";
  if (!secret) {
    console.error("ADMIN_TOTP_SECRET or BFF_ADMIN_TOTP_SECRET is required.");
    process.exit(2);
  }
  const result = verifySecret(secret, code);
  if (!result.ok) {
    console.error(result.error || "TOTP code rejected.");
    process.exit(1);
  }
  console.log("TOTP code accepted for the active runtime secret.");
  process.exit(0);
}

if (command === "verify-setup") {
  const [secret, code] = args;
  if (!secret || !code) {
    usage();
    process.exit(1);
  }
  const result = verifySecret(secret, code);
  if (!result.ok) {
    console.error(result.error || "TOTP setup verification failed.");
    process.exit(1);
  }
  console.log("TOTP setup verified. Promote this secret only through runtime secret storage.");
  process.exit(0);
}

usage();
process.exit(command ? 1 : 0);
