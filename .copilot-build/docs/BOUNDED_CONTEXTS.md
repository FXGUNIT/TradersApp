# TradersApp — Bounded Contexts & DDD Architecture

**Last Updated:** 2026-04-06
**Owner:** Architecture Team

---

## Context Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SIGNAL DELIVERY CONTEXT                             │
│  Owner: bff / frontend                                                     │
│  Scope: BFF orchestration, React UI, Telegram bridge, admin panel         │
│  gRPC: SignalDeliveryService (SignalResponse → React)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│   INFERENCE      │  │   PORTFOLIO     │  │   DATA INGESTION         │
│   CONTEXT        │  │   CONTEXT       │  │   CONTEXT                │
│  Owner: ml-engine│  │  Owner: portfolio│  │  Owner: ingestion-svc   │
│  Scope: ML models│  │  Scope: trade log│  │  Scope: candles, trades │
│  gRPC: AnalysisSvc│  │  gRPC: PortfolioSvc│  │  gRPC: IngestionSvc     │
└────────┬─────────┘  └────────┬─────────┘  └──────────────┬──────────┘
         │                    │                           │
         │                    │                           │
         ▼                    ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FEATURE STORE CONTEXT                               │
│  Owner: ml-engine                                                          │
│  Scope: Feast feature registry, Redis online store, Parquet offline store  │
│  Access: All contexts via Feast SDK / gRPC FeatureService                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EVENT BUS (Kafka / Redis Streams)                      │
│  Topics: candle-data, consensus-signals, model-predictions, feedback-loop   │
│  Consumers: Feature Store ← Data Ingestion, Portfolio ← Inference           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Bounded Contexts

### Context 1: Signal Delivery
**Owner:** `bff/`
**Service:** BFF (Backend-for-Frontend) — Node.js Express
**gRPC Port:** 8788 (HTTP/REST), analysis-service:50051 (gRPC internal)
**Upstream:** Inference Context, Portfolio Context, Feature Store Context
**Downstream:** React Frontend, Telegram Bridge

**Core Domain:**
- Consensus signal rendering (CollectiveConsciousness.jsx)
- Breaking news detection and routing
- Admin panel and support chat
- User identity and session management

**Key Aggregates:**
- `ConsensusSignal`: aggregate of ML inference + regime + timing + RRR
- `BreakingNewsItem`: detected news with impact classification
- `UserSession`: authenticated user session state
- `AdminMessage`: internal admin communications

**ACL (Anti-Corruption Layer):**
- Transforms `AnalysisService.GetConsensusResponse` → React frontend props
- Transforms `PortfolioService.GetPortfolioSummaryResponse` → Journal/Account tab data
- No direct database access — all reads go through service calls

**Published Events (Kafka):**
- `consensus-signals`: every consensus signal generated (for logging/analytics)
- `feedback-loop`: signal outcomes fed back to ML Engine for drift detection

**SLO:**
- P95 latency < 200ms for consensus endpoint
- Availability > 99.5%

---

### Context 2: Inference
**Owner:** `ml-engine/`
**Service:** ML Engine — Python FastAPI (port 8001)
**gRPC Port:** 8001 (HTTP), Triton:8001 (gRPC)
**Upstream:** Data Ingestion Context, Feature Store Context
**Downstream:** Signal Delivery Context, Portfolio Context

**Core Domain:**
- Model training (LightGBM, XGBoost, RF, SVM, MLP, AMD, Regime Ensemble, Mamba)
- Consensus aggregation (confidence-weighted voting with regime adjustment)
- Feature engineering (candle features, session aggregates, historical stats)
- Self-learning (continual learning, EWC, drift detection, paper trade feedback)

**Key Aggregates:**
- `DirectionEnsemble`: 6-model voting ensemble
- `RegimeEnsemble`: HMM + FP-FK PDE + Anomalous Diffusion
- `ConsensusAggregator`: unified signal from all model families
- `AlphaEngine`: composite alpha score from momentum + mean reversion
- `ExitOptimizer`: PSO-optimized exit strategy (RRR, partial close, trailing)
- `PositionSizer`: Kelly fraction + volatility-adjusted sizing

