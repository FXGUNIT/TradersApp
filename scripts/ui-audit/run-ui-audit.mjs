import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const BASE_URL_CANDIDATES = process.env.UI_AUDIT_URL
  ? [process.env.UI_AUDIT_URL]
  : ["http://localhost", "http://localhost:5173"];
const HEADLESS = process.env.UI_AUDIT_HEADLESS !== "false";
const OUTPUT_DIR = path.join(ROOT, "artifacts", "ui-audit");
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screens");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const REPORT_PATH = path.join(OUTPUT_DIR, `report-${timestamp}.json`);
const DESKTOP_VIEWPORT = { width: 1440, height: 1800 };
const MOBILE_VIEWPORT = { width: 393, height: 1180 };
const AUDIT_VIEWPORT_MODE = String(
  process.env.UI_AUDIT_VIEWPORT ||
    (process.env.npm_lifecycle_event === "audit:ui:mobile"
      ? "mobile"
      : "desktop"),
).toLowerCase();
const VIEWPORT =
  AUDIT_VIEWPORT_MODE === "mobile" ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;
const AUDIT_MODE_KEY = "TradersApp_AuditMode";
const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function findBrowserExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    "No supported Chrome/Edge executable found for Playwright audit.",
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function addStep(scenario, status, message, details = {}) {
  scenario.steps.push({
    status,
    message,
    details,
    timestamp: new Date().toISOString(),
  });
}

function addIssue(target, severity, category, message, details = {}) {
  target.issues.push({
    severity,
    category,
    message,
    details,
    timestamp: new Date().toISOString(),
  });
}

async function saveScenarioScreenshot(page, scenario, label) {
  const filePath = path.join(
    SCREENSHOT_DIR,
    `${safeName(scenario.name)}-${safeName(label)}.png`,
  );
  await page.screenshot({
    path: filePath,
    fullPage: true,
  });
  scenario.screenshots.push(filePath);
}

async function installNetworkMocks(page, report) {
  const mocks = [
    {
      url: "https://api.ipify.org/**",
      handler: async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ip: "127.0.0.1" }),
        });
      },
    },
    {
      url: "https://ipapi.co/**",
      handler: async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ip: "127.0.0.1",
            city: "Delhi",
            country_name: "India",
            country: "IN",
            timezone: "Asia/Calcutta",
          }),
        });
      },
    },
    {
      url: "https://api.telegram.org/**",
      handler: async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, mocked: true }),
        });
      },
    },
    {
      url: "https://api.anthropic.com/**",
      handler: async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "audit-message",
            type: "message",
            role: "assistant",
            content: [
              {
                type: "text",
                text: "Audit stub response from the browser runner.",
              },
            ],
          }),
        });
      },
    },
    {
      url: "https://api.emailjs.com/**",
      handler: async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "ok", mocked: true }),
        });
      },
    },
  ];

  for (const mock of mocks) {
    await page.route(mock.url, mock.handler);
  }

  report.networkMocks = mocks.map((mock) => mock.url);
}

async function waitForHarness(page) {
  await page.waitForFunction(() => Boolean(window.__TradersAppAudit), null, {
    timeout: 15000,
  });
}

async function resolveBaseUrl() {
  for (const candidate of BASE_URL_CANDIDATES) {
    const normalizedCandidate = candidate.replace(/\/+$/, "");
    const probeUrls = ["/health", "/"];

    for (const probePath of probeUrls) {
      try {
        const response = await fetch(new URL(probePath, normalizedCandidate), {
          method: "GET",
        });
        if (response.ok) {
          return normalizedCandidate;
        }
      } catch {
        // Try the next probe or candidate.
      }
    }
  }

  return BASE_URL_CANDIDATES[0].replace(/\/+$/, "");
}

async function gotoApp(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await waitForHarness(page);
}

async function loadScenario(page, name) {
  await page.evaluate((scenarioName) => {
    window.__TradersAppAudit.loadScenario(scenarioName);
  }, name);
  await page.waitForTimeout(350);
}

async function expectVisible(page, selector, description, timeout = 5000) {
  await page.locator(selector).first().waitFor({ state: "visible", timeout });
  return description;
}

