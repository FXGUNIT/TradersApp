---
name: user_research_2026
description: User's trading research direction, tech preferences, priorities
type: user
---

User is building an elite trading intelligence system on TradersApp platform.
**Primary goal:** Maximum alpha discovery, sub-100ms latency, enterprise-grade reliability with SLA.

## Architecture Decisions (User-Mandated)
- Use **Mamba SSM** (NOT Transformers, NOT SSM/Mamba-2) — latest version available
  - Available: `mamba-ssm` package (Apache 2.0, free), HuggingFace `state-spaces/mamba-2.8b`
  - Use for: sequence prediction, regime modeling, candle pattern detection
- Use **Particle Swarm Optimization (PSO)** for alpha discovery + hyperparameter tuning
- **Continual learning** — catastrophic forgetting prevention is MANDATORY
  - Use: Experience Replay + Elastic Weight Consolidation (EWC)
  - No training run should make the model dumber
- **Auto git backup** — commit after every significant code change
- **Redis** for caching ML predictions
- **Railway** for BFF + ML Engine, **Neon** PostgreSQL, **Vercel** frontend

## Infisical Setup Status (as of 2026-04-02)
- Infisical GitHub App installed but only has access to `FXGUNIT/TRADERS-REGIMENT`
- User needs to add their `TradersApp` repo to the Infisical App permissions
- Browser action needed: GitHub → Settings → Installed Apps → Infisical App Connection → Select repositories → add TradersApp → Save

## Tech Stack Decisions
- ML Engine: Python FastAPI (port 8001), Railway
- BFF: Node.js Express (port 8788), Railway  
- Frontend: React + Vite, Vercel
- Secrets: Infisical (workspace `0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab`)
- DB: SQLite WAL (dev) → Neon PostgreSQL (prod)
- Redis: planned for prediction caching
- Telegram: Bridge on port 5001, 7 AI providers

## Key Files
- ML Engine: `ml-engine/main.py` (FastAPI, 21 endpoints)
- BFF: `bff/server.mjs` (Express, 15+ route handlers)
- Telegram: `telegram-bridge/index.js` + `aiConversation.js`
- CI/CD: `.github/workflows/ci.yml`, `infisical-sync.yml`, `monitor.yml`
