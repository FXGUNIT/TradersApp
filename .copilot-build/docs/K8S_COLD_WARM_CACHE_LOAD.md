# K8S Cold vs Warm Cache Load Test

Runbook for `scripts/k8s/run-cold-warm-cache-load-test.sh` (TODO 56).

---

## Overview

The cold vs warm cache load test compares ML Engine latency between:

| Cache State | Description |
|---|---|
| **Cold** | First request after a cache eviction — triggers on-demand data loading |
| **Warm** | Steady-state requests with all frequently-accessed data in Redis cache |

The test is designed to quantify the **cache benefit** — how much faster warm requests are vs. cold ones — and verify that the warm P95 stays within the SLO.

---

## Methodology

### Phase 1 — Cold

1. Clear the Redis cache (configurable strategy: `rollout-restart`, `pod-kill`, or `redis-flush`).
2. Wait for the ml-engine deployment to become healthy (`GET /health` returns 200).
3. Fire **exactly one** request to `POST /predict` and record wall-clock latency.
4. Record the result as the **cold** measurement.

### Phase 2 — Warm

5. Immediately after the cold phase, fire **10 consecutive** requests to `POST /predict`.
6. Compute P50, P95, P99 across those 10 latencies.
7. Record the results as the **warm** measurement.

### Why 1 Cold + 10 Warm?

- A single cold request is sufficient: cold-start latency is dominated by the first cache miss / model load, not by request count.
- Ten warm requests give a stable estimate of steady-state P95/P99 without the overhead of a full k6 ramp.
- The test is intentionally lightweight so it can run in CI or as a pre-deploy gate.

---

## Expected Results

### Typical Latency (MNQ 5-min candles, 3-model ensemble)

| Metric | Cold | Warm | Notes |
|---|---|---|---|
| P50 | 800–2000 ms | 50–150 ms | Cold triggers feature recomputation |
| P95 | 1000–3000 ms | 100–300 ms | Warm benefits from Redis cache |
| P99 | 1500–4000 ms | 200–500 ms | Tail of distribution |
| Fail rate | < 5 % | < 1 % | Cold has slightly higher failure rate |

### Expected P95 Difference

**Cold cache is typically 3–5x worse than warm cache** for the ML Engine predict endpoint when Redis is serving the feature cache. If the ratio is less than 2x, either:

- The cache is not being cleared properly, or
- The ML Engine is not hitting the Redis cache (check `INFRASTRUCTURE_CACHE_TTL_*` env vars)

### SLO Thresholds

```bash
SLO_COLD_P95_MS=2000   # hard cap; alert if exceeded
SLO_WARM_P95_MS=500    # standard ML Engine SLO
SLO_WARM_P99_MS=1000   # standard ML Engine P99 SLO
```

Alert if cold P95 > `SLO_COLD_P95_MS` or warm P95 > `SLO_WARM_P95_MS`.

---

## Output

All artifacts are written to `tests/load/results/`:

```
tests/load/results/
  cold-warm-{timestamp}.csv          ← final comparison CSV (primary artifact)
  k6-cold-{timestamp}.log            ← k6 cold-phase raw log
  k6-warm-{timestamp}.log             ← k6 warm-phase raw log
  k6-cold-{timestamp}.json           ← k6 JSON metrics
  k6-warm-{timestamp}.json           ← k6 JSON metrics
  pods-pre-cold-{timestamp}.txt      ← pod list before cold phase
```

### CSV Format

```csv
run_id,cache_state,p50_ms,p95_ms,p99_ms,fail_rate
cold-warm-20260411-213000-run1,cold,1420.50,1580.30,1890.10,0.000000
cold-warm-20260411-213000-run1,warm,88.30,134.70,210.50,0.000000
```

### Comparison Summary (logged to stdout)

```
COLD p50=1420.50ms  p95=1580.30ms  p99=1890.10ms
WARM p50=88.30ms   p95=134.70ms   p99=210.50ms
P95 speedup (cold/warm): 11.74x
```

---

## How to Interpret Results

### Good (cache working correctly)

```
COLD p95 ≈ 1000–3000 ms
WARM p95 ≈ 100–300 ms
P95 ratio (cold/warm) ≥ 3x
```

