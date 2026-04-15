# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser-compatibility.spec.js >> no console errors on page load
- Location: tests\e2e\playwright\browser-compatibility.spec.js:23:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:5173/", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
  - iframe [ref=e71]:
    
```

# Test source

```ts
  1   | /**
  2   |  * browser-compatibility.spec.js
  3   |  * R15 gap fix — proves core flows work across browsers.
  4   |  * Run: npx playwright test
  5   |  * CI: see .github/workflows/ci.yml browser-tests job
  6   |  */
  7   | import { test, expect } from '@playwright/test';
  8   | 
  9   | // ── Helper: skip if auth not configured ───────────────────────────────────
  10  | test.beforeEach(async ({ page }) => {
  11  |   // Navigate to app root — will get redirected to login or landing
  12  |   await page.goto('/', { waitUntil: 'domcontentloaded' });
  13  | });
  14  | 
  15  | // ── R15: Page loads without crash across browsers ───────────────────────
  16  | test('page loads without crash', async ({ page }) => {
  17  |   // Should not get an unhandled error boundary
  18  |   const errorText = page.locator('text=Something went wrong').first();
  19  |   await expect(errorText).not.toBeVisible({ timeout: 10_000 });
  20  | });
  21  | 
  22  | // ── R15: No console errors on load ─────────────────────────────────────
  23  | test('no console errors on page load', async ({ page }) => {
  24  |   const errors = [];
  25  |   page.on('console', (msg) => {
  26  |     if (msg.type() === 'error') {
  27  |       errors.push(msg.text());
  28  |     }
  29  |   });
  30  | 
> 31  |   await page.goto('/', { waitUntil: 'networkidle' });
      |              ^ Error: page.goto: Test timeout of 30000ms exceeded.
  32  |   await page.waitForTimeout(2_000);
  33  | 
  34  |   // Filter out known acceptable errors (e.g. favicon 404)
  35  |   const realErrors = errors.filter(
  36  |     (e) =>
  37  |       !e.includes('favicon') &&
  38  |       !e.includes('net::ERR_') &&
  39  |       !e.includes('Failed to load resource'),
  40  |   );
  41  |   expect(realErrors).toHaveLength(0);
  42  | });
  43  | 
  44  | // ── R15: Login page renders core elements ──────────────────────────────
  45  | test('login page renders required elements', async ({ page }) => {
  46  |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  47  | 
  48  |   // Page must have some heading or content
  49  |   const body = page.locator('body');
  50  |   await expect(body).toBeVisible();
  51  | 
  52  |   // No blank page
  53  |   const html = await page.content();
  54  |   expect(html.length).toBeGreaterThan(500);
  55  | });
  56  | 
  57  | // ── R15: Mobile viewport — no horizontal overflow ─────────────────────
  58  | test('mobile viewport has no horizontal overflow', async ({ page }) => {
  59  |   await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12 size
  60  |   await page.goto('/', { waitUntil: 'domcontentloaded' });
  61  |   await page.waitForTimeout(1_000);
  62  | 
  63  |   // documentElement scrollWidth must equal viewport width
  64  |   const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  65  |   const innerWidth = await page.evaluate(() => window.innerWidth);
  66  |   expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 5); // 5px tolerance for rounding
  67  | });
  68  | 
  69  | // ── R15: Tablet viewport — no horizontal overflow ─────────────────────
  70  | test('tablet viewport has no horizontal overflow', async ({ page }) => {
  71  |   await page.setViewportSize({ width: 768, height: 1024 });
  72  |   await page.goto('/', { waitUntil: 'domcontentloaded' });
  73  |   await page.waitForTimeout(1_000);
  74  | 
  75  |   const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  76  |   const innerWidth = await page.evaluate(() => window.innerWidth);
  77  |   expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 5);
  78  | });
  79  | 
  80  | // ── R16: Keyboard navigation — Tab moves focus forward ─────────────────
  81  | test('keyboard tab navigation moves focus forward', async ({ page }) => {
  82  |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  83  |   await page.waitForTimeout(500);
  84  | 
  85  |   // Press Tab 5 times — should not crash
  86  |   for (let i = 0; i < 5; i++) {
  87  |     await page.keyboard.press('Tab');
  88  |     await page.waitForTimeout(100);
  89  |   }
  90  | 
  91  |   // Page should still be alive
  92  |   const body = page.locator('body');
  93  |   await expect(body).toBeVisible();
  94  | });
  95  | 
  96  | // ── R16: Keyboard — Enter on login button does not crash ───────────────
  97  | test('keyboard enter on focused element does not crash', async ({ page }) => {
  98  |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  99  |   await page.waitForTimeout(500);
  100 | 
  101 |   // Focus first input and press Enter
  102 |   const firstInput = page.locator('input').first();
  103 |   if (await firstInput.isVisible()) {
  104 |     await firstInput.focus();
  105 |     await page.keyboard.press('Enter');
  106 |     await page.waitForTimeout(500);
  107 |   }
  108 | 
  109 |   // Page still alive
  110 |   await expect(page.locator('body')).toBeVisible();
  111 | });
  112 | 
  113 | // ── R16: Focus visible — focused element has visible outline ─────────────
  114 | test('focused interactive elements have visible focus indicator', async ({ page }) => {
  115 |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  116 |   await page.waitForTimeout(500);
  117 | 
  118 |   const firstInput = page.locator('input').first();
  119 |   if (await firstInput.isVisible()) {
  120 |     await firstInput.focus();
  121 |     // Check that focused element or its parent has visible focus
  122 |     const focusedStyle = await page.evaluate(() => {
  123 |       const el = document.activeElement;
  124 |       if (!el) return null;
  125 |       const style = window.getComputedStyle(el);
  126 |       return {
  127 |         outline: style.outline,
  128 |         outlineWidth: style.outlineWidth,
  129 |         boxShadow: style.boxShadow,
  130 |       };
  131 |     });
```