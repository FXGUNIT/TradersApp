# ADR-009: Infisical for Secrets Management

**ADR ID:** ADR-009
**Title:** Infisical for Secrets Management
**Status:** Accepted
**Date:** 2026-04-02
**Author:** FXGUNIT

## Context

TradersApp has **30+ secrets** across 4 services:

| Service | Secrets |
|---------|---------|
| **Frontend (Vite)** | Firebase, EmailJS, Telegram bot token |
| **BFF (Node.js)** | AI provider keys (Gemini, Groq, OpenRouter, Cerebras, DeepSeek, SambaNova), Finnhub, NewsAPI |
| **ML Engine (Python)** | AI keys, database URL |
| **GitHub Actions** | INFISICAL_TOKEN, RAILWAY_TOKEN, VERCEL_TOKEN |

GitHub push protection scans every commit for secrets. Real API keys committed will permanently block the repo.

## Decision

Use **Infisical** as the single source of truth for all secrets:

### Configuration

| Setting | Value |
|---------|-------|
| Workspace ID | `0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab` |
| Environments | production, staging, development |
| CI Integration | `infisical/infisical-action@v2` |
| Local Dev | `infisical run -- <command>` |

### Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Infisical │───▶│  GitHub     │───▶│  Railway/   │
│  Dashboard │    │  Actions    │    │  Vercel     │
└─────────────┘    └─────────────┘    └─────────────┘
      │                   │                   │
      │   Manual edit     │  Pull on build   │  Sync on deploy
      ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────┐
│                  Secrets Store                       │
│  • Version history                                  │
│  • Audit log                                       │
│  • Environment separation                            │
└─────────────────────────────────────────────────────┘
```

### CI/CD Integration

**GitHub Actions (`.github/workflows/infisical-sync.yml`):**
```yaml
- name: Pull secrets from Infisical
  uses: infisical/infisical-action@v2
  with:
    workspace_id: ${{ secrets.INFISICAL_WORKSPACE_ID }}
    env: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
```

**Local Development:**
```bash
# Install Infisical CLI
npm install -g @infisical/infisical

# Login
infisical auth login

# Run with secrets
infisical run -- npm run dev

# Or source secrets to .env
infisical secrets pull --format=dotenv > .env.local
```

### Never Commit Secrets

```gitignore
# .gitignore
.env
.env.local
.env.*.local
*.key
*.pem
*.crt
credentials.json
```

## Consequences

### Positive
- **Centralized secrets:** One source of truth across all environments
- **Version history:** Rollback any secret to previous version
- **Audit log:** Track who accessed what secret when
- **Auto-sync:** Railway and Vercel sync on each deployment
- **Push protection bypassed:** No secrets in Git history

### Negative
- **Infisical account required:** Access token management overhead
- **Initial setup:** Workspace must be configured before first CI run
- **Self-hosted option:** Requires additional infrastructure if cloud not used

### Neutral
- `.env.local` remains for local development (never committed)
- `INFISICAL_TOKEN` itself is a secret (stored in GitHub Secrets)

## Alternatives Considered

### GitHub Secrets Only
- **Pros:** Built-in to GitHub, no extra service
- **Cons:** No environment separation, no audit log, no versioning
- **Why rejected:** Need environment separation (dev/staging/prod)

### AWS Secrets Manager
- **Pros:** Enterprise-grade, integrated with AWS
- **Cons:** Requires AWS account, overkill for this scale
- **Why rejected:** Additional AWS dependency not justified

### HashiCorp Vault
- **Pros:** Industry standard, powerful policies
- **Cons:** Self-hosted complexity, operational overhead
- **Why rejected:** Significant setup and maintenance burden

### Doppler
- **Pros:** Good UX, reliable service
- **Cons:** Paid for teams, limited free tier
- **Why rejected:** Infisical has better free tier with self-hosted option

## References

- [Infisical Documentation](https://infisical.com/docs)
- [Infisical GitHub Action](https://github.com/infisical/infisical-action)
- [Infisical CLI](https://infisical.com/docs/cli/overview)
- Related ADRs: [ADR-015 Keycloak](ADR-015-keycloak-sso.md) (Keycloak credentials in Infisical), [ADR-017 Trivy](ADR-017-trivy-scanning.md) (Trivy DB credentials)
