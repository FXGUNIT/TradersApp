#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    text: true,
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stdout || ""}${result.stderr || ""}` : "";
    throw new Error(`${command} ${args.join(" ")} failed${detail}`);
  }
  return result.stdout || "";
}

function parseArgs(argv) {
  const args = { workflow: "ci.yml", ref: "", dispatch: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workflow") args.workflow = argv[++index] || args.workflow;
    else if (arg === "--ref") args.ref = argv[++index] || "";
    else if (arg === "--print-only") args.dispatch = false;
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
console.log("Remote BFF image build/reuse workflow dispatched. Watch it in GitHub Actions.");
