# Admin Auth BFF Setup

This project no longer verifies the admin password in the browser. The frontend sends the plain password to the BFF over HTTPS, and the BFF checks the hash from server-side environment secrets.

## What Changed

- Frontend admin unlock now calls `src/services/adminAuthService.js`.
- Backend verification runs in `bff/server.mjs`.
- Browser bundles no longer read `VITE_MASTER_SALT`.
- Local Vite dev now proxies `/api/*` to `http://127.0.0.1:8788/*`.
- The BFF includes a 3-attempt lockout over a 15-minute window.

## Required Secrets

Store these in Infisical for the BFF runtime:

- `BFF_ADMIN_PASS_HASH`
- `MASTER_SALT` if you want a custom salt. If omitted, the current default salt is used.
- `BFF_HOST` optional, defaults to `127.0.0.1`
- `BFF_PORT` optional, defaults to `8788`
- `BFF_ALLOWED_ORIGINS` optional, comma-separated origins for non-local deployments
- `BFF_TELEGRAM_BOT_TOKEN` and `BFF_TELEGRAM_CHAT_ID` if Telegram alerts are enabled

Frontend runtime values:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_BFF_URL` only if you are not using the local Vite proxy

Server-only AI / notification values:

- `AI_GEMINI_PRO_KEY`
- `AI_GROQ_TURBO_KEY`
- `AI_OPENROUTER_MIND_ALPHA`
- `AI_OPENROUTER_MIND_BETA`
- `AI_CEREBRAS_KEY`
- `AI_DEEPSEEK_KEY`
- `AI_SAMBANOVA_KEY`
Do not keep `MASTER_SALT`, admin hashes, AI provider keys, or Telegram bot credentials under `VITE_*` names. Those are browser-exposed by design.

See `.env.example` for the full key list.

## Generate The Admin Hash

Use the helper script:

```bash
npm run admin:hash
```

It prints:

- `BFF_ADMIN_PASS_HASH=...`
- `MASTER_SALT=...` only when you pass a custom salt

Store the generated hash in Infisical. Do not commit the plain password.

## Local Development

If you are using Infisical locally:

```bash
npm run bff:dev:infisical
npm run dev:local
```

If you want to run locally without the Infisical CLI:

```bash
npm run bff:dev
npm run dev
```

The BFF now auto-loads `.env` and `.env.local` from the repo root for local development.
The Vite proxy forwards `/api/*` to the BFF, so `VITE_BFF_URL` can stay empty for local development.

## Health Check

The BFF health route is:

```text
GET http://127.0.0.1:8788/health
```

Expected response:

- `ok: true`
- `adminPasswordConfigured: true` once `BFF_ADMIN_PASS_HASH` is present
- `adminRateLimit` with the active attempt window

## Production Notes

- Keep `BFF_ADMIN_PASS_HASH` and `MASTER_SALT` server-side only.
- Reverse proxy `/api` to the BFF or set `VITE_BFF_URL` to the deployed BFF origin.
- For `tradergunit.pages.dev`, set `VITE_BFF_URL` explicitly and include `https://tradergunit.pages.dev` in `BFF_ALLOWED_ORIGINS`.
- Do not expose the admin plain password in any frontend env file.
- The admin unlock flow will fail closed if the BFF secret is missing.
