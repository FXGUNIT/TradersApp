import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const outDir = resolve(repoRoot, "dist", "desktop-web");

mkdirSync(outDir, { recursive: true });

function normalizeHttpsUrl(value) {
  if (!value) {
    return "";
  }

  const trimmed = String(value).trim().replace(/\/$/, "");
  if (!trimmed) {
    return "";
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const env = {
  ...process.env,
  VITE_DESKTOP_BUILD: "true",
  VITE_BFF_URL:
    normalizeHttpsUrl(process.env.DESKTOP_BFF_URL) ||
    normalizeHttpsUrl(process.env.BFF_PUBLIC_HOST) ||
    process.env.VITE_BFF_URL ||
    "https://bff.173.249.18.14.sslip.io",
  VITE_APP_VERSION:
    process.env.DESKTOP_APP_VERSION ||
    process.env.VITE_APP_VERSION ||
    process.env.npm_package_version ||
    "0.0.0-dev",
};

Object.assign(process.env, env);

await build({
  configFile: resolve(repoRoot, "vite.config.js"),
  root: repoRoot,
  envFile: false,
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
  },
});
