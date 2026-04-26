# REGULAR TO-DO LIST
**Generated:** 2026-04-26
**Owner:** FXGUNIT / Claude
**Status:** PLANNING — do not execute until user approves

---

## CORRECTIONS (after deep code trace)

The initial plan had 4 errors discovered via code archaeology:

1. **Task 2 (Admin login)**: Frontend `verifyAdminTotp()` does NOT call the BFF — it runs TOTP verification entirely in the browser using the `ADMIN_TOTP_SECRET` from the browser bundle. The BFF route `POST /auth/admin/totp/verify` is NOT used for TOTP unlock. The actual flow: AdminUnlockModal → `handleAdminAccess` → `executeHandleAdminAccess` → `verifyAdminTotp(browser-side)` → `completeAdminUnlock`. Fix: remove the `ADMIN_TOTP_SECRET` from browser bundles entirely and require TOTP verification to go through the BFF (move the secret server-side only).

2. **Task 2 (Email OTP)**: Frontend already supports 3 OTP codes. `verifyAdminEmailOtp` in `adminAuthService.js:239-248` accepts `codes` as array OR `{otp1, otp2, otp3}` object, requires exactly 3 codes. BFF `POST /auth/admin/email-otp/start` already generates 3 codes. So the 3-code email OTP flow is already implemented in the frontend. The only missing piece is the BFF route handler on the live server (stale deploy). No code changes needed — just deploy.

3. **Task 1 (Watchtower)**: The watchtower does NOT check `result.source` anywhere. The `ML_CONSENSUS_DEGRADED` fault fires on `!consensusResult.ok` with no `source === 'ny_lunch_block'` exception. This is not a design choice — it's an oversight. The fix is adding a `source` check before setting the fault.

4. **Task 6 (Google Sign In)**: Google sign-in uses Firebase direct OAuth (`signInWithRedirect`) — the BFF is NOT involved. This is a Firebase configuration issue, not a BFF issue. The fix is in Firebase console: add `tradergunit.pages.dev` to the authorized OAuth redirect domains.

---

## CONTEXT

User (Gunit Singh, trader + founder) has identified 10 issues/errors on the live TradersApp at `tradergunit.pages.dev`. This doc is the canonical plan. Execution starts only when user says GO.

Brand direction: **minimalist old-school luxury** — White + Black + Brown (logo brown, same as logo file in Downloads folder). NOT gold/blue/purple. No random styling.

---

## BLOCKING ROOT CAUSE

Every backend issue traces to **one root cause**: Contabo VPS deploy failing at SSH connectivity for 3+ consecutive runs. The live BFF at `bff.173.249.18.14.sslip.io` is running stale code that predates:
- `adminMfaRoutes.mjs` → "Route not found" on all admin MFA endpoints
- `/watchtower/status` → HTTP 502 → all 5 Watchtower faults

**Fix (one line):** Set `CONTABO_SSH_KNOWN_HOSTS` secret in GitHub Actions to the pinned ECDSA host key of the VPS.

---

## TASK MAPPING

| # | Task | Type | Priority | Blocking |
|---|------|------|----------|----------|
| 1 | Watchtower — resolve all faults | Bug fix | P0 | None |
| 2 | Admin login — redesign, email OTP → authenticator, NO password | Feature | P0 | Contabo redeploy |
| 3 | IP safe zone — whitelist office + Meerut (250001, 250002) | Security | P0 | None |
| 4 | Telegram — relink | Bug fix | P1 | Contabo redeploy |
| 5 | "Research Buttons" visible text on login | Bug fix | P1 | None |
| 6 | Google Sign In fix | Bug fix | P1 | Investigate first |
| 7 | Logo / app icon — swap new logos everywhere | Design | P2 | User files needed |
| 8 | Blog on logo — write as new blog post | Content | P2 | None |
| 9 | Pitch deck page — inside admin panel | Feature | P2 | Task 2 must be done |
| 10 | Secret sauce privacy — separate public vs private info | Content | P2 | None |
| 11 | Brand redesign — white/black/brown | Design | P2 | Task 7 must be done |
| 12 | Blog section redesign — creative charts below LinkedIn | Design | P2 | Task 7 + Task 11 |