**Published Events (Kafka):**
- `model-predictions`: every prediction for analytics
- `drift-alerts`: when drift is detected (feature, concept, or regime)
- `feedback-loop`: trade outcomes for continual learning

**Data Access:**
- Reads candles from `candles_5min` table (SQLite)
- Reads trade log from `trade_log` table (SQLite)
- Reads features from Feast (Redis online store)
- Writes predictions to `signal_log` table

**SLO:**
- P95 inference latency < 200ms (consensus endpoint)
- P95 regime detection < 1000ms
- Availability > 99.9%

---

### Context 3: Portfolio Management
**Owner:** `portfolio-service/`
**Service:** Portfolio Service — Python FastAPI
**gRPC Port:** TBD (e.g., 50052)
**Upstream:** Signal Delivery Context (for trade logging), Inference Context (for P&L analysis)
**Downstream:** Signal Delivery Context (for risk metrics display)

**Core Domain:**
- Trade logging (open trades, close trades, P&L tracking)
- Risk metrics (max drawdown, Sharpe ratio, Sortino ratio, expectancy)
- Paper trade evaluation (signal_outcome tracking)
- Account balance management

**Key Aggregates:**
- `Trade`: entry → management → close lifecycle
- `Portfolio`: aggregate of all trades and metrics
- `RiskMetrics`: real-time risk calculations
- `SessionSummary`: per-session P&L aggregation

**Data Access:**
- Reads from `trade_log` table
- Writes to `trade_log` and `signal_outcome` tables

**Published Events (Kafka):**
- `feedback-loop`: closed trade outcomes → Inference Context for continual learning

**SLO:**
- P95 latency < 100ms for trade operations
- Availability > 99.5%

---

### Context 4: Data Ingestion
**Owner:** `data-ingestion-service/`
**Service:** Data Ingestion Service — Python FastAPI
**gRPC Port:** TBD (e.g., 50053)
**Upstream:** External data sources (NinjaTrader CSV, Kafka, manual upload)
**Downstream:** Feature Store Context, Inference Context

**Core Domain:**
- Candle data ingestion and validation
- Trade log ingestion
- Great Expectations data quality checks
- Quarantine bad data

**Key Aggregates:**
- `CandleBatch`: OHLCV ingestion unit
- `IngestionJob`: async ingestion job tracking
- `DataQualityReport`: Great Expectations validation results

**Data Access:**
- Writes to `candles_5min` table
- Writes to `trade_log` table

**Published Events (Kafka):**
- `candle-data`: every ingested candle for Feature Store materialization

**SLO:**
- P95 ingestion latency < 5s for 1000 candles
- Data quality: reject > 0.1% bad candles

---

### Context 5: Feature Store
**Owner:** `ml-engine/features/feast_repo/`
**Service:** Feast (not a microservice — shared library + CronJobs)
**Access:** All contexts via Feast Python SDK or gRPC FeatureService
**Upstream:** Data Ingestion Context (candle data), Portfolio Context (trade data)
**Downstream:** Inference Context (feature retrieval)

**Core Domain:**
- Feature registration and versioning
- Online feature serving (< 10ms from Redis)
- Offline feature retrieval for training
- Feature lineage tracking

**Feature Views:**
| View | Entity | TTL | Freshness | Consumers |
|------|--------|-----|-----------|-----------|
| `candle_features` | symbol | 24h | < 5 min | Inference Context |
| `historical_features` | symbol | 30 days | Per trade | Inference Context |
| `session_features` | symbol | 7 days | Per session | Inference Context |

**Materialization Pipeline:**
1. Nightly CronJob: SQLite → Parquet → Redis (05:00 UTC)
2. Streaming CronJob: Kafka → Redis (every 5 min for candles)
3. Event-driven: trade log updates → Redis (per trade close)

**SLO:**
- Online retrieval P95 < 10ms
- Feature freshness: candles < 5 min, session < 1 hour, historical < 1 day

---

## Integration Patterns

### gRPC (Synchronous — Low Latency)

