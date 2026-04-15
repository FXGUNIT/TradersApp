# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-quality-matrix.spec.js >> RS04 actionable controls expose label contract
- Location: tests\e2e\playwright\ui-quality-matrix.spec.js:75:1

# Error details

```
Error: control #0 has no accessible label signal

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e5]:
    - generic [ref=e7]:
      - img "Traders Regiment logo" [ref=e8]
      - generic [ref=e10]: THE DEPARTMENT OF INSTITUTIONAL ARTILLERY
    - generic [ref=e19]: INITIALIZING...
  - button [ref=e21] [cursor=pointer]:
    - img [ref=e22]
  - generic [ref=e24]:
    - generic [ref=e26]: "\"The best revenge is massive success.\" 🦅"
    - generic [ref=e29] [cursor=pointer]:
      - img "Gunit Singh" [ref=e31]
      - generic [ref=e32]:
        - generic [ref=e33]: Gunit Singh
        - generic [ref=e34]: Commander-in-Chief
      - link "LinkedIn" [ref=e35]:
        - /url: https://www.linkedin.com/in/singhgunit/
        - img [ref=e36]
        - text: LinkedIn
    - generic [ref=e40]:
      - generic [ref=e41]: AI System Status
      - generic [ref=e42]: Watchtower Active
      - generic "News source is offline." [ref=e43]:
        - generic [ref=e45]: Live News OFFLINE
      - generic "Economic-calendar source is offline." [ref=e46]:
        - generic [ref=e48]: Scheduled News OFFLINE
      - generic "Bottom-strip statuses refresh every 5 minutes." [ref=e49]: 5 MIN REFRESH
      - generic [ref=e50]: Fresh provider keys needed
      - generic "Fresh provider key required." [ref=e51]:
        - generic [ref=e53]: Gemini
      - generic "Fresh provider key required." [ref=e54]:
        - generic [ref=e56]: Groq
      - generic "Fresh provider key required." [ref=e57]:
        - generic [ref=e59]: OpenRouter
      - generic "Fresh provider key required." [ref=e60]:
        - generic [ref=e62]: Cerebras
      - generic "Fresh provider key required." [ref=e63]:
        - generic [ref=e65]: DeepSeek
      - generic "Fresh provider key required." [ref=e66]:
        - generic [ref=e68]: SambaNova
    - generic [ref=e70]: WELCOME TO THE REGIMENT
```

# Test source