---

## TASK 1 — WATCHTOWER FAULTS RESOLUTION

### Root Causes
| Fault | Root Cause | Fix |
|---|---|---|
| Backend daemon: checking | `/watchtower/status` → HTTP 502 (stale BFF) | Fix Contabo SSH + redeploy |
| Board Room sync: BFF unavailable | Downstream of stale BFF | Fix Contabo SSH + redeploy |
| ML consensus degraded: HTTP 503 | `/ml/consensus` returns `ok:false` during NY lunch block (12–1 PM ET) — **expected by design** | Suppress known block window in frontend fault logic |
| Backend Watchtower unreachable | Same as first | Fix Contabo SSH |
| Board Room sync failed | Same as first | Fix Contabo SSH |

### Implementation Steps

**Step 1.1 — Fix Contabo SSH (unblocks BFF redeploy)**
- Run `ssh-keyscan -H <CONTABO_VPS_HOST_IP>` from any machine that can reach the VPS
- Result is one line like `hostname ssh-rsa AAAAB3...`
- Go to GitHub repo → Settings → Secrets → Actions → New repo secret
- Name: `CONTABO_SSH_KNOWN_HOSTS`
- Value: paste the single line from ssh-keyscan output
- Trigger re-deploy: `gh workflow run deploy-contabo.yml --ref main`
- **Owner: Gunit** (needs SSH access to get the host key)

**Step 1.2 — Suppress NY lunch block false fault (frontend-only, no deploy needed)**
- File: `src/services/watchtower.js`
- Line ~567: fault trigger uses `!consensusResult.ok`
- Add check: `if (consensusResult.source === 'ny_lunch_block') return false` before setting `ML_CONSENSUS_DEGRADED`
- This fault fires every weekday 12–1 PM by design — it's a feature not a bug, but it should not show as a fault

### Verification
```
curl -s "https://bff.173.249.18.14.sslip.io/watchtower/status" → HTTP 200 (not 502)
curl -s "https://bff.173.249.18.14.sslip.io/ml/consensus?session=1&symbol=MNQ" → after 1 PM ET, HTTP 200
Watchtower footer on site shows 0 FAULTS
```

### Files Touched
- `src/services/watchtower.js` (Step 1.2)
- GitHub Actions secrets (Step 1.1 — manual by Gunit)

---

## TASK 2 — ADMIN LOGIN REDESIGN

### What user wants
1. Two paths to get admin access:
   - **Path A:** Enter email → receive 3 OTP codes via email → enter OTP codes → access granted (no password, no authenticator)
   - **Path B:** Enter email → enter TOTP authenticator code → access granted (no password)
2. **NO PASSWORD field in admin login at all** — remove entirely
3. Both paths work independently (either email OTP or TOTP)

### Current State (AdminUnlockModal.jsx)
- Has: password field (labeled "AUTHENTICATOR CODE"), email OTP panel, "UNLOCK WITH AUTHENTICATOR" button
- **CRITICAL SECURITY FLAW**: TOTP verification runs entirely in the browser using `ADMIN_TOTP_SECRET` from the browser bundle — anyone can extract the secret from the JS bundle
- Email OTP: 3-code flow already implemented in frontend (`verifyAdminEmailOtp` accepts `codes: [otp1, otp2, otp3]`)
- BFF routes missing on live server → "Route not found"

### CRITICAL FIX: Move TOTP to BFF (security non-negotiable)

**Current (INSECURE):**
```
Browser bundle contains ADMIN_TOTP_SECRET
→ client-side TOTP verification in adminAuthService.js:300-331
→ completeAdminUnlock() → localStorage
```

**Fix (SECURE):**
```
Browser → POST /auth/admin/totp/verify { code }
→ BFF verifies against server-side ADMIN_TOTP_SECRET
→ returns { ok, token }
→ completeAdminUnlock(token)
```

**Step 2.1 — Move TOTP verification server-side (security fix)**
- File: `src/features/admin-security/adminAccessHandlers.js:58`
  - Replace `verifyAdminTotp(adminPassInput)` browser call with `fetch('/auth/admin/totp/verify', { method:'POST', body: JSON.stringify({ code: adminPassInput }), headers:{'Content-Type':'application/json'} })`