Used for:
- Consensus prediction (Signal Delivery → Inference)
- Model status checks (BFF → Inference)
- Portfolio summaries (BFF → Portfolio)

Pattern: **Request-Response** with deadline propagation
- Timeout: 30s for inference, 10s for status checks
- Circuit breaker: 5 failures / 30s → open
- Retry: 2x with exponential backoff (in HALF_OPEN state only)

### Kafka (Asynchronous — Event-Driven)

Used for:
- Candle data flow: Ingestion → Feature Store
- Signal logging: Signal Delivery → analytics
- Trade feedback: Portfolio → Inference (continual learning)
- Drift alerts: Inference → all consumers

Pattern: **Pub/Sub** with consumer groups
- `candle-data`: partitioned by symbol for ordering
- `feedback-loop`: partitioned by symbol for consistency
- `drift-alerts`: single partition (low volume, no ordering needed)

### REST (External APIs)

Used for:
- News API (Finnhub, NewsAPI) — BFF calls directly
- Telegram Bot API — BFF sends notifications
- MLflow API — ML Engine logs experiments

---

## Anti-Corruption Layers

Each bounded context exposes only its own domain models. Translation happens at integration boundaries:

```
React Frontend
    ↓ (React props)
BFF (Signal Delivery Context)
    ↓ (ACL: AnalysisService.GetConsensusResponse → SignalResponse)
Analysis Service (Inference Context)
    ↓ (ACL: ML models → ConsensusOutput)
Feature Store (Feature Store Context)
    ↓ (Feast SDK: Redis → Feature vectors)
Data Ingestion (Data Ingestion Context)
    ↓ (Raw candles → SQLite)
```

---

## Database Ownership

| Database | Table | Owner Context |
|----------|-------|---------------|
| `trading_data.db` | `candles_5min` | Data Ingestion Context |
| `trading_data.db` | `session_aggregates` | Data Ingestion Context |
| `trading_data.db` | `trade_log` | Portfolio Context |
| `trading_data.db` | `signal_log` | Inference Context |
| `trading_data.db` | `signal_outcome` | Inference Context |
| `trading_data.db` | `model_registry` | Inference Context |
| `trading_data.db` | `feature_importance` | Inference Context |
| `trading_data.db` | `training_log` | Inference Context |
| Redis | Feast online store | Feature Store Context |

---

## Deployment Topology

```
┌─────────────────────────────────────────────────────────┐
│  Kubernetes Cluster (k3s)                               │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Frontend   │  │     BFF      │  │  analysis-svc  │  │
│  │  (React)    │  │  (Node.js)   │  │  (gRPC server) │  │
│  │  :80        │  │  :8788       │  │  :50051        │  │
│  └─────────────┘  └──────┬───────┘  └───────┬────────┘  │
│                          │                  │            │
│                     ┌────▼──────────────────▼────┐        │
│                     │       Inference Context     │        │
│                     │       ML Engine FastAPI     │        │
│                     │       :8001 (HTTP/gRPC)    │        │
│                     │       Triton :8000-8002     │        │
│                     └─────────────┬───────────────┘        │
│                                   │                        │
│         ┌─────────────────────────┼────────────────────┐   │
│         │                         │                    │   │
│    ┌────▼────┐              ┌─────▼─────┐       ┌──────▼──┐│
│    │ PostgreSQL│              │  Redis    │       │ Feast   ││
│    │  :5432   │              │  :6379     │       │ CronJob ││
│    └──────────┘              └───────────┘       └─────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Migration Strategy

Phase 1 (Current): Monolith → Strangler Fig
- Keep existing FastAPI in `ml-engine/` as single deployment
- Extract `data-ingestion/` as first bounded context microservice
- Add proto contracts for all service interfaces

Phase 2: gRPC Orchestration
- Deploy `analysis-service` as dedicated gRPC server (currently in BFF)
- All BFF → ML Engine calls go through `analysis-service`
- Feature Store fully materialized and validated

Phase 3: Independent Deployments
- Extract `portfolio-service` as standalone service
- `ml-engine/` becomes pure inference (no data ingestion)
- Each service has its own Docker image and Helm chart
