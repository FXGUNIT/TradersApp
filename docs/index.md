# TradersApp — Algorithmic Trading ML Platform

**Collective Consciousness System** — ensemble ML consensus for day trading futures.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     TradersApp Frontend (React)              │
│            CollectiveConsciousness.jsx                        │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTP/gRPC
┌─────────────────▼───────────────────────────────────────────┐
│              BFF (Node.js — port 8788)                       │
│   Consensus routing, security, rate limiting                  │
└──────┬──────────────────────┬───────────────────────────────┘
       │                      │
       ▼                      ▼
┌──────────────────┐  ┌──────────────────────────┐
│ ML Engine        │  │ News Service             │
│ FastAPI          │  │ port 8001                │
│ port 8001        │  └──────────────────────────┘
│                  │
│ • Predictor      │
│ • ConsensusAgg   │
│ • DriftMonitor   │
│ • Feast Client   │
│ • Triton Client  │
│ • Prometheus     │
│ • OpenTelemetry  │
└────────┬─────────┘
         │
    ┌────┴────────────────┐
    ▼                     ▼
┌────────────┐      ┌──────────┐
│  Redis      │      │ Kafka     │
│  Cache      │      │ 5 Topics  │
└────────────┘      └───────────┘
```

## Services

| Service | Port | Language | Purpose |
|---------|------|----------|---------|
| Frontend | 80 | React | UI — Collective Consciousness |
| BFF | 8788 | Node.js | API gateway, security |
| ML Engine | 8001 | Python | Training, inference, drift |
| Telegram Bridge | — | Node.js | Signal alerts |
| Prometheus | 9090 | — | Metrics collection |
| Grafana | 3001 | — | Dashboards |
| Jaeger | 16686 | — | Distributed tracing |
| Kafka | 9092 | — | Event bus |

## Key Features

- **Ensemble ML**: LightGBM + XGBoost + SVM + Neural Net + AMD classifier
- **Closed-loop feedback**: Paper trades → drift detection → auto-retrain
- **Feature store**: Feast with SQLite offline + Redis online
- **GPU inference**: Triton + ONNX Runtime fallback chain
- **Data quality**: Great Expectations + Airflow pipeline
- **Observability**: Prometheus + Grafana + Loki + Jaeger

## Quick Start

```bash
# Start full stack
docker compose up -d

# Start ML Engine only
docker compose up -d ml-engine redis

# Run tests
cd ml-engine && python -m pytest tests/ -q

# View API docs
open http://localhost:8001/docs
```

## License

Proprietary — FXGUNIT
