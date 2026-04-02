# ═══════════════════════════════════════════════════════════════════════════════
# TradersApp — Secrets Architecture (Infisical)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Single source of truth for ALL secrets: Infisical
# NEVER commit secrets to Git. NEVER use .env files in CI directly.
#
# Architecture:
#   ┌─────────────────────────────────────────────────────────────┐
#   │              Infisical (secret vault)                        │
#   │  workspace: 0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab            │
#   │                                                           │
#   │  production/  ──→ Railway BFF + ML Engine (runtime)       │
#   │               ──→ Vercel Frontend (env vars)              │
#   │               ──→ GitHub Actions Secrets (for CI)          │
#   │                                                           │
#   │  staging/     ──→ Railway staging (runtime)                │
#   │               ──→ Vercel preview (env vars)               │
#   │                                                           │
#   │  development/ ──→ local dev (infisical run -- npm run dev) │
#   └─────────────────────────────────────────────────────────────┘
#
# SECURITY PRINCIPLES:
#   1. Secrets NEVER baked into Docker images (use runtime env vars)
#   2. CI pulls secrets from Infisical at runtime (infisical-action)
#   3. Railway/Railway syncs secrets from Infisical after deploy
#   4. Vercel env vars pulled from Infisical at deploy time
#   5. INFISICAL_TOKEN stored in GitHub Secrets only
#   6. Rotation: change in Infisical → auto-syncs everywhere
#
# ENVIRONMENT MATRIX:
# ┌─────────────┬──────────────┬──────────────┬──────────────────────────────┐
# │ Secret      │ Production   │ Staging      │ Development                  │
# ├─────────────┼──────────────┼──────────────┼──────────────────────────────┤
# │ AI Keys     │ ✓            │ ✓ (same)     │ via: npm run dev:infisical  │
# │ BFF keys    │ ✓            │ ✓ (same)     │ via: npm run dev:infisical  │
# │ ML Engine   │ ✓            │ ✓ (same)     │ via: npm run bff:dev:infisical│
# │ Firebase    │ ✓            │ ✓ (same)     │ via: VITE_ vars in .env.local│
# │ VITE_BFF_URL│ https://bff  │ staging URL  │ http://127.0.0.1:8788       │
# │ ML_ENGINE_URL│ https://api │ staging URL  │ http://127.0.0.1:8001       │
# └─────────────┴──────────────┴──────────────┴──────────────────────────────┘
#
# SETUP (one-time):
#   1. Get Infisical token: app.infisical.com → Settings → Access Tokens
#   2. Run: .\scripts\setup-infisical.ps1 -InfisicalToken "is.xxx"
#   3. In Infisical dashboard → Settings → Integrations:
#      - GitHub App (auto-inject into Actions)
#      - Railway (auto-inject into services)
#
# LOCAL DEV:
#   npm run dev:infisical          # Frontend with secrets from Infisical
#   npm run bff:dev:infisical      # BFF with secrets from Infisical
#
# MANUAL SYNC (CI post-deploy):
#   workflow: infisical-sync.yml   # syncs secrets to Railway/Vercel/GH
#
# ROLLBACK:
#   Infisical retains all previous secret versions.
#   To rollback: change secret value in Infisical → triggers auto-sync
#
# ═══════════════════════════════════════════════════════════════════════════════

# ── PRODUCTION Environment Secrets ─────────────────────────────────────────

