import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const outDir = resolve(repoRoot, "dist", "desktop-web");

mkdirSync(outDir, { recursive: true });

const env = {
  ...process.env,
  VITE_DESKTOP_BUILD: "true",
  VITE_BFF_URL:
    process.env.DESKTOP_BFF_URL ||
    process.env.VITE_BFF_URL ||
    "https://bff.traders.app",
  VITE_APP_VERSION:
    process.env.DESKTOP_APP_VERSION ||
    process.env.VITE_APP_VERSION ||
    process.env.npm_package_version ||
    "0.0.0-dev",
};

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(
  npxCommand,
  ["vite", "build", "--outDir", outDir],
  {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
