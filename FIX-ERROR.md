# Fix This Error — Instructions

## When you encounter ANY error (compile, runtime, test, build, console, stack trace, etc.):

**Step 1:** Copy the FULL error text

**Step 2:** Paste it into chat

**Step 3:** Type exactly: `fix this error`

---

I will automatically:

1. **Detect the microservice** — Analyze stack trace, file paths, package names from the error
2. **Scope to that service ONLY** — No touching other services
3. **Read only relevant files** — Use grep + targeted reads (no full repo scan)
4. **Diagnose the root cause** — Find the exact line/function causing the error
5. **Fix it** — Edit only the necessary files in the scoped service
6. **Verify** — Run build/test if available, confirm fix

---

## Error Types Covered

- React/Vite build errors (src/)
- Node.js/BFF runtime errors (bff/)
- Python/FastAPI errors (ml-engine/)
- Telegram bot errors (telegram-bridge/)
- TypeScript/linter errors
- Import/module errors
- Firebase Auth errors
- Database/API errors
- ML model errors
- Test failures

---

## What I Will NOT Do

- Ask you to click files
- Ask you to open folders
- Ask you to type file names
- Load code from other microservices
- Suggest things that require manual steps