### Warning: Cache not clearing

```
COLD p95 ≈ WARM p95  (ratio < 2x)
```
→ The cache clear strategy is not working. Check that Redis is reachable and that `REDIS_HOST`/`REDIS_PORT` are set correctly in the ml-engine deployment.

### Warning: Cold SLO breach

```
COLD p95 > 2000 ms  (or configured SLO_COLD_P95_MS)
```
→ Cold-start latency exceeds the hard cap. Investigate whether:
  - Redis is unavailable (falling back to on-disk DB)
  - Model loading is slow (check `/health` startup time)
  - NetworkPolicies are blocking ml-engine → redis traffic

### Warning: Warm SLO breach

```
WARM p95 > 500 ms  (or configured SLO_WARM_P95_MS)
```
→ Steady-state latency is degraded. Check Redis memory, CPU throttling, or increased request volume relative to replica count.

---

## Commands to Run

### Standard run (k3s / tradersapp-dev)

```bash
bash scripts/k8s/run-cold-warm-cache-load-test.sh
```

### Custom namespace / service

```bash
NAMESPACE=tradersapp-prod \
BASE_URL=http://ml-engine:8001 \
bash scripts/k8s/run-cold-warm-cache-load-test.sh
```

### Use pod-kill to clear cache (instead of rollout-restart)

```bash
CACHE_CLEAR=pod-kill bash scripts/k8s/run-cold-warm-cache-load-test.sh
```

### Use Redis FLUSHALL to clear cache

```bash
CACHE_CLEAR=redis-flush bash scripts/k8s/run-cold-warm-cache-load-test.sh
```

### Custom SLO thresholds

```bash
SLO_COLD_P95_MS=3000 \
SLO_WARM_P95_MS=750 \
bash scripts/k8s/run-cold-warm-cache-load-test.sh
```

### CI / automated (capture CSV from stdout)

```bash
bash scripts/k8s/run-cold-warm-cache-load-test.sh 2>&1 \
  | grep '^K6_CSV_RESULT:' \
  | sed 's/^K6_CSV_RESULT://' \
  >> tests/load/results/historical.csv
```

### Parse results with Python

```python
import csv

with open("tests/load/results/cold-warm-20260411-213000.csv") as f:
    for row in csv.DictReader(f):
        print(f"{row['cache_state']:5s}  "
              f"p50={row['p50_ms']:>10s}ms  "
              f"p95={row['p95_ms']:>10s}ms  "
              f"fail_rate={row['fail_rate']}")
```

---

## Prerequisites

- `kubectl` configured for the target cluster
- `k6` installed and in `$PATH`
- `python3` available in the shell
- ml-engine deployed with `POST /predict` and `GET /health` endpoints
- Redis deployed and accessible from ml-engine pods
- (Optional) Chaos Mesh installed if `CACHE_CLEAR=pod-kill`

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| k6 not found | k6 not installed | Install: `curl -sL https://聊.k6.io/dist/k6-latest.tar.gz \| tar xzf -` |
| Health check timeout after restart | Pod not ready | Increase `TIMEOUT_ROLLBACK` or check pod events: `kubectl -n tradersapp-dev describe deploy/ml-engine` |
| Cold/warm ratio < 2x | Cache not clearing | Verify `redis` pod is running and ml-engine env var `REDIS_HOST` is set |
| All requests fail | Service unreachable | Check service: `kubectl -n tradersapp-dev get svc ml-engine` |
| CSV not written | Python3 missing | Ensure python3 is available in the shell |

---

## Integration with CI

Add to the pre-deploy pipeline:

```yaml
# .woodpecker.yml  (or equivalent CI)
steps:
  - name: cold-warm-cache
    commands:
      - bash scripts/k8s/run-cold-warm-cache-load-test.sh
      # Parse CSV for gating
      - python3 -c "
          import csv, sys
          for row in csv.DictReader(open('tests/load/results/cold-warm-LATEST.csv')):
              if row['cache_state'] == 'warm' and float(row['p95_ms']) > 500:
                  sys.exit(1)
          print('Warm P95 within SLO — PASS')
        "
```
