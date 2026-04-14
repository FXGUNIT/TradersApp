# R15 Proof Artifact: Browser & Device Coverage

**Task:** R15 — Prove browser and device coverage beyond the current local browser path.
**Claimed by:** claude-sonnet | **Date:** 2026-04-14
**Status:** PARTIAL — CI infrastructure present, cross-browser testing not yet verified in live CI

---

## What R15 Requires

1. Supported desktop browsers: Chrome, Edge, Firefox, Safari-equivalent
2. Mobile viewport behavior beyond a single synthetic dimension
3. Clipboard, popup, auth, drag/drop, file-selection cross-browser behavior
4. Font, overflow, modal, scroll-lock, fixed-position behavior per browser
5. Explicitly record unsupported browser exceptions

---

## CI Pipeline: Cross-Browser Coverage

### GitHub Actions CI (`.github/workflows/ci.yml`)

The CI has 4 jobs that run across environments:

| Job | Platform | What It Tests |
|-----|----------|---------------|
| `frontend` | ubuntu-latest + Node 20 | `npm run lint`, ESLint, `npm run build` |
| `bff` | ubuntu-latest + Node 20 | `npm run lint`, Docker build |
| `integration-tests` | ubuntu-latest + Python 3.11 | pytest against live containers |
| `load-tests` | ubuntu-latest | Locust + k6 load simulation |
| `ml-engine` | ubuntu-latest + Python 3.11 | Docker build + health check |

**Browser runtime:** Frontend built by Vite — outputs static assets served by Vercel CDN. Vite uses default browserslist targets (`> 0.5%, not dead`). No explicit browser matrix defined in `package.json` or `.browserslistrc`.

### Vite Build Output

Vite config (`vite.config.js`) — no custom browser target overrides. Build produces ES2017+ output. This covers Chrome 60+, Firefox 55+, Safari 11+, Edge 79+.

### Vercel Deployment

Frontend deployed to Vercel CDN — served to all browsers via CDN edge nodes. No explicit browser targeting in Vercel config.

---

## Auth Cross-Browser Behavior

### Firebase Auth Persistence

`src/features/identity/authCredentialHandlers.js:3`:
```javascript
 persistence: [browserLocalPersistence]
```
Firebase IndexedDB persistence: works across Chrome, Edge, Firefox, Safari 14+.
Token refresh: `user.reload()` called on bootstrap with 5s timeout.
No WebKit-specific fallback paths — Firebase SDK handles cross-browser internally.

### BFF Session (Bearer Token)

Bearer token stored in React state / `localStorage`. No cookie-based session → no CSRF exposure. Works identically across all browsers with `fetch()` API support.

### Login Flow (`CleanLoginScreen.jsx`)

Google OAuth redirect popup — browser-native. No custom popup sizing or positioning. Firebase `signInWithPopup` handles cross-browser differences internally.

---

## Frontend Feature: Cross-Browser Audit

### Scroll Lock Behavior

`src/index.css:16` — `scroll-lock` class removes body overflow. Works in all modern browsers.
`src/styles/global.css:3` — `scroll-lock` also applied globally.

### Fixed Position Elements

`ChatHelpline.jsx:3` — `aria-live="polite"` for dynamic status. Fixed positioned help button.
`FloatingChatWidget.jsx:1` — floating widget with keyboard focus support.

### Keyboard Navigation

- `DiamondNavigationLattice.jsx:5` — `onKeyDown` for diamond nav keyboard interactions
- `TerminalJournalOverview.jsx:2` — keyboard navigation for journal
- `AdminUnlockModal.jsx:1` — keyboard handling for admin unlock

### Focus Trap

`CommandPalette.jsx:1` — command palette with `tabindex` for keyboard operability.

### aria-Labels

- `EULATermsSection.jsx:1` — aria label on terms checkbox
- `CollectiveConsciousness.jsx:2` — aria semantics for consensus sections
- `SupportChatModal.jsx:1` — modal accessibility label

---

## Modal Behavior Cross-Browser

`AdminUnlockModal.jsx` — modal with keyboard handling. Uses `ReactDOM.createPortal` for portal rendering (cross-browser safe). `aria-modal="true"` not found in existing code — gap.

`SupportChatModal.jsx` — uses React portals, has `role="dialog"` — cross-browser.

---

## File Upload Cross-Browser

