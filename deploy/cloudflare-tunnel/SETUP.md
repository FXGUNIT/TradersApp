# Optional Free Cloudflare Worker BFF Proxy

## Current Production Path

The active no-owned-domain setup is:

- Frontend: `https://tradergunit.pages.dev`
- BFF: `https://bff.173.249.18.14.sslip.io`
- ML API proof host: `https://api.173.249.18.14.sslip.io`

Do not use `traders.app`, `api.traders.app`, or `bff.traders.app`. That domain is not owned and is not part of the active production path.

## When To Use This Worker

This Worker is optional. Use it only if we want a free Cloudflare `workers.dev` proxy URL in front of the existing BFF, for example:

`https://tradersapp-bff-proxy.<your-cloudflare-subdomain>.workers.dev`

No paid domain is required.

## Deploy Prerequisites

1. A free Cloudflare account.
2. A Cloudflare API token that can deploy Workers. The current GitHub secret is valid for the account but not for Worker deploys.
3. Local Wrangler authentication, if deploying from your laptop:

```bash
npx wrangler login
```
4. Verify authentication:

```bash
npx wrangler whoami
```

## GitHub Actions Deploy

A workflow is available:

```bash
gh workflow run deploy-bff-worker.yml --repo FXGUNIT/TradersApp --ref main
```

Latest result, 2026-04-25: GitHub run `24928501312` reached Cloudflare but failed with:

```text
Authentication error [code: 10000]
```

That means the `CLOUDFLARE_API_TOKEN` secret must be replaced with a token that has Cloudflare Workers deploy permission before this optional proxy can go live.

## Deploy

```bash
cd deploy/cloudflare-tunnel/bff-worker
npx wrangler deploy
```

Wrangler will print the free `workers.dev` URL after deployment.

## Verify

Replace `<worker-url>` with the deployed `workers.dev` URL:

```bash
curl -sI <worker-url>/health
curl -s <worker-url>/news/upcoming
curl -s <worker-url>/news/breaking?fresh=true
```

Only switch `VITE_BFF_URL` after `/health` returns HTTP 200 and the news endpoints return JSON.

## Files

```text
deploy/cloudflare-tunnel/
  bff-worker/
    index.js       # Optional Worker proxy for BFF API calls
    wrangler.toml  # Free workers.dev deployment config
  SETUP.md
```
