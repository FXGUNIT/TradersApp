import {
  mkdirSync,
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  createSession,
  deleteSession,
  getSession,
} from "./redis-session-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PASSKEY_CHALLENGE_PREFIX = "admin-passkey-challenge:";
const PASSKEY_CHALLENGE_TTL_MS = Number.parseInt(
  process.env.ADMIN_PASSKEY_CHALLENGE_TTL_MS || "300000",
  10,
);
const PASSKEY_STORE_FILE =
  process.env.ADMIN_PASSKEY_CREDENTIALS_FILE ||
  join(__dirname, "../runtime/admin-passkeys.json");

const PASSKEY_CHALLENGE_OPTIONS = {
  prefix: PASSKEY_CHALLENGE_PREFIX,
  ttlSeconds: Math.max(1, Math.ceil(PASSKEY_CHALLENGE_TTL_MS / 1000)),
};

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveRpId() {
  const raw =
    process.env.ADMIN_PASSKEY_RP_ID ||
    process.env.BFF_PUBLIC_HOST ||
    process.env.TRADERSAPP_DOMAIN ||
    "localhost";
  return String(raw).replace(/^https?:\/\//i, "").split("/")[0].split(":")[0];
}

function resolveOrigins() {
  const configured = parseCsv(
    process.env.ADMIN_PASSKEY_ORIGINS ||
      process.env.BFF_ALLOWED_ORIGINS ||
      process.env.ALLOWED_ORIGINS,
  );
  if (configured.length) return configured;
  return [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
  ];
}

function clientBinding(clientKey) {
  return String(clientKey || "unknown-client").trim() || "unknown-client";
}

function fromBase64Url(value) {
  return Buffer.from(String(value || ""), "base64url");
}

function toBase64Url(value) {
  return Buffer.from(value || "").toString("base64url");
}

function parseCredentialList(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : parsed.credentials || [];
  } catch {
    return [];
  }
}

function readStoreFile() {
  if (!existsSync(PASSKEY_STORE_FILE)) return { credentials: [] };
  try {
    const parsed = JSON.parse(readFileSync(PASSKEY_STORE_FILE, "utf8"));
    return {
      credentials: Array.isArray(parsed.credentials) ? parsed.credentials : [],
    };
  } catch {
    return { credentials: [] };
  }
}

function loadCredentials() {
  const envCredentials = parseCredentialList(
    process.env.ADMIN_PASSKEY_CREDENTIALS_JSON,
  );
  const fileCredentials = readStoreFile().credentials;
  const byId = new Map();
  for (const credential of [...envCredentials, ...fileCredentials]) {
    if (credential?.id && credential?.publicKey) {
      byId.set(credential.id, credential);
    }
  }
  return [...byId.values()];
}

function saveCredentials(credentials) {
  const dir = dirname(PASSKEY_STORE_FILE);
  mkdirSync(dir, { recursive: true });
  const tmp = `${PASSKEY_STORE_FILE}.${process.pid}.tmp`;
  writeFileSync(
    tmp,
    `${JSON.stringify({ version: 1, credentials }, null, 2)}\n`,
    { mode: 0o600 },
  );
  renameSync(tmp, PASSKEY_STORE_FILE);
}

function toSimpleCredential(credential) {
  return {
    id: credential.id,
    publicKey: fromBase64Url(credential.publicKey),
    counter: Number(credential.counter || 0),
    transports: credential.transports || [],
  };
}

async function createPasskeyChallenge(payload) {
  const id = await createSession(
    {
      ...payload,
      clientBinding: clientBinding(payload.clientKey),
      expiresAt: Date.now() + PASSKEY_CHALLENGE_TTL_MS,
    },
    PASSKEY_CHALLENGE_OPTIONS,
  );
  return id;
}

async function getPasskeyChallenge(challengeId, expectedType, clientKey) {
  const id = String(challengeId || "").trim();
  const challenge = await getSession(id, {
    ...PASSKEY_CHALLENGE_OPTIONS,
    touch: false,
  });
  if (!challenge || challenge.type !== expectedType) {
    return { ok: false, status: 400, error: "Passkey challenge expired." };
  }
  if (Date.now() > Number(challenge.expiresAt || 0)) {
    await deleteSession(id, PASSKEY_CHALLENGE_OPTIONS);
    return { ok: false, status: 400, error: "Passkey challenge expired." };
  }
  if (challenge.clientBinding !== clientBinding(clientKey)) {
    await deleteSession(id, PASSKEY_CHALLENGE_OPTIONS);
    return { ok: false, status: 403, error: "Passkey challenge mismatch." };
  }
  return { ok: true, challenge };
}

export function getAdminPasskeyStatus() {
  const credentials = loadCredentials();
  return {
    passkeyConfigured: credentials.length > 0,
    passkeyCredentialCount: credentials.length,
    passkeyRpId: resolveRpId(),
    passkeyOriginsConfigured: resolveOrigins().length > 0,
    passkeyRegistrationBackendOnly: true,
    passkeyCredentialStore: PASSKEY_STORE_FILE,
  };
}

