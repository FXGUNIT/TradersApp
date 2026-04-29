#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const AUDIT_MODE_KEY = "TradersApp_AuditMode";
const DEFAULT_LIVE_URL = "https://tradergunit.pages.dev/";
const DEFAULT_OUTPUT_DIR = path.join(
  ROOT,
  "output",
  "playwright",
  "website-user-audit",
);
const VIEWPORTS = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844, isMobile: true },
};

const DEFAULT_SCENARIOS = [
  "login",
  "signup",
  "waiting",
  "hub",
  "app",
  "support-chat",
  "consciousness",
  "sessions",
  "admin",
  "viewport-mobile",
  "viewport-tablet",
  "viewport-desktop",
];

function parseArgs(argv) {
  const args = {
    baseUrl:
      process.env.WEBSITE_AUDIT_BASE_URL ||
      process.env.PLAYWRIGHT_BASE_URL ||
      "http://127.0.0.1:5173",
    target: process.env.WEBSITE_AUDIT_TARGET || "local",
    outputDir: process.env.WEBSITE_AUDIT_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
    commit: process.env.GITHUB_SHA || "",
    headless: process.env.WEBSITE_AUDIT_HEADLESS !== "false",
    timeoutMs: Number(process.env.WEBSITE_AUDIT_TIMEOUT_MS || 45_000),
    scenarios: DEFAULT_SCENARIOS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--base-url" || key === "--url") {
      args.baseUrl = value;
      index += 1;
    } else if (key === "--target") {
      args.target = value;
      index += 1;
    } else if (key === "--output-dir") {
      args.outputDir = value;
      index += 1;
    } else if (key === "--commit") {
      args.commit = value;
      index += 1;
    } else if (key === "--scenarios") {
      args.scenarios = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
    } else if (key === "--live") {
      args.baseUrl = DEFAULT_LIVE_URL;
      args.target = "live";
    } else if (key === "--headed") {
      args.headless = false;
    } else if (key === "--timeout-ms") {
      args.timeoutMs = Number(value);
      index += 1;
    }
  }

  args.baseUrl = normalizeBaseUrl(args.baseUrl);
  args.outputDir = path.resolve(args.outputDir);
  return args;
}

function normalizeBaseUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return DEFAULT_LIVE_URL;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function toRelative(filePath) {
  if (!filePath) return "";
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function redact(value) {
  return String(value ?? "")
    .replace(/gh[pousr]_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/gsk_[A-Za-z0-9_-]{20,}/g, "[REDACTED_GROQ_KEY]")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(
      /\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}\b/g,
      "[REDACTED_UUID]",
    )
    .replace(
      /((?:api[_-]?key|token|password|secret|access_token)=)[^&\s"']+/gi,
      "$1[REDACTED]",
    )
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]");
}

function sanitizeForReport(value) {
  if (Array.isArray(value)) return value.map(sanitizeForReport);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeForReport(item)]),
    );
  }
  if (typeof value === "string") return redact(value);
  return value;
}

function collapse(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sameOrigin(url, baseUrl) {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

function isBenignConsoleError(text) {
  const line = String(text || "");
  return [
    "favicon",
    "downloadable font",
    "ResizeObserver loop",
    "ERR_ABORTED",
    "ERR_BLOCKED_BY_CLIENT",
    "BFF unavailable",
    "Failed to notify support webhook",
    "Telegram notification failed",
  ].some((needle) => line.includes(needle));
}

function isBenignNetworkFailure(entry, baseUrl) {
  const url = entry.url || "";
  if (url.includes("favicon")) return true;
  if (url.includes("fonts.gstatic.com") || url.includes("fonts.googleapis.com")) {
    return true;
  }
  if (entry.method && !["GET", "HEAD"].includes(entry.method)) return true;
  return !sameOrigin(url, baseUrl);
}

async function installAuditRuntimeGuards(page, baseUrl) {
  await page.addInitScript((auditModeKey) => {
    window.__TRADERS_UI_AUDIT__ = true;
    try {
      localStorage.setItem(auditModeKey, "true");
    } catch {
      // Audit mode should not fail just because storage is restricted.
    }
  }, AUDIT_MODE_KEY);

  await page.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = request.url();

    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
      !sameOrigin(url, baseUrl)
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, mocked: true, audit: true }),
      });
      return;
    }

    if (
      url.includes("/support/") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(method)
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, mocked: true, audit: true }),
      });
      return;
    }

    await route.continue();
  });
}

