# TradersApp

Quantitative trading intelligence platform — multi-model consensus signals for futures trading.

## Quick Start

| What you need | Where to look |
|---|---|
| Architecture overview | [docs/index.md](docs/index.md) |
| Requirements & blockers | [SPEC.md](SPEC.md) |
| ML Engine docs | [ml-engine/](ml-engine/) |
| BFF service | [bff/](bff/) |
| Frontend | [src/](src/) |
| Telegram bridge | [telegram-bridge/](telegram-bridge/) |

## Repository Structure

```
TradersApp/
├── src/                    # React frontend (Vite, port 5173)
├── bff/                    # Node.js BFF orchestration (port 8788)
├── ml-engine/              # Python FastAPI ML engine (port 8001)
├── telegram-bridge/        # Telegram bot + web server
├── docs/                   # Architecture, ADRs, guides
├── k8s/                    # Kubernetes/Helm configs
├── scripts/                # Automation scripts
└── proto/                  # gRPC proto definitions
```

## Key Docs

- [Setup Guide](docs/SETUP.md) — Local development setup
- [Deployment Guide](docs/DEPLOYMENT.md) — Production deployment
- [Architecture ADR Register](docs/adr/README.md) — All 18 architectural decisions
- [MLflow + MLOps](docs/MLOPS_MLFLOW.md) — Experiment tracking & model registry
- [CI/CD: Gitea + Woodpecker](docs/CICD_GITEA_WOODPECKER.md) — Build & deploy pipeline
- [Secrets Management](docs/SECRETS_MANAGEMENT.md) — Infisical integration

## Key Rules (Claude Code)

Claude Code operates under these non-negotiable rules — always read [CLAUDE.md](CLAUDE.md) first:

- **Monorepo Scoping** — every reply starts with `Scoped to: [folder]`
- **90% Accuracy** — every task must be 90%+ correct before completion
- **Evidence First** — list file:line refs before writing any code
- **Tests First** — write test, paste failure, then implement
- **Paper Trade** — all signals must be paper traded 1 week before live use
- **Never Monolith** — every feature gets its own directory with tests

## Architecture

TradersApp is a self-hosted trading ML platform with:

- **Frontend** → **BFF** → **ML Engine** consensus pipeline
- **DDD bounded contexts** with gRPC contracts (`proto/ddd/v1/`)
- **Redis + Feast** for low-latency feature serving
- **MLflow + MinIO + PostgreSQL** for model lifecycle
- **Airflow + Great Expectations** for data quality & retraining
- **Prometheus + Grafana + Loki + Jaeger** for observability
- **Gitea + Woodpecker + Helm + k3s** for CI/CD
- **Infisical** for secrets injection
- **Keycloak** for SSO
- **Trivy** for container scanning
- **Kafka** for event streaming

See [docs/index.md](docs/index.md) for the full operating map.

## Project Files

These files are auto-loaded by Claude Code at every session start:

| File | Purpose |
|------|---------|
| [CLAUDE.md](CLAUDE.md) | Architecture bible |
| [SPEC.md](SPEC.md) | Requirements & blockers |
| [EDGE-CASES.md](EDGE-CASES.md) | Market scenarios |
| [DOMAIN-RULES.md](DOMAIN-RULES.md) | Trading rules |
| [LEGACY-PATTERNS.md](LEGACY-PATTERNS.md) | Existing patterns |
| [PROMPT-TEMPLATE.md](PROMPT-TEMPLATE.md) | Session starter |

---

**Author:** FXGUNIT
**License:** Proprietary