- File: `src/services/adminAuthService.js`
  - Remove `ADMIN_TOTP_SECRET` import and browser-side `verifyAdminTotp` function entirely
  - Replace with `verifyAdminTotpBff({ code })` → calls BFF `POST /auth/admin/totp/verify`
- File: `src/features/admin-security/adminAccessHandlers.js`
  - On BFF success: extract `payload.token` → pass to `completeAdminUnlock(payload.token)`
- Verify: TOTP secret must NOT appear anywhere in the browser bundle (grep the built JS)

**Step 2.2 — Redesign AdminUnlockModal UI**
- File: `src/features/admin-security/AdminUnlockModal.jsx`
- Remove: password field + `passwordError` prop entirely
- Add: two-column layout (TOTP left, Email OTP right)
- TOTP column: 6-digit input + "Remember device" checkbox + "UNLOCK WITH AUTHENTICATOR" button
- Email OTP column: "SEND THREE EMAIL OTP CODES" → 3 input fields → "VERIFY EMAIL OTP CODES"
- IP restriction notice at top (from Task 3)
- Styling: clean, purple accent, minimalist

**Step 2.3 — Email OTP already implemented (no code needed)**
- `requestAdminEmailOtp(masterEmail)` → BFF already sends 3 codes (see `adminMfaService.mjs:171`)
- `verifyAdminEmailOtp({ challengeId, codes: [otp1, otp2, otp3] })` → already accepts array format
- BFF `POST /auth/admin/email-otp/verify` → already handles array codes
- Only missing: BFF route on live server → Contabo redeploy unblocks this

**Step 2.4 — IP safe zone middleware**
- File: `bff/middleware/ipSafeZone.mjs` (new)
- File: `bff/_dispatchRoutes.mjs` — apply to all `/auth/admin/*` routes
- Logic: extract `X-Forwarded-For` → check exact office IP → else use `ip-api.com/json/<ip>?fields=city,zip` → allow if city=Meerut AND zip in [250001, 250002]
- Cache geolocation per IP for 24h to avoid hammering ip-api.com
- On block: `403 { error: "Admin access restricted. Your IP is not in the allowed safe zone.", ipMasked: true }`

### Files Touched
- `src/services/adminAuthService.js` (Step 2.1 — add BFF TOTP call, remove browser TOTP)
- `src/features/admin-security/adminAccessHandlers.js` (Step 2.1 — use BFF TOTP)
- `src/features/admin-security/AdminUnlockModal.jsx` (Step 2.2 — UI redesign)
- `bff/middleware/ipSafeZone.mjs` (new — Step 2.4)
- `bff/_dispatchRoutes.mjs` (Step 2.4)

### Verification
- Load admin login → shows email field + two method columns
- Enter email + click "SEND THREE EMAIL OTP CODES" → receive 3 emails, enter codes → access granted
- Enter email + enter authenticator code → access granted
- From non-whitelisted IP → see "Access restricted" message

---

## TASK 3 — IP SAFE ZONE WHITELIST

### Configuration
```
SAFE_ZONE_IPS:
  - 106.219.146.101/32  (Office IP — Bharti Airtel, Uttar Pradesh)

SAFE_ZONE_CITY: Meerut
SAFE_ZONE_PIN_CODES: [250001, 250002]
SAFE_ZONE_COUNTRY: India

FALLBACK_MODE: Allow all (log warning) — ONLY if geolocation lookup fails
```

### Implementation Steps

**Step 3.1 — IP safe zone middleware**
- New file: `bff/middleware/ipSafeZone.mjs`
- Exports: `createIpSafeZoneMiddleware({ allowedIps, allowedCities, allowedPinCodes })`
- Logic: extract `X-Forwarded-For` (Cloudflare) or `X-Real-IP`
- If IP in `allowedIps` → allow immediately
- Else: query `https://ip-api.com/json/<ip>?fields=countryCode,regionName,city,zip` (free, 45 req/min)
- If city === "Meerut" AND zip in [250001, 250002] → allow
- Otherwise → 403 with `{ ok: false, error: "Admin access restricted. Your IP is not in the allowed safe zone.", ip: <masked> }`

