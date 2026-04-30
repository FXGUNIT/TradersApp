#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  createAdminPasskeyRegistrationOptions,
  listAdminPasskeyCredentials,
  removeAdminPasskeyCredential,
  verifyAdminPasskeyRegistration,
} from "../../bff/services/adminPasskeyService.mjs";

function usage() {
  console.log(`Usage:
  node scripts/admin/admin-mfa-passkey.mjs register-options [label]
  node scripts/admin/admin-mfa-passkey.mjs register-verify <challengeId> <response-json-file>
  node scripts/admin/admin-mfa-passkey.mjs list
  node scripts/admin/admin-mfa-passkey.mjs remove <credentialId>

Environment:
  ADMIN_PASSKEY_RP_ID              Domain used as WebAuthn RP ID.
  ADMIN_PASSKEY_ORIGINS            Comma-separated allowed browser origins.
  ADMIN_PASSKEY_CREDENTIALS_FILE   Runtime JSON file for public credential metadata.

Registration remains owner-controlled: this command prints challenge options and
stores only public credential metadata. It never creates a frontend enrollment page.
`);
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "register-options") {
    const result = await createAdminPasskeyRegistrationOptions({
      label: args[0] || "owner-passkey",
    });
    if (!result.ok) {
      console.error(result.error || "Failed to create passkey registration options.");
      process.exit(result.status === 503 ? 2 : 1);
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  if (command === "register-verify") {
    const [challengeId, filePath] = args;
    if (!challengeId || !filePath) {
      usage();
      process.exit(1);
    }
    const response = JSON.parse(readFileSync(filePath, "utf8"));
    const result = await verifyAdminPasskeyRegistration({
      challengeId,
      response,
    });
    if (!result.ok) {
      console.error(result.error || "Passkey registration rejected.");
      process.exit(result.status === 503 ? 2 : 1);
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  if (command === "list") {
    console.log(JSON.stringify(listAdminPasskeyCredentials(), null, 2));
    process.exit(0);
  }

  if (command === "remove") {
    const id = args[0];
    if (!id) {
      usage();
      process.exit(1);
    }
    const removed = removeAdminPasskeyCredential(id);
    console.log(JSON.stringify({ ok: removed }, null, 2));
    process.exit(removed ? 0 : 1);
  }

  usage();
  process.exit(command ? 1 : 0);
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
