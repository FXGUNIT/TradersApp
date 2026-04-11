import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");

async function readRepoFile(relativePath) {
  return fs.readFile(resolve(REPO_ROOT, relativePath), "utf8");
}

function collectPatternFailures(relativePath, source, checks) {
  const failures = [];

  for (const check of checks.required ?? []) {
    if (!check.pattern.test(source)) {
      failures.push(`${relativePath}: missing ${check.label}`);
    }
  }

  for (const check of checks.forbidden ?? []) {
    if (check.pattern.test(source)) {
      failures.push(`${relativePath}: contains forbidden ${check.label}`);
    }
  }

  return failures;
}

async function main() {
  const failures = [];

  const docChecks = [
    {
      path: "docs/index.md",
      required: [
        { label: "Current Runtime Truth section", pattern: /## Current Runtime Truth/ },
        { label: "HTTP /predict runtime note", pattern: /HTTP `\/predict`/ },
        { label: "mixed delivery wording", pattern: /described as mixed/i },
        { label: "current SLA baseline", pattern: /<200ms P95/ },
      ],
    },
    {
      path: "docs/BOUNDED_CONTEXTS.md",
      required: [
        { label: "non-canonical service warning section", pattern: /## What Is Not Canonical Today/ },
        { label: "logical-only context wording", pattern: /Logical only/ },
        { label: "HTTP /predict boundary note", pattern: /HTTP `\/predict`/ },
      ],
    },
    {
      path: "docs/DDD_MICROSERVICES.md",
      required: [
        { label: "HTTP /predict seam wording", pattern: /HTTP `\/predict`/ },
        { label: "mixed deployment wording", pattern: /mixed rather than purely self-hosted/ },
      ],
    },
    {
      path: "ARCHITECTURE.html",
      required: [
        { label: "mixed delivery summary", pattern: /Delivery is mixed:/ },
        { label: "HTTP /predict html edge note", pattern: /HTTP <code>\/predict<\/code>/ },
        { label: "Legacy PNG label", pattern: /Legacy PNG/ },
      ],
      forbidden: [
        { label: "old self-hosted-ops stance", pattern: /self-hosted ops/i },
      ],
    },
    {
      path: "proto/ddd/v1/analysis.proto",
      forbidden: [
        { label: "fictional portfolio-service consumer", pattern: /portfolio-service/i },
      ],
    },
  ];

  for (const entry of docChecks) {
    const source = await readRepoFile(entry.path);
    failures.push(...collectPatternFailures(entry.path, source, entry));
  }

  const svgPaths = [
    "docs/assets/architecture-3d-overview.svg",
    "docs/assets/architecture-3d-overview-print.svg",
    "docs/assets/architecture-system-design-board.svg",
    "docs/assets/architecture-system-design-board-print.svg",
    "docs/assets/architecture-5w1h-map.svg",
    "docs/assets/architecture-5w1h-map-print.svg",
    "docs/assets/architecture-birdview-roadmap.svg",
    "docs/assets/architecture-birdview-roadmap-print.svg",
  ];

  const forbiddenSvgPatterns = [
    { label: "stale 50ms SLA wording", pattern: /\b50ms\b/i },
    { label: "self-hosted release path claim", pattern: /current self-hosted release path/i },
    { label: "blanket already-live observability claim", pattern: /already live across the platform/i },
    { label: "stale strict-gRPC roadmap wording", pattern: /Keep the gRPC seam strict/i },
  ];

  for (const relativePath of svgPaths) {
    const source = await readRepoFile(relativePath);
    failures.push(
      ...collectPatternFailures(relativePath, source, {
        forbidden: forbiddenSvgPatterns,
      }),
    );
  }

  if (failures.length === 0) {
    console.log("Architecture documentation verification passed.");
    return;
  }

  console.error("Architecture documentation verification failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error("Architecture documentation verification failed unexpectedly:");
  console.error(error);
  process.exit(1);
});
