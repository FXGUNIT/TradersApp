# Secrets Architecture

**Status:** Stub — needs implementation

## Overview

This document describes the secrets management architecture for TradersApp across all environments.

## Principles

- No secrets hardcoded in source code
- All secrets loaded from environment variables or secret management services
- Secrets scoped per microservice (BFF, ML Engine, Telegram Bridge)

## Services Used

| Service | Purpose | Environment |
|---------|---------|-------------|
| Infisical | Secret injection at deploy time | Production |
| Kubernetes External Secrets | Sync from AWS Secrets Manager | Staging |
| `.env.local` | Local development | Development |

## Secret Categories

### Infrastructure
- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — Redis connection string
- `KAFKA_BOOTSTRAP_SERVERS` — Kafka broker list

### ML Engine
- `MLFLOW_TRACKING_URI` — MLflow server URL
- `AWS_ACCESS_KEY_ID` — MinIO/S3 access
- `AWS_SECRET_ACCESS_KEY` — MinIO/S3 secret

### External Services
- `NEWS_API_KEY` — News data provider
- `TELEGRAM_BOT_TOKEN` — Telegram bot token

## Rotation Policy

- Infrastructure secrets rotated every 90 days
- API keys rotated on compromise suspicion
-滚动更新 with zero downtime via Kubernetes rolling update

## See Also

- `docs/SECRETS_MANAGEMENT.md` — Operational secrets management guide
- `docs/K8S_SECRET_CONTRACT.md` — Kubernetes secret definitions