async function waitForHarness(page, timeoutMs) {
  await page.waitForFunction(
    () => Boolean(window.__TradersAppAudit?.loadScenario),
    null,
    { timeout: timeoutMs },
  );
}

async function gotoAuditApp(page, baseUrl, timeoutMs) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await waitForHarness(page, timeoutMs);
}

async function loadScenario(page, scenarioName) {
  await page.evaluate((name) => {
    window.__TradersAppAudit.loadScenario(name);
  }, scenarioName);
  await page.waitForTimeout(450);
}

async function assertPageAlive(page) {
  await page.locator("body").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("#root").waitFor({ state: "attached", timeout: 10_000 });
  const rootTextLength = await page.locator("#root").evaluate((node) =>
    (node.textContent || "").replace(/\s+/g, " ").trim().length,
  );
  if (rootTextLength < 20) {
    throw new Error(`Root content is too small (${rootTextLength} chars).`);
  }
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  );
  if (overflow > 4) {
    throw new Error(`Horizontal overflow detected (${overflow}px).`);
  }
}

async function assertText(page, pattern, description) {
  const locator = page.getByText(pattern, { exact: false }).first();
  await locator.waitFor({ state: "visible", timeout: 10_000 });
  return description;
}

async function assertVisible(locator, description) {
  await locator.first().waitFor({ state: "visible", timeout: 10_000 });
  return description;
}

async function assertClickable(locator, description) {
  const target = locator.first();
  await target.waitFor({ state: "visible", timeout: 10_000 });
  await target.click({ trial: true, timeout: 5_000 });
  return description;
}

async function assertInputReady(locator, description) {
  const target = locator.first();
  await target.waitFor({ state: "visible", timeout: 10_000 });
  const disabled = await target.isDisabled().catch(() => false);
  if (disabled) throw new Error(`${description} is disabled.`);
  return description;
}

async function runLogin(page) {
  await loadScenario(page, "login");
  await assertText(page, /welcome back/i, "Login screen rendered.");
  await assertInputReady(page.locator("input[type='email']"), "Email input");
  await assertInputReady(page.locator("input[type='password']"), "Password input");
  await assertClickable(
    page.getByRole("button", { name: /^continue$/i }),
    "Continue button",
  );
  await assertClickable(
    page.getByRole("button", { name: /new user\? apply/i }),
    "Signup entry button",
  );
}

async function runSignup(page) {
  await loadScenario(page, "signup");
  await assertText(page, /apply to join traders regiment/i, "Signup screen rendered.");
  await assertInputReady(page.locator("input").nth(0), "Signup name input");
  await assertInputReady(page.locator("input").nth(1), "Signup email input");
  await assertClickable(
    page.getByRole("button", { name: /back to login/i }),
    "Back to login button",
  );
}

async function runWaiting(page) {
  await loadScenario(page, "waiting");
  await assertText(page, /application under review/i, "Waiting room rendered.");
  await assertClickable(
    page.getByRole("button", { name: /check approval status/i }),
    "Check approval status button",
  );
  await assertVisible(
    page.getByRole("button", { name: /logout/i }),
    "Waiting room logout button",
  );
}

async function runHub(page) {
  await loadScenario(page, "hub");
  await assertText(page, /traders regiment/i, "Hub rendered.");
  await assertClickable(page.getByText(/trading terminal/i), "Trading terminal card");
  await assertClickable(
    page.getByText(/collective consciousness/i),
    "Collective Consciousness card",
  );
}

async function runApp(page) {
  await loadScenario(page, "app");
  await assertText(page, /execution workspace/i, "Terminal rendered.");
  await assertVisible(
    page.locator("[data-testid='terminal-screenshot-dropzone']"),
    "Screenshot upload dropzone",
  );
  await assertClickable(page.getByRole("button", { name: /^journal$/i }), "Journal tab");
  await assertClickable(page.getByRole("button", { name: /^account$/i }), "Account tab");
}

async function runSupportChat(page) {
  await loadScenario(page, "hub");
  const launcher = page
    .getByRole("button", { name: /open support chat|support chat/i })
    .first();
  await assertClickable(launcher, "Support chat launcher");
  await launcher.click();
  await assertText(page, /tradersapp support/i, "Support panel header");
  await assertText(page, /before we start/i, "Support pre-chat form");
  await page.getByPlaceholder("Your Full Name").fill("Audit Trader");
  await page.getByPlaceholder("Mobile Number").fill("+10000000000");
  await page.getByRole("button", { name: /start chat/i }).click();
  await assertText(page, /how can i help you today/i, "Support welcome message");
  await assertInputReady(
    page.getByPlaceholder("Type your message..."),
    "Support message input",
  );
}

