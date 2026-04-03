# TradersApp — Scalability Design

## Architecture Overview

TradersApp is designed for **horizontal scalability** across all services.
Stateless services (BFF, ML Engine) can scale independently based on load.
Stateful services (Redis, PostgreSQL, Kafka) are configured for single-node
with upgrade paths to clustered deployments.

## Service Scaling Strategy

### BFF (Backend-for-Frontend)
- **Stateless**: No session state — all state in Redis
- **Scaling trigger**: CPU > 60% sustained
- **Range**: 2–8 replicas
- **Load balancer**: k8s Service with round-robin
- **Connection pooling**: 100 connections to ML Engine per replica

### ML Engine
- **Stateless**: Models loaded from shared PVC (model store)
- **Scaling trigger**: CPU > 70% OR prediction queue depth
- **Range**: 1–4 replicas (GPU is the bottleneck)
- **Cache coordination**: Redis shared across all replicas
- **Concurrency**: asyncio + thread pool for blocking ML ops
- **Important**: Only ONE replica should train at a time (use leader lock)

### Redis
- **Deployment**: Single-node (persistence + AOF)
- **Upgrade path**: Redis Cluster when shards needed
- **Memory**: 2GB initial, scale to 8GB
- **Max clients**: 10,000 (sufficient for 8 BFF + 4 ML replicas)

### PostgreSQL
- **Deployment**: Single-node with managed backup
- **CPU**: 2 cores minimum, 4 for production
- **Storage**: 50GB SSD (grow as needed)
- **Connection pooler**: PgBouncer (pool_size=20)

## Auto-Scaling Configuration

### ML Engine HPA
```yaml
minReplicas: 1
maxReplicas: 4
metrics:
  - cpuUtilization: 70%
  - memoryUtilization: 80%
scaleDownStabilization: 300s
scaleUpStabilization: 30s
```

### BFF HPA
```yaml
minReplicas: 2
maxReplicas: 8
metrics:
  - cpuUtilization: 60%
scaleDownStabilization: 300s
scaleUpStabilization: 15s
```

## Latency Targets

| Service | p50 | p95 | p99 |
|---------|-----|-----|-----|
| BFF → ML Engine | < 50ms | < 150ms | < 200ms |
| Redis cache hit | < 5ms | < 10ms | < 20ms |
| ML consensus | < 100ms | < 200ms | < 300ms |
| ML inference (Triton) | < 20ms | < 50ms | < 100ms |
| End-to-end signal | < 500ms | < 1s | < 2s |

## Capacity Planning

### Normal Trading Day (8am–5pm ET)
- ~500 consensus requests/minute (peak: 50/min during high-volatility)
- ~1000 candles ingested/minute
- Redis: ~50MB data, < 500 ops/sec

### High-Volatility Event (NFP, FOMC)
- 10x traffic spike
- ML Engine scales to 4 replicas
- Redis handles 5000 ops/sec (well within 10K limit)
- Kafka consumer buffers any overflow

## Shared Storage

| Volume | Storage | Access | Size |
|--------|---------|--------|------|
| ML models | ReadOnlyMany | All ML replicas | ~500MB |
| Candle data | ReadWriteMany | Single ML writer | ~1GB/month |
| MLflow artifacts | S3/MinIO | ML + MLflow | ~10GB |

## Leader Election (Training Lock)

Only one ML Engine replica should train at a time.
Use Redis distributed lock:

```
SET train:lock {owner_id} NX EX 3600
```

On lock acquisition: run training, refresh model store, release lock.
On lock failure: skip training this cycle.

## Failover Strategy

1. **ML Engine pod dies**: HPA spawns new replica; requests route to healthy replicas (Redis cache provides continuity)
2. **BFF pod dies**: HPA replaces; clients reconnect to new replica
3. **Redis dies**: All services degrade gracefully — ML Engine falls back to in-memory cache, BFF returns stale-with-warning
4. **PostgreSQL dies**: MLflow logging fails silently; all other services unaffected
5. **Kafka dies**: ML Engine queues locally; producer buffers up to 100 messages

## Monitoring

Key scalability metrics (see Grafana dashboard):
- `ml_http_request_duration_seconds` — endpoint latency p95/p99
- `ml_prediction_latency_seconds` — model inference p95/p99
- `ml_cache_hit_ratio` — should stay > 0.85
- `ml_circuit_breaker_state` — should be 0 (closed) normally
- `kube_pod_status_phase` — replica health
- `container_cpu_usage_seconds_total` — per-replica load
