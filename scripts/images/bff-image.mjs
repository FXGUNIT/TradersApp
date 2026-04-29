import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(process.cwd());
const hashInputs = ["bff", "proto", "bff/Dockerfile", "bff/package-lock.json", ".dockerignore"];
const skipDirs = new Set([
  ".git",
  "node_modules",
  "__pycache__",
  ".pytest_cache",
  ".pytest_tmp",
  ".tmp_pytest",
  ".tmp_pytest_r08",
  ".venv",
  "venv",
]);
const forbiddenSecretNames = [
  "AI_GEMINI_PRO_KEY",
  "AI_GROQ_TURBO_KEY",
  "AI_OPENROUTER_MIND_ALPHA",
  "AI_OPENROUTER_MIND_BETA",
  "AI_CEREBRAS_KEY",
  "AI_DEEPSEEK_KEY",
  "AI_SAMBANOVA_KEY",
  "GROQ_API_KEY",
  "SAMBANOVA_API_KEY",
  "OPENROUTER_API_KEY",
  "FINNHUB_API_KEY",
  "NEWS_API_KEY",
  "BFF_ADMIN_PASS_HASH",
  "MASTER_SALT",
  "ADMIN_TOTP_SECRET",
  "ADMIN_MFA_SECRET",
];
const excludedFilePatterns = [
  /^bff\/\.env(\..*)?$/,
  /^bff\/tests\//,
  /^bff\/Dockerfile\.new$/,
  /^bff\/\.dockerignore$/,
  /^bff\/railway\.json$/,
];

function normalizePath(path) {
  return path.split(sep).join("/");
}

function collectFiles(inputPath, files = new Set()) {
  const absolutePath = resolve(repoRoot, inputPath);
  if (!existsSync(absolutePath)) return files;
  const stats = statSync(absolutePath);
  if (stats.isDirectory()) {
    const entries = readdirSync(absolutePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
      collectFiles(resolve(absolutePath, entry.name), files);
    }
    return files;
  }
  if (stats.isFile()) {
    const file = normalizePath(relative(repoRoot, absolutePath));
    if (!excludedFilePatterns.some((pattern) => pattern.test(file))) {
      files.add(file);
    }
  }
  return files;
}

function computeHash() {
  const files = [...hashInputs.reduce((set, input) => collectFiles(input, set), new Set())].sort();
  const hasher = createHash("sha256");
  for (const file of files) {
    hasher.update(file);
    hasher.update("\0");
    hasher.update(readFileSync(resolve(repoRoot, file)));
    hasher.update("\0");
  }
  return {
    hash: hasher.digest("hex").slice(0, 20),
    files,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true";
    args[key] = value;
  }
  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stdout || ""}${result.stderr || ""}` : "";
    throw new Error(`${command} ${args.join(" ")} failed${detail}`);
  }
  return result.stdout || "";
}

function gitSha() {
  try {
    return run("git", ["rev-parse", "--short=12", "HEAD"], { capture: true }).trim();
  } catch {
    return "local";
  }
}

function ownerFromGitRemote() {
  try {
    const remoteUrl = run("git", ["config", "--get", "remote.origin.url"], { capture: true }).trim();
    const match = remoteUrl.match(/github\.com[:/](?<owner>[^/]+)\/[^/]+(?:\.git)?$/i);
    return match?.groups?.owner || "";
  } catch {
    return "";
  }
}

function defaultOwner() {
  return (process.env.GHCR_OWNER || process.env.GITHUB_REPOSITORY_OWNER || ownerFromGitRemote() || "tradersapp").toLowerCase();
}

function imageRef(args, hash) {
  const owner = String(args.owner || defaultOwner()).toLowerCase();
  const tag = args.tag || process.env.IMAGE_TAG || gitSha();
  return {
    owner,
    tag,
    shaImage: args.image || `ghcr.io/${owner}/bff:${tag}`,
    contextImage: `ghcr.io/${owner}/bff:context-${hash}`,
  };
}

function writeGithubOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  writeFileSync(outputPath, `${lines.join("\n")}\n`, { flag: "a" });
}

function handleHash(args) {
  const result = computeHash();
  const refs = imageRef(args, result.hash);
  if (args.json === "true") {
    console.log(JSON.stringify({ ...result, ...refs, dockerfile: "bff/Dockerfile" }, null, 2));
  } else {
    console.log(result.hash);
  }
  writeGithubOutput({
    context_hash: result.hash,
    sha_image: refs.shaImage,
    context_image: refs.contextImage,
    dockerfile: "bff/Dockerfile",
  });
}

function handleBuild(args) {
  const { hash } = computeHash();
  const refs = imageRef(args, hash);
  run("docker", [
    "build",
    "--file",
    "bff/Dockerfile",
    "--tag",
    refs.shaImage,
    "--tag",
    refs.contextImage,
    ".",
  ]);
  console.log(JSON.stringify({ contextHash: hash, image: refs.shaImage, contextImage: refs.contextImage }, null, 2));
}

function assertNoSecretNamesInImage(image) {
  const inspect = run("docker", ["image", "inspect", image], { capture: true });
  const history = run("docker", ["history", "--no-trunc", image], { capture: true });
  const haystack = `${inspect}\n${history}`;
  const found = forbiddenSecretNames.filter((name) => haystack.includes(name));
  if (found.length) {
    throw new Error(`BFF image contains forbidden secret env/build metadata: ${found.join(", ")}`);
  }
}

function handleSmoke(args) {
  const { hash } = computeHash();
  const refs = imageRef(args, hash);
  const image = args.image || refs.shaImage;
  assertNoSecretNamesInImage(image);

  const name = `traders-bff-smoke-${Date.now()}`;
  try {
    run("docker", [
      "run",
      "-d",
      "--name",
      name,
      "-e",
      "ML_ENGINE_URL=http://127.0.0.1:8001",
      image,
    ]);
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      const result = spawnSync("docker", ["exec", name, "wget", "-qO-", "http://127.0.0.1:8788/health"], {
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
      if (
        result.status === 0 &&
        (/"ok"\s*:\s*true/.test(result.stdout) ||
          /"status"\s*:\s*"ok"/.test(result.stdout))
      ) {
        console.log(`BFF smoke passed for ${image}`);
        return;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
    }
    run("docker", ["logs", name]);
    throw new Error(`BFF smoke did not pass for ${image}`);
  } finally {
    spawnSync("docker", ["rm", "-f", name], { cwd: repoRoot, stdio: "ignore" });
  }
}

const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

try {
  if (command === "hash") handleHash(args);
  else if (command === "build") handleBuild(args);
  else if (command === "smoke") handleSmoke(args);
  else {
    throw new Error("Usage: node scripts/images/bff-image.mjs <hash|build|smoke> [--owner OWNER] [--tag TAG] [--image IMAGE] [--json]");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