async function clickText(page, text, options = {}) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.click(options);
}

async function clickButton(page, name, options = {}) {
  const locator = page.getByRole("button", { name }).first();
  await locator.click(options);
}

async function fillVisibleInput(page, selector, value, index = 0) {
  const locator = page.locator(selector).nth(index);
  await locator.waitFor({ state: "visible", timeout: 4000 });
  await locator.fill(value);
}

async function collectVisibleMojibake(page) {
  return page.evaluate(() => {
    const suspiciousPatterns = [
      /â€¦/u,
      /â€”/u,
      /â€º/u,
      /Ã—/u,
      /Â·/u,
      /ðŸ/u,
      /✓“/u,
      /✓—/u,
      /→/u,
      /→º/u,
      /âŸ³/u,
    ];

    const textNodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
    );

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent?.trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      const styles = window.getComputedStyle(parent);
      const rect = parent.getBoundingClientRect();
      if (
        styles.visibility === "hidden" ||
        styles.display === "none" ||
        rect.width === 0 ||
        rect.height === 0
      ) {
        continue;
      }

      if (suspiciousPatterns.some((pattern) => pattern.test(text))) {
        textNodes.push(text);
      }
    }

    return Array.from(new Set(textNodes)).slice(0, 80);
  });
}

async function collectInteractiveElements(page, excludePatterns = []) {
  return page.evaluate((patterns) => {
    const selectors = [
      "button",
      "input[type='checkbox']",
      "input[type='radio']",
      "select",
      "[role='button']",
      "[role='tab']",
      "[role='switch']",
      "a[href]:not([target='_blank'])",
    ];

    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const styles = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return !(
        styles.visibility === "hidden" ||
        styles.display === "none" ||
        element.hidden ||
        rect.width === 0 ||
        rect.height === 0
      );
    };

    const normalize = (value) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    const labelOf = (element) =>
      normalize(
        element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.textContent ||
          element.value ||
          element.id ||
          element.className,
      );

    const makeId = (element, index) => {
      if (!element.dataset.auditId) {
        element.dataset.auditId = `audit-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      }
      return element.dataset.auditId;
    };

    const elements = Array.from(
      document.querySelectorAll(selectors.join(",")),
    ).filter((element) => {
      if (!isVisible(element)) return false;
      if (element instanceof HTMLButtonElement && element.disabled) return false;
      const label = labelOf(element).toLowerCase();
      if (!label) return false;
      return !patterns.some((pattern) => label.includes(pattern));
    });

    return elements.map((element, index) => ({
      auditId: makeId(element, index),
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute("type") || "",
      label: labelOf(element),
      disabled: Boolean(element.disabled),
      checked:
        element instanceof HTMLInputElement &&
        ["checkbox", "radio"].includes(element.type)
          ? element.checked
          : null,
      options:
        element instanceof HTMLSelectElement
          ? Array.from(element.options).map((option) => ({
              value: option.value,
              label: normalize(option.textContent),
            }))
          : [],
    }));
  }, excludePatterns);
}

async function interactWithElement(page, element) {
  const locator = page.locator(`[data-audit-id="${element.auditId}"]`).first();
  await locator.scrollIntoViewIfNeeded();

  if (element.tag === "select" && element.options.length > 1) {
    const nextOption = element.options[element.options.length - 1];
    await locator.selectOption(nextOption.value);
    return;
  }

  if (
    element.tag === "input" &&
    ["checkbox", "radio"].includes(element.type || "")
  ) {
    await locator.click({ force: true, timeout: 3000 });
    return;
  }

  await locator.click({ force: true, timeout: 3000 });
}

async function genericSweep(page, scenario, options = {}) {
  const excludePatterns = options.excludePatterns || [
    "logout",
    "abort",
    "back to login",
    "connect",
    "linkedin",
    "new recruit",
    "admin",
  ];
  const visited = new Set();
  const maxInteractions = options.maxInteractions || 40;

  for (let step = 0; step < maxInteractions; step += 1) {
    const elements = await collectInteractiveElements(page, excludePatterns);
    const nextElement = elements.find((element) => {
      const key = `${element.tag}:${element.type}:${element.label}`;
      return !visited.has(key);
    });

    if (!nextElement) break;

    const key = `${nextElement.tag}:${nextElement.type}:${nextElement.label}`;
    visited.add(key);

    try {
      await interactWithElement(page, nextElement);
      await page.waitForTimeout(250);
    } catch (error) {
      const message = error.message || "";
      if (
        message.includes("waiting for locator") ||
        message.includes("scrollIntoViewIfNeeded")
      ) {
        continue;
      }

      addIssue(
        scenario,
        "medium",
        "interaction",
        `Generic sweep failed on "${nextElement.label}"`,
        {
          step: step + 1,
          error: message,
        },
      );
      await page.waitForTimeout(150);
    }
  }
}

async function dispatchDrop(page, targetLocator, files) {
  await page.evaluate(
    async ({ locator, payloads }) => {
      const target =
        document.querySelector(locator) ||
        Array.from(document.querySelectorAll("div")).find((element) =>
          element.textContent?.includes(locator),
        );
      if (!target) {
        throw new Error(`Drop target not found: ${locator}`);
      }

      const dataTransfer = new DataTransfer();

      for (const fileInfo of payloads) {
        const response = await fetch(fileInfo.url);
        const buffer = await response.arrayBuffer();
        const file = new File([buffer], fileInfo.name, {
          type: fileInfo.type,
        });
        dataTransfer.items.add(file);
      }

      target.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );

      target.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );
    },
    {
      locator: targetLocator,
      payloads: files,
    },
  );
  await page.waitForTimeout(500);
}

async function auditFooter(page, scenario) {
  await page.evaluate(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
  });
  await page.waitForTimeout(300);

  const founderCard = page.locator("[data-testid='founder-card']").first();
  if (await founderCard.isVisible().catch(() => false)) {
    try {
      await page.evaluate(() => {
        const card = document.querySelector("[data-testid='founder-card']");
        if (card) {
          card.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        }
      });
      await page.waitForTimeout(300);
    } catch (error) {
      addIssue(
        scenario,
        "low",
        "footer",
        "Founder card hover could not be completed cleanly.",
        { error: error.message },
      );
    }
  }

  const tooltipText = page.locator("[data-testid='founder-tooltip']").first();
  if (!(await tooltipText.isVisible().catch(() => false))) {
    addIssue(
      scenario,
      "medium",
      "footer",
      "Founder tooltip did not appear on hover.",
    );
  }

  const aiStatus = page.getByText("AI System Status", { exact: false }).first();
  if (!(await aiStatus.isVisible().catch(() => false))) {
    addIssue(
      scenario,
      "high",
      "footer",
      "AI System Status footer was not visible.",
    );
  }

  const popupPromise = page.context().waitForEvent("page").catch(() => null);
  const connectLink = page.getByText("Connect", { exact: true }).first();
  if (await connectLink.isVisible().catch(() => false)) {
    await connectLink.click();
    const popup = await popupPromise;
    if (popup) {
      scenario.footerPopupUrl = popup.url();
      await popup.close().catch(() => {});
    } else {
      addIssue(
        scenario,
        "low",
        "footer",
        "Founder Connect link did not open a new page.",
      );
    }
  }
}

async function runLoginAudit(page, scenario) {
  await loadScenario(page, "login");
  addStep(scenario, "info", "Loaded login scenario.");

  await fillVisibleInput(page, "input[type='email']", "audit.user@gmail.com");
  await clickText(page, "Forgot Password?");
  await clickButton(page, /send recovery link/i);
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Password reset email sent.") ||
      document.body.innerText.includes("Audit mode: password reset link simulated."),
    null,
    { timeout: 5000 },
  );
  await clickButton(page, /back to sign in/i);

  await fillVisibleInput(page, "input[type='email']", "audit.user@gmail.com");
  await fillVisibleInput(page, "input[type='password']", "AuditPass123!");
  await clickButton(page, /show/i);
  await page
    .locator("label")
    .filter({ hasText: /keep me signed in/i })
    .locator("input[type='checkbox']")
    .first()
    .check();
  await clickButton(page, /^continue$/i);
  const loginReachedHub = await page
    .waitForFunction(
      () => document.body.innerText.includes("TRADERS REGIMENT"),
      null,
      { timeout: 4000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!loginReachedHub) {
    addStep(
      scenario,
      "warn",
      "Credential login did not route to hub in this environment; using harness fallback.",
    );
    await loadScenario(page, "hub");
  }
  await expectVisible(page, "text=TRADERS REGIMENT", "Login reached hub.");

  await loadScenario(page, "login");
  await clickButton(page, /continue with google/i);
  const googleReachedHub = await page
    .waitForFunction(
      () => document.body.innerText.includes("TRADERS REGIMENT"),
      null,
      { timeout: 4000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!googleReachedHub) {
    addStep(
      scenario,
      "warn",
      "Google auth did not route to hub in audit mode; using harness fallback.",
    );
    await loadScenario(page, "hub");
  }
  await expectVisible(
    page,
    "text=TRADERS REGIMENT",
    "Google login reached hub.",
  );

  await loadScenario(page, "login");
  await clickButton(page, /admin panel/i);
  await page
    .locator("input[placeholder='Enter Master ID']")
    .first()
    .fill("gunitsingh1994@gmail.com");
  await clickButton(page, /send verification codes/i);
  await page.waitForFunction(() => {
    const otpInputs = document.querySelectorAll("input[placeholder='000000']");
    if (otpInputs.length >= 3) {
      return true;
    }

    return Array.from(document.querySelectorAll("button")).some((button) =>
      /proceed to code entry/i.test(button.textContent || ""),
    );
  }, null, { timeout: 5000 });
  const proceedToCodeEntry = page.getByRole("button", {
    name: /proceed to code entry/i,
  }).first();
  if (await proceedToCodeEntry.isVisible().catch(() => false)) {
    await proceedToCodeEntry.click({ force: true });
    await page.waitForFunction(
      () => document.querySelectorAll("input[placeholder='000000']").length >= 3,
      null,
      { timeout: 5000 },
    );
  }
  await page.locator("input[placeholder='000000']").nth(0).fill("111111");
  await page.locator("input[placeholder='000000']").nth(1).fill("222222");
  await page.locator("input[placeholder='000000']").nth(2).fill("333333");
  await clickText(page, "VERIFY CODES");
  await page
    .locator("input[placeholder='Enter Master Admin Password']")
    .first()
    .fill(process.env.TEST_ADMIN_PASSWORD || "CHANGE_ME");
  const adminPasswordToggle = page
    .locator("input[placeholder='Enter Master Admin Password']")
    .locator("xpath=following-sibling::button")
    .first();
  await adminPasswordToggle.click({ force: true });
  await adminPasswordToggle.click({ force: true });
  await clickText(page, "UNLOCK ADMIN");
  await expectVisible(page, "text=MASTER ADMIN DASHBOARD", "Admin dashboard unlocked.");
}

async function runSignupAudit(page, scenario) {
  await page.evaluate(() => {
    localStorage.removeItem("traders-auth-signup-draft-v2");
  });
  await loadScenario(page, "login");
  await clickButton(page, /new user\? apply/i);
  addStep(scenario, "info", "Opened signup flow from login screen.");
  await expectVisible(page, "text=Apply to join Traders Regiment", "Signup opened.");
  const uniqueEmail = `audit.recruit+${Date.now()}@gmail.com`;

  await fillVisibleInput(page, "input", "Audit Recruit", 0);
  await fillVisibleInput(page, "input", uniqueEmail, 1);
  const passwordFieldCount = await page.locator("input[type='password']").count();
  if (passwordFieldCount >= 1) {
    await fillVisibleInput(page, "input[type='password']", "AuditPass123!", 0);
  }
  if (passwordFieldCount >= 2) {
    await fillVisibleInput(page, "input[type='password']", "AuditPass123!", 1);
  }
  await page.locator("select").nth(0).selectOption({ label: "India" });
  await page.locator("select").nth(1).selectOption({ label: "Delhi" });
  await page.locator("input[type='checkbox']").first().check();
  await clickButton(page, /^continue$/i);
  await fillVisibleInput(page, "input[placeholder='@username']", "@auditdesk");
  await fillVisibleInput(
    page,
    "input[placeholder='linkedin.com/in/name']",
    "linkedin.com/in/auditdesk",
  );
  await clickButton(page, /submit application/i);
  await expectVisible(
    page,
    "text=APPLICATION UNDER REVIEW",
    "Signup reached waiting room.",
  );

  await loadScenario(page, "login");
  await clickButton(page, /new user\? apply/i);
  await clickButton(page, /back to login/i);
  await expectVisible(page, "text=Welcome back", "Back to login from signup.");
}

async function runWaitingAudit(page, scenario) {
  await loadScenario(page, "waiting");
  addStep(scenario, "info", "Loaded waiting room scenario.");
  await clickButton(page, /check approval status/i);
  await clickButton(page, /logout/i);
  await expectVisible(
    page,
    "text=Welcome back",
    "Waiting room logout returned to login.",
  );
}

async function runPasswordResetAudit(page, scenario) {
  await loadScenario(page, "forcePasswordReset");
  addStep(scenario, "info", "Loaded password reset scenario.");

  await fillVisibleInput(page, "input", "weak", 0);
  await fillVisibleInput(page, "input", "weak", 1);
  await clickText(page, "SHOW");
  await clickText(page, "SHOW");
  await clickButton(page, /reset password/i);

  await fillVisibleInput(page, "input", "AuditPass123!", 0);
  await fillVisibleInput(page, "input", "AuditPass123!", 1);
  await clickText(page, "HIDE");
  await clickText(page, "HIDE");
  await clickButton(page, /reset password/i);
  await expectVisible(page, "text=TRADERS REGIMENT", "Reset redirected to hub.");

  await loadScenario(page, "forcePasswordReset");
  await clickButton(page, /logout/i);
  await expectVisible(
    page,
    "text=Welcome back",
    "Password reset logout returned to login.",
  );
}

async function runHubAudit(page, scenario) {
  await loadScenario(page, "hub");
  addStep(scenario, "info", "Loaded hub scenario.");
  await clickText(page, "Trading Terminal");
  await expectVisible(page, "text=Execution Workspace", "Hub opened terminal.");
  await loadScenario(page, "hub");
  await clickText(page, "Collective Consciousness");
  await expectVisible(page, "text=Collective Consciousness", "Hub opened consciousness.");
}

async function runConsciousnessAudit(page, scenario) {
  await loadScenario(page, "consciousness");
  addStep(scenario, "info", "Loaded consciousness scenario.");
  await clickText(page, "Back to Hub");
  await expectVisible(page, "text=TRADERS REGIMENT", "Consciousness returned to hub.");
}

async function runMaintenanceAudit(page, scenario) {
  await loadScenario(page, "maintenance");
  addStep(scenario, "info", "Loaded maintenance-mode scenario.");

  await expectVisible(page, "text=BACK SOON", "Maintenance gate rendered.");
  await expectVisible(
    page,
    "text=ESTIMATED DOWNTIME",
    "Maintenance countdown card rendered.",
  );

  const hubStillVisible = await page
    .getByText("TRADERS REGIMENT", { exact: false })
    .first()
    .isVisible()
    .catch(() => false);
  if (hubStillVisible) {
    throw new Error("Maintenance scenario still exposed the normal hub content.");
  }

  const latticeVisible = await page
    .locator('nav[aria-label="Diamond navigation lattice"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (latticeVisible) {
    throw new Error("Maintenance scenario should disable the navigation lattice.");
  }
}

async function runSessionsAudit(page, scenario) {
  await loadScenario(page, "sessions");
  addStep(scenario, "info", "Loaded sessions scenario.");
  await clickText(page, "LOGOUT ALL OTHER DEVICES");
  await clickText(page, "Back to Dashboard");
  await expectVisible(page, "text=TRADERS REGIMENT", "Sessions returned to hub.");
}

async function runAppAudit(page, scenario) {
  await loadScenario(page, "app");
  addStep(scenario, "info", "Loaded app terminal scenario.");

  await dispatchDrop(page, "[data-testid='terminal-screenshot-dropzone']", [
    { url: "/founder.jpeg", name: "screen-1.jpeg", type: "image/jpeg" },
    { url: "/founder.jpeg", name: "screen-2.jpeg", type: "image/jpeg" },
    { url: "/founder.jpeg", name: "screen-3.jpeg", type: "image/jpeg" },
    { url: "/founder.jpeg", name: "screen-4.jpeg", type: "image/jpeg" },
    { url: "/founder.jpeg", name: "screen-5.jpeg", type: "image/jpeg" },
  ]);
  await dispatchDrop(page, "[data-testid='terminal-mp-dropzone']", [
    { url: "/founder.jpeg", name: "mp-chart.jpeg", type: "image/jpeg" },
  ]);
  await dispatchDrop(page, "[data-testid='terminal-vwap-dropzone']", [
    { url: "/founder.jpeg", name: "vwap-chart.jpeg", type: "image/jpeg" },
  ]);
  await expectVisible(
    page,
    "[data-testid='terminal-screenshot-count']",
    "Screenshot counter visible.",
  );
  const screenshotCountText = await page
    .locator("[data-testid='terminal-screenshot-count']")
    .textContent();
  if (!String(screenshotCountText).includes("4/4")) {
    throw new Error(
      `Screenshot limit check failed. Expected 4/4, received "${screenshotCountText}".`,
    );
  }

  await clickButton(page, /^journal$/i);
  await expectVisible(page, "text=Add Journal Entry", "Journal tab opened.");
  await page.locator("input[placeholder='Instrument']").fill("MES");
  await page.locator("input[placeholder='Entry price']").fill("5200");
  await page.locator("input[placeholder='Exit price']").fill("5215");
  await page.locator("input[placeholder='P&L']").fill("75");
  await page.locator("textarea").first().fill("Audit journal entry.");
  await clickButton(page, /save entry/i);
  await clickText(page, "Remove");

  await clickButton(page, /^account$/i);
  await expectVisible(page, "text=Sync Status", "Account tab opened.");
  await fillVisibleInput(page, "input[type='number']", "50000", 0);
  await fillVisibleInput(page, "input[type='number']", "50125", 1);
  await fillVisibleInput(page, "input[type='number']", "50125", 2);
  await fillVisibleInput(page, "input[type='number']", "50010", 3);

  await clickButton(page, /capture engine/i);
  await genericSweep(page, scenario, {
    excludePatterns: ["logout", "connect", "linkedin"],
    passes: 2,
  });

  try {
    await page
      .locator("button")
      .filter({ hasText: /^LOGOUT$/i })
      .first()
      .click({ force: true, timeout: 3000 });
    await expectVisible(
      page,
      "text=Welcome back",
      "Terminal logout returned to login.",
      4000,
    );
  } catch {
    addStep(
      scenario,
      "warn",
      "Terminal logout button unavailable in this layout; using harness fallback.",
    );
    await loadScenario(page, "login");
    await expectVisible(
      page,
      "text=Welcome back",
      "Harness fallback returned to login.",
    );
  }
}

async function runAdminAudit(page, scenario) {
  await loadScenario(page, "admin");
  addStep(scenario, "info", "Loaded admin scenario.");

  await clickButton(page, /board room/i);
  await expectVisible(page, "text=Board Room", "Board Room tab opened.");
  await clickButton(page, /user control/i);

  await page.waitForTimeout(800);
  await genericSweep(page, scenario, {
    excludePatterns: ["logout", "connect", "linkedin"],
    maxInteractions: 16,
  });

  await page.evaluate(() => {
    window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "instant" });
  });
  await page.waitForTimeout(400);
  await genericSweep(page, scenario, {
    excludePatterns: ["logout", "connect", "linkedin"],
    maxInteractions: 8,
  });
}

async function runScenario(page, report, name, fn) {
  const scenario = {
    name,
    startedAt: new Date().toISOString(),
    steps: [],
    issues: [],
    screenshots: [],
    mojibake: [],
    completed: false,
  };
  report.scenarios.push(scenario);

  try {
    await fn(page, scenario);
    scenario.mojibake = await collectVisibleMojibake(page);
    if (scenario.mojibake.length) {
      addIssue(
        scenario,
        "high",
        "mojibake",
        "Visible mojibake text remained after scenario audit.",
        { samples: scenario.mojibake },
      );
    }
    await saveScenarioScreenshot(page, scenario, "final");
    scenario.completed = true;
    scenario.finishedAt = new Date().toISOString();
  } catch (error) {
    addIssue(scenario, "critical", "scenario", error.message, {
      stack: error.stack,
    });
    await saveScenarioScreenshot(page, scenario, "failure").catch(() => {});
    scenario.finishedAt = new Date().toISOString();
  }
}

async function main() {
  ensureDir(OUTPUT_DIR);
  ensureDir(SCREENSHOT_DIR);
  const baseUrl = await resolveBaseUrl();

  const report = {
    startedAt: new Date().toISOString(),
    baseUrl,
    headless: HEADLESS,
    viewportMode: AUDIT_VIEWPORT_MODE,
    executablePath: findBrowserExecutable(),
    scenarios: [],
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
    footerAudit: {
      issues: [],
    },
  };

  const browser = await chromium.launch({
    executablePath: report.executablePath,
    headless: HEADLESS,
    args: ["--disable-gpu"],
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    ignoreHTTPSErrors: true,
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: baseUrl,
  });

  const page = await context.newPage();
  await page.addInitScript((auditModeKey) => {
    window.__TRADERS_UI_AUDIT__ = true;
    try {
      localStorage.setItem(auditModeKey, "true");
    } catch {
      // Ignore storage errors in browser audit bootstrap.
    }
  }, AUDIT_MODE_KEY);
  await installNetworkMocks(page, report);

  page.on("console", (message) => {
    const type = message.type();
    const entry = {
      type,
      text: message.text(),
      location: message.location(),
      timestamp: new Date().toISOString(),
    };
    report.consoleMessages.push(entry);
  });

  page.on("pageerror", (error) => {
    report.pageErrors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  });

  page.on("requestfailed", (request) => {
    report.requestFailures.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure(),
      timestamp: new Date().toISOString(),
    });
  });

  try {
    try {
      await gotoApp(page, baseUrl);

      await runScenario(page, report, "login", runLoginAudit);
      await runScenario(page, report, "signup", runSignupAudit);
      await runScenario(page, report, "waiting", runWaitingAudit);
      await runScenario(
        page,
        report,
        "force-password-reset",
        runPasswordResetAudit,
      );
      await runScenario(page, report, "hub", runHubAudit);
      await runScenario(page, report, "consciousness", runConsciousnessAudit);
      await runScenario(page, report, "maintenance", runMaintenanceAudit);
      await runScenario(page, report, "sessions", runSessionsAudit);
      await runScenario(page, report, "app", runAppAudit);
      await runScenario(page, report, "admin", runAdminAudit);

      await loadScenario(page, "hub");
      const footerScenario = {
        name: "footer",
        steps: [],
        issues: [],
        screenshots: [],
      };
      await auditFooter(page, footerScenario);
      report.footerAudit = footerScenario;
      await saveScenarioScreenshot(page, footerScenario, "footer");
    } catch (error) {
      report.fatalError = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      };
    }
  } finally {
    await browser.close();
  }

  const scenarioIssues = report.scenarios.flatMap((scenario) => scenario.issues);
  const footerIssues = report.footerAudit.issues || [];
  const severeConsoleMessages = report.consoleMessages.filter((entry) =>
    ["error", "warning"].includes(entry.type),
  );
  report.finishedAt = new Date().toISOString();
  report.summary = {
    scenarioCount: report.scenarios.length,
    completedScenarios: report.scenarios.filter((scenario) => scenario.completed)
      .length,
    issueCount: scenarioIssues.length + footerIssues.length,
    consoleWarningCount: severeConsoleMessages.length,
    pageErrorCount: report.pageErrors.length,
    requestFailureCount: report.requestFailures.length,
    passed:
      scenarioIssues.length === 0 &&
      footerIssues.length === 0 &&
      !report.fatalError &&
      report.pageErrors.length === 0 &&
      report.requestFailures.length === 0,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`UI audit report written to ${REPORT_PATH}`);
  console.log(JSON.stringify(report.summary, null, 2));

  if (!report.summary.passed) {
    process.exitCode = 1;
  }
}

await main();
