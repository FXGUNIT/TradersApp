# Kafka Backpressure Strategy

**Document ID:** Phase 2 Task 41
**Owner:** ML Engine + BFF
**Last Updated:** 2026-04-11

---

## Problem Statement

When the Kafka consumer falls behind (lag > 10,000 messages), the ML engine risks:
1. **Memory exhaustion** — consuming and queuing thousands of unprocessed messages
2. **Stale predictions** — processing outdated data while newer candles are queued behind it
3. **CPU thrashing** — ML inference on stale data at the cost of fresh signal generation
4. **Broker backpressure cascade** — a slow consumer group causes broker disk pressure

Simultaneously, if the Kafka broker is unavailable, the **producer** must not block request threads.

---

## Strategy Overview

```
Producer side (broker unavailable):
  Circuit breaker (CLOSED → OPEN → HALF_OPEN)
    ↓ OPEN: messages buffered in deque(maxlen=1000)
    ↓ HALF_OPEN: _drain_buffer() replays buffered messages
    ↓ CLOSED: normal operation resumes
  Non-blocking: request threads never wait on broker availability

Consumer side (lag > 10,000):
  consumer.pause() via _check_and_apply_backpressure()
    ↓ 60-second backoff (KAFKA_CONSUMER_BACKOFF_SECONDS)
    ↓ BFF degrades gracefully (caches + stale signals)
    ↓ After backoff: consumer.resume() + retry

BFF (degraded mode while consumer is backpressured):
  Serve cached regime/consensus data
  Return NEUTRAL signal with confidence=0 for new requests
  Log "backpressure active" with alert severity
```

---

## Component Details

### 1. Kafka Producer Circuit Breaker

**File:** `ml-engine/kafka/producer.py`

**States:**
| State       | Condition                                         | Behavior                          |
|-------------|--------------------------------------------------|----------------------------------|
| CLOSED      | Normal operation                                 | Messages published directly       |
| OPEN        | `_failure_count >= _failure_threshold` (default 3)| Messages buffered, not sent       |
| HALF_OPEN   | `time.time() - _last_failure_time >= 30s`        | Up to 100 buffered msgs replayed  |

**Recovery flow:**
1. `_record_failure()` increments `_failure_count` and sets `_last_failure_time`
2. When threshold reached → circuit OPEN
3. After 30s (configurable via `KAFKA_CB_RECOVERY_TIMEOUT_SECONDS`) → circuit HALF_OPEN
4. `_drain_buffer()` tries to publish buffered messages
5. On any success → circuit CLOSED
6. On any failure in HALF_OPEN → circuit back to OPEN (re-lock)

**Buffer behavior:**
- `deque(maxlen=1000)` (configurable via `KAFKA_BUFFER_MAX_SIZE`)
- FIFO eviction — oldest message dropped when full
- Dropped messages counted in `_dropped_count`
- Buffer survives across circuit state transitions

**Prometheus metrics:**
```
kafka_producer_circuit_state{broker="localhost:9092"} 0=CLOSED 1=HALF_OPEN 2=OPEN
```

**Environment variables:**
```
KAFKA_ENABLE=true|false
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CB_FAILURE_THRESHOLD=3          # consecutive failures to trip circuit
KAFKA_CB_RECOVERY_TIMEOUT_SECONDS=30  # wait time before half-open
KAFKA_BUFFER_MAX_SIZE=1000            # max buffered messages
KAFKA_BUFFER_RETRY_INTERVAL_SECONDS=5 # sleep between drain attempts
```

---

### 2. Kafka Consumer Backpressure

**File:** `ml-engine/kafka/consumer.py`

**Trigger condition:**
```
lag = high_watermark - committed_offset
if lag > KAFKA_MAX_LAG (default 10,000):
    consumer.pause([TopicPartition])
    _paused = True
    _pause_until = now + KAFKA_CONSUMER_BACKOFF_SECONDS (default 60)
```

**Recovery flow:**
1. `_check_and_apply_backpressure()` called on every commit (every message)
2. If `_paused=True` and `time.time() >= _pause_until` → `consumer.resume([tp])`
3. Resumed topics removed from `_paused_topics`
4. When `_paused_topics` is empty → `_paused = False`

