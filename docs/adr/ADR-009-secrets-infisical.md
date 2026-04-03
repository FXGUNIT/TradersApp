# ADR-009: Infisical for Secrets Management

**Status:** Accepted
**Date:** 2026-04-02
**Author:** FXGUNIT

## Context

TradersApp has 30+ secrets across 4 services:
- **Frontend (Vite):** Firebase, EmailJS, Telegram bot token
- **BFF (Node.js):** AI provider keys (Gemini, Groq, OpenRouter, Cerebras, DeepSeek, SambaNova), Finnhub, NewsAPI
- **ML Engine (Python):** AI keys, database URL
- **GitHub Actions:** INFISICAL_TOKEN, RAILWAY_TOKEN, VERCEL_TOKEN

GitHub push protection scans every commit for secrets. Real API keys in any committed file will permanently block the repo.

## Decision

Use **Infisical** as the single source of truth for all secrets:
- Workspace: `0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab`
- Environments: production, staging, development
- GitHub Actions: `infisical/infisical-action@v2` pulls secrets at runtime
- CI/CD: `infisical-sync.yml` syncs production secrets to Railway + Vercel

**Never** commit secrets to Git. The `.env.local` file is in `.gitignore`.

**Workflow:**
1. Secrets are stored in Infisical (one-time setup via `setup-infisical.ps1`)
2. CI pulls from Infisical at build time (via `infisical-action`)
3. Railway/Vercel sync from Infisical on each deployment
4. Local dev uses `infisical run -- npm run dev` or `.env.local` directly

**Why Infisical over alternatives:**
- **GitHub Secrets alone:** No environment separation, no audit log, no versioning
- **AWS Secrets Manager:** Requires AWS account, overkill for this scale
- **HashiCorp Vault:** Self-hosted complexity, operational overhead
- **Doppler:** Good but paid; Infisical has generous free tier with self-hosted option

## Consequences

### Positive
- Centralized secrets with environment separation
- Version history: rollback any secret
- Audit log: who accessed what secret when
- Auto-sync to Railway + Vercel via GitHub Actions
- GitHub push protection bypassed (no secrets in Git)

### Negative
- Requires Infisical account + access token management
- Infisical workspace must be set up before first CI run
- Self-hosted option requires additional infrastructure

### Neutral
- `.env.local` remains for local development (never committed)
- `INFISICAL_TOKEN` itself is a secret (stored in GitHub Secrets, not in repo)
