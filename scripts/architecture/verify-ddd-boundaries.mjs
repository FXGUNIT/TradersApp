import { promises as fs } from "node:fs";
import { resolve, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");

const MANIFEST_PATH = resolve(REPO_ROOT, "architecture", "ddd", "bounded-contexts.json");
const BFF_PATH = resolve(REPO_ROOT, "bff");
const DOMAINS_PATH = resolve(BFF_PATH, "domains");
const SERVICES_PATH = resolve(BFF_PATH, "services");
const ROUTES_PATH = resolve(BFF_PATH, "routes");

const IMPORT_RE = /^\s*import\s+[^'"]*['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT_RE = /import\(\s*['"]([^'"]+)['"]\s*\)/gm;

function asPosix(pathValue) {
  return normalize(pathValue).replace(/\\/g, "/");
}

async function pathExists(pathValue) {
  try {
    await fs.access(pathValue);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursive(rootDir) {
  const stack = [rootDir];
  const files = [];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const abs = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") {
          continue;
        }
        stack.push(abs);
        continue;
      }
      if (extname(entry.name) === ".mjs") {
        files.push(abs);
      }
    }
  }

  return files;
}

function extractImportSpecifiers(source) {
  const specs = [];
  for (const re of [IMPORT_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source)) !== null) {
      specs.push(match[1]);
    }
  }
  return specs;
}

function isRelativeSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/");
}

function classifyBffPath(pathValue) {
  const normalized = asPosix(pathValue);
  if (normalized.includes("/bff/domains/")) return "domains";
  if (normalized.includes("/bff/services/")) return "services";
  if (normalized.includes("/bff/routes/")) return "routes";
  return "other";
}

async function verifyManifestPaths() {
  const raw = await fs.readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(raw);
  const missing = [];

  for (const context of manifest.contexts || []) {
    for (const relPath of context.owned_paths || []) {
      const absPath = resolve(REPO_ROOT, relPath);
      if (!(await pathExists(absPath))) {
        missing.push(`${context.name}: ${relPath}`);
      }
    }
  }

  return missing;
}

async function verifyBffLayering() {
  const files = [
    ...(await listFilesRecursive(DOMAINS_PATH)),
    ...(await listFilesRecursive(SERVICES_PATH)),
    ...(await listFilesRecursive(ROUTES_PATH)),
  ];

  const violations = [];

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    const fileLayer = classifyBffPath(file);
    const specifiers = extractImportSpecifiers(source).filter(isRelativeSpecifier);

    for (const specifier of specifiers) {
      const importedAbs = resolve(dirname(file), specifier);
      const importedLayer = classifyBffPath(importedAbs);

      if (fileLayer === "domains" && (importedLayer === "services" || importedLayer === "routes")) {
        violations.push(
          `${asPosix(file)} imports ${specifier} (${importedLayer})`,
        );
      }
      if (fileLayer === "services" && importedLayer === "routes") {
        violations.push(
          `${asPosix(file)} imports ${specifier} (${importedLayer})`,
        );
      }
    }
  }

  return violations;
}

async function main() {
  const missingManifestPaths = await verifyManifestPaths();
  const layeringViolations = await verifyBffLayering();

  if (missingManifestPaths.length === 0 && layeringViolations.length === 0) {
    console.log("DDD boundary verification passed.");
    return;
  }

  if (missingManifestPaths.length > 0) {
    console.error("Missing bounded-context owned paths:");
    for (const entry of missingManifestPaths) {
      console.error(`  - ${entry}`);
    }
  }

  if (layeringViolations.length > 0) {
    console.error("BFF layering violations:");
    for (const entry of layeringViolations) {
      console.error(`  - ${entry}`);
    }
  }

  process.exit(1);
}

main().catch((error) => {
  console.error("DDD boundary verification failed unexpectedly:");
  console.error(error);
  process.exit(1);
});