**Prometheus metrics:**
```
ml_kafka_consumer_lag{topic="candle-data", partition="0"} 100
```

**Environment variables:**
```
KAFKA_MAX_LAG=10000                    # pause threshold
KAFKA_CONSUMER_BACKOFF_SECONDS=60      # backoff duration before retry
KAFKA_LAG_CHECK_INTERVAL=50           # emit lag metric every N messages
```

---

### 3. BFF Graceful Degradation

**File:** `bff/services/consensusEngine.mjs` (or equivalent BFF consensus route)

While the consumer is backpressured:

1. **Regime cache TTL extended** — serve last-known regime longer
2. **Consensus signals served from Redis cache** — fresh or stale, never empty
3. **New prediction requests return fallback:**
   ```json
   {
     "signal": "NEUTRAL",
     "confidence": 0,
     "regime": "unknown",
     "_degraded": true,
     "_reason": "kafka_consumer_backpressure"
   }
   ```
4. **Health endpoint `/health`** returns `"status": "degraded"` with Kafka backpressure flag

The BFF circuit breaker (`bff/services/security.mjs`) already wraps ML Engine calls with 5s timeout.
Combined with consumer backpressure, this creates a two-layer protection:
```
BFF → ML Engine (5s timeout, circuit breaker)
     → Kafka producer (buffered, non-blocking)
        → Kafka consumer (paused if lag > 10K)
```

---

## Fail-Secure Guarantees

| Scenario                           | Producer Behavior          | Consumer Behavior      |
|------------------------------------|---------------------------|-----------------------|
| Broker down at startup             | Connect fails, buffering  | Skip, poll next cycle |
| Broker dies mid-operation          | `BufferError`, OPEN, buffer| Skip, poll next cycle |
| Lag buildup (slow inference)        | Normal                    | `pause()` + backoff   |
| Lag recovers                       | Normal                    | `resume()` + drain    |
| Recovery timeout expires            | HALF_OPEN → drain         | Backoff → resume      |
| Buffer overflow ( >1000 messages)  | FIFO eviction, drop count | N/A                   |
| confluent-kafka not installed      | Warning log, skip messages| Warning log, skip     |
| Prometheus not installed           | Silently no-op            | Silently no-op         |

---

## Alerting Rules (Prometheus)

```yaml
# Alert when producer circuit is stuck OPEN for > 2 minutes
- alert: KafkaProducerCircuitOpen
  expr: kafka_producer_circuit_state == 2
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "Kafka producer circuit breaker has been OPEN for > 2 minutes"

# Alert when consumer lag exceeds threshold
- alert: KafkaConsumerLagHigh
  expr: ml_kafka_consumer_lag > 10000
  for: 1m
  labels:
    severity: warning
  annotations:
    summary: "Kafka consumer lag exceeds 10,000 messages on {{ $labels.topic }}:{{ $labels.partition }}"

# Alert when consumer is paused (backpressure active)
- alert: KafkaConsumerBackpressureActive
  expr: ml_kafka_consumer_backpressure_active == 1
  for: 30s
  labels:
    severity: critical
  annotations:
    summary: "Kafka consumer is paused due to high lag — BFF operating in degraded mode"
```

---

## Testing

| Test File                                    | Coverage                                         |
|---------------------------------------------|--------------------------------------------------|
| `ml-engine/tests/test_kafka_circuit_breaker.py` | (a) broker failure → no crash<br>(b) circuit opens after N failures<br>(c) buffer fills when OPEN<br>(d) retry on HALF_OPEN<br>(e) Prometheus metric exported |
| `ml-engine/tests/test_kafka_consumer_backpressure.py` | (a) no pause when lag < threshold<br>(b) pause when lag > threshold<br>(c) resume after backoff<br>(d) lag metric exported |
| `ml-engine/tests/test_kafka_buffering.py`  | End-to-end buffering + drain cycle               |

---

## Related Documents

- `k8s/helm/tradersapp/values.yaml` — Kafka topic definitions, storage sizing
- `k8s/helm/tradersapp/values.yaml` — Kafka broker note (E10: single-broker dev limitation)
- `docs/EDGE-CASES.md` — Market regime edge cases (high volatility, weekend gaps)
- `CLAUDE.md` — Performance rules (ML Consensus latency < 200ms target)
