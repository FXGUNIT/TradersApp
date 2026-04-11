# Cold vs Warm Cache Load Test — Comparison Methodology

## Purpose

Compare ML Engine and BFF latency performance when the Redis cache is **cold**
(empty or cleared) vs **warm** (pre-populated with consensus signals and feature
data). This documents the methodology, expected results, and interpretation guidelines
for the scale-load-test.sh `--warm-cache` sweep.

---

## Methodology

### Test Setup

```
┌─────────────────────────────────────────────────────────────┐
│  k3s / Railway Cluster: tradersapp-dev                      │
│                                                             │
│  Service          Replicas  Cache State                     │
│  ─────────────────────────────────────────────────────────  │
│  ml-engine           2       warm / cold                     │
│  bff                 2       circuit-breaker fallback        │
│  redis               1       empty / pre-populated           │
└─────────────────────────────────────────────────────────────┘
```

### Test Scenarios

| Scenario | Description | k6 VUs | Duration |
|---|---|---|---|
| `predict` | POST /predict direct to ML Engine | 50 | 30s ramp + 60s peak |
| `consensus` | POST /api/consensus via BFF | 75 | 60s ramp + 120s peak |
| `mamba` | POST /mamba/predict | 25 | 30s ramp + 60s peak |

### Command

```bash
# Cold cache sweep (no --warm-cache flag)
bash scripts/k8s/scale-load-test.sh \
  --scenarios predict \
  --namespace tradersapp-dev \
  --deployment ml-engine \
  REPLICAS="1 2 4 8"

# Warm cache sweep (--warm-cache pre-populates Redis)
bash scripts/k8s/scale-load-test.sh \
  --scenarios predict \
  --warm-cache \
  --namespace tradersapp-dev \
  --deployment ml-engine \
  REPLICAS="1 2 4 8"
```

### Cold Cache Procedure

1. **Clear Redis cache** before each replica-count iteration:

```bash
# Option A: Kill Redis pod (forces empty cache on restart)
kubectl -n tradersapp-dev delete pod -l app=redis

# Option B: Flush Redis DB via exec
kubectl -n tradersapp-dev exec deploy/redis -- redis-cli FLUSHDB ASYNC
```

2. Wait for Redis to restart and BFF circuit breaker to reset.
3. Run k6 scenario without `--warm-cache`.

### Warm Cache Procedure

1. Start from clean Redis (cold procedure above).
2. Run `scale-load-test.sh` with `--warm-cache`:
   - Before each replica-count iteration, fires 20 warm-up requests
     against `/api/consensus` and `/ml/predict` endpoints.
   - This populates Redis with consensus signal caches (TTL ~60s) and
     feature pipeline caches (TTL ~300s).
3. Wait 5s for cache to stabilize.
4. Run k6 scenario.

---

## Expected Differences

### Latency Comparison (Target: P95 < 200ms, P99 < 500ms)

| Metric | Cold Cache | Warm Cache | Expected Δ | Interpretation |
|---|---|---|---|---|
| P50 latency | 40–80ms | 15–30ms | ~50% reduction | Feature pipeline + model load avoided |
| P95 latency | 120–250ms | 60–120ms | ~40–50% reduction | Cache hit avoids ML inference path |
| P99 latency | 300–600ms | 150–300ms | ~40–50% reduction | Reduced tail from cold-start model loading |
| Cold-start (1st request) | 800–2000ms | N/A | — | Pod restart or new replica |
| Cache miss rate | 100% | 5–20% | — | Some stale data evicted |

### Why Warm Cache Is Faster

```
Cold request path:
  Client → BFF → ML Engine → Feature Pipeline (no cache)
         → ML Model Load → Inference → Redis (cache miss)
         → Response (200–400ms)

Warm request path:
  Client → BFF → Redis (cache HIT) → Response (20–50ms)
  (No ML Engine call needed for cached consensus signals)
```

### Fail Ratio

| Scenario | Cold Cache | Warm Cache | Notes |
|---|---|---|---|
| Error rate | < 1% | < 0.5% | Cold: more timeouts during model loading |
| Circuit breaker 503s | 0–5% | 0% | Cold: BFF may timeout waiting for slow ML Engine |
| Health check failures | 0–3% | 0% | Cold: ML Engine pod restarting |

