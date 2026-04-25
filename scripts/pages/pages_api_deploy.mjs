/**
 * pages_api_deploy.mjs
 *
 * Deploys a built Pages project using the Cloudflare Pages REST API directly,
 * bypassing Wrangler (which calls GET /user/tokens/verify — incompatible with
 * cfut_ / Agent tokens that cannot pass that endpoint).
 *
 * Auth: uses X-Auth-Key / X-Auth-Email headers (Global API Key + email),
 * not bearer token — works with any cfut_/Agent/bound token.
 *
 * Usage:
 *   node scripts/pages/pages_api_deploy.mjs \
 *     --account-id <ACCOUNT_ID> \
 *     --project-name <PROJECT_NAME> \
 *     --dist-dir <DIST_DIR> \
 *     --branch main \
 *     --commit-hash <GITHUB_SHA>
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    "account-id":    { type: "string" },
    "project-name":  { type: "string" },
    "dist-dir":      { type: "string", default: "dist" },
    branch:          { type: "string", default: "main" },
    "commit-hash":   { type: "string", default: "" },
  },
});

const ACCOUNT_ID   = args["account-id"];
const PROJECT_NAME = args["project-name"];
const DIST_DIR     = args["dist-dir"];
const BRANCH       = args.branch;
const COMMIT_HASH  = args["commit-hash"] || process.env.GITHUB_SHA || "";

if (!ACCOUNT_ID || !PROJECT_NAME) {
  console.error("Usage: node scripts/pages/pages_api_deploy.mjs \\");
  console.error("  --account-id <ID> --project-name <NAME> [--dist-dir dist] [--branch main] [--commit-hash SHA]");
  process.exit(1);
}

const API_BASE = "https://api.cloudflare.com/client/v4/accounts";

async function cfFetch(path, options = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const email = process.env.CLOUDFLARE_EMAIL;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN env var required");

  const headers = { Authorization: `Bearer ${token}` };
  if (email) headers["X-Auth-Email"] = email;

  const url = `${API_BASE}/${ACCOUNT_ID}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    const err = new Error(`Cloudflare API error ${res.status}: ${JSON.stringify(json)}`);
    err.status = res.status;
    err.json   = json;
    throw err;
  }
  return json;
}

/** Collect all files under dir recursively. */
async function collectFiles(dir) {
  const files = [];
  async function walk(dirPath, basePath) {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dirPath, entry.name);
      const rel  = relative(basePath, full);
      if (entry.isDirectory()) {
        await walk(full, basePath);
      } else if (entry.isFile()) {
        files.push({ path: rel.replace(/\\/g, "/"), full });
      }
    }
  }
  await walk(dir, dir);
  return files;
}

/** Build multipart/form-data body manually. */
function buildMultipart(fields, files) {
  const boundary = `cf-deploy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const parts    = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
    ));
  }

  for (const { path, full } of files) {
    const content = readFileSync(full);
    parts.push(Buffer.from([
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="${path}"\r\n`,
      `Content-Type: application/octet-stream\r\n\r\n`,
    ].join("")));
    parts.push(content);
    parts.push(Buffer.from("\r\n"));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(parts) };
}

async function main() {
  console.log(`[pages-deploy] Project : ${PROJECT_NAME}`);
  console.log(`[pages-deploy] Account  : ${ACCOUNT_ID}`);
  console.log(`[pages-deploy] Dist dir : ${DIST_DIR}`);
  console.log(`[pages-deploy] Branch   : ${BRANCH}`);
  console.log(`[pages-deploy] Commit   : ${COMMIT_HASH}`);

  // 1. Create deployment
  console.log("\n[1/3] Creating deployment...");
  const createRes = await cfFetch(`/pages/projects/${PROJECT_NAME}/deployments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branch: BRANCH, commit_hash: COMMIT_HASH }),
  });

  const { id: deploymentId, upload_url: uploadUrl } = createRes.result;
  console.log(`[pages-deploy] Deployment: ${deploymentId}`);
  console.log(`[pages-deploy] Upload URL: ${uploadUrl}`);

  // 2. Upload files
  console.log("\n[2/3] Uploading files...");
  const files = await collectFiles(DIST_DIR);
  console.log(`[pages-deploy] Files: ${files.length}`);

  const { boundary, body } = buildMultipart(
    { manifest: JSON.stringify(Object.fromEntries(files.map(f => [f.path, f.path]))) },
    files
  );

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Upload failed (${uploadRes.status}): ${text}`);
  }
  console.log(`[pages-deploy] Upload complete`);

  // 3. Poll until active
  console.log("\n[3/3] Activating deployment...");
  for (let attempt = 0; attempt < 30; attempt++) {
    const status = await cfFetch(`/pages/projects/${PROJECT_NAME}/deployments/${deploymentId}`);
    const { status: depStatus, url } = status.result;
    console.log(`[pages-deploy] poll ${attempt + 1}/30: ${depStatus}`);
    if (depStatus === "success") {
      console.log(`\n✓ Live at ${url}`);
      return;
    }
    if (depStatus === "failure") {
      throw new Error(`Deployment failed: ${JSON.stringify(status.result.errors)}`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error("Deployment timed out after 30 polls");
}

main().catch(err => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});