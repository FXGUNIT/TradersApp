import "./idor-guard.spec.impl.js";
/*
/**
 * idor-guard.spec.js — R03 gap fix: BFF IDOR guard integration test
 *
 * Proves that the BFF layer correctly rejects cross-user identity access.
 * The IDOR guard in identityRoutes.mjs returns HTTP 403 when the URL uid
 * does not match the authenticated uid from the Bearer token.
 *
 * Run: npx playwright test
 * CI: runs in browser-tests job alongside browser-compatibility.spec.js
 */
import { test, expect } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

// ── R03: IDOR guard — cross-UID access blocked at BFF layer ─────────────────
test(
  'identity PATCH to a different user uid returns 403 — IDOR guard blocks cross-user write',
  async ({ page }) => {
    // Step 1: login as audit-user-001
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Fill credentials (use env vars or fixtures in real CI)
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    if (!(await emailInput.isVisible({ timeout: 5_000 }))) {
      // Auth may already be bypassed in test env — skip if login UI not present
      test.skip('Login UI not available in this environment');
      return;
    }

    await emailInput.fill(process.env.TEST_AUTH_EMAIL || 'audit-user-001@test.traders.app');
    await passInput.fill(process.env.TEST_AUTH_PASSWORD || 'TestPassword123!');
    await submitBtn.click();

    // Wait for authenticated state
    await page.waitForURL('**/hub', { timeout: 30_000 }).catch(() => {
      test.skip('Auth redirect to /hub did not occur within timeout');
    });

    // Step 2: Extract Bearer token from localStorage or sessionStorage
    const token = await page.evaluate(() => {
      // BFF stores session token after login
      return localStorage.getItem('traders_session_token') ||
             sessionStorage.getItem('traders_session_token') ||
             null;
    });

    if (!token) {
      test.skip('No session token found in storage — auth flow not fully exercised');
      return;
    }

    // Step 3: Issue PATCH to /identity/users/<different-uid>/access with the user's token
    // The guard must return 403 because the URL uid != authenticated uid
    const targetUid = 'OTHER_USER_UID_' + Date.now();
    const response = await page.request.fetch('/api/identity/users/' + encodeURIComponent(targetUid) + '/access', {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessLevel: 'ADMIN' }),
    });

    // Step 4: Assert 403 — the IDOR guard must block this
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      error: expect.stringContaining('denied'),
    });
  },
);
*/
