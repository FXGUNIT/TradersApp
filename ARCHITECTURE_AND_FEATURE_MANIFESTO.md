# TRADERSAPP — ARCHITECTURE & FEATURE MANIFESTO
**Version**: 2.0 — Post-Audit Rebuild  
**Audited By**: Senior Principal Software Engineer  
**Date**: July 2025  
**App File Audited**: `src/App.jsx` — 10,906 lines  
**Build Status**: ✅ Zero ESLint errors, zero warnings  

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Full Codebase Audit — What Exists](#2-full-codebase-audit--what-exists)
3. [Phase 1 Status: UI Primitives](#3-phase-1-status-ui-primitives)
4. [Phase 2 Status: Core Services & Hooks](#4-phase-2-status-core-services--hooks)
5. [Critical Findings & Bugs](#5-critical-findings--bugs)
6. [Target Folder Structure](#6-target-folder-structure)
7. [State Management Rules](#7-state-management-rules)
8. [Extraction Priority Queue](#8-extraction-priority-queue)
9. [Naming Conventions](#9-naming-conventions)
10. [Component Architecture Rules](#10-component-architecture-rules)
11. [Hook Extraction Plan](#11-hook-extraction-plan)
12. [Constants & Config Extraction Plan](#12-constants--config-extraction-plan)
13. [AI Prompt Management Rules](#13-ai-prompt-management-rules)

---

## 1. PROJECT OVERVIEW

### What TradersApp Is
TradersApp is an institutional-grade prop trading compliance and analysis terminal. Its core purpose is to give prop traders a disciplined, rules-based execution environment that prevents violations of prop firm rules (daily loss limits, drawdown, consistency caps), combines multi-model AI analysis (5-endpoint Council of Models), and maintains a complete trade journal with P&L tracking.

### Core User Flows
| Screen | Purpose |
|--------|---------|
| Login / Signup | Firebase Auth (email+password, Google OAuth) |
| OTP Verification | Email OTP post-login gate |
| Waiting Room | New users pending admin approval |
| Regiment Hub | User landing page with navigation |
| MainTerminal | 4-tab trading terminal (Tab 1: Premarket, Tab 2: Entry, Tab 3: Journal, Tab 4: Account) |
| Session Manager | Active device session list + logout-all |
| Admin Dashboard | Full user management, mirror view, identity docs |
| Collective Consciousness | Community page |
| Onboarding | Signup flow via CleanOnboarding |

### Tech Stack (Confirmed)
- **Framework**: React 19.2.4 + Vite 8.0.0
- **Language**: Pure JavaScript (no TypeScript)
- **Styling**: 100% inline JSX styles — no CSS-in-JS library, no Tailwind
- **Firebase**: Auth (email/pass + Google) + Realtime Database (REST + v9 SDK) + Storage
- **AI**: Anthropic Claude (direct API), Groq, Gemini, OpenRouter — via `src/services/ai-router.js`
- **Notifications**: EmailJS (OTP delivery), Telegram Bot API (admin alerts)
- **Build**: ESLint v9 flat config — zero errors enforced

---

## 2. FULL CODEBASE AUDIT — WHAT EXISTS

### 2.1 — The Monolith: `src/App.jsx` (10,906 lines)

App.jsx contains **everything**. It is organized (with comment separators) but not modularized. Below is the complete inventory of what lives in this file.

#### SECTION A: Firebase & Infrastructure (~Lines 1–200)
```
firebaseApp, firebaseAuth, firebaseDb, firebaseStorage  — Firebase init
dbR(path, token)           — REST GET
dbW(path, data, token)     — REST PUT
dbM(path, data, token)     — REST PATCH
dbDel(path, token)         — REST DELETE
authPost(endpoint, body)   — Firebase Auth REST
fbSignUp(email, pass)      — Register user
fbSignIn(email, pass)      — Login user
detectGPUCapability()      — WebGL GPU detection (result unused — dead code)
withRetry(fn, retries)     — Exponential retry wrapper
gatherForensicData()       — Device/IP fingerprint collector
sendTelegramAlert(msg)     — Telegram bot messaging
sendForensicAlert(email, type)  — Formatted intrusion alert
genOTP()                   — 6-digit OTP generator
```

#### SECTION B: Session & Security Utilities (~Lines 200–500)
```
encryptSessionToken(token) — XOR cipher on session token
generateSessionId()        — Crypto-random session ID
createSession(uid, token, persist)   — Firebase session creation
logoutOtherDevices(uid, sessionId, token)  — Terminate all sessions
getDevice()                — Device type from user agent
getDeviceInfo()            — Extended device metadata
getSessionGeoData()        — IP geolocation fetch
calculatePasswordStrength(pass)      — Entropy-based strength scorer
getStrengthLabel(score)    — "Weak/Fair/Strong/Very Strong"
isValidGmailAddress(email) — Gmail-only validator
isPasswordExpired(dateStr) — 120-day expiry check
hashAdminPasswordWithSalt(pass)      — PBKDF2-style hash with MASTER_SALT
MASTER_SALT                — Static salt constant (⚠️ move to env var)
```

#### SECTION C: Cache & Search Utilities (~Lines 500–700)
```
cacheUserList(data)        — localStorage user list cache
getCachedUserList()        — Retrieve with 5-minute TTL check
clearUserListCache()       — Invalidate cache
fuzzySearchScore(str, query)      — Character-by-character fuzzy match
highlightMatches(str, query)      — Returns [{text, match}] segments
renderHighlightedText(str, query) — React JSX with highlighted spans
```

#### SECTION D: UI Utilities (~Lines 700–900)
```
triggerConfetti(count, rounds)    — DOM confetti burst (Rule #123)
copyToClipboard(text, label, showToast)       — Clipboard write with toast
copyToClipboardSecure(text, label, showToast) — Fallback clipboard method
createCardTiltHandler(element)    — 3D perspective tilt on mousemove
```

#### SECTION E: IST Clock & Time Utilities (~Lines 900–1100)
```
getISTState()              — {isOpen, session, countdown, phase}
getTimeBasedGreeting(name) — {greeting, fullGreeting} based on IST hour
getUserLevelBadge(user)    — {level, color, bg} based on join date + trades
TIME_OPTIONS               — Predefined IST time slots array
```

#### SECTION F: Complex UI Components (~Lines 1100–2200)
```
CommandPalette             — Keyboard shortcut Cmd+K modal navigator
UserSwitcher               — Admin: jump between user views
FullScreenToggle           — Fullscreen button + keyboard handler
MobileBottomNav            — iOS-style bottom navigation bar
SafeAreaWrapper            — iPhone notch/home indicator safe area
NotificationCenter         — Notification bell with panel
SystemThemeSync            — OS dark/light mode sync connector
Breadcrumbs                — Route breadcrumb trail
MegaMenu                   — Full-width dropdown navigation menu
BackToTopButton            — Scroll-to-top floating button
compressIdentityProofImage(file) — Canvas-based image compression
uploadIdentityDoc(file, uid, token, type) — Firebase Storage upload
```

#### SECTION G: Theme System (~Lines 2200–2400)
```
createTheme(isDark, accentKey) — Returns T object
T                          — Active theme object (colors, fonts)
ACCENT_COLORS              — {TRADING_GREEN, GOLD, BLUE, PURPLE, CYAN, PINK}
useSystemTheme()           — Custom hook: OS prefers-color-scheme
```

#### SECTION H: Global Constants (~Lines 2400–2600)
```
ADMIN_UID                  — Firebase UID of master admin
ADMIN_EMAIL                — Admin email address
ADMIN_PASS_HASH            — Hashed admin password (PBKDF2)
TELEGRAM_TOKEN             — Bot token (⚠️ HARDCODED — must move to .env)
TELEGRAM_CHAT_ID           — Chat ID (⚠️ HARDCODED — must move to .env)
FB_KEY                     — Firebase Web API Key (⚠️ HARDCODED)
AMD_PHASES                 — {ACCUMULATION, MANIPULATION, DISTRIBUTION, UNCLEAR} with labels/colors
OFFICERS_BRIEFING          — Array of 20 rotating motivational quotes
getRandomQuote()           — Returns random OFFICERS_BRIEFING entry
```

#### SECTION I: AI System Prompts (~Lines 2600–2900)
```
PART1_PROMPT               — ~150 lines: Premarket AMD analysis instructions
PART2_PROMPT               — ~80 lines: Trade entry compliance analysis instructions
SCREENSHOT_EXTRACT_PROMPT  — Indicator value extraction from chart screenshots
TNC_PARSE_PROMPT           — Prop firm T&C PDF parsing into structured JSON
```

#### SECTION J: Auth UI Primitives (~Lines 2900–3100)
```
authCard                   — Card container style (borderRadius:24, maxWidth:460)
authInp                    — Input style (height:44, dark bg)
authBtn(color, disabled)   — Button factory function
lbl                        — Label style (uppercase, 11px, letter-spacing)
inp                        — General input style
cardS(overrides)           — Card style factory (glass, rounded, padded)
glowBtn(color, disabled)   — Glow button factory with disabled state
```

#### SECTION K: Core UI Primitives (~Lines 3100–3500)
```
AuthLogo                   — App logo with branding text
SplashScreen               — Full-screen animated loading splash
LED(color, size, pulse)    — Pulsing status indicator dot
Tag(label, color)          — Pill/badge label component
SHead(icon, title, color)  — Section header with icon
Field(label, value, onChange, options, type, mono) — Universal form field
Loader                     — Simple spinner
VideoLoader                — Heavyweight skeleton animation
TableSkeletonLoader        — Admin table placeholder rows
RenderOut(text)            — Markdown renderer for AI outputs
AMDPhaseTag(phase)         — AMD phase badge with color
TrafficLight(state)        — Red/yellow/green execution signal component
CountdownBanner(ist)       — Market open countdown strip
PasteZone(zoneId, ...)     — Paste/drop target wrapper for charts
HourlyHeatmap(hourlyHeatmap) — 24-column trade activity heatmap
LoadingOverlay             — Full-screen loading dim
SkeletonLoader             — Generic shimmer placeholder
LazyImage                  — Intersection-observer lazy image
EmptyStateCard(searchQuery, filterStatus) — "No results" card
```

#### SECTION L: Auth Screens (~Lines 3500–4500)
```
Toast(toasts, onDismiss)   — Toast notification stack (top-right)
ThemePicker(isOpen, ...)   — Accent color selection modal (6 options)
LoginScreen(...)           — Email+password login with "Stay Logged In"
ImageCropper(...)          — Canvas-based circular avatar cropper
IdentityVerificationComponent(...) — Aadhar/Passport/License/PAN upload flow
GoogleSignInButton(...)    — Firebase Google OAuth button
OTPScreen(...)             — 6-digit OTP entry with auto-submit
ForcePasswordResetScreen(...)  — Forced reset when password > 120 days old
WaitingRoom(...)           — Pending approval with auto-refresh
LoadingFallback            — React.Suspense fallback div
ErrorBoundaryAdmin         — Class component error boundary for AdminDashboard
```

#### SECTION M: Context (~Lines 4500–4700)
```
UserListContext            — React Context for admin user list state
UserListProvider(children) — Provider: fetches/subscribes to Firebase users
useUserList()              — Consumer hook
```

#### SECTION N: Support (~Lines 4700–5000)
```
SupportChatModal(...)      — Admin <-> Trader real-time chat via Firebase
detectDuplicateIPs(users)  — Scans user list for shared IP addresses
```

#### SECTION O: Utility Screens (~Lines 5000–5200)
```
MaintenanceScreen          — Full-screen "Back Soon" overlay
DebugOverlay(...)          — Admin-only perf monitor with console intercept
```

#### SECTION P: AdminDashboard (~Lines 5200–8100)
```
AdminDashboard(auth, onLogout, isAdminAuthenticated, showToast,
               maintenanceModeActive, handleToggleMaintenanceMode)

60+ internal useState variables:
  users, loading, dbError, searchQuery, filterStatus
  balanceFilter, showAdvancedFilter, rowDensity, rowsPerPage, currentPage
  sortConfig, visibleColumns, mirror, mirrorData
  chatWith, chatModalOpen, selectedUserDocs
  duplicateIPs, isMobileView

Internal functions:
  approve(uid)       — Set status ACTIVE + Telegram alert
  block(uid)         — Set status BLOCKED + Telegram alert
  openMirror(uid)    — Load full user data into mirror panel
  normalizeStatus(s) — 'active'/'ACTIVE'/'Active' -> 'ACTIVE'

Features:
  - Stats cards (total, active, pending, blocked users)
  - Live fuzzy search with highlight
  - Filter by status (ALL/PENDING/ACTIVE/BLOCKED)
  - Advanced filter: date range, balance range
  - Grid controls: density toggle, rows-per-page, column picker
  - Paginated user table (10/50/100 per page) with sort
  - Approve / Ban / Restore / View Docs / Message buttons per row
  - Right-panel Mirror View (read-only user dashboard with journal stats)
  - Duplicate IP fraud detection flag (orange "DUP IP" tag)
  - Identity Documents modal viewer (Aadhar/Passport/License/PAN)
  - Direct support chat via SupportChatModal
  - Mobile-responsive card layout
```

#### SECTION Q: SessionsManagementScreen (~Lines 8100–8300)
```
SessionsManagementScreen(profile, auth, currentSessionId, onBack, showToast)
  - Lists all active sessions from Firebase users/{uid}/sessions
  - Shows device name, city/country, last active timestamp
  - "Logout All Other Devices" button
```

#### SECTION R: MainTerminal (~Lines 8300–10200)
```
MainTerminal(profile, onLogout, onSaveJournal, onSaveAccount, onSaveFirmRules, showToast)

Navigation Tabs: PREMARKET (1) | TRADE ENTRY (2) | JOURNAL (3) | ACCOUNT MANAGER (4)

Key state:
  - part (active tab), loading, err
  - ist (IST clock, updated every 1000ms)
  - screenshots[], extractedVals (ADX, CI, VWAP, ATR from vision)
  - f (trade form: instrument, direction, riskPct, entryPrice, etc.)
  - journal[] (trade history array)
  - firmRules (parsed prop firm T&C object)
  - accountState (startingBalance, currentBalance, highWaterMark, dailyStartBalance)

Math Engine (derived constants in render body):
  VR = calculateVolatilityRatio(5dayATR, 20dayATR)
  {vwapSD1, vwapSD2, trendSLMult, mrSLMult} = getDynamicParameters(VR)
  {activeRiskPct, isThrottled} = calculateThrottledRisk(riskPct, VR, balance, maxDD)
  contracts, proposedSLDollars, sd1Target, sd2Target

Compliance Engine (derived constants in render body):
  isDailyBreached, isDDBreached, isConsistencyBreached
  isDeadZone (ADX < 20 OR CI > 61.8)
  execBlocked, execBlockReason (string)
  trafficState = 'red' | 'yellow' | 'green' | 'none'

AI Functions:
  extractFromScreenshots() — Claude vision: ADX/CI/VWAP/ATR from screenshots
  parseTandC(text)         — Claude: PDF text -> structured firm rules JSON
  runPart2()               — 5-model council trade entry analysis
  buildFirmContext()       — Formats compliance data as AI context string

TAB 1 (PREMARKET): ⚠️ CRITICAL BUG — EMPTY. The part==='1' render block is absent.
TAB 2 (TRADE ENTRY): Full compliance UI, chart paste zones, AI analysis, trade log form
TAB 3 (JOURNAL): P&L stats cards, full trade history table with delete
TAB 4 (ACCOUNT MANAGER): T&C drag-drop parser, balance fields, extracted firm rules display
```

#### SECTION S: Root Component & Router (~Lines 10200–10300)
```
TradersRegiment() — Root exported default component

Screen state machine:
  loading          -> SplashScreen (while checking localStorage admin session)
  login            -> LoginScreen + Admin Auth Modal (Triple-OTP + Master Password)
  signup           -> CleanOnboarding (pages)
  waiting          -> WaitingRoom
  otp              -> OTPScreen
  forcePasswordReset -> ForcePasswordResetScreen
  sessions         -> SessionsManagementScreen
  hub              -> RegimentHub (pages)
  consciousness    -> CollectiveConsciousness (pages)
  admin            -> AdminDashboard (ErrorBoundary + Suspense + UserListProvider)
  app              -> MainTerminal (Privacy Mode toggle + Session button + Theme controls)
  default          -> SplashScreen

Global auth flows:
  handleLogin()         — validates, fbSignIn, session creation, screen routing
  handleSignup()        — AntiSpamShield check, fbSignUp, Firebase profile init
  handleOTPVerified()   — role-based routing post-OTP
  handlePasswordReset() — Firebase Auth password update
  handleLogout()        — full state clear + Firebase signOut + cache clear
  sendAdminOTPs()       — Triple OTP to 3 emails via EmailJS
  verifyAdminOTPs()     — sessionStorage OTP cross-check (5-minute TTL)
  handleAdminAccess()   — final PBKDF2 password hash check before admin entry
  checkUserStatus()     — Firebase user fetch + routing decision
  showToast(msg, type, duration) — Creates toast with auto-dismiss + Web Audio sound
  playNotificationSound(type) — Web Audio API ascending/descending tones
```

#### SECTION T: Global Styles (~Lines 10300–10906)
```
Injected via document.createElement("style") at module load.

Keyframes: bar, led-pulse, fadein, pulse, shimmer, spin, float,
  fadeInDashboard, slideInToast, glowBorder, confetti-fall,
  confetti-rotate, tilt-in, pulse-critical, pulse-attention,
  neonGlow, subtleGlow, bounce-in, shake, slide-in-left, slide-in-right

CSS Classes:
  .glass-panel          — backdrop-filter blur(12px), border, border-radius
  .btn-glass            — glassmorphic button with hover lift + active scale
  .input-glass          — glassmorphic input with focus glow
  .card-tilt            — perspective-1000px 3D hover tilt
  .btn-pending-pulse    — pulse-critical animation for approve buttons
  .gemini-gradient-text — white->gray gradient text fill
  .glassmorphic-card/sidebar/modal/table/dropdown (variants)
  .active-glow variants (green, gold, purple, cyan, pink)
  .icon, .icon-xs/sm/md/lg/xl
  h1/h2/h3/p/small/label — Typography hierarchy
  ::-webkit-scrollbar   — Custom 4px blue scrollbar
```

---

### 2.2 — Already-Extracted Modules

#### `/src/pages/` — 6 files ✅
`CleanOnboarding.jsx`, `RegimentHub.jsx`, `CollectiveConsciousness.jsx`,
`PrivacyPolicy.jsx`, `RegimentEULA.jsx`, `TermsOfService.jsx`

#### `/src/components/` — 3 files ✅
`ThemeSwitcher.jsx`, `FounderCard.jsx`, `MessageRenderer.jsx`

#### `/src/services/` — 11 files ✅
`ai-router.js`, `firebaseHeartbeat.js`, `firebaseOptimization.js`,
`leakagePreventionModule.js`, `performanceTestRunner.js`, `ragVerificationLayer.js`,
`securityMonitor.js`, `securitySentinel.js`, `socialEngineeringDetectionModule.js`,
`telegramDiagnostics.js`, `telegramMonitor.js`

#### `/src/utils/` — 5+ files ✅
`math-engine.js`, `businessLogicUtils.jsx`, `imageOptimizationChecker.js`,
`performanceBenchmark.js`, `uiAuditRunner.js` + related audit utils

#### `/src/context/` — ❌ EMPTY
`UserListContext` is still inside App.jsx — not yet extracted.

---

## 3. PHASE 1 STATUS: UI PRIMITIVES

**Definition**: Phase 1 = All reusable UI building blocks extracted to `/src/components/ui/`.

**Phase 1 Completion: ~15%** — 3 of ~21 target components extracted.

### What's Done ✅
`ThemeSwitcher`, `FounderCard`, `MessageRenderer`

### What's Still in App.jsx (Must Extract)

| Component | Priority | Used In |
|-----------|----------|---------|
| `Toast` | CRITICAL | Root TradersRegiment |
| `Field` | HIGH | Terminal Tab 2, Tab 4, Admin |
| `SHead` | HIGH | Every card in Admin + Terminal |
| `LED` | HIGH | Admin header, Terminal header |
| `Tag` | HIGH | Terminal, Admin |
| `TrafficLight` | MEDIUM | Terminal Tab 2 |
| `ThemePicker` | HIGH | Root TradersRegiment |
| `AMDPhaseTag` | MEDIUM | Terminal |
| `CountdownBanner` | MEDIUM | Terminal |
| `PasteZone` | MEDIUM | Terminal Tab 2 |
| `HourlyHeatmap` | MEDIUM | Terminal Tab 2 |
| `RenderOut` | MEDIUM | Terminal Tab 2 AI output |
| `EmptyStateCard` | LOW | AdminDashboard |
| `SkeletonLoader` | LOW | Multiple screens |
| `TableSkeletonLoader` | LOW | AdminDashboard |
| `LazyImage` | LOW | Auth screens |
| `LoadingOverlay` | LOW | Auth screens |
| `Loader` / `VideoLoader` | LOW | Loading states |
| `BackToTopButton` | LOW | AdminDashboard |
| `CommandPalette` | LOW | App overlay |
| `MobileBottomNav` | LOW | Mobile layout |

---

## 4. PHASE 2 STATUS: CORE SERVICES & HOOKS

**Definition**: Phase 2 = All business logic, Firebase interactions, and hooks isolated from UI code.

### Services: What's Done ✅
All 11 files in `/src/services/` are correctly extracted.

### Services: Still in App.jsx

| Target File | Contents to Extract |
|-------------|---------------------|
| `src/services/firebase.js` | `firebaseApp`, `firebaseAuth`, `firebaseDb`, `firebaseStorage`, `dbR`, `dbW`, `dbM`, `dbDel`, `authPost`, `fbSignUp`, `fbSignIn` |
| `src/utils/security.js` | `calculatePasswordStrength`, `getStrengthLabel`, `isValidGmailAddress`, `isPasswordExpired`, `hashAdminPasswordWithSalt`, `gatherForensicData`, `sendTelegramAlert`, `sendForensicAlert` |
| `src/utils/sessionUtils.js` | `createSession`, `logoutOtherDevices`, `getDevice`, `getDeviceInfo`, `getSessionGeoData`, `encryptSessionToken`, `generateSessionId` |
| `src/utils/cacheUtils.js` | `cacheUserList`, `getCachedUserList`, `clearUserListCache` |
| `src/utils/searchUtils.js` | `fuzzySearchScore`, `highlightMatches`, `renderHighlightedText` |
| `src/utils/uiUtils.js` | `triggerConfetti`, `copyToClipboard`, `copyToClipboardSecure`, `createCardTiltHandler` |
| `src/utils/istUtils.js` | `getISTState`, `getTimeBasedGreeting`, `getUserLevelBadge`, `TIME_OPTIONS` |

### Hooks: What's Done
**None** — `/src/hooks/` folder does not exist yet.

### Hooks: Still in App.jsx

| Hook | Target File | Status |
|------|-------------|--------|
| `useSystemTheme` | `src/hooks/useSystemTheme.js` | ❌ In App.jsx |
| `useUserList` | `src/context/UserListContext.jsx` | ❌ In App.jsx |
| `useToast` (not abstracted) | `src/hooks/useToast.js` | ❌ Must build |
| `useIST` (not abstracted) | `src/hooks/useIST.js` | ❌ Must build |
| `useComplianceEngine` (not abstracted) | `src/hooks/useComplianceEngine.js` | ❌ Must build |

**Phase 2 Completion: ~55%** — Services done; Firebase module, all hooks, and 7 utility files remain.

---

## 5. CRITICAL FINDINGS & BUGS

### BUG-001 — MainTerminal Tab 1 (PREMARKET) Renders Nothing
**Severity**: CRITICAL — Core feature non-functional  
**Location**: `MainTerminal` render, between Navigation Tabs and Tab 2  
**Finding**: The `{part === '1' && (...)}` block is completely absent. There is an empty `<div style={{ maxWidth: 1440... }}></div>` followed immediately by Tab 2's code block. Clicking the PREMARKET tab shows a blank page.  
**Evidence**: State variables `currentAMD`, `parsed`, `p1Out` have their setters (`_setCurrentAMD`, `_setParsed`, `_setP1Out`) prefixed with `_` — never called. The AMD phase displayed across the app is permanently `"UNCLEAR"`.  
**Fix Required**: Implement the full PREMARKET tab UI — chart paste zones for news/premarket/key-levels charts, a `runPart1()` function calling `runDeliberation()` with `PART1_PROMPT`, AMD phase selector, and output display. This is the foundational analysis step the entire system is designed around.

### BUG-002 — Hardcoded Secrets in Source Code
**Severity**: HIGH — Security / Credential Exposure  
**Location**: App.jsx constants section  
**Finding**: `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, and `FB_KEY` are string literals committed directly in source.  
**Fix Required**: Move to `.env` (add `.env` to `.gitignore`). Access via `import.meta.env.VITE_TELEGRAM_TOKEN`, etc.

### BUG-003 — Static MASTER_SALT Weakens Admin Password Hash
**Severity**: MEDIUM — Security Degradation  
**Location**: App.jsx security utils section  
**Finding**: The salt for `hashAdminPasswordWithSalt` is a hardcoded string constant in source. If source is exposed, the admin password hash can be precomputed.  
**Fix Required**: Move to `import.meta.env.VITE_ADMIN_SALT`.

### BUG-004 — Tab 1 State Variables Are Orphaned (Dead Code)
**Severity**: MEDIUM — Misleading dead code  
**Finding**: `_setCurrentAMD`, `_setParsed`, `_setP1Out`, `setP1NewsChart`, `setP1PremarketChart`, `setP1KeyLevelsChart` are declared and initialized but never called. AMD phase is always `"UNCLEAR"`, `parsed` is always `null`.  
**Fix Required**: Implement Part 1 run function or remove the state.

### BUG-005 — `detectGPUCapability()` Result Is Discarded
**Severity**: LOW — Dead code  
**Finding**: GPU capability is detected on init but the return value is never stored or used.  
**Fix Required**: Remove, or wire to a performance-adaptive rendering decision.

### BUG-006 — `UserListContext` Folder Is Empty
**Severity**: LOW — Architectural debt  
**Finding**: `/src/context/` is an empty directory. `UserListContext`, `UserListProvider`, and `useUserList` are declared in App.jsx.  
**Fix Required**: Extract to `src/context/UserListContext.jsx`.

### BUG-007 — Direct Claude API Calls Bypass ai-router
**Severity**: LOW — Architectural inconsistency  
**Finding**: `extractFromScreenshots()` and `parseTandC()` call `https://api.anthropic.com/v1/messages` directly, bypassing the 5-model council in `ai-router.js` and its fallback/caching logic.  
**Fix Required**: Add `runVisionExtraction()` and `runTnCParse()` methods to `ai-router.js`. Migrate both functions to use them.

---

## 6. TARGET FOLDER STRUCTURE

This is the **production-ready target state** for `/src/`. Files marked ✅ exist. Files marked ❌ need to be created or extracted.

```
src/
|
+-- main.jsx                              # ✅ Vite entry — unchanged
+-- App.jsx                               # TARGET: ~200 lines (root router only)
+-- App.css
+-- index.css
|
+-- components/
|   |
|   +-- ui/                               # Stateless primitive components
|   |   +-- LED.jsx                       # ❌
|   |   +-- Tag.jsx                       # ❌
|   |   +-- SHead.jsx                     # ❌
|   |   +-- Field.jsx                     # ❌
|   |   +-- Toast.jsx                     # ❌
|   |   +-- ThemePicker.jsx               # ❌
|   |   +-- AMDPhaseTag.jsx               # ❌
|   |   +-- TrafficLight.jsx              # ❌
|   |   +-- CountdownBanner.jsx           # ❌
|   |   +-- PasteZone.jsx                 # ❌
|   |   +-- HourlyHeatmap.jsx             # ❌
|   |   +-- RenderOut.jsx                 # ❌
|   |   +-- EmptyStateCard.jsx            # ❌
|   |   +-- SkeletonLoader.jsx            # ❌
|   |   +-- TableSkeletonLoader.jsx       # ❌
|   |   +-- LazyImage.jsx                 # ❌
|   |   +-- LoadingOverlay.jsx            # ❌
|   |   +-- Loader.jsx                    # ❌
|   |   +-- VideoLoader.jsx               # ❌
|   |   +-- BackToTopButton.jsx           # ❌
|   |
|   +-- navigation/
|   |   +-- CommandPalette.jsx            # ❌
|   |   +-- MobileBottomNav.jsx           # ❌
|   |   +-- Breadcrumbs.jsx               # ❌
|   |   +-- MegaMenu.jsx                  # ❌
|   |   +-- NotificationCenter.jsx        # ❌
|   |   +-- UserSwitcher.jsx              # ❌
|   |   +-- FullScreenToggle.jsx          # ❌
|   |
|   +-- auth/
|   |   +-- LoginScreen.jsx               # ❌
|   |   +-- OTPScreen.jsx                 # ❌
|   |   +-- ForcePasswordResetScreen.jsx  # ❌
|   |   +-- WaitingRoom.jsx               # ❌
|   |   +-- ImageCropper.jsx              # ❌
|   |   +-- IdentityVerificationComponent.jsx  # ❌
|   |   +-- GoogleSignInButton.jsx        # ❌
|   |
|   +-- admin/
|   |   +-- AdminDashboard.jsx            # ❌ (extract 3,000 lines)
|   |   +-- AdminAuthModal.jsx            # ❌ (extract inline modal from login case)
|   |   +-- SupportChatModal.jsx          # ❌
|   |   +-- DebugOverlay.jsx              # ❌
|   |
|   +-- terminal/
|   |   +-- MainTerminal.jsx              # ❌ (extract + wire Tab 1)
|   |   +-- PremarketTab.jsx              # ❌ BUILD — Tab 1 (currently missing)
|   |   +-- TradeEntryTab.jsx             # ❌ (extract Tab 2)
|   |   +-- JournalTab.jsx                # ❌ (extract Tab 3)
|   |   +-- AccountManagerTab.jsx         # ❌ (extract Tab 4)
|   |
|   +-- overlays/
|   |   +-- SplashScreen.jsx              # ❌
|   |   +-- MaintenanceScreen.jsx         # ❌
|   |   +-- SafeAreaWrapper.jsx           # ❌
|   |   +-- SystemThemeSync.jsx           # ❌
|   |
|   +-- ThemeSwitcher.jsx                 # ✅
|   +-- FounderCard.jsx                   # ✅
|   +-- MessageRenderer.jsx               # ✅
|
+-- pages/
|   +-- CleanOnboarding.jsx               # ✅
|   +-- RegimentHub.jsx                   # ✅
|   +-- CollectiveConsciousness.jsx        # ✅
|   +-- SessionsManagementScreen.jsx      # ❌ (extract from App.jsx)
|   +-- PrivacyPolicy.jsx                 # ✅
|   +-- RegimentEULA.jsx                  # ✅
|   +-- TermsOfService.jsx                # ✅
|
+-- context/
|   +-- UserListContext.jsx               # ❌ (extract from App.jsx)
|
+-- hooks/
|   +-- useSystemTheme.js                 # ❌ (extract from App.jsx)
|   +-- useIST.js                         # ❌ (build)
|   +-- useToast.js                       # ❌ (build)
|   +-- useComplianceEngine.js            # ❌ (build — major extraction)
|
+-- services/
|   +-- firebase.js                       # ❌ (extract from App.jsx)
|   +-- ai-router.js                      # ✅
|   +-- firebaseHeartbeat.js              # ✅
|   +-- firebaseOptimization.js           # ✅
|   +-- leakagePreventionModule.js        # ✅
|   +-- performanceTestRunner.js          # ✅
|   +-- ragVerificationLayer.js           # ✅
|   +-- securityMonitor.js                # ✅
|   +-- securitySentinel.js               # ✅
|   +-- socialEngineeringDetectionModule.js  # ✅
|   +-- telegramDiagnostics.js            # ✅
|   +-- telegramMonitor.js                # ✅
|
+-- utils/
|   +-- security.js                       # ❌ (extract from App.jsx)
|   +-- sessionUtils.js                   # ❌ (extract from App.jsx)
|   +-- cacheUtils.js                     # ❌ (extract from App.jsx)
|   +-- searchUtils.js                    # ❌ (extract from App.jsx)
|   +-- uiUtils.js                        # ❌ (extract from App.jsx)
|   +-- istUtils.js                       # ❌ (extract from App.jsx)
|   +-- math-engine.js                    # ✅
|   +-- businessLogicUtils.jsx            # ✅
|   +-- imageOptimizationChecker.js       # ✅
|   +-- performanceBenchmark.js           # ✅
|   +-- uiAuditRunner.js                  # ✅
|
+-- constants/
    +-- index.js                          # ❌ (build)
    +-- aiPrompts.js                      # ❌ (extract 4 prompt constants)
    +-- theme.js                          # ❌ (extract createTheme, T, design primitives)
```

---

## 7. STATE MANAGEMENT RULES

These are strict, non-negotiable rules. No exceptions without architectural review.

### Rule 1 — State Lives at the Lowest Possible Owner
State that is only used inside one component lives in that component with `useState`. State shared between siblings is lifted to their nearest common parent. State needed app-wide uses Context.

### Rule 2 — Three Tiers of State

| Tier | Mechanism | Used For |
|------|-----------|----------|
| Local UI State | `useState` inside component | Form inputs, modal open/closed, loading flags, hover states |
| Shared App State | `useContext` + Context provider | Auth (auth, profile, screen), user list, toast queue |
| Server State | Firebase via `dbR/dbW/dbM` | Users, journal, firmRules, accountState, sessions |

### Rule 3 — Context Is Not a Redux Store
Context is for values that rarely change and are needed by many components. DO NOT put frequently-updating values (form fields, search queries, hover state) in Context. Every Context value change re-renders all subscribers.

### Rule 4 — No State in `/src/services/`
Services are pure functions and class instances with no React state. They receive data, do async work, and return results. State from their outputs is owned by the calling component or hook.

### Rule 5 — Firebase Is the Source of Truth for Persistence
All data that must survive a page refresh lives in Firebase.

`localStorage` is used ONLY for:
- `appAccentColor` (UI preference)
- `appTheme` (UI preference)
- `isAdminAuthenticated` (admin session flag)
- `TradersApp_MaintenanceMode` (admin control flag)

`sessionStorage` is used ONLY for:
- `adminOtps` (ephemeral, 5-minute TTL — correct usage)

### Rule 6 — Derived State Is Never Stored
If a value can be calculated from existing state, it is a `const`, not a `useState`. This is already correctly done in MainTerminal for `contracts`, `proposedSLDollars`, `sd1Target`, `complianceBlocked`, `execBlocked`, `trafficState` — maintain this discipline everywhere.

### Rule 7 — Async State Pattern
Every async operation follows this exact pattern:
```js
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [data, setData] = useState(null);

const fetchSomething = async () => {
  setLoading(true);
  setError('');
  try {
    const result = await someAsyncCall();
    setData(result);
  } catch (e) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
};
```

### Rule 8 — Form State Is Local
Form fields are always local component state. They are only sent to Firebase on explicit user action (save button), not on every keystroke.

### Rule 9 — No `useEffect` for Derived Values
`useEffect` is for side effects: subscriptions, timers, DOM access, data fetching. Never use `useEffect` to keep derived state in sync — compute it inline instead.

### Rule 10 — Context Providers Are Flat
Never nest more than 2 Context providers. If you need more than 2, compose them in a single `Providers.jsx` wrapper.

---

## 8. EXTRACTION PRIORITY QUEUE

Extract in this exact order. Each item is a discrete, independently deployable unit of work. After each extraction, verify: `npm run build` returns exit code 0 with zero ESLint errors.

### PRIORITY 0 — Security (Do This First, Blocks Everything Else)
1. Create `.env` file: add `VITE_TELEGRAM_TOKEN`, `VITE_TELEGRAM_CHAT_ID`, `VITE_FB_KEY`, `VITE_ADMIN_SALT`
2. Add `.env` to `.gitignore`
3. Replace all 5 hardcoded secrets in App.jsx with `import.meta.env.VITE_*`

### PRIORITY 1 — Context (Unblocks Admin extraction)
4. Extract `UserListContext` + `UserListProvider` + `useUserList` -> `src/context/UserListContext.jsx`
5. Update the import in the admin case of TradersRegiment

### PRIORITY 2 — Firebase Service (Unblocks everything — most import sites)
6. Create `src/services/firebase.js` with Firebase init + all REST helpers
7. Update ~40+ call sites in App.jsx to import from `../services/firebase`

### PRIORITY 3 — Constants (Unblocks component extraction)
8. Create `src/constants/aiPrompts.js` — extract the 4 AI prompts
9. Create `src/constants/theme.js` — extract `createTheme`, T, all style primitives
10. Create `src/constants/index.js` — extract `ADMIN_UID`, `AMD_PHASES`, `ACCENT_COLORS`, `TIME_OPTIONS`, `OFFICERS_BRIEFING`, `getRandomQuote`

### PRIORITY 4 — Hooks
11. Create `src/hooks/` folder
12. Extract `useSystemTheme` -> `src/hooks/useSystemTheme.js`
13. Build `useIST` -> `src/hooks/useIST.js`
14. Build `useToast` -> `src/hooks/useToast.js`

### PRIORITY 5 — Utilities
15. `src/utils/security.js` — password utils + hash + forensic functions
16. `src/utils/sessionUtils.js` — session creation + device detection
17. `src/utils/cacheUtils.js` — user list cache
18. `src/utils/searchUtils.js` — fuzzy search + highlight
19. `src/utils/uiUtils.js` — confetti, clipboard, cardTilt
20. `src/utils/istUtils.js` — IST clock + greeting + user badge

### PRIORITY 6 — High-Impact UI Primitives
21. `src/components/ui/Toast.jsx`
22. `src/components/ui/Field.jsx`
23. `src/components/ui/SHead.jsx`
24. `src/components/ui/LED.jsx`
25. `src/components/ui/Tag.jsx`
26. `src/components/ui/TrafficLight.jsx`
27. `src/components/ui/RenderOut.jsx`
28. `src/components/ui/ThemePicker.jsx`

### PRIORITY 7 — Auth Screens
29. `src/components/auth/LoginScreen.jsx`
30. `src/components/auth/OTPScreen.jsx`
31. `src/components/auth/ForcePasswordResetScreen.jsx`
32. `src/components/auth/WaitingRoom.jsx`
33. `src/components/auth/GoogleSignInButton.jsx`
34. `src/components/admin/AdminAuthModal.jsx` (the inline modal from login case)

### PRIORITY 8 — Critical Feature Build
35. BUILD `PremarketTab.jsx` (Tab 1 — currently empty):
    - Chart paste zones: news chart, premarket chart, key levels chart
    - `runPart1()` function calling `runDeliberation(PART1_PROMPT, context)`
    - AMD phase output display
    - Wire `setCurrentAMD`, `setParsed`, `setP1Out` to actual outputs
    - Part 1 loading state with council stage progress indicator

### PRIORITY 9 — Large Screen Extraction
36. `src/components/admin/AdminDashboard.jsx`
37. `src/components/terminal/MainTerminal.jsx` (tabs 2, 3, 4 only; Tab 1 already in PremarketTab)
38. `src/pages/SessionsManagementScreen.jsx`
39. `src/components/admin/SupportChatModal.jsx`
40. `src/components/admin/DebugOverlay.jsx`

### PRIORITY 10 — Remaining Lower-Priority Primitives
All remaining components from Sections K and F: `AMDPhaseTag`, `CountdownBanner`, `PasteZone`, `HourlyHeatmap`, `EmptyStateCard`, `SkeletonLoader`, `LazyImage`, `LoadingOverlay`, `Loader`, `VideoLoader`, `BackToTopButton`, `CommandPalette`, `MobileBottomNav`, `Breadcrumbs`, `MegaMenu`, `NotificationCenter`, `UserSwitcher`, `FullScreenToggle`, `SplashScreen`, `MaintenanceScreen`, `SafeAreaWrapper`, `SystemThemeSync`

---

## 9. NAMING CONVENTIONS

### Files
| Type | Convention | Example |
|------|------------|---------|
| React Component | PascalCase.jsx | `TradeEntryTab.jsx` |
| Custom Hook | camelCase with `use` prefix, .js | `useComplianceEngine.js` |
| Service | camelCase.js | `firebase.js` |
| Utility module | camelCase.js | `sessionUtils.js` |
| Constants module | camelCase.js | `aiPrompts.js` |
| Page | PascalCase.jsx | `RegimentHub.jsx` |

### Functions & Variables
| Type | Convention | Example |
|------|------------|---------|
| React Component | PascalCase | `function MainTerminal({ ... })` |
| Event Handler | `handle` prefix | `handleLogin`, `handleAdminAccess` |
| Async fetch | `fetch`/`load`/`get` prefix | `fetchSessions`, `loadUserData` |
| Boolean state | `is`/`has`/`show` prefix | `isAdminAuthenticated`, `showThemePicker` |
| Loading state | `loading` or descriptor+`ing` | `loading`, `tcParsing`, `extracting` |
| Error state | `err` or `error` | `err`, `adminPassErr` |
| Firebase write | `save` prefix | `saveJournal`, `saveFirmRules` |
| Validation | `is`/`has`/`can` prefix | `isPasswordExpired`, `isValidGmailAddress` |
| Formatter | `format`/`get` prefix | `formatPhoneNumber`, `getTimeBasedGreeting` |

### Constants
| Type | Convention | Example |
|------|------------|---------|
| Global config | SCREAMING_SNAKE_CASE | `ADMIN_UID`, `TELEGRAM_TOKEN` |
| Config object | SCREAMING_SNAKE_CASE | `AMD_PHASES`, `ACCENT_COLORS` |
| AI Prompts | PART_N_PROMPT pattern | `PART1_PROMPT`, `TNC_PARSE_PROMPT` |
| Theme instance | Single uppercase letter | `T` (the active computed theme) |

---

## 10. COMPONENT ARCHITECTURE RULES

### Rule 1 — Single Responsibility
Each component does one thing. `AdminDashboard` manages the user list. `SupportChatModal` is a separate component it imports. `DebugOverlay` is a separate component it imports.

### Rule 2 — Props for Leaf Components, Context for Global State
Leaf components (`LED`, `Tag`, `SHead`, `Field`) take props only. They never read from Context. Context is only consumed by components that actually need app-wide state (auth screens reading `auth`, admin reading user list).

### Rule 3 — No Inline Anonymous Components
Never define a component function inside another component's render. Inline components get recreated on every parent render, causing child unmount/remount cycles and breaking React's reconciliation.

```js
// WRONG
function AdminDashboard() {
  const Row = ({ user }) => <div>{user.name}</div>; // Re-created every render
  return <Row user={x} />;
}

// CORRECT
function UserRow({ user }) { return <div>{user.name}</div>; }
function AdminDashboard() { return <UserRow user={x} />; }
```

### Rule 4 — useEffect Cleanup Is Mandatory
Every `useEffect` that starts an interval, registers an event listener, opens a Firebase subscription, or patches `window.fetch` MUST return a cleanup function. No exceptions.

### Rule 5 — useCallback for All Handlers Passed as Props
Any function passed as a prop must be wrapped in `useCallback` with correct dependencies. This prevents unnecessary re-renders of children that receive handlers.

### Rule 6 — Component File Internal Order
```
1. Imports
2. Module-level constants (if any)
3. Helper functions that are not React components
4. Sub-components (only if too small to warrant their own file — under 30 lines)
5. Main exported component:
   a. Props destructuring
   b. State declarations (useState)
   c. Derived constants (const — never useState)
   d. Effects (useEffect) — each with cleanup
   e. Handlers (useCallback as needed)
   f. Render return (JSX)
6. export default ComponentName
```

### Rule 7 — No Direct DOM Manipulation Except These Exact Cases
DOM imperative access (`document.createElement`, etc.) is only valid for:
- Global style injection (the `styleSheet` block at App.jsx end — valid, kept there)
- Web Audio API (no React abstraction exists — valid in `useToast`)
- Third-party library initialization (valid, if no React wrapper exists)

Everything else goes through React state and JSX.

### Rule 8 — Screens Are Thin Orchestrators
Pages/screens orchestrate child components. They own screen-level state and pass it down as props. They do async data loading. Child components only render what they are given. Business logic belongs in hooks or services, not in screen render functions.

---

## 11. HOOK EXTRACTION PLAN

### `useSystemTheme.js`
```js
// src/hooks/useSystemTheme.js
import { useState, useEffect } from 'react';

export function useSystemTheme() {
  const [isDark, setIsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDark;
}
```

### `useIST.js`
```js
// src/hooks/useIST.js
import { useState, useEffect } from 'react';
import { getISTState } from '../utils/istUtils';

export function useIST(intervalMs = 1000) {
  const [ist, setIst] = useState(() => getISTState());
  useEffect(() => {
    const id = setInterval(() => setIst(getISTState()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return ist;
}
```

### `useToast.js`
```js
// src/hooks/useToast.js
import { useState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const playNotificationSound = useCallback((type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (type === 'error' || type === 'warning') {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.4);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.05, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
      } else {
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.1, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
      }
    } catch { /* silent fail */ }
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    playNotificationSound(type);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, [playNotificationSound]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}
```

### `useComplianceEngine.js` (Major Extraction)
Extract the entire compliance math section from `MainTerminal` into this hook. Receives `{ firmRules, accountState, journal, ist, extractedVals, f }` and returns all derived compliance values.

```js
// src/hooks/useComplianceEngine.js
import { useMemo } from 'react';
import { calculateVolatilityRatio, getDynamicParameters, calculateThrottledRisk } from '../utils/math-engine';

export function useComplianceEngine({ firmRules: fr, accountState, journal, ist, extractedVals, f }) {
  return useMemo(() => {
    const fiveDayATR = extractedVals?.fiveDayATR || 0;
    const twentyDayATR = extractedVals?.twentyDayATR || 0;
    const VR = calculateVolatilityRatio(fiveDayATR, twentyDayATR);
    const { vwapSD1, vwapSD2, trendSLMult, mrSLMult } = getDynamicParameters(VR);
    const { activeRiskPct, isThrottled } = calculateThrottledRisk(
      parseFloat(f?.riskPct) || 0.3, VR,
      parseFloat(accountState?.currentBalance) || 0,
      parseFloat(fr?.maxDrawdown) || 0
    );
    // ... full compliance calculations ...
    // returns: execBlocked, execBlockReason, trafficState, contracts,
    //          proposedSLDollars, sd1Target, sd2Target, volatilityRegime,
    //          complianceBlocked, isDailyBreached, isDDBreached, ...
  }, [fr, accountState, journal, ist, extractedVals, f]);
}
```

---

## 12. CONSTANTS & CONFIG EXTRACTION PLAN

### `src/constants/index.js`
```js
// All app-wide configuration constants
export const ADMIN_UID = import.meta.env.VITE_ADMIN_UID;
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
export const ADMIN_PASS_HASH = import.meta.env.VITE_ADMIN_PASS_HASH;

export const AMD_PHASES = {
  ACCUMULATION:  { label: 'A — Accumulation',  color: '#22C55E', ... },
  MANIPULATION:  { label: 'M — Manipulation',   color: '#F59E0B', ... },
  DISTRIBUTION:  { label: 'D — Distribution',   color: '#EF4444', ... },
  UNCLEAR:       { label: 'Unclear',             color: '#94A3B8', ... },
};

export const ACCENT_COLORS = {
  TRADING_GREEN: { primary: '#00C853', glow: 'rgba(0,200,83,0.3)', name: 'Trading Green' },
  GOLD:          { primary: '#FFD60A', glow: 'rgba(255,214,10,0.3)', name: 'Gold' },
  BLUE:          { primary: '#007AFF', glow: 'rgba(0,122,255,0.3)',  name: 'Blue' },
  PURPLE:        { primary: '#BF5AF2', glow: 'rgba(191,90,242,0.3)', name: 'Purple' },
  CYAN:          { primary: '#64D2FF', glow: 'rgba(100,210,255,0.3)', name: 'Cyan' },
  PINK:          { primary: '#FF375F', glow: 'rgba(255,55,95,0.3)',  name: 'Pink' },
};

export const TIME_OPTIONS = [ /* ... IST time slots ... */ ];
export const OFFICERS_BRIEFING = [ /* ... 20 quotes ... */ ];
export const getRandomQuote = () => OFFICERS_BRIEFING[Math.floor(Math.random() * OFFICERS_BRIEFING.length)];
```

### `src/constants/aiPrompts.js`
```js
// AI System Prompts — versioned
// PART1_PROMPT v1.x — Premarket AMD analysis
export const PART1_PROMPT = `...`;

// PART2_PROMPT v1.x — Trade entry compliance analysis
export const PART2_PROMPT = `...`;

// SCREENSHOT_EXTRACT_PROMPT v1.x — Chart indicator extraction
export const SCREENSHOT_EXTRACT_PROMPT = `...`;

// TNC_PARSE_PROMPT v1.x — Prop firm T&C parser
export const TNC_PARSE_PROMPT = `...`;
```

### `src/constants/theme.js`
```js
// Design system: theme factory, color tokens, style primitives
export const createTheme = (isDark, accentKey) => ({ ... });

// Style primitive factories — used everywhere in JSX
export const authCard = { borderRadius: 24, maxWidth: 460, ... };
export const authInp = { height: 44, ... };
export const authBtn = (color, disabled) => ({ ... });
export const lbl = { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, ... };
export const inp = { ... };
export const cardS = (overrides = {}) => ({ ... });
export const glowBtn = (color, disabled) => ({ ... });
```

---

## 13. AI PROMPT MANAGEMENT RULES

### Rule 1 — Prompts Are Static Constants, Never Dynamic
System prompts are `const` strings in `src/constants/aiPrompts.js`. They are never generated dynamically. Dynamic context (firm rules, account state, trade data) is injected as the **user message content**, not appended to the system prompt.

```js
// CORRECT: static system prompt + dynamic user message
const response = await runDeliberation(PART2_PROMPT, buildFirmContext() + tradeDetails);

// WRONG: dynamic system prompt
const response = await runDeliberation(PART2_PROMPT + currentAMD + firmContext, userMsg);
```

### Rule 2 — All AI Calls Route Through ai-router.js
No component calls `fetch('https://api.anthropic.com/...')` directly. All AI calls go through `runDeliberation()` in `src/services/ai-router.js`.

**Action Required**: Add `runVisionExtraction(images)` and `runTnCParse(text)` to ai-router.js. Migrate `extractFromScreenshots()` and `parseTandC()` to use them.

### Rule 3 — Token Budget Limits

| Prompt | Max Input Tokens | Max Output Tokens |
|--------|-----------------|-------------------|
| PART1_PROMPT | 8,000 (text + 3 images) | 2,500 |
| PART2_PROMPT | 6,000 (text + 3 images) | 1,500 |
| SCREENSHOT_EXTRACT_PROMPT | 4 images + 50 text tokens | 800 (JSON only) |
| TNC_PARSE_PROMPT | 12,000 (PDF text slice) | 1,200 (JSON only) |

### Rule 4 — Prompt Version Comments
When a prompt changes, add a version comment at the top of the prompt string:
```js
// PART2_PROMPT v4.1 — Added consistency cap compliance logic (2025-07-xx)
export const PART2_PROMPT = `You are...`;
```

---

## APPENDIX: CONFIRMED IMPORT DEPENDENCY GRAPH

```
App.jsx imports:
  -> ai-router.js         (runDeliberation, councilStage, quadCoreStatus)
  -> securitySentinel.js  (AntiSpamShield)
  -> telegramMonitor.js   (initTelegramMonitor)
  -> telegramDiagnostics.js (testTelegramConnectivity)
  -> firebaseOptimization.js (firebaseOptimizer)
  -> leakagePreventionModule.js (initLeakagePrevention)
  -> socialEngineeringDetectionModule.js (initSocialEngineeringDetection)
  -> performanceTestRunner.js (exposePerformanceTestToWindow)
  -> securityMonitor.js   (exposeSecurityAPIToWindow)
  -> math-engine.js       (calculateVolatilityRatio, getDynamicParameters, calculateThrottledRisk)
  -> businessLogicUtils.jsx (formatPhoneNumber, ExchangeFacilityBadge, TradersRegimentWatermark)
  -> ThemeSwitcher.jsx
  -> FounderCard.jsx
  -> CleanOnboarding.jsx  (pages)
  -> RegimentHub.jsx      (pages)
  -> CollectiveConsciousness.jsx (pages)
  -> ragVerificationLayer.js (confirm actual usage)

Firebase SDK imports in App.jsx (to move to services/firebase.js):
  initializeApp, getAuth, getDatabase, getStorage
  ref, onValue, get, set, update, remove (firebase/database)
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged,
  setPersistence, browserLocalPersistence, fetchSignInMethodsForEmail
  getDownloadURL, uploadBytes, storageRef (firebase/storage)
```

---

*This document supersedes all previous architecture notes. It is the single source of truth for TradersApp structural decisions. Any change to /src/ folder structure must be reflected here before implementation begins.*