async function runConsciousness(page) {
  await loadScenario(page, "consciousness");
  await assertText(page, /collective consciousness/i, "Consciousness screen rendered.");
  await assertVisible(
    page.getByRole("button", { name: /back to hub/i }),
    "Back to Hub button",
  );
}

async function runSessions(page) {
  await loadScenario(page, "sessions");
  await assertText(page, /active sessions|session/i, "Sessions screen rendered.");
  await assertVisible(
    page.getByRole("button", { name: /back to dashboard/i }),
    "Back to dashboard button",
  );
  await assertVisible(
    page.getByRole("button", { name: /logout all other devices/i }),
    "Logout all other devices button",
  );
}

async function runAdmin(page) {
  await loadScenario(page, "admin");
  await assertText(page, /master admin dashboard/i, "Admin fixture dashboard rendered.");
  await assertVisible(
    page.getByRole("button", { name: /board room/i }),
    "Board Room tab",
  );
  await assertVisible(
    page.getByRole("button", { name: /user control/i }),
    "User Control tab",
  );
}

async function runViewport(page, viewportName) {
  await loadScenario(page, "hub");
  await assertText(page, /traders regiment/i, `${viewportName} hub rendered.`);
  await assertNoHorizontalOverflow(page);
}

const SCENARIO_RUNNERS = {
  login: { viewport: "desktop", run: runLogin },
  signup: { viewport: "desktop", run: runSignup },
  waiting: { viewport: "desktop", run: runWaiting },
  hub: { viewport: "desktop", run: runHub },
  app: { viewport: "desktop", run: runApp },
  "support-chat": { viewport: "desktop", run: runSupportChat },
  consciousness: { viewport: "desktop", run: runConsciousness },
  sessions: { viewport: "desktop", run: runSessions },
  admin: { viewport: "desktop", run: runAdmin },
  "viewport-mobile": { viewport: "mobile", run: (page) => runViewport(page, "Mobile") },
  "viewport-tablet": { viewport: "tablet", run: (page) => runViewport(page, "Tablet") },
  "viewport-desktop": { viewport: "desktop", run: (page) => runViewport(page, "Desktop") },
};