PRODUCTION_SECRETS=(
  # ── AI Providers (7 keys — used by BFF + ML Engine) ────────────────────
  "AI_GEMINI_PRO_KEY"
  "AI_GROQ_TURBO_KEY"
  "AI_OPENROUTER_MIND_ALPHA"
  "AI_OPENROUTER_MIND_BETA"
  "AI_CEREBRAS_KEY"
  "AI_DEEPSEEK_KEY"
  "AI_SAMBANOVA_KEY"

  # ── Breaking News (free tier — used by BFF news service) ───────────────
  "FINNHUB_API_KEY"
  "NEWS_API_KEY"

  # ── BFF Server Security ─────────────────────────────────────────────────
  "BFF_ADMIN_PASS_HASH"
  "MASTER_SALT"
  "BFF_HOST"
  "BFF_PORT"
  "BFF_ALLOWED_ORIGINS"
  "ML_ENGINE_URL"                    # https://api.traders.app (Railway)

  # ── Telegram Bridge ─────────────────────────────────────────────────────
  "TELEGRAM_BOT_TOKEN"               # From @BotFather
  "TELEGRAM_CHAT_ID"                 # From @userinfobot
  "TELEGRAM_BOT_USERNAME"
  "TELEGRAM_BRIDGE_PORT"
  "TELEGRAM_ADMIN_API_KEY"
  "SUPPORT_SERVICE_KEY"
  "TELEGRAM_BOT_MODE"                # 'polling' for dev, 'webhook' for prod
  "TELEGRAM_ADMIN_CHAT_IDS"          # Comma-separated
  "TELEGRAM_WEBHOOK_URL"
  "TELEGRAM_WEBHOOK_KEY"

  # ── Frontend (VITE_* — public bundle, but stored in Infisical) ─────────
  "VITE_BFF_URL"                     # https://bff.traders.app (Railway)
  "VITE_FIREBASE_API_KEY"
  "VITE_FIREBASE_AUTH_DOMAIN"
  "VITE_FIREBASE_PROJECT_ID"
  "VITE_FIREBASE_STORAGE_BUCKET"
  "VITE_FIREBASE_MESSAGING_SENDER_ID"
  "VITE_FIREBASE_APP_ID"
  "VITE_FIREBASE_DATABASE_URL"
  "VITE_TELEGRAM_BOT_TOKEN"
  "VITE_TELEGRAM_CHAT_ID"
  "VITE_TELEGRAM_BOT_USERNAME"

  # ── ML Engine ───────────────────────────────────────────────────────────
  "DATABASE_URL"                     # sqlite:///ml-engine/trading_data.db (for now)
  "ML_ENGINE_API_KEY"

  # ── Feature Flags ────────────────────────────────────────────────────────
  "VITE_FEATURE_FLOATING_SUPPORT_CHAT"
  "VITE_FEATURE_COLLECTIVE_CONSCIOUSNESS"
  "VITE_FEATURE_MAIN_TERMINAL"
  "VITE_FEATURE_CLEAN_ONBOARDING"

  # ── Production Infrastructure ─────────────────────────────────────────────
  "RAILWAY_TOKEN"                    # GitHub Secret only — not in Infisical
  "VERCEL_TOKEN"                     # GitHub Secret only — not in Infisical
)

# ── GITHUB ACTIONS SECRETS (synced from Infisical) ─────────────────────────
# These go to GitHub → Settings → Secrets and variables → Actions
# They are NOT in the Docker images — only used by CI at runtime

GITHUB_SECRETS=(
  "INFISICAL_TOKEN"                  # Master token — syncs all secrets
  "AI_GEMINI_PRO_KEY"
  "AI_GROQ_TURBO_KEY"
  "AI_OPENROUTER_MIND_ALPHA"
  "AI_OPENROUTER_MIND_BETA"
  "AI_CEREBRAS_KEY"
  "AI_DEEPSEEK_KEY"
  "AI_SAMBANOVA_KEY"
  "FINNHUB_API_KEY"
  "NEWS_API_KEY"
  "BFF_ADMIN_PASS_HASH"
  "MASTER_SALT"
  "RAILWAY_TOKEN"
  "VERCEL_TOKEN"
  "VERCEL_ORG_ID"
  "VERCEL_PROJECT_ID"
  "SLACK_WEBHOOK_URL"
  "DISCORD_WEBHOOK_URL"
)

# ── GITHUB ACTIONS VARIABLES (non-sensitive) ───────────────────────────────
GITHUB_VARIABLES=(
  "RAILWAY_PROD_ENV_ID"              # Railway Environment ID (not secret)
  "RAILWAY_PROD_ML_SERVICE_ID"
  "RAILWAY_PROD_BFF_SERVICE_ID"
  "RAILWAY_STAGING_ENV_ID"
  "RAILWAY_STAGING_ML_SERVICE_ID"
  "RAILWAY_STAGING_BFF_SERVICE_ID"
  "ML_ENGINE_URL"
  "BFF_URL"
  "FRONTEND_URL"
)