export async function startAdminPasskeyAuthentication({ clientKey }) {
  const credentials = loadCredentials();
  if (!credentials.length) {
    return { ok: false, status: 503, error: "Admin passkey is not configured." };
  }
  const options = await generateAuthenticationOptions({
    rpID: resolveRpId(),
    allowCredentials: credentials.map((credential) => ({
      id: credential.id,
      transports: credential.transports || [],
    })),
    userVerification: "required",
  });
  const challengeId = await createPasskeyChallenge({
    type: "authentication",
    challenge: options.challenge,
    credentialIds: credentials.map((credential) => credential.id),
    clientKey,
  });
  if (!challengeId) {
    return { ok: false, status: 503, error: "Passkey challenge store is unavailable." };
  }
  return { ok: true, challengeId, options, expiresInMs: PASSKEY_CHALLENGE_TTL_MS };
}

export async function verifyAdminPasskeyAuthentication({
  challengeId,
  response,
  clientKey,
}) {
  const challengeResult = await getPasskeyChallenge(
    challengeId,
    "authentication",
    clientKey,
  );
  if (!challengeResult.ok) return challengeResult;

  const credentials = loadCredentials();
  const credential = credentials.find((entry) => entry.id === response?.id);
  if (!credential) {
    return { ok: false, status: 401, error: "Passkey credential rejected." };
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeResult.challenge.challenge,
    expectedOrigin: resolveOrigins(),
    expectedRPID: resolveRpId(),
    credential: toSimpleCredential(credential),
    requireUserVerification: true,
  });
  if (!verification.verified) {
    return { ok: false, status: 401, error: "Passkey verification failed." };
  }

  const updated = credentials.map((entry) =>
    entry.id === credential.id
      ? {
          ...entry,
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: Date.now(),
        }
      : entry,
  );
  saveCredentials(updated);
  await deleteSession(challengeId, PASSKEY_CHALLENGE_OPTIONS);
  return { ok: true, verified: true, method: "passkey", credentialId: credential.id };
}

export async function createAdminPasskeyRegistrationOptions({
  label = "owner-passkey",
  clientKey = "backend-cli",
} = {}) {
  const credentials = loadCredentials();
  const options = await generateRegistrationOptions({
    rpName: process.env.ADMIN_PASSKEY_RP_NAME || "TradersApp Admin",
    rpID: resolveRpId(),
    userName: process.env.ADMIN_PASSKEY_USER_NAME || "tradersapp-admin",
    userDisplayName: process.env.ADMIN_PASSKEY_USER_DISPLAY || "TradersApp Admin",
    attestationType: "none",
    excludeCredentials: credentials.map((credential) => ({
      id: credential.id,
      transports: credential.transports || [],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });
  const challengeId = await createPasskeyChallenge({
    type: "registration",
    challenge: options.challenge,
    label,
    clientKey,
  });
  if (!challengeId) {
    return { ok: false, status: 503, error: "Passkey challenge store is unavailable." };
  }
  return { ok: true, challengeId, options, expiresInMs: PASSKEY_CHALLENGE_TTL_MS };
}

export async function verifyAdminPasskeyRegistration({
  challengeId,
  response,
  clientKey = "backend-cli",
}) {
  const challengeResult = await getPasskeyChallenge(
    challengeId,
    "registration",
    clientKey,
  );
  if (!challengeResult.ok) return challengeResult;
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeResult.challenge.challenge,
    expectedOrigin: resolveOrigins(),
    expectedRPID: resolveRpId(),
    requireUserVerification: true,
  });
  if (!verification.verified) {
    return { ok: false, status: 401, error: "Passkey registration rejected." };
  }

  const info = verification.registrationInfo;
  const credentials = loadCredentials().filter(
    (credential) => credential.id !== info.credential.id,
  );
  const credential = {
    id: info.credential.id,
    publicKey: toBase64Url(info.credential.publicKey),
    counter: Number(info.credential.counter || 0),
    transports: response?.response?.transports || info.credential.transports || [],
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
    label: challengeResult.challenge.label || "owner-passkey",
    createdAt: Date.now(),
    lastUsedAt: 0,
  };
  saveCredentials([...credentials, credential]);
  await deleteSession(challengeId, PASSKEY_CHALLENGE_OPTIONS);
  return { ok: true, credential: { id: credential.id, label: credential.label } };
}

export function listAdminPasskeyCredentials() {
  return loadCredentials().map((credential) => ({
    id: credential.id,
    label: credential.label || "owner-passkey",
    counter: Number(credential.counter || 0),
    createdAt: credential.createdAt || null,
    lastUsedAt: credential.lastUsedAt || null,
    transports: credential.transports || [],
  }));
}

export function removeAdminPasskeyCredential(id) {
  const credentials = loadCredentials();
  const next = credentials.filter((credential) => credential.id !== id);
  if (next.length === credentials.length) return false;
  saveCredentials(next);
  return true;
}

export default {
  createAdminPasskeyRegistrationOptions,
  getAdminPasskeyStatus,
  listAdminPasskeyCredentials,
  removeAdminPasskeyCredential,
  startAdminPasskeyAuthentication,
  verifyAdminPasskeyAuthentication,
  verifyAdminPasskeyRegistration,
};
