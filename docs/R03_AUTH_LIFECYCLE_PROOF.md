# R03 Proof Artifact: Authentication, Session Lifecycle & Account Recovery

**Task:** R03 — Prove authentication, session lifecycle, and account recovery are correct.
**Claimed by:** claude-sonnet | **Date:** 2026-04-14
**Status:** EVIDENCE GATHERED — execution pending Docker/WSL recovery (same blocker as R01/R02)

---

## What R03 Requires

> A single auth edge-case bug can invalidate any claim of flawless behavior.

Five proof steps, each must pass with documented evidence before R03 is marked `[x]`:
1. Email/password login — success, invalid creds, locked/disabled, partial-input
2. Google auth — success, cancel, popup failure, blocked popup, audit-mode fallback
3. Forgot password — reset flow, token handling, forced reset, repeat attempts, post-reset session
4. Logout / logout-all-other-devices / expired session / stale token / refresh-after-expiry
5. Duplicate logins from multiple devices/tabs — no inconsistent sessions or silent privilege leakage

---

## System Under Audit

### Auth Entry Points

| Flow | Frontend Entry | BFF Handler | Session Store |
|------|---------------|-------------|---------------|
| Email/password login | `CleanLoginScreen.jsx` | `identityRoutes.mjs` → `Firebase` | `redis-session-store.mjs` |
| Google OAuth | `CleanLoginScreen.jsx` → Firebase popup | Firebase SDK | `redis-session-store.mjs` |
| Admin password verify | `adminAuthService.js` | `/auth/admin/verify` + `/admin/session` | `redis-session-store.mjs` |
| Forgot password | `CleanLoginScreen.jsx` (reset mode) | `identityRoutes.mjs` | Firebase email |
| Session refresh | `onAuthStateChanged` listener | `getSession()` via `verifyKeycloakToken` | Redis TTL |
| Logout | `authSessionHandlers.js` | `identityRoutes.mjs` (`DELETE /identity/users/:uid/sessions/:sid`) | Redis delete |
| Logout all other | `adminAuthService.js` | `identityRoutes.mjs` (`POST /identity/users/:uid/sessions/revoke-others`) | Redis bulk delete |
| Force password reset | `authRoutingHandlers.js` → `isPasswordExpired()` | BFF profile load | In-user-profile field |

### Key Files Examined (Evidence First)

| File | What It Does |
|------|-------------|
| `src/hooks/useAuth.js` | Firebase `onAuthStateChanged` listener; exposes `user`, `isAuthenticated`, `isAdmin` |
| `src/features/auth/CleanLoginScreen.jsx` | Login UI; Gmail-only validation (`/^[a-z0-9._%+-]+@gmail\.com$/i`); draft persistence |
| `src/features/identity/authSessionHandlers.js` | `createSyncedAuthSession` → creates Redis session via `createSession()` |
| `src/features/identity/authSessionUtils.js` | Builds pending profile, syncs Firebase token to Redis session |
| `src/features/identity/authRoutingHandlers.js` | `executeCheckUserStatus` — routes user to correct screen based on status/role |
| `src/services/adminAuthService.js` | Admin password verify, device fingerprinting, session token management, brute-force lockout |
| `bff/routes/identityRoutes.mjs` | All identity routes: user CRUD, session CRUD, revoke-others |
| `bff/routes/adminRoutes.mjs` | Admin user management, maintenance toggle |
| `bff/services/security.mjs` | Security headers (CSP, HSTS, X-Frame), RBAC, rate limiter, `authorizeRequest`, `getRequiredRole` |
| `bff/_dispatch.mjs` | `authorizeRequest` called at dispatch entry for every request — all routes are RBAC-protected |
| `bff/services/redis-session-store.mjs` | Session storage with TTL, device fingerprint, active session list |
| `bff/services/keycloakJwtVerifier.mjs` | JWT verification for BFF→ML Engine calls; graceful fallback when JWKS unreachable |

### Verified Contract Points

**Redis Session Schema** (from `redis-session-store.mjs`):
```
Key:   session:{uid}:{sessionId}
Value: { uid, token, deviceFingerprint, deviceBrowser, deviceOs, deviceType, createdAt, lastActiveAt, isCurrent, expiresAt }
TTL:   configurable (default ~session TTL)
```

**Admin Token Schema** (localStorage):
```
TradersApp_AdminToken    — Bearer token for admin API calls
TradersApp_AdminDeviceId — persistent device fingerprint
TradersApp_AdminRemember — "remember this device" flag
```

**User Profile Status Values**: `PENDING | ACTIVE | BLOCKED | DRAFT`
**User Profile Role Values**: `user | admin`

---

## Verified Behaviors

### Auth Routing — Screen Resolution Logic

`authRoutingHandlers.js` `executeCheckUserStatus()` maps status/role to screens:

```
uid === ADMIN_UID                              → ADMIN dashboard
userData.status === "BLOCKED"                  → LOGIN (with toast)
userData.status === "PENDING"                  → WAITING room
authData.emailVerified === false               → WAITING room
isPasswordExpired(passwordLastChanged)         → FORCE_PASSWORD_RESET
otherwise                                     → HUB (via restorable screen)
```

**Audit mode** (`window.__TRADERS_AUDIT_DATA.active`): bypasses Firebase, injects mock profile directly. Correctly falls back to mock role check.

### Password Expiry Check

`src/utils/securityUtils.js` → `isPasswordExpired()` — checked at every status check. Forces reset screen before any trading access.

### Account Lockout (Admin)

`adminAuthService.js` `verifyAdminPassword()` — reads `retryAfterMs` from BFF response and surfaces locked-until message to user. Throws on any non-OK response.

### Duplicate Device Handling

`adminAuthService.js` — device fingerprinting uses `Math.random()` + localStorage persistence for stable device ID across sessions.

`identityRoutes.mjs` `/identity/users/:uid/sessions/revoke-others` — `revokeOtherSessions(uid, currentSessionId)` revokes all sessions except the caller's, preventing ghost sessions.

### Google Auth Draft Preservation

`authRoutingHandlers.js` — if `loadUserProfile` returns no profile but Firebase user has Google provider, drafts a PENDING Google signup and routes to SIGNUP screen. Prevents silent auth failures.

### Error-Safe Fallback at Status Check

`authRoutingHandlers.js` lines 87-120 — if `loadUserProfile` fails AND no `userData`, constructs a minimal fallback profile from Firebase UID + constructs safe fallback screen. Does NOT crash — logs warning and lands user safely.

### Security Headers (All Responses)

`security.mjs` sets on every response:
- `Strict-Transport-Security: max-age=31536000`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cache-Control: no-store` (sensitive data)
- CSP: `frame-ancestors 'none'`

### No Secrets in Frontend Auth Flow

`adminAuthService.js` — admin password verified server-side only. Frontend sends plain password over HTTPS to BFF (`/auth/admin/verify`). No Firebase-admin-key in frontend bundle. Audit mode uses `window.__TRADERS_AUDIT_DATA` (injected at test harness level, not repo code).

---

## Gaps Identified (Items Needing Verification Evidence)

| Gap | Risk | Requires |
|-----|------|---------|
| `identityRoutes.mjs` — no `requireCeo`/`requireAdmin` RBAC guard on `GET /identity/users/:uid` | Normal user can fetch any user's profile via direct URL | BFF auth middleware test |
| `/identity/users/:uid/access` (PATCH) — no RBAC check | User could patch their own role upward | BFF auth middleware test |
| `createSyncedAuthSession` — session expiry not checked client-side | Stale Firebase token used after hard expiry | Token refresh test |
| No explicit "expired session → refresh → retry" test | Unknown if expired BFF sessions auto-refresh | Integration test |
| Forgot password flow — token handling not traced | Reset token could be replayable or not expire correctly | Firebase verification test |
| Google popup blocked — error surfaced correctly? | If popup blocked, is error message clear? | Manual UI test |
| Session TTL not visible to frontend | Frontend doesn't know when its session expires | TTL boundary test |
| Multi-tab simultaneous login — Redis session list consistency | Two tabs same device, session list may diverge | Concurrent session test |

---

## Execution Plan

Pending Docker/WSL recovery (same blocker as R01/R02), run:

```bash
# 1. Auth integration smoke
curl -X POST http://localhost:8788/auth/admin/verify \
  -H "Content-Type: application/json" \
  -d '{"password":"wrong"}'
# Expect: 401 + retryAfterMs if brute-force triggered

# 2. Session lifecycle
# Login as test user → list sessions → revoke others → verify BFF session gone

# 3. RBAC probe
curl http://localhost:8788/identity/users/<normal_uid> \
  -H "Authorization: Bearer <normal_user_token>"
# Expect: 403 — no RBAC bypass

# 4. Expired token probe
curl http://localhost:8788/identity/users/<uid>/sessions \
  -H "Authorization: Bearer expired_token"
# Expect: 401 + clear error

# 5. Duplicate session probe
# Open two tabs, login same user — verify sessions list shows 2, revoke-all-other from one tab, verify other tab's session is invalid
```

---

## Interim Verdict

**What we have:** Auth routing is well-structured with proper status-to-screen mapping, error-safe fallbacks, Firebase + Redis dual-session model, brute-force lockout on admin, device fingerprinting, and comprehensive security headers.

**What we lack:** RBAC enforcement on identity read routes (`GET /identity/users/:uid` accessible to any authenticated user — needs `requireCeo` or `requireAdmin` guard). No explicit BFF-level auth integration test suite.

**Exit criteria status:** 0/5 steps fully verified. Execution blocked on Docker/WSL recovery.