async function runScenario(browser, args, scenarioId, dirs) {
  const runner = SCENARIO_RUNNERS[scenarioId];
  if (!runner) {
    return {
      id: scenarioId,
      status: "failed",
      durationMs: 0,
      errors: [`Unknown website audit scenario: ${scenarioId}`],
      consoleErrors: [],
      networkFailures: [],
      screenshotPath: "",
      tracePath: "",
    };
  }

  const started = Date.now();
  const context = await browser.newContext({
    viewport: VIEWPORTS[runner.viewport] || VIEWPORTS.desktop,
    ignoreHTTPSErrors: true,
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const page = await context.newPage();
  const consoleErrors = [];
  const networkFailures = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    consoleErrors.push(
      sanitizeForReport({
        type: message.type(),
        text: collapse(message.text()),
        location: message.location(),
      }),
    );
  });

  page.on("pageerror", (error) => {
    pageErrors.push(redact(error?.stack || error?.message || error));
  });

  page.on("requestfailed", (request) => {
    networkFailures.push(
      sanitizeForReport({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        failure: request.failure()?.errorText || "",
      }),
    );
  });

  let screenshotPath = "";
  let tracePath = "";
  const errors = [];

  try {
    await installAuditRuntimeGuards(page, args.baseUrl);
    await gotoAuditApp(page, args.baseUrl, args.timeoutMs);
    await runner.run(page);
    await assertPageAlive(page);
    await assertNoHorizontalOverflow(page);

    const fatalConsoleErrors = consoleErrors.filter(
      (entry) => entry.type === "error" && !isBenignConsoleError(entry.text),
    );
    const fatalNetworkFailures = networkFailures.filter(
      (entry) => !isBenignNetworkFailure(entry, args.baseUrl),
    );

    if (pageErrors.length > 0) {
      errors.push(...pageErrors.map((entry) => `Page error: ${entry}`));
    }
    if (fatalConsoleErrors.length > 0) {
      errors.push(
        ...fatalConsoleErrors.map((entry) => `Console error: ${entry.text}`),
      );
    }
    if (fatalNetworkFailures.length > 0) {
      errors.push(
        ...fatalNetworkFailures.map(
          (entry) => `Network failure: ${entry.method} ${entry.url}`,
        ),
      );
    }
  } catch (error) {
    errors.push(redact(error?.stack || error?.message || error));
  }

  const status = errors.length > 0 ? "failed" : "passed";

  if (status === "failed") {
    const screenshotFile = path.join(dirs.screenshots, `${scenarioId}.png`);
    const traceFile = path.join(dirs.traces, `${scenarioId}.zip`);
    await page.screenshot({ path: screenshotFile, fullPage: true }).catch(() => {});
    await context.tracing.stop({ path: traceFile }).catch(() => {});
    screenshotPath = toRelative(screenshotFile);
    tracePath = toRelative(traceFile);
  } else {
    await context.tracing.stop().catch(() => {});
  }

  await context.close().catch(() => {});

  return {
    id: scenarioId,
    status,
    durationMs: Date.now() - started,
    errors: sanitizeForReport(errors),
    consoleErrors: sanitizeForReport(consoleErrors),
    networkFailures: sanitizeForReport(networkFailures),
    screenshotPath,
    tracePath,
  };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writeHtmlReport(report, outputPath) {
  const rows = report.scenarios
    .map(
      (scenario) => `<tr>
        <td>${htmlEscape(scenario.id)}</td>
        <td class="${scenario.status}">${htmlEscape(scenario.status)}</td>
        <td>${scenario.durationMs}</td>
        <td>${htmlEscape(scenario.errors.join("\n"))}</td>
        <td>${htmlEscape(scenario.screenshotPath)}</td>
        <td>${htmlEscape(scenario.tracePath)}</td>
      </tr>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Website User Audit</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 32px; color: #111827; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }
      th { background: #f3f4f6; text-align: left; }
      .passed { color: #047857; font-weight: 700; }
      .failed { color: #b91c1c; font-weight: 700; }
      pre { white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h1>Website User Audit</h1>
    <p><strong>Status:</strong> ${report.ok ? "passed" : "failed"}</p>
    <p><strong>Target:</strong> ${htmlEscape(report.target)}</p>
    <p><strong>Base URL:</strong> ${htmlEscape(report.baseUrl)}</p>
    <p><strong>Commit:</strong> ${htmlEscape(report.commit || "unknown")}</p>
    <table>
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Status</th>
          <th>Duration ms</th>
          <th>Errors</th>
          <th>Screenshot</th>
          <th>Trace</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>
`;
  fs.writeFileSync(outputPath, html, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dirs = {
    output: args.outputDir,
    screenshots: path.join(args.outputDir, "screenshots"),
    traces: path.join(args.outputDir, "traces"),
    html: path.join(args.outputDir, "html-report"),
  };
  Object.values(dirs).forEach(ensureDir);

  const report = {
    ok: false,
    target: args.target,
    baseUrl: args.baseUrl,
    commit: args.commit,
    startedAt: new Date().toISOString(),
    scenarios: [],
  };

  const browser = await chromium.launch({ headless: args.headless });

  try {
    for (const scenarioId of args.scenarios) {
      const result = await runScenario(browser, args, scenarioId, dirs);
      report.scenarios.push(result);
      console.log(
        `[website-audit] ${result.status.toUpperCase()} ${scenarioId} (${result.durationMs}ms)`,
      );
    }
  } finally {
    await browser.close().catch(() => {});
  }

  report.finishedAt = new Date().toISOString();
  report.ok = report.scenarios.every((scenario) => scenario.status === "passed");
  report.summary = {
    passed: report.scenarios.filter((scenario) => scenario.status === "passed").length,
    failed: report.scenarios.filter((scenario) => scenario.status === "failed").length,
    total: report.scenarios.length,
  };

  const reportPath = path.join(args.outputDir, "website-user-audit-report.json");
  const htmlPath = path.join(dirs.html, "index.html");
  fs.writeFileSync(reportPath, `${JSON.stringify(sanitizeForReport(report), null, 2)}\n`);
  writeHtmlReport(sanitizeForReport(report), htmlPath);

  console.log(`[website-audit] report: ${toRelative(reportPath)}`);
  console.log(`[website-audit] html: ${toRelative(htmlPath)}`);

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(redact(error?.stack || error?.message || error));
  process.exit(1);
});
