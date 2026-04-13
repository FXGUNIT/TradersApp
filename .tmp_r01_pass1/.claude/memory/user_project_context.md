---
name: TradersApp Project Context
description: Monorepo for a quantitative trading signal app — ML engine, BFF, React frontend, Telegram bridge
type: project
---

## Project: TradersApp

**What it is:** Quantitative trading intelligence platform that aggregates multi-model consensus signals (HMM regime, LightGBM direction, Mamba SSM, PSO optimizer, etc.) for futures trading.

**Architecture:**
- `src/` — React frontend (Vite, port 5173)
- `bff/` — Node.js BFF orchestrator (Express, port 8788)
- `ml-engine/` — Python FastAPI ML engine (port 8001)
- `telegram-bridge/` — Telegram bot + web server
- `k8s/` — Kubernetes/Helm configs
- `proto/ddd/` — gRPC service contracts

**Key ML models:** HMM regime, FP-FK kinetics, Anomalous Diffusion, LightGBM direction, Mamba SSM, PSO exit optimizer, Position sizer

**Infrastructure:** Redis, Kafka, MLflow, MinIO, PostgreSQL, Airflow, Great Expectations, Prometheus, Grafana, Loki, Jaeger, Keycloak, Trivy, Gitea, Woodpecker, k3s, Infisical

**Repo:** `c:\Users\Asus\Desktop\TradersApp` (git, branch: main)
