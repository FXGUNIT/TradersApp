# Runbook: Auth Failures

**Severity:** P1 for end-user login; P2 for admin
**Detection:** 401 flood in logs, user reports

---

## Step 1: Identify failure type

```bash
# Check which auth path is failing
# Admin login
curl -sf -X POST http://localhost:8788/auth/admin/verify \
  -H "Content-Type: application/json" \
  -d '{"password":"test"}' | python3 -m json.tool

# User Firebase auth: check Firebase console -> Authentication -> Users
```

---

## Step 2: Admin auth failures

### Wrong password
- Admin lockout after 5 failed attempts (15-minute window)
- Check lockout state:
```bash
grep -i "lockout\|attempt" bff/data/admin-domain.json
```
- Reset: clear `admin-domain.json` or wait 15 minutes

### Redis unavailable (admin sessions)
```bash
# See: docs/runbooks/redis-unavailable.md
# Admin sessions survive Redis restart (Redis TTL expiry)
# Users must re-authenticate
```

---

## Step 3: Firebase auth failures

Firebase auth state persists in browser IndexedDB. Server-side token validation uses Bearer tokens.

If `user.uid` undefined in BFF routes:
- User's Firebase ID token has expired
- Fix: frontend calls `firebaseAuth.currentUser.reload()` (5s timeout)
- User should refresh the page

### Firebase server-side token revocation
Firebase IndexedDB auth cannot be revoked server-side (R12 residual risk).
**Mitigation:** All `/admin/*` routes use BFF session tokens, not Firebase tokens.
User must clear browser data to force logout.

---

## Step 4: Post-incident

- [ ] Check Prometheus: `rate(bff_http_request_duration_seconds{statuscode="401"}[5m])`
- [ ] If lockout abuse: add IP rate limit (already in place via enhanced-security.mjs)
- [ ] Document root cause in GitHub issue