```ts
  2   | 
  3   | test.describe.configure({ timeout: 90_000 });
  4   | 
  5   | const VIEWPORTS = [
  6   |   { width: 320, height: 740 },
  7   |   { width: 375, height: 812 },
  8   |   { width: 390, height: 844 },
  9   |   { width: 768, height: 1024 },
  10  |   { width: 1024, height: 768 },
  11  |   { width: 1280, height: 800 },
  12  | ];
  13  | 
  14  | async function gotoPrimarySurface(page) {
  15  |   await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
  16  |   if ((await page.locator("body").count()) === 0) {
  17  |     await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  18  |   }
  19  |   await expect(page.locator("body")).toBeVisible();
  20  | }
  21  | 
  22  | async function ensureActionableControls(page) {
  23  |   const selector =
  24  |     'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
  25  | 
  26  |   const waitForControls = async () => {
  27  |     await page
  28  |       .waitForFunction(
  29  |         (sel) => document.querySelectorAll(sel).length > 0,
  30  |         selector,
  31  |         { timeout: 8_000 },
  32  |       )
  33  |       .catch(() => {});
  34  |     return page.locator(selector);
  35  |   };
  36  | 
  37  |   let controls = await waitForControls();
  38  |   if ((await controls.count()) > 0) {
  39  |     return controls;
  40  |   }
  41  | 
  42  |   const floatingLauncher = page
  43  |     .locator("button")
  44  |     .filter({ has: page.locator('svg path[d*="M21 15a2 2"]') })
  45  |     .first();
  46  |   if (await floatingLauncher.isVisible({ timeout: 3_000 }).catch(() => false)) {
  47  |     await floatingLauncher.click();
  48  |     await page.waitForTimeout(400);
  49  |   }
  50  | 
  51  |   controls = await waitForControls();
  52  |   return controls;
  53  | }
  54  | 
  55  | test("RS02 viewport matrix has no horizontal overflow on primary surface", async ({
  56  |   page,
  57  | }) => {
  58  |   await gotoPrimarySurface(page);
  59  | 
  60  |   for (const viewport of VIEWPORTS) {
  61  |     await page.setViewportSize(viewport);
  62  |     await page.reload({ waitUntil: "domcontentloaded" });
  63  |     await page.waitForTimeout(300);
  64  | 
  65  |     const overflowPx = await page.evaluate(
  66  |       () => Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  67  |     );
  68  |     expect(
  69  |       overflowPx,
  70  |       `horizontal overflow at ${viewport.width}x${viewport.height}`,
  71  |     ).toBeLessThanOrEqual(4);
  72  |   }
  73  | });
  74  | 
  75  | test("RS04 actionable controls expose label contract", async ({ page }) => {
  76  |   await gotoPrimarySurface(page);
  77  | 
  78  |   const controls = await ensureActionableControls(page);
  79  |   const count = await controls.count();
  80  |   expect(count).toBeGreaterThan(0);
  81  | 
  82  |   const sample = Math.min(count, 20);
  83  |   for (let index = 0; index < sample; index += 1) {
  84  |     const control = controls.nth(index);
  85  |     const isVisible = await control.isVisible();
  86  |     if (!isVisible) continue;
  87  | 
  88  |     const metadata = await control.evaluate((el) => ({
  89  |       ariaLabel: (el.getAttribute("aria-label") || "").trim(),
  90  |       text: (el.textContent || "").trim(),
  91  |       title: (el.getAttribute("title") || "").trim(),
  92  |       placeholder: (el.getAttribute("placeholder") || "").trim(),
  93  |       value: "value" in el ? String(el.value || "").trim() : "",
  94  |     }));
  95  | 
  96  |     const hasLabel =
  97  |       metadata.ariaLabel ||
  98  |       metadata.text ||
  99  |       metadata.title ||
  100 |       metadata.placeholder ||
  101 |       metadata.value;
> 102 |     expect(Boolean(hasLabel), `control #${index} has no accessible label signal`).toBe(
      |                                                                                   ^ Error: control #0 has no accessible label signal
  103 |       true,
  104 |     );
  105 |   }
  106 | });
  107 | 
  108 | test("RS04 keyboard tab focus is visible", async ({ page }) => {
  109 |   await gotoPrimarySurface(page);
  110 | 
  111 |   await page.keyboard.press("Tab");
  112 |   await page.waitForTimeout(150);
  113 | 
  114 |   const focused = await page.evaluate(() => {
  115 |     const el = document.activeElement;
  116 |     if (!el || el === document.body) {
  117 |       return { hasFocusTarget: false, hasVisibleRing: false };
  118 |     }
  119 |     const style = window.getComputedStyle(el);
  120 |     const hasOutline = style.outlineStyle !== "none" && style.outlineWidth !== "0px";
  121 |     const hasShadow = style.boxShadow && style.boxShadow !== "none";
  122 |     return { hasFocusTarget: true, hasVisibleRing: hasOutline || hasShadow };
  123 |   });
  124 | 
  125 |   expect(focused.hasFocusTarget).toBe(true);
  126 |   expect(focused.hasVisibleRing).toBe(true);
  127 | });
  128 | 
  129 | test("RS06 reduced-motion preference suppresses long transitions", async ({
  130 |   page,
  131 | }) => {
  132 |   await page.emulateMedia({ reducedMotion: "reduce" });
  133 |   await gotoPrimarySurface(page);
  134 | 
  135 |   const hasLongMotion = await page.evaluate(() => {
  136 |     const toMs = (raw) => {
  137 |       if (!raw) return 0;
  138 |       const parts = raw
  139 |         .split(",")
  140 |         .map((token) => token.trim())
  141 |         .filter(Boolean)
  142 |         .map((token) => {
  143 |           if (token.endsWith("ms")) return Number.parseFloat(token);
  144 |           if (token.endsWith("s")) return Number.parseFloat(token) * 1000;
  145 |           return 0;
  146 |         });
  147 |       return Math.max(0, ...parts);
  148 |     };
  149 | 
  150 |     const nodes = Array.from(document.querySelectorAll("*"));
  151 |     return nodes.some((node) => {
  152 |       const style = window.getComputedStyle(node);
  153 |       const maxAnim = toMs(style.animationDuration);
  154 |       const maxTransition = toMs(style.transitionDuration);
  155 |       return maxAnim > 120 || maxTransition > 120;
  156 |     });
  157 |   });
  158 | 
  159 |   expect(hasLongMotion).toBe(false);
  160 | });
  161 | 
  162 | test("RS07 primary routes avoid fatal console errors", async ({ page }) => {
  163 |   const consoleErrors = [];
  164 |   page.on("console", (msg) => {
  165 |     if (msg.type() === "error") {
  166 |       consoleErrors.push(msg.text());
  167 |     }
  168 |   });
  169 | 
  170 |   await gotoPrimarySurface(page);
  171 |   await page.goto("/", { waitUntil: "domcontentloaded" });
  172 |   await page.waitForTimeout(1200);
  173 | 
  174 |   const filtered = consoleErrors.filter(
  175 |     (line) =>
  176 |       !line.includes("favicon") &&
  177 |       !line.includes("Failed to load resource") &&
  178 |       !line.includes("ERR_ABORTED"),
  179 |   );
  180 |   expect(filtered).toEqual([]);
  181 | });
  182 | 
```