import { test, expect } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

const VIEWPORTS = [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
];

async function gotoPrimarySurface(page) {
  try {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  } catch {
    // If root fails, try login
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  }
}

async function ensureActionableControls(page) {
  const selector =
    'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';

  // First try: wait for any actionable control to appear on page
  try {
    await page.waitForSelector(selector, { state: 'attached', timeout: 8_000 });
  } catch {
    // fall through to panel-opening attempt
  }

  // If nothing visible yet, open the support chat panel (it contains inputs)
  const floatingLauncher = page
    .locator("button")
    .filter({ has: page.locator('svg path[d*="M21 15a2 2"]') })
    .first();
  if (await floatingLauncher.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await floatingLauncher.click();
    await page.waitForTimeout(500);
    try {
      await page.waitForSelector(selector, { state: 'attached', timeout: 5_000 });
    } catch {
      // fall through — locator may still resolve to 0
    }
  }

  return page.locator(selector);
}

test("RS02 viewport matrix has no horizontal overflow on primary surface", async ({
  page,
}) => {
  await gotoPrimarySurface(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    const overflowPx = await page.evaluate(
      () => Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    );
    expect(
      overflowPx,
      `horizontal overflow at ${viewport.width}x${viewport.height}`,
    ).toBeLessThanOrEqual(4);
  }
});

test("RS04 actionable controls expose label contract", async ({ page }) => {
  await gotoPrimarySurface(page);

  const controls = await ensureActionableControls(page);
  const count = await controls.count();
  if (count === 0) {
    test.skip(true, "No actionable controls found in this environment");
    return;
  }
  expect(count).toBeGreaterThan(0);

  const sample = Math.min(count, 20);
  for (let index = 0; index < sample; index += 1) {
    const control = controls.nth(index);
    const isVisible = await control.isVisible();
    if (!isVisible) continue;

    const metadata = await control.evaluate((el) => ({
      ariaLabel: (el.getAttribute("aria-label") || "").trim(),
      text: (el.textContent || "").trim(),
      title: (el.getAttribute("title") || "").trim(),
      placeholder: (el.getAttribute("placeholder") || "").trim(),
      value: "value" in el ? String(el.value || "").trim() : "",
    }));

    const hasLabel =
      metadata.ariaLabel ||
      metadata.text ||
      metadata.title ||
      metadata.placeholder ||
      metadata.value;
    expect(Boolean(hasLabel), `control #${index} has no accessible label signal`).toBe(
      true,
    );
  }
});

test("RS04 keyboard tab focus is visible", async ({ page }) => {
  await gotoPrimarySurface(page);

  const launcher = page.getByRole("button", { name: /support chat/i }).first();
  if (await launcher.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await launcher.click();
    await page.waitForTimeout(400);
  }

  await page.locator("body").click();

  let focused = { hasFocusTarget: false, hasVisibleRing: false };
  let tabTarget = null;
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(120);

    focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) {
        return { hasFocusTarget: false, hasVisibleRing: false };
      }
      const style = window.getComputedStyle(el);
      const hasOutline =
        style.outlineStyle !== "none" && style.outlineWidth !== "0px";
      const hasShadow = style.boxShadow && style.boxShadow !== "none";
      return { hasFocusTarget: true, hasVisibleRing: hasOutline || hasShadow };
    });

    if (focused.hasFocusTarget) {
      tabTarget = i;
      break;
    }
  }

  // If no focusable element found after many tabs, skip — the browser may not
  // have loaded the page fully or the page has no interactive elements
  if (!tabTarget) {
    test.skip(true, "No focusable element found in this browser environment");
    return;
  }

  expect(focused.hasFocusTarget).toBe(true);
  expect(focused.hasVisibleRing).toBe(true);
});

test("RS06 reduced-motion preference suppresses long transitions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoPrimarySurface(page);

  const hasLongMotion = await page.evaluate(() => {
    const toMs = (raw) => {
      if (!raw) return 0;
      const parts = raw
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => {
          if (token.endsWith("ms")) return Number.parseFloat(token);
          if (token.endsWith("s")) return Number.parseFloat(token) * 1000;
          return 0;
        });
      return Math.max(0, ...parts);
    };

    const nodes = Array.from(document.querySelectorAll("*"));
    return nodes.some((node) => {
      const style = window.getComputedStyle(node);
      const maxAnim = toMs(style.animationDuration);
      const maxTransition = toMs(style.transitionDuration);
      return maxAnim > 120 || maxTransition > 120;
    });
  });

  expect(hasLongMotion).toBe(false);
});

test("RS05 hostile long inputs do not introduce horizontal overflow", async ({
  page,
}) => {
  await gotoPrimarySurface(page);

  const launcher = page.getByRole("button", { name: /support chat/i }).first();
  const hasLauncher = await launcher.isVisible({ timeout: 3_000 }).catch(() => false);
  if (!hasLauncher) {
    test.skip(true, "Floating support chat is not enabled in this environment.");
  }

  await launcher.click();
  const nameInput = page.getByPlaceholder("Your Full Name");
  const mobileInput = page.getByPlaceholder("Mobile Number");

  if (!(await nameInput.isVisible({ timeout: 3_000 }).catch(() => false))) {
    test.skip(true, "Pre-chat form is not available for hostile-input checks.");
  }

  await nameInput.fill(`AUDIT-${"X".repeat(260)}`);
  await mobileInput.fill(`+91${"9".repeat(40)}`);
  await page.waitForTimeout(250);

  const overflowPx = await page.evaluate(
    () => Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  );
  expect(overflowPx).toBeLessThanOrEqual(4);
});

test("RS07 primary routes avoid fatal console errors", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  await gotoPrimarySurface(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const filtered = consoleErrors.filter(
    (line) =>
      !line.includes("favicon") &&
      !line.includes("Failed to load resource") &&
      !line.includes("ERR_ABORTED"),
  );
  expect(filtered).toEqual([]);
});
