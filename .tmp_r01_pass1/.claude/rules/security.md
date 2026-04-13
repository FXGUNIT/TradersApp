# Security Checklist

After any code change touching orders, data, or auth, review:

- [ ] No secrets hardcoded (API keys, tokens, passwords)
- [ ] No `eval()` or `new Function()` usage
- [ ] Input validation on all external data (params, body, headers)
- [ ] SQL injection prevention (parameterized queries only)
- [ ] No user-controlled file paths (path traversal prevention)
- [ ] Rate limiting on all public endpoints
- [ ] Circuit breaker on all external calls
- [ ] Timeout on all external calls (5s ML, 3s news)
- [ ] CORS properly configured (no wildcard in production)
- [ ] Error messages don't expose internal paths or system details

Review takes 60 seconds. Catches almost everything.