**Step 3.2 — Apply middleware to admin routes only**
- In `bff/_dispatchRoutes.mjs` or `bff/_dispatch.mjs`
- Apply to routes: all `/auth/admin/*` and `/admin/*`
- Do NOT apply to public routes

**Step 3.3 — GitHub Actions secret for IP list**
- Add to GitHub repo Settings → Secrets:
  - `SAFE_ZONE_IPV4`: `106.219.146.101`
  - `SAFE_ZONE_CITY`: `Meerut`
  - `SAFE_ZONE_PIN_CODES`: `250001,250002`
- These get injected at deploy time into Contabo VPS env vars

### Note on Meerut IP
- Pin codes 250001, 250002 are primarily Bharti Airtel DSL/Corporate IPs
- IP range for Airtel UP East: roughly `124.0.0.0/8` — too broad
- Better approach: maintain a static list or use ip-api.com for geolocation check
- ip-api.com free tier: 45 requests/minute, enough for admin login attempts (logged in, infrequent)
- Rate limit: cache geolocation result per IP for 24h to avoid hammering API

### Files Touched
- `bff/middleware/ipSafeZone.mjs` (new — Step 3.1)
- `bff/_dispatchRoutes.mjs` (Step 3.2)
- GitHub Actions secrets (Step 3.3 — manual by Gunit)

---

## TASK 4 — TELEGRAM RELINK

### Current State
- BFF has `telegramRoutes.mjs` at `POST /telegram/send-message` and `/telegram/send-forensic-alert`
- Frontend has `src/services/telegram*.js` (5 files)
- **Not verified if token is set on Contabo VPS**

### Steps
**Step 4.1 — Verify token on Contabo VPS**
```
ssh to Contabo VPS
grep -r "TELEGRAM" ~/.env /opt/tradersapp/.env 2>/dev/null
```
Expected: `BFF_TELEGRAM_BOT_TOKEN=5...` and `BFF_TELEGRAM_CHAT_ID=-100...`

**Step 4.2 — If not set (most likely)**
- Set via Infisical or manual env file on Contabo VPS:
  ```
  BFF_TELEGRAM_BOT_TOKEN=<token from BotFather>
  BFF_TELEGRAM_CHAT_ID=<your Telegram chat ID>
  ```
- User (Gunit) needs to provide the bot token and chat ID

**Step 4.3 — If set, verify route works**
```
curl -X POST "https://bff.173.249.18.14.sslip.io/telegram/send-message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"text":"Telegram link test"}'
```

### Verification
- Telegram bot receives test message
- Site footer shows "Telegram connected" or green status

---

## TASK 5 — "RESEARCH BUTTONS" VISIBLE TEXT

### Root Cause
`src/features/auth/CleanLoginScreen.jsx:716` renders `BlogSection` with heading + description:
```jsx
<BlogSection
  heading="Research Buttons"
  description="Small, direct article buttons below the login panel..."
/>
```
The new `BlogSection` design has no heading/description props. This is leftover code.

### Fix
In `CleanLoginScreen.jsx`, replace the BlogSection render with just the sharp row buttons:
```jsx
<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
  {BLOG_POSTS.map((post) => (
    <a key={post.id} href={post.url} target="_blank" rel="noopener noreferrer"
      style={{
        fontSize: 8, fontWeight: 700, letterSpacing: 2.2,
        color: "rgba(212,165,32,0.5)", textTransform: "uppercase",
        padding: "3px 8px", border: "1px solid rgba(212,165,32,0.18)",
        borderRadius: 4, textDecoration: "none",
      }}>
      {post.eyebrow} →
    </a>
  ))}
</div>
```
Where `BLOG_POSTS` is imported from `../../components/BlogSection.jsx`

### Files Touched
- `src/features/auth/CleanLoginScreen.jsx`

---

## TASK 6 — GOOGLE SIGN IN FIX