---

## Interpreting Results

### Acceptable Δ for Warm Cache Advantage

| Metric | Minimum Improvement | Target Improvement |
|---|---|---|
| P95 latency | 20% faster | 40–60% faster |
| P99 latency | 15% faster | 30–50% faster |
| Fail ratio | ≤ cold | 50–90% fewer failures |

### Failure Modes Detected by This Test

| Symptom | Cold | Warm | Likely Cause |
|---|---|---|---|
| P95 > 500ms (cold only) | Yes | No | Model loading on cold pod |
| P99 >> P95 (cold only) | Yes | No | Gc/CPU spike during cold start |
| Consistent 503s (cold) | Yes | No | Redis circuit breaker too aggressive |
| Consistent 503s (warm) | No | Yes | Redis still down after failover |
| No improvement warm vs cold | — | — | Cache not enabled or TTL = 0 |

---

## CSV Output Format

Each scale sweep writes to:
`tests/load/results/scale-{scenario}-{warm|cold}-{timestamp}.csv`

Columns:

```csv
timestamp,replica_count,scenario,base_url,sla_p95_ms,sla_p99_ms,
max_fail_ratio,exit_code,total_requests,total_failures,fail_ratio,
p50_ms,p95_ms,p99_ms,actual_p95_ms,actual_p99_ms,actual_fail_ratio,duration_s
```

### Example Comparison Query

```python
import csv

def compare_cold_warm(cold_csv, warm_csv, replica):
    cold = next(r for r in csv.DictReader(open(cold_csv))
                if r['replica_count'] == str(replica))
    warm = next(r for r in csv.DictReader(open(warm_csv))
                if r['replica_count'] == str(replica))

    def delta(a, b):
        return round((float(a) - float(b)) / float(b) * 100, 1) if float(b) else 0

    print(f"Replica count: {replica}")
    print(f"  P95  cold={cold['p95_ms']}ms  warm={warm['p95_ms']}ms  "
          f"Δ={delta(cold['p95_ms'], warm['p95_ms'])}%")
    print(f"  P99  cold={cold['p99_ms']}ms  warm={warm['p99_ms']}ms  "
          f"Δ={delta(cold['p99_ms'], warm['p99_ms'])}%")
    print(f"  Fail cold={float(cold['fail_ratio'])*100:.2f}%  "
          f"warm={float(warm['fail_ratio'])*100:.2f}%")
```

---

## Reproducing This Test

### Prerequisites

- k6 >= 0.47.0
- kubectl configured for the target cluster
- Redis running in the tradersapp namespace

### Full Sweep (if k3s available)

```bash
# 1. Cold cache run
OUTPUT_DIR=".artifacts/scale/cold" \
  bash scripts/k8s/scale-load-test.sh \
    --scenarios predict --namespace tradersapp-dev

# 2. Warm cache run
OUTPUT_DIR=".artifacts/scale/warm" \
  bash scripts/k8s/scale-load-test.sh \
    --scenarios predict --namespace tradersapp-dev --warm-cache

# 3. Compare results
python3 -c "
import glob, csv
cold = sorted(glob.glob('.artifacts/scale/cold/*.csv'))[-1]
warm = sorted(glob.glob('.artifacts/scale/warm/*.csv'))[-1]
print(f'Cold: {cold}')
print(f'Warm: {warm}')
"
```

### Without k3s (Syntax Verification)

```bash
# Verify all scripts are syntactically correct
bash -n scripts/k8s/scale-load-test.sh && echo "scale-load-test.sh OK"
bash -n scripts/chaos/run-pod-kill.sh       && echo "run-pod-kill.sh OK"
bash -n scripts/chaos/run-network-partition.sh && echo "run-network-partition.sh OK"
bash -n scripts/chaos/run-redis-failover.sh    && echo "run-redis-failover.sh OK"
bash -n scripts/chaos/run-kafka-broker-failure.sh && echo "run-kafka-broker-failure.sh OK"
python3 -m py_compile scripts/k8s/benchmark-cold-start.py && echo "benchmark-cold-start.py OK"
```
