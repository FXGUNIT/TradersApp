# TradersApp - Algorithmic Trading ML Platform

**Collective Consciousness System** - ensemble ML consensus for day trading futures.

---

## Architecture Overview

```
[Frontend] -> [BFF] -> [ML Engine]
                 |         |
                 v         v
              [Redis]   [Kafka]
```

## Services

| Service | Port | Language | Purpose |
|---|---:|---|---|
| Frontend | 80 | React | User interface |
| BFF | 8788 | Node.js | API gateway and security boundary |
| ML Engine | 8001 | Python | Training, inference, drift detection |
| Prometheus | 9090 | - | Metrics collection |
| Grafana | 3001 | - | Dashboards |
| Jaeger | 16686 | - | Distributed tracing |
| Kafka | 9092 | - | Event bus |

## Key Features

- Ensemble ML with multiple model families
- Closed-loop feedback and retraining
- Feature store and online cache
- GPU inference path with Triton fallback
- Self-hosted observability stack
- Self-hosted CI/CD with Gitea + Woodpecker + k3s

## Quick Start

```bash
# Start the local application stack
docker compose up -d

# Run ML tests
cd ml-engine && python -m pytest tests/ -q
```

## Operations Docs

- [Self-hosted CI/CD](./CICD_GITEA_WOODPECKER.md)
- [MLflow MLOps lifecycle](./MLOPS_MLFLOW.md)
- [Deployment guide](./DEPLOYMENT.md)
- [Setup guide](./SETUP.md)

## License

Proprietary - FXGUNIT
