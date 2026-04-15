# Runbook: High ML Latency

**Severity:** P2 — consensus slow (>500ms P95)
**Detection:** k6 SLO breach alert, user report, `/sla` endpoint

---

## Step 1: Check latency metrics

```bash
# ML Engine SLA endpoint
curl -sf http://localhost:8001/sla | python3 -m json.tool

# Prometheus latency query
curl "http://localhost:9090/api/v1/query?query=bff_ml_engine_latency_seconds" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); [print(r['metric'], r['value']) for r in d['data']['result']]"
```

---

## Step 2: Check which endpoint is slow

From `/sla` output, identify the endpoint with highest P95.

| Endpoint | Likely cause | Fix |
|----------|-------------|-----|
| `/predict` | Model cold / large payload | Warm model cache |
| `/train-sync` | Training in progress | Wait or cancel |
| `/backtest/full` | Large candle dataset | Limit rows |
| `/news-trigger` | News API slow | Timeout expected |

---

## Step 3: Warm model cache

```bash
# Force model warmup
curl -sf http://localhost:8001/features/warmup

# Check model status
curl -sf http://localhost:8001/model-status | python3 -m json.tool
```

---

## Step 4: Check ML Engine resource usage

```bash
docker stats traders-ml-engine --no-stream
# If CPU 100%: check for runaway training job
# If memory 90%+: restart ML Engine (see ml-engine-down.md)
```

---

## Step 5: Post-incident

- [ ] Check Prometheus for latency trend: `rate(bff_ml_engine_latency_seconds[5m])`
- [ ] If pattern: add alerting rule to Prometheus alerts
- [ ] File issue if new root cause
