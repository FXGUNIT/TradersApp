# ADR-005: Apache Kafka for Event-Driven Communication

**ADR ID:** ADR-005
**Title:** Apache Kafka for Event-Driven Communication
**Status:** Accepted
**Date:** 2026-04-06
**Author:** Claude

## Context

The TradersApp system requires real-time data streaming between multiple services for:
- Candle data ingestion from NinjaTrader CSV feeds
- ML prediction events and regime change notifications
- Telegram bridge messaging events
- Session aggregate calculations
- Cross-service event propagation (drift detection alerts, model retraining triggers)

The system currently uses HTTP polling and direct database queries, which introduces:
- High latency for real-time updates
- Tight coupling between services
- Database as a shared mutable state bottleneck
- Difficulty scaling to multiple consumers of the same event

## Decision

We will use **Apache Kafka** as the central event bus for all inter-service communication that requires real-time or near-real-time event propagation.

### Kafka Cluster Configuration

- **Broker:** Self-hosted Kafka on k3s (3 brokers minimum for HA)
- **Topic Structure:**
  - `candles.{symbol}.{timeframe}` — Raw OHLCV data per symbol/timeframe
  - `predictions.{model}` — Model inference results
  - `regime.changes` — Regime detection events
  - `session.aggregates` — Calculated session metrics
  - `drift.alerts` — Drift detection notifications
  - `telegram.messages` — Telegram bridge communication
  - `training.events` — ML training pipeline events

### Consumer Groups

- **ML Engine:** Subscribes to `candles.*`, `training.events`
- **BFF:** Subscribes to `predictions.*`, `regime.changes`, `drift.alerts`
- **Telegram Bridge:** Subscribes to `telegram.messages`
- **Session Aggregator:** Subscribes to `candles.*`, produces `session.aggregates`
- **Drift Monitor:** Subscribes to `predictions.*`, produces `drift.alerts`

### Schema Registry

- Use **Confluent Schema Registry** for Avro/Protobuf serialization
- Register all event schemas before deployment
- Enable schema compatibility checking (BACKWARD_COMPATIBLE)

### Event Schema Example

```protobuf
syntax = "proto3";

package tradersapp.v1;

message CandleEvent {
  string symbol = 1;
  string timeframe = 2;
  int64 timestamp = 3;
  double open = 4;
  double high = 5;
  double low = 6;
  double close = 7;
  int64 volume = 8;
}

message PredictionEvent {
  string model_name = 1;
  string signal = 2;  // LONG, SHORT, NEUTRAL
  float confidence = 3;
  int64 timestamp = 4;
  map<string, float> metadata = 5;
}

message RegimeChangeEvent {
  string regime_type = 1;
  float probability = 2;
  int64 timestamp = 3;
  string trigger = 4;  // hmm, fp_fk, anomalous_diffusion
}
```

## Consequences

### Positive
- **Decoupled services:** Producers and consumers evolve independently
- **Scalability:** Kafka handles high-throughput streaming without database contention
- **Replay capability:** Consumers can replay events from offset for debugging/recovery
- **Exactly-once semantics:** Kafka transactions ensure no duplicate events
- **Event sourcing foundation:** Enables future CQRS and event sourcing patterns
- **Real-time streaming:** Sub-100ms latency for event propagation

### Negative
- **Operational complexity:** Kafka cluster requires dedicated运维 expertise
- **Cost:** Requires more infrastructure than simple HTTP calls
- **Debugging complexity:** Distributed tracing across Kafka events is harder than HTTP
- **Schema evolution overhead:** Schema registry adds CI/CD complexity
- **Network partition risk:** Kafka unavailable affects all event-driven flows

### Neutral
- Requires additional monitoring (Kafka consumer lag, topic throughput)
- May need schema migration tooling as events evolve
- Consumer groups require careful planning to avoid hot spots

## Alternatives Considered

### RabbitMQ
- Pros: Easier to operate, built-in dead-letter queues, simpler API
- Cons: Not designed for high-throughput streaming, lacks replay capability
- **Rejected** because we need high-throughput event streaming and replay

### NATS
- Pros: Extremely lightweight, lower resource usage, simpler operation
- Cons: No persistent storage, limited message retention, smaller ecosystem
- **Rejected** because we need durable message retention for replay and audit trails

### Direct HTTP/WebSocket
- Pros: Simple, familiar, no additional infrastructure
- Cons: Tight coupling, no durability, no fan-out, no backpressure
- **Rejected** because it creates tight coupling and no replay capability

## References

- [Confluent Schema Registry Documentation](https://docs.confluent.io/platform/current/schema-registry/index.html)
- [Kafka Topic Naming Conventions](https://cnrisml.medium.com/kafka-topic-naming-conventions-best-practices)
- Related ADRs: [ADR-006 k3s](ADR-006-k3s-choice.md) (Kafka deployment target)
