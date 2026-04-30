#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stdout || ""}${result.stderr || ""}` : "";
    throw new Error(`${command} ${args.join(" ")} failed${detail}`);
  }
  return result.stdout || "";
}

function parseArgs(argv) {
  const args = { workflow: "ci.yml", ref: "", dispatch: true, wait: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workflow") args.workflow = argv[++index] || args.workflow;
    else if (arg === "--ref") args.ref = argv[++index] || "";
    else if (arg === "--print-only") args.dispatch = false;
    else if (arg === "--no-wait") args.wait = false;
  }
  return args;
}

function currentRef() {
  try {
    return run("git", ["branch", "--show-current"], { capture: true }).trim();
  } catch {
    return "";
  }
}

function currentSha() {
  try {
    return run("git", ["rev-parse", "HEAD"], { capture: true }).trim();
  } catch {
    return "";
  }
}

const args = parseArgs(process.argv.slice(2));
const ref = args.ref || currentRef() || currentSha();

if (!ref) {
  console.error("Unable to resolve git ref. Pass --ref <branch-or-sha>.");
  process.exit(1);
}

const hashJson = run(
  process.execPath,
  ["scripts/images/bff-image.mjs", "hash", "--json"],
  { capture: true },
);
const hash = JSON.parse(hashJson);

console.log(`BFF context hash: ${hash.hash}`);
console.log(`SHA image target: ${hash.shaImage}`);
console.log(`Context image target: ${hash.contextImage}`);
console.log(`Remote workflow: ${args.workflow}`);
console.log(`Ref: ${ref}`);

const command = [
  "workflow",
  "run",
  args.workflow,
  "--ref",
  ref,
  "-f",
  "bootstrap_edge=false",
];

if (!args.dispatch) {
  console.log(`gh ${command.join(" ")}`);
  process.exit(0);
}

run("gh", command);
console.log("Remote BFF image build/reuse workflow dispatched.");

if (!args.wait) {
  console.log("Use GitHub Actions to watch the workflow.");
  process.exit(0);
}

const expectedSha = currentSha();
let runId = "";
let runUrl = "";
for (let attempt = 1; attempt <= 30; attempt += 1) {
  const rawRuns = run(
    "gh",
    [
      "run",
      "list",
      "--workflow",
      args.workflow,
      "--limit",
      "10",
      "--json",
      "databaseId,headSha,status,url",
    ],
    { capture: true },
  );
  const runs = JSON.parse(rawRuns);
  const match = runs.find((item) => !expectedSha || item.headSha === expectedSha);
  if (match?.databaseId) {
    runId = String(match.databaseId);
    runUrl = match.url || "";
    break;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
}

if (!runId) {
  console.log("Workflow dispatched, but the run id was not visible yet.");
  process.exit(0);
}

console.log(`Workflow run: ${runUrl || runId}`);
run("gh", ["run", "watch", runId, "--exit-status"]);

const artifactDir = `.artifacts/bff-remote/${runId}`;
run("gh", ["run", "download", runId, "-n", "bff-image-manifest", "-D", artifactDir]);
const manifest = JSON.parse(
  run(
    process.execPath,
    [
      "-e",
      `const fs=require('fs');process.stdout.write(fs.readFileSync('${artifactDir.replace(/\\/g, "\\\\")}/bff-image-manifest.json','utf8'))`,
    ],
    { capture: true },
  ),
);
console.log(`BFF image: ${manifest.image}`);
console.log(`BFF digest: ${manifest.digest}`);
console.log(`BFF context hash: ${manifest.contextHash}`);
console.log(`SBOM: ${manifest.sbom || "not recorded"}`);
console.log(`Trivy SARIF: ${manifest.trivySarif || "not recorded"}`);