### Root Cause (confirmed via code trace)
- Google OAuth uses **Firebase direct OAuth** (`signInWithRedirect`) — BFF is NOT in the path
- Code: `src/features/identity/authCredentialHandlers.js` → `executeStructuredGoogleAuth()` → `signInWithRedirect(firebaseAuth, googleProvider)`
- Flow: CleanLoginScreen → Firebase SDK → Google OAuth redirect → back to app
- **The "unavailable" issue is a Firebase console configuration problem**, not a code issue

### Fix (Firebase console — no code change)
1. Go to [Firebase Console](https://console.firebase.google.com) → your project
2. Authentication → Sign-in method → Google → edit
3. Under **Authorized redirect domains**, add:
   - `tradergunit.pages.dev`
   - `pages.dev` (if not already)
4. Save

If button is greyed out instead of showing an error:
- Check: Authentication → Sign-in method → Google → enable it (toggle must be ON)
- Check: your app's Web OAuth client ID includes `tradergunit.pages.dev` in authorized JavaScript origins

### Files to verify (no changes needed)
- `src/features/auth/CleanLoginScreen.jsx:336-349` — `handleGoogle()` calls `onGoogleAuth()` which calls `signInWithRedirect` — this is correct
- `src/features/identity/authCredentialHandlers.js` — Firebase direct OAuth, no BFF call — this is correct
- No code changes needed

### Verification
- Click "Continue with Google" → redirects to Google OAuth consent screen
- After OAuth: user returns to app, Firebase auth completes, user is logged in

---

## TASK 7 — LOGO / APP ICON SWAP

### What user said
New logos saved in Downloads folder on laptop. Different extensions. Want them everywhere: app icon, favicon, manifest.

### What I don't have yet
Logo files. User needs to share:
1. App thumbnail/icon (PNG, at least 192x192 and 512x512)
2. Full logo (PNG or SVG)
3. Both in white+transparent and dark+transparent variants if possible

### What to do with them once shared
| Location | File name | Size |
|---|---|---|
| `public/icon-192.png` | user-provided | 192x192 |
| `public/icon-512.png` | user-provided | 512x512 |
| `public/apple-touch-icon.png` | user-provided | 180x180 |
| `public/favicon-32x32.png` | user-provided | 32x32 |
| `public/favicon-16x16.png` | user-provided | 16x16 |
| `public/icon.png` | user-provided | original |
| `src/assets/logo.svg` | user-provided | original |
| `index.html` | apple-touch-icon href | updated |
| `manifest.json` | icons array | updated |

### Files Touched
- All `public/` icon files
- `index.html`
- `public/manifest.json`

---

## TASK 8 — BLOG POST: OUR NEW LOGO

### What to cover
1. The story of the logo (what inspired it, the thinking)
2. Brand language: white + black + brown
3. Why the brand aesthetic is old-school luxury
4. The evolution from V1 to V2 logo

### Structure
- Title: "Why Our Logo Looks The Way It Does"
- Tags: FOUNDER, BRAND, DESIGN
- Embed the logo image
- Chart: brand color usage (brown vs gold/blue — the shift)
- Quote from founder on brand philosophy

### Blog file to create
- `public/blog/our-new-logo/index.html` (follow existing blog template)

### Note
**User specified:** some info must NOT be in public blogs (secret sauce, recipes, pipeline tools, internal systems). Keep this blog at brand/story level only. Full technical depth is for the Pitch Deck only.

---

## TASK 9 — PITCH DECK PAGE (ADMIN PANEL)

### What user wants
Inside admin panel, a complete pitch deck page/presentation. Used for:
1. Getting funding
2. Making viewers/potential users excited and impressed

### Content to include (PRIVATE — not in public blogs)
- Complete vision and pipeline tools
- All systems architecture (ML models, self-improving mechanism, Board Room)
- Revenue model
- Market size and TAM
- Competitive landscape
- Traction and metrics
- Roadmap (next 12 months)
- Ask: how much funding, what for, milestones
- **Secret sauce: the full proprietary recipe** — this is what differentiates from public blogs

### UX
New route: `/admin/pitch-deck` (authenticated admin only)
- Slide-based presentation UI (like a real pitch deck)
- Keyboard navigation: arrow keys, space
- Can also be a downloadable PDF
- Print-friendly layout

### Implementation
- New file: `src/pages/AdminPitchDeck.jsx`
- Route: add to `App.jsx` → `/admin/pitch-deck` → requires admin auth
- Slides data: `src/data/pitchDeckSlides.js`
- Design: minimalist luxury (white/black/brown — matching brand direction)

### Slide Structure
```
Slide 1: Cover — "Traders Regiment" + tagline + logo
Slide 2: Problem — retail traders lack institutional tools
Slide 3: Solution — AI-powered quant desk for everyone
Slide 4: Product Demo — (screenshots, not described in detail)
Slide 5: How It Works — 12 AI models, Board Room, Watchtower (technical depth)
Slide 6: The Secret Sauce — proprietary systems (PRIVATE)
Slide 7: Market Opportunity — TAM, SAM, SOM
Slide 8: Business Model — subscription tiers, B2B
Slide 9: Traction — current users, engagement
Slide 10: Team — founder story, expertise
Slide 11: Roadmap — next 12 months
Slide 12: The Ask — funding amount, milestones
```

### Files Touched
- `src/pages/AdminPitchDeck.jsx` (new)
- `src/data/pitchDeckSlides.js` (new)
- `src/App.jsx` (new route)
- `src/features/shell/AppScreenRegistry.jsx` (nav entry if needed)

---

## TASK 10 — SECRET SAUCE PRIVACY

### What to move to private (Pitch Deck only)
- Full ML architecture details (which specific algorithms, weights, voting mechanisms)
- Self-improvement mechanism (how the system learns)
- Board Room veto logic specifics
- Exact performance metrics and backtest results
- Proprietary data sources
- Internal roadmap with specific milestones and dates
- Revenue model details with actual numbers

### What to KEEP in public blogs
- Founder story
- High-level product vision ("decision support not signals")
- General architecture overview ("12 AI models voting")
- Brand philosophy
- Screenshots (no internal system details)

### Implementation
- Audit all public blog files in `public/blog/*`
- Remove any technical details that are too revealing
- Add a note: "For detailed technical information, see the admin pitch deck"
- Create `docs/PRIVATE_PITCH_DECK_CONTENT.md` as the private vault of all secret sauce info

---

## TASK 11 — BRAND REDESIGN (White/Black/Brown)

### Brand Language Spec
```
Primary Background:   #FFFFFF (light) / #0A0A0A (dark)
Text:                 #0A0A0A (light) / #FAFAFA (dark)
Accent:                LOGO_BROWN = #8B4513 or exact logo brown (user to confirm hex)
                       DO NOT USE: #D4A520 (gold) — replace with logo brown
Secondary Text:        #6B6B6B (muted)
Borders:              rgba(0,0,0,0.08) light / rgba(255,255,255,0.08) dark
```

**Conflicting requirement:** Brand is white/black/brown. But existing theme system uses gold (`#D4A520`). Need to reconcile:
- User says "old-school luxury, white, black and brown. NOT gold/blue."
- But the logo uses a specific brown (need exact hex from logo file)
- All existing gold usage should use the logo brown instead

### What to change (files + changes)
| File | Change |
|---|---|
| `src/index.css` | Replace `--aura-accent-primary: #2563eb` with logo brown; replace all gold `#D4A520` with logo brown |
| `src/utils/uiUtils.js` | Update accent color definitions |
| `ThemeSwitcher.jsx` | Keep L/A/M toggle (functional) — colors still update but with brown palette |
| `src/features/auth/CleanLoginScreen.jsx` | Replace all gold (#D4A520, rgba gold) with logo brown |
| `src/pages/RegimentHub.jsx` | Same brown-only palette |
| `src/pages/CollectiveConsciousness.jsx` | Same |
| `public/blog/index.html` | Same |
| All component CSS | Same |

### Critical decision needed
**Logo file required first.** Need the exact brown hex value from the logo. Ask Gunit to confirm: "What is the exact hex code of the brown in your logo file?" Or share the file so I can read the color.

### Files Touched
- `src/index.css` (extensive — all theme variables)
- `src/utils/uiUtils.js`
- All JSX component files using gold colors
- `public/blog/*.html` files

---

## TASK 12 — BLOG SECTION REDESIGN

### Placement
1. **Home page (RegimentHub)** — below LinkedIn link, before the main content cards
2. **Login page (CleanLoginScreen)** — below login form, above footer strip
3. **CollectiveConsciousness** — below engine mode status bar

### Design Direction: "Old-School Editorial"
- White/black/brown color palette (matching Task 11)
- Sharp, small, one-by-one buttons
- Each blog post: small eyebrow label + arrow right
- NO card-style big boxes on home/login screens (those are for blog/ subpages)
- Charts: bar charts per blog post — creative placement (see below)
- Creative screen separation: thin brown line + eyebrow label as section separator

### Layout on RegimentHub
```
[LinkedIn card — left side]
[Blogger card — right side]

--- thin brown horizontal rule + eyebrow label ---
INTELLIGENCE. RESEARCH. VISION.
────────────────────────────────────────────---
[Founder →] [Vision →] [Architecture →]        ← 3 sharp row buttons
[mini SVG bar chart beside each]

--- next section ---
```

### Bar Chart Design
- Pure SVG, small (60x24px), brown-filled bars
- One bar per blog post (shows "read level" or stat — e.g., "01 read")
- Placed to the right of each row button
- No flashy animations — static, clean
- Brown fill: `fill="var(--accent-primary, #8B4513)"` (use logo brown variable)

### Layout on Login page
```
[Login form]

--- thin brown rule ---
[INTELLIGENCE. RESEARCH.]
[Founder →] [Vision →] [Architecture →]   ← smaller, muted
```

### Files Touched
- `src/pages/RegimentHub.jsx` (blog section position + design)
- `src/features/auth/CleanLoginScreen.jsx` (blog section below form)
- `src/pages/CollectiveConsciousness.jsx` (blog section below status bar)
- `src/components/BlogSection.jsx` (re-export clean row buttons)

---

## EXECUTION ORDER

```
Phase 1 (No deploy needed — frontend only)
├── Task 5 — Remove "Research Buttons" text        → deploy-pages-root.yml trigger
├── Task 1.2 — Suppress NY lunch false fault     → deploy-pages-root.yml trigger
└── Task 6 — Investigate Google Sign In            → depends on investigation

Phase 2 (Manual — Gunit does SSH)
└── Task 1.1 — Get Contabo SSH host key + set secret → triggers Contabo redeploy

Phase 3 (After Contabo redeploys)
├── Task 2 (all steps) — Admin login redesign
├── Task 3 (all steps) — IP safe zone
├── Task 4 (all steps) — Telegram relink
└── Task 1.2 verification — Watchtower 0 faults

Phase 4 (Gunit shares logo files)
├── Task 7 — Logo/app icon everywhere
├── Task 8 — Blog about logo
└── Task 11 — Brand redesign (confirm brown hex first)

Phase 5 (After logo + brand)
├── Task 9 — Pitch deck page in admin panel
├── Task 10 — Secret sauce privacy audit
└── Task 12 — Blog section redesign with charts
```

---

## CRITICAL DEPENDENCIES

| Dependency | Blocks |
|---|---|
| Contabo SSH fix | Tasks 2, 3, 4, Watchtower fix |
| Logo files from Gunit | Tasks 7, 8, 11, 12 |
| Exact logo brown hex | Task 11 brand redesign |
| Admin login redesign (Task 2) | Task 9 (pitch deck in admin panel) |

---

## WHAT I CANNOT DO WITHOUT YOU

1. **Contabo SSH host key** — run `ssh-keyscan -H <your-vps-ip>` and paste result into GitHub secret `CONTABO_SSH_KNOWN_HOSTS`
2. **Logo files** — drag-and-drop into this chat or share the path
3. **Exact logo brown hex** — tell me the hex (e.g. `#8B4513` or what it is)
4. **Telegram bot token + chat ID** — provide if not already set on VPS
5. **Google Sign In error details** — open browser console, click the button, report the exact error

---

## AFTER THIS PLAN

Once you approve this plan, I will:
1. Create `docs/REGULAR_TO_DO_LIST.md` with this exact content as a committed doc
2. Await your GO signal before any execution
3. Execute in the order shown above
4. Report completion status per task

**Say GO when ready. Say SKIP on any task you want to deprioritize.**