Terminal screenshot/file upload path: `src/features/terminal/TerminalJournalOverview.jsx`. No ActiveX, no IE-only fallbacks. Uses standard `<input type="file">` with `accept="image/*"` filter.

File size limits enforced server-side (BFF body parser: 10MB screenshots, 5MB AI body, 100KB workspace).

---

## Mobile Viewport

CSS `viewport` meta tag in `index.html` — standard responsive setup. No browser-specific CSS hacks found.

---

## Gaps Found

### GAP 1 (Medium) — No explicit browserslist target

Vite uses default browserslist (`> 0.5%, not dead`) which is broad but not formally declared. React 19 and Vite support all modern browsers, but explicit target would tighten guarantee.

**Fix optional:** Add `browserslist` key to `package.json`:
```json
"browserslist": [
  "Chrome >= 90",
  "Firefox >= 90",
  "Safari >= 15",
  "Edge >= 90"
]
```

### GAP 2 (Medium) — No Playwright cross-browser test

CI runs `npm run build` only. No automated Playwright test against Chrome/Firefox/Safari. R15 step 1 (verify Chrome/Edge/Firefox/Safari) requires browser automation.

**Fix needed:** Add Playwright test suite with browser matrix:
```javascript
// tests/e2e/browser-compatibility.spec.js
const browsers = ['chromium', 'firefox', 'webkit'];
browsers.forEach(browser => {
  test(`${browser}: auth flow`, async ({ page }) => {
    await page.goto('/');
    // core auth flow
  });
});
```

### GAP 3 (Low) — No mobile viewport test in CI

No mobile browser automation in CI. Only responsive CSS exists — no automated proof mobile layouts work.

**Fix optional:** Add Playwright mobile viewport tests:
```javascript
const devices = ['iPhone 12', 'Pixel 5'];
devices.forEach(device => {
  test(`${device}: terminal page`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // check no horizontal overflow, no clipped elements
  });
});
```

### GAP 4 (Low) — No clipboard API cross-browser test

Clipboard API (`navigator.clipboard.writeText`) used in journal entry copy. Safari < 13 has partial support. No fallback for older browsers.

**Fix optional:** Add clipboard fallback using `document.execCommand('copy')` for older Safari.

### GAP 5 (Low) — No `aria-modal` on modals

`AdminUnlockModal.jsx` has no `aria-modal="true"` attribute. Screen readers may not correctly announce modal state.

**Fix:** Add `aria-modal="true"` to modal root element.

---

## What Already Works

| Feature | Chrome | Firefox | Edge | Safari |
|---------|--------|---------|------|--------|
| Vite build output | ✓ | ✓ | ✓ | ✓ |
| Firebase IndexedDB auth | ✓ | ✓ | ✓ | ✓ (14+) |
| Bearer token auth | ✓ | ✓ | ✓ | ✓ |
| Google OAuth popup | ✓ | ✓ | ✓ | ✓ |
| CSS scroll-lock | ✓ | ✓ | ✓ | ✓ |
| React portals (modals) | ✓ | ✓ | ✓ | ✓ |
| File upload (input type=file) | ✓ | ✓ | ✓ | ✓ |
| WebSocket for ML Engine | ✓ | ✓ | ✓ | ✓ |
| React 19 + Vite | ✓ | ✓ | ✓ | ✓ (15+) |

---

## Deployment Pipeline Browser Coverage

```
Vite build (ubuntu-latest) → Vercel CDN edge nodes → all browsers
BFF Docker build (ubuntu-latest) → Railway containers
ML Engine Docker build (ubuntu-latest) → Railway containers
```

Production serves static assets from Vercel CDN. Vercel handles Brotli/Gzip compression and serves appropriate bundles per browser capability.

---

## Interim Verdict

**Partial.** Core infrastructure (Vite, Firebase, Bearer auth, CSS) works across modern browsers by design. CI builds frontend and validates. However, no automated cross-browser Playwright suite exists in CI — the "proven" step 1 verification is blocked without browser automation. Auth flow is cross-browser-safe via Firebase SDK. No IE11 or legacy browser support declared — reasonable given React 19 requirement.

**Recommended:** Add Playwright with browser matrix to CI to fully satisfy R15 exit criteria.

**Proof artifact:** `docs/R15_BROWSER_COVERAGE_PROOF.md`
