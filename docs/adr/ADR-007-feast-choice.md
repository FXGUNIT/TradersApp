# ADR-007: Feast Feature Store for ML Feature Management

**ADR ID:** ADR-007
**Title:** Feast Feature Store for ML Feature Management
**Status:** Accepted
**Date:** 2026-04-06
**Author:** Claude

## Context

The TradersApp ML system requires consistent feature engineering across:
- Training pipelines (historical data)
- Online inference (real-time predictions)
- Feature reuse across 12+ ML models (direction, regime, magnitude, alpha, session, etc.)

Current challenges:
- Feature definitions duplicated across training and serving code
- No feature versioning or lineage tracking
- Inconsistent feature values between training and inference (training-serving skew)
- Difficulty sharing features between model families
- No feature monitoring or drift detection at the feature level

## Decision

We will use **Feast** as the feature store for all ML features.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Feature Store Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Feast Server (gRPC/REST API)                               │
│  ├── Online Store: Redis (sub-10ms reads)                   │
│  └── Offline Store: Parquet files on MinIO                  │
├─────────────────────────────────────────────────────────────┤
│  Feature Registry (feast_metadata.db)                       │
│  ├── FeatureView definitions                                │
│  ├── FeatureService definitions                              │
│  └── Entity relationships                                   │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────────┐
│  Training Jobs  │          │   Inference Jobs    │
│  (ml-engine/)   │          │   (ml-engine/)       │
└─────────────────┘          └─────────────────────┘
```

### Feature Organization

#### Feature Views

```yaml
# features/candle_features.yaml
name: candle_features
entities:
  - name: symbol
    description: Trading symbol
entities:
  - name: timestamp
    description: Candle timestamp
features:
  - name: returns_1d
    dtype: FLOAT
  - name: returns_5d
    dtype: FLOAT
  - name: returns_10d
    dtype: FLOAT
  - name: volatility_20d
    dtype: FLOAT
  - name: volume_ratio
    dtype: FLOAT
  - name: rsi_14
    dtype: FLOAT
  - name: macd_signal
    dtype: FLOAT
  - name: bollinger_position
    dtype: FLOAT
```

```yaml
# features/session_aggregates.yaml
name: session_aggregates
entities:
  - name: symbol
  - name: session_date
features:
  - name: london_session_pnl
  - name: london_session_trades
  - name: london_session_win_rate
  - name: ny_session_pnl
  - name: ny_session_trades
  - name: ny_session_win_rate
  - name: asia_session_pnl
  - name: fatigue_score
```

### Online Store (Redis)

| Key Pattern | TTL | Purpose |
|------------|-----|---------|
| `feature_views:candle:{symbol}` | 60s | Latest candle features |
| `feature_views:session:{symbol}:{date}` | 24h | Session aggregates |
| `feature_views:regime:{symbol}` | 300s | Regime detection features |

### Offline Store (MinIO)

- Parquet files organized by feature view and date range
- Partitioned by: `year/month/day/feature_view/`
- Retention: 2 years for training data
- Backed by DVC for versioning

## Consequences

### Positive
- **Training-serving consistency:** Same feature definitions used in training and serving
- **Feature reuse:** Multiple models can share feature views
- **Feature versioning:** Track feature lineage and backfill historical features
- **Online-offline parity:** Online store stays in sync with offline store
- **Feature monitoring:** Track feature distribution over time (see ADR-016)
- **Reduced duplication:** Feature logic defined once, reused everywhere

### Negative
- **Additional infrastructure:** Redis + Feast server adds operational complexity
- **Latency overhead:** Feature retrieval adds ~5-10ms to inference latency
- **Feast learning curve:** Team needs to learn Feast concepts and YAML DSL
- **Registry management:** Feature registry needs careful versioning
- **Backfill complexity:** Re-generating historical features requires careful orchestration

### Neutral
- Feast supports multiple online stores (Redis, DynamoDB, SQL); we use Redis
- Feast supports multiple offline stores (BigQuery, Snowflake, Parquet); we use Parquet/MinIO
- Feature computation (Feast does not compute features, only stores and retrieves them)

## Alternatives Considered

### Tecton
- Pros: Fully managed, enterprise features, strong SLAs
- Cons: Expensive (enterprise pricing), vendor lock-in, limited self-hosted option
- **Rejected** because cost prohibitive for self-hosted ML infrastructure

### Hopsworks
- Pros: Excellent feature store, good UX, managed option available
- Cons: Complex setup for self-hosted, heavier infrastructure
- **Rejected** because Feast is simpler for self-hosted Kubernetes deployment

### Custom Feature Store (Homegrown)
- Pros: Full control, no external dependencies
- Cons: Significant development effort, no community support, no feature monitoring
- **Rejected** because building and maintaining a feature store is out of scope

### No Feature Store
- Pros: Simpler initial architecture
- Cons: Training-serving skew, feature duplication, no feature lineage
- **Rejected** because we need consistency across 12+ ML models

## References

- [Feast Documentation](https://docs.feast.dev/)
- [Feast on Kubernetes](https://docs.feast.dev/getting-started/quickstart)
- [Feature Store Patterns](https://www.feast.dev/blog/feature-store-patterns)
- Related ADRs: [ADR-005 Kafka](ADR-005-kafka-choice.md) (feeds feature computation events), [ADR-016 Drift Detection](ADR-016-drift-detection.md) (feature-level monitoring)
