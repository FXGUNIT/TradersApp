# k6 Load Test Runbook

## Prerequisites
- k6 installed: `brew install k6` (macOS) or download from [k6.io](https://k6.io)
- Target endpoint: `BASE_URL=http://bff:8788` (k8s) or `http://localhost:8788` (local dev)

## Running Load Tests

### Local
```bash
cd /e/TradersApp
BASE_URL=http://localhost:8788 k6 run tests/load/k6/scenarios.js
```

### Against k8s
```bash
kubectl port-forward svc/bff 8788:8788 -n tradersapp-dev &
BASE_URL=http://localhost:8788 k6 run tests/load/k6/scenarios.js
```

### With SLO thresholds and JSON/CSV output
```bash
BASE_URL=http://localhost:8788 \
  k6 run tests/load/k6/scenarios.js \
  --out json=tests/load/results/k6-report.json \
  --out csv=tests/load/results/k6-report.csv
```

### Override thresholds via environment variables
```bash
CI_LOCUST_SLA_P95_MS=200 \
CI_LOCUST_SLA_P99_MS=500 \
BASE_URL=http://localhost:8788 \
  k6 run tests/load/k6/scenarios.js
```

## SLO Thresholds

| Metric               | Threshold   |
|----------------------|-------------|
| P95 latency          | < 200 ms    |
| P99 latency          | < 500 ms    |
| Request failure rate | < 1 %       |

## Test Scenarios

| Scenario             | Endpoint              | VUs  | Duration |
|----------------------|-----------------------|------|----------|
| `predict_scenario`   | `POST /predict`       | 0→50 | 2 min    |
| `mamba_scenario`     | `POST /mamba/predict` | 0→25 | 2 min    |
| `consensus_scenario` | `GET /consensus`      | 0→75 | 3.5 min  |

## Fixture Data (from `tests/load/k6/fixtures.py`)

| Fixture             | Candles | Market Condition            |
|---------------------|---------|----------------------------|
| `trendingCandles`   | 50      | Consistent directional move |
| `rangingCandles`    | 50      | Oscillation within ±20 pts |
| `volatileCandles`   | 50      | High range + volume (earnings-like) |
| `mambaInput`        | 100     | First 50 trending + next 50 ranging |

## Results
- JSON report: `tests/load/results/k6-report.json`
- CSV report:   `tests/load/results/k6-report.csv`

Parse the JSON report for CI gate checks:
```bash
# Fail build if P95 > 200 ms
jq '[.metrics."http_req_duration".values] | .[0]."p(95)"' tests/load/results/k6-report.json
```

## Interpreting Results

- P99 > SLA threshold → investigate tail latency (check circuit breakers, GC pauses)
- Error rate > 1% → circuit breaker may be open; check ML Engine health
- RPS below target → horizontal scaling needed; check HPA

## See Also
- `tests/load/k6/fixtures.py` — Python candle fixtures
- `tests/load/k6/consensus_inputs.py` — consensus request helpers
- `tests/load/k6/scenarios.js` — k6 test definitions
- `docs/HPA_SCALING_TEST_RUNBOOK.md`
