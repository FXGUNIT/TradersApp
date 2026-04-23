# Stage P — Observability Validation

> **Archived legacy validation guide.** The active public frontend is `https://tradergunit.pages.dev/`, and the current Contabo runtime proof hosts remain on `sslip.io`. Hostnames like `traders.app`, `bff.traders.app`, and `api.traders.app` below are historical OCI-era references.

**Stage:** P11
**Purpose:** Prove that production observability (metrics, logs, traces) is correctly wired end-to-end.
**Run after:** P01–P10 complete, production endpoints publicly reachable, all required GitHub secrets and variables seeded.
**Reference artifacts:**
- `docs/STAGE_P_PRODUCTION_ACTIVATION_PROOF.md`
- `.github/workflows/monitor.yml`

---

## Prerequisites

Before running this validation, confirm the following are in place:

| Requirement | Where Required | How to Verify |
|---|---|---|
| Production endpoints reachable | Public DNS + TLS (P02–P06) | `curl -sI https://api.traders.app/health` returns 200 |
| `MLFLOW_TRACKING_URI` variable | GitHub repo variables | `gh variable list MLFLOW_TRACKING_URI` |
| `PROMETHEUS_URL` variable | GitHub repo variables | `gh variable list PROMETHEUS_URL` |
| `SLACK_WEBHOOK_URL` secret | GitHub repo secrets | `gh secret list SLACK_WEBHOOK_URL` |
| `DISCORD_WEBHOOK_URL` secret | GitHub repo secrets | `gh secret list DISCORD_WEBHOOK_URL` |
| `PAGERDUTY_ROUTING_KEY` secret | GitHub repo secrets | `gh secret list PAGERDUTY_ROUTING_KEY` |

---

## 1. Prometheus Metrics Endpoint Validation

### 1.1 ML Engine `/metrics`

The ML Engine (FastAPI) exposes Prometheus metrics at `GET /metrics`.

**Endpoint:**
```
curl https://api.traders.app/metrics
```

**Expected format:** Prometheus text exposition (type `text/plain; version=0.0.4; charset=utf-8`).

**Key metrics that MUST be present:**

| Metric Name | Type | Description | Must Be Present |
|---|---|---|---|
| `consensus_latency_ms` | Histogram | End-to-end consensus prediction latency | Yes |
| `prediction_confidence` | Gauge | Latest prediction confidence score (0–1) | Yes |
| `regime_detection_score` | Gauge | Current regime detection confidence | Yes |
| `model_inference_duration_seconds` | Histogram | Per-model inference time | Yes |
| `ml_engine_requests_total` | Counter | Total ML Engine requests received | Yes |
| `ml_engine_request_errors_total` | Counter | Total ML Engine request errors (5xx) | Yes |
| `consensus_signal` | Gauge | Current consensus signal value (LONG/SHORT/NEUTRAL encoded as float) | Yes |
| `rrr_recommendation` | Gauge | Current RRR recommendation value | Recommended |
| `session_probability` | Gauge | Current session probability score | Recommended |
| `alpha_score` | Gauge | Current alpha score from alpha engine | Recommended |

**Validation command:**
```bash
# Save metrics output
curl -s https://api.traders.app/metrics -o /tmp/ml_metrics.txt

# Check for required metrics (at least one line per metric starting with metric name)
for METRIC in consensus_latency_ms prediction_confidence regime_detection_score \
              model_inference_duration_seconds ml_engine_requests_total; do
  if grep -q "^${METRIC}" /tmp/ml_metrics.txt; then
    echo "FOUND: ${METRIC}"
  else
    echo "MISSING: ${METRIC}"
  fi
done
```

**Evidence capture:**
```bash
curl -s https://api.traders.app/metrics > docs/stage-p/ml-metrics-$(date -u +%Y%m%dT%H%M%SZ).txt
```

### 1.2 BFF `/metrics`

The BFF (Node.js/Express) exposes Prometheus metrics at `GET /metrics` (via `prom-client`).

**Endpoint:**
```
curl https://bff.traders.app/metrics
```

**Key metrics that MUST be present:**

| Metric Name | Type | Description | Must Be Present |
|---|---|---|---|
| `bff_http_request_duration_seconds` | Histogram | BFF HTTP request latency by route and method | Yes |
| `bff_http_requests_total` | Counter | Total BFF HTTP requests by route, method, status code | Yes |
| `bff_ml_engine_latency_seconds` | Histogram | Latency of BFF → ML Engine calls | Yes |
| `bff_news_service_latency_seconds` | Histogram | Latency of BFF → News service calls | Yes |
| `bff_circuit_breaker_state` | Gauge | Circuit breaker state per downstream (0=closed, 1=open, 2=half-open) | Yes |
| `bff_ml_consensus_cache_hits_total` | Counter | Cache hits on consensus endpoint | Recommended |
| `bff_ml_consensus_cache_misses_total` | Counter | Cache misses on consensus endpoint | Recommended |

**Validation command:**
```bash
curl -s https://bff.traders.app/metrics -o /tmp/bff_metrics.txt

for METRIC in bff_http_request_duration_seconds bff_http_requests_total \
              bff_ml_engine_latency_seconds bff_circuit_breaker_state; do
  if grep -q "^${METRIC}" /tmp/bff_metrics.txt; then
    echo "FOUND: ${METRIC}"
  else
    echo "MISSING: ${METRIC}"
  fi
done
```

**Evidence capture:**
```bash
curl -s https://bff.traders.app/metrics > docs/stage-p/bff-metrics-$(date -u +%Y%m%dT%H%M%SZ).txt
```

### 1.3 Prometheus Scrape Config Verification

Confirm Prometheus is configured to scrape both endpoints. In `k8s/` or the Prometheus config:

```yaml
scrape_configs:
  - job_name: 'ml-engine'
    static_configs:
      - targets: ['api.traders.app:443']
    metrics_path: '/metrics'
    scheme: https
    tls_config:
      insecure_skip_verify: false   # set true only for dev

  - job_name: 'bff'
    static_configs:
      - targets: ['bff.traders.app:443']
    metrics_path: '/metrics'
    scheme: https
```

### 1.4 Grafana Dashboard Verification

**Grafana URL (production):**
```
https://grafana.traders.app/d/ml-engine-overview
```

**Panels to verify are populated (not "No data"):**

| Panel | What to Check |
|---|---|
| ML Consensus Latency (P50/P95/P99) | `histogram_quantile(0.95, rate(consensus_latency_ms_bucket[5m]))` should show values < 500 ms |
| Prediction Confidence Over Time | `prediction_confidence` gauge should show values 0.0–1.0, updated each cycle |
| Regime Detection Score | `regime_detection_score` should show 0.0–1.0, with regime label |
| BFF Latency by Route | `histogram_quantile(0.95, rate(bff_http_request_duration_seconds_bucket[5m]))` per route |
| Circuit Breaker State | `bff_circuit_breaker_state` should be 0 (closed) for healthy downstreams |
| Request Rate | `rate(ml_engine_requests_total[5m])` should be > 0 if traffic is flowing |

**Grafana provisioning config snippet (if self-hosted):**
```yaml
# k8s/grafana-values.yaml or grafana/provisioning/dashboards/*
- name: 'ML Engine Overview'
  url: 'https://grafana.traders.app/api/dashboards/uid/ml-engine-overview'
  folder: 'TradersApp'
  type: 'json
```

---

## 2. MLflow Tracking Validation

### 2.1 MLflow Server Accessibility

**Health check:**
```bash
curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${MLFLOW_TRACKING_URI}/health"
# Expected: 200
```

**UI access:**
```
https://mlflow.traders.app    (or ${MLFLOW_TRACKING_URI} if exposed)
```

### 2.2 Required Experiment Names

Four experiments MUST be registered in MLflow:

| Experiment Name | Purpose | Required |
|---|---|---|
| `direction` | Direction model (LONG/SHORT/NEUTRAL classifier) training runs | Yes |
| `regime` | Regime detection ensemble training runs | Yes |
| `session` | Session probability model training runs | Yes |
| `alpha` | Alpha engine scoring model training runs | Yes |

**Validation via MLflow API:**
```bash
MLFLOW_URI="${MLFLOW_TRACKING_URI:-http://localhost:5000}"

curl -s -H "Content-Type: application/json" \
  "${MLFLOW_URI}/api/2.0/mlflow/experiments/list" \
  -o /tmp/mlflow_experiments.json

# Check for required experiments
python3 -c "
import json
with open('/tmp/mlflow_experiments.json') as f:
    data = json.load(f)
names = [e['name'] for e in data.get('experiments', [])]
required = ['direction', 'regime', 'session', 'alpha']
for r in required:
    status = 'FOUND' if r in names else 'MISSING'
    print(f'{status}: experiment={r}')
print(f'Total experiments: {len(names)}')
"
```

**Expected output:**
```
FOUND: experiment=direction
FOUND: experiment=regime
FOUND: experiment=session
FOUND: experiment=alpha
Total experiments: >= 4
```

### 2.3 Training Runs Being Logged

Confirm that recent training runs exist (logged by `ml-engine/training/trainer.py`):

```bash
# Get experiment IDs
curl -s "${MLFLOW_URI}/api/2.0/mlflow/experiments/list" > /tmp/mlflow_exps.json

# Check last run timestamp for each experiment
for EXP in direction regime session alpha; do
  EXP_ID=$(python3 -c "
import json
with open('/tmp/mlflow_exps.json') as f:
    exps = json.load(f)['experiments']
for e in exps:
    if e['name'] == '${EXP}':
        print(e['experiment_id'])
" 2>/dev/null)

  if [ -n "$EXP_ID" ]; then
    LAST_RUN=$(curl -s "${MLFLOW_URI}/api/2.0/mlflow/experiments/get?experiment_id=${EXP_ID}" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); runs=d.get('experiment',{}).get('last_run_info',{}); print(runs.get('last_run_time','NO_RUNS'))" 2>/dev/null)
    echo "Experiment '${EXP}' (${EXP_ID}): last_run_time=${LAST_RUN}"
  else
    echo "MISSING experiment: ${EXP}"
  fi
done
```

**Acceptance criteria:**
- All four experiments exist
- Each experiment has at least one completed run (`last_run_time` is not `NO_RUNS` and not `null`)
- Run status is `FINISHED` (not `FAILED` or `KILLED`)

### 2.4 Model Registry Validation

Confirm production/staging model stages are registered:

```bash
curl -s -H "Content-Type: application/json" \
  "${MLFLOW_URI}/api/2.0/mlflow/registered-models/list" \
  -o /tmp/mlflow_models.json

python3 -c "
import json
with open('/tmp/mlflow_models.json') as f:
    data = json.load(f)
for model in data.get('registered_models', []):
    name = model['name']
    versions = model.get('latest_versions', [])
    stages = [v.get('current_stage','None') for v in versions]
    print(f'Model: {name}, stages: {stages}')
"
```

---

## 3. Alert Routing Validation (P10 Confirmation)

P10 must be validated before P11 can fully pass. The `monitor.yml` workflow is the authoritative alert definition. Use this section to confirm routing works.

### 3.1 Test Discord Alert

Send a test message to the Discord channel:

```bash
DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL}"   # From GitHub secrets / env
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"[P11 VALIDATION] Observability test alert — ignore. Sent at ${TIMESTAMP}\",
    \"embeds\": [{
      \"title\": \"P11 Observability Validation\",
      \"description\": \"This is a synthetic test alert from Stage P11 observability validation.\",
      \"color\": 3066993,
      \"footer\": { \"text\": \"TradersApp Stage P11\" },
      \"timestamp\": \"${TIMESTAMP}\"
    }]
  }" \
  "${DISCORD_WEBHOOK_URL}"
```

**Expected:** Message appears in the configured Discord channel within ~5 seconds.

**Monitor workflow equivalent** (what fires automatically):
- `monitor.yml` → `ml-engine-health` → fires when `ML_ENGINE_DOWN=true`
- `monitor.yml` → `bff-health` → fires when `BFF_DOWN=true`

### 3.2 Test Slack Alert

```bash
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"[P11 VALIDATION] Observability test alert\",
    \"blocks\": [
      {
        \"type\": \"section\",
        \"text\": {
          \"type\": \"mrkdwn\",
          \"text\": \":test_tube: *P11 Observability Validation*\nSent at ${TIMESTAMP}\nThis is a synthetic test — safe to ignore.\"
        }
      },
      {
        \"type\": \"context\",
        \"elements\": [
          { \"type\": \"mrkdwn\", \"text\": \"Source: stage_p_validate_observability.sh\" }
        ]
      }
    ]
  }" \
  "${SLACK_WEBHOOK_URL}"
```

**Expected:** Message appears in the configured Slack channel with Block Kit formatting.

### 3.3 Test PagerDuty Alert (Events API v2)

Use the PagerDuty Events API v2 to send a test `trigger` event:

```bash
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Token token=${PAGERDUTY_ROUTING_KEY}" \
  -d "{
    \"routing_key\": \"${PAGERDUTY_ROUTING_KEY}\",
    \"event_action\": \"trigger\",
    \"dedup_key\": \"p11-validation-$(date -u +%Y%m%d%H%M%S)\",
    \"payload\": {
      \"summary\": \"[P11 VALIDATION] Test alert — ignore\",
      \"severity\": \"info\",
      \"source\": \"stage-p-observability-validation\",
      \"component\": \"observability\",
      \"class\": \"validation\",
      \"timestamp\": \"${TIMESTAMP}\",
      \"custom_details\": {
        \"validation_run\": \"STAGE_P11\",
        \"environment\": \"production\",
        \"test_alert\": true
      }
    }
  }" \
  https://events.pagerduty.com/v2/enqueue

# Resolve the test incident immediately after
sleep 2

curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"routing_key\": \"${PAGERDUTY_ROUTING_KEY}\",
    \"event_action\": \"resolve\",
    \"dedup_key\": \"p11-validation-$(date -u +%Y%m%d%H%M%S)\"
  }" \
  https://events.pagerduty.com/v2/enqueue
```

**PagerDuty validation criteria:**
- Trigger event accepted (HTTP 202 response)
- Incident created in PagerDuty (visible in the service's incidents view)
- `severity: info` does not page on-call (lowest urgency) — safe for daytime testing
- Resolve event closes the incident

**PagerDuty monitor workflow equivalent** (fires automatically on `ML_ENGINE_DOWN=true`):
- `monitor.yml` → `ml-engine-health` → PagerDuty trigger with `severity: critical`
- Auto-resolves when next health check passes

### 3.4 Prometheus Alert Firing Check

Confirm Prometheus is actively evaluating alert rules:

```bash
curl -s --max-time 15 \
  "${PROMETHEUS_URL}/api/v1/alerts" \
  -o /tmp/prometheus_alerts.json

python3 -c "
import json
with open('/tmp/prometheus_alerts.json') as f:
    data = json.load(f)
alerts = data.get('data', {}).get('alerts', [])
firing = [a for a in alerts if a.get('state') == 'firing']
pending = [a for a in alerts if a.get('state') == 'pending']
print(f'Total alert rules loaded: {len(alerts)}')
print(f'Firing: {len(firing)}')
print(f'Pending: {len(pending)}')
for a in firing:
    print(f'  FIRING: {a[\"labels\"].get(\"alertname\",\"?\")} — {a[\"labels\"].get(\"severity\",\"?\")}')
for a in pending:
    print(f'  PENDING: {a[\"labels\"].get(\"alertname\",\"?\")}')
"
```

**Expected:**
- At least one alert rule loaded (any non-zero count means Prometheus is evaluating)
- No unacknowledged `firing` alerts on a healthy system (all alerts should be `inactive` on a healthy deploy)

---

## 4. Validation Scripts

### 4.1 Automated Validation Script

The primary validation tool is:

```
scripts/stage_p_validate_observability.sh
```

See that file for full implementation. Summary of what it checks:

| Check ID | What It Validates | Pass Criterion |
|---|---|---|
| `C01` | ML Engine `/metrics` reachable (HTTP 200) | `curl` returns 200 |
| `C02` | ML Engine `/metrics` has `consensus_latency_ms` | Metric name found in output |
| `C03` | ML Engine `/metrics` has `prediction_confidence` | Metric name found in output |
| `C04` | ML Engine `/metrics` has `regime_detection_score` | Metric name found in output |
| `C05` | ML Engine `/metrics` has `ml_engine_requests_total` | Metric name found in output |
| `C06` | BFF `/metrics` reachable (HTTP 200) | `curl` returns 200 |
| `C07` | BFF `/metrics` has `bff_http_request_duration_seconds` | Metric name found in output |
| `C08` | BFF `/metrics` has `bff_circuit_breaker_state` | Metric name found in output |
| `C09` | MLflow server reachable | `curl /health` returns 200 |
| `C10` | MLflow experiment `direction` exists | Experiment found via API |
| `C11` | MLflow experiment `regime` exists | Experiment found via API |
| `C12` | MLflow experiment `session` exists | Experiment found via API |
| `C13` | MLflow experiment `alpha` exists | Experiment found via API |
| `C14` | MLflow has at least one completed run | `last_run_time` not null for required experiments |
| `A01` | Discord test alert fires | Requires `--alert-test` flag |
| `A02` | Slack test alert fires | Requires `--alert-test` flag |
| `A03` | PagerDuty test event accepted | Requires `--alert-test` flag (HTTP 202) |

### 4.2 Running the Script

```bash
# Full validation (no alert test — safe to run anytime)
./scripts/stage_p_validate_observability.sh

# With alert test (sends real Discord/Slack/PagerDuty messages)
./scripts/stage_p_validate_observability.sh --alert-test

# Set custom endpoints (defaults from env or GitHub variables)
ML_ENGINE_URL=https://api.traders.app \
BFF_URL=https://bff.traders.app \
MLFLOW_TRACKING_URI=https://mlflow.traders.app \
PROMETHEUS_URL=https://prometheus.traders.app \
  ./scripts/stage_p_validate_observability.sh

# CI/CD usage (exit code 0 = all PASS, non-zero = at least one FAIL)
./scripts/stage_p_validate_observability.sh || exit 1
```

### 4.3 Expected Output Format

```
=============================================================
  STAGE P11 — Observability Validation
  Run: 2026-04-16T00:00:00Z
=============================================================

[PASS] C01  ML Engine /metrics reachable
[PASS] C02  ML Engine metrics: consensus_latency_ms
[PASS] C03  ML Engine metrics: prediction_confidence
[PASS] C04  ML Engine metrics: regime_detection_score
[PASS] C05  ML Engine metrics: ml_engine_requests_total
[PASS] C06  BFF /metrics reachable
[PASS] C07  BFF metrics: bff_http_request_duration_seconds
[PASS] C08  BFF metrics: bff_circuit_breaker_state
[PASS] C09  MLflow server reachable
[PASS] C10  MLflow experiment: direction
[PASS] C11  MLflow experiment: regime
[PASS] C12  MLflow experiment: session
[PASS] C13  MLflow experiment: alpha
[PASS] C14  MLflow experiments have completed runs
[SKIP] A01  Discord alert test (--alert-test not specified)
[SKIP] A02  Slack alert test (--alert-test not specified)
[SKIP] A03  PagerDuty alert test (--alert-test not specified)

=============================================================
  RESULT: 14 PASS, 0 FAIL, 3 SKIP
  STATUS: STAGE P11 COMPLETE
=============================================================
Evidence: docs/stage-p/p11-validation-20260416T000000Z.json
```

---

## 5. Sign-Off Gates

Each line must be checked manually (or by CI) before signing off P11:

| Gate | Evidence Required | Sign-off |
|---|---|---|
| G1 — Prometheus ML Engine | `curl https://api.traders.app/metrics` returns 200 + key metrics present | [ ] |
| G2 — Prometheus BFF | `curl https://bff.traders.app/metrics` returns 200 + key metrics present | [ ] |
| G3 — MLflow Experiments | All 4 experiments exist with >= 1 completed run | [ ] |
| G4 — Grafana Dashboard | Dashboard loads, all panels show data (not "No data") | [ ] |
| G5 — Discord Alert | Synthetic test message appears in correct Discord channel | [ ] |
| G6 — Slack Alert | Synthetic test message appears in correct Slack channel | [ ] |
| G7 — PagerDuty Routing | Test event accepted (HTTP 202), incident visible in PD UI | [ ] |
| G8 — Prometheus Alert Rules | `monitor.yml` jobs defined and Prometheus is evaluating rules | [ ] |

**All gates must be PASS before P11 is marked COMPLETE in `docs/STAGE_P_PRODUCTION_ACTIVATION_PROOF.md`.**

---

## 6. Failure Investigation Guide

| Failure | Likely Cause | Fix |
|---|---|---|
| `C01` FAIL — ML Engine /metrics unreachable | DNS not resolving, service down, TLS error | Check P02–P06; run `curl -v https://api.traders.app/health` |
| `C02–C05` FAIL — metric missing | `prometheus-fastapi-instrumentator` not imported, or `instrument_default()` not called | Verify `ml-engine/main.py` instruments the FastAPI app |
| `C06` FAIL — BFF /metrics unreachable | BFF not instrumented with `prom-client` | Verify `bff/server.mjs` creates a Registry and `/metrics` route |
| `C07–C08` FAIL — BFF metric missing | Custom metrics not registered | Verify BFF registers `bff_http_request_duration_seconds` via Express middleware |
| `C09` FAIL — MLflow unreachable | MLflow server down or `MLFLOW_TRACKING_URI` wrong | Check Docker container, check DNS; verify `MLFLOW_TRACKING_URI` |
| `C10–C13` FAIL — experiment missing | `trainer.py` not calling `mlflow.set_experiment()` | Verify training pipeline logs to correct experiment names |
| `C14` FAIL — no completed runs | Training pipeline never ran | Run `python -m ml_engine.training.trainer` manually and check MLflow UI |
| `A01–A03` FAIL — alert not received | Webhook URL wrong, secret not seeded, firewall blocking outbound 443 | Verify `gh secret list` shows all webhook URLs |
| Prometheus alert rules not loaded | `monitor.yml` not triggered yet, Prometheus config not updated | Manually trigger `monitor.yml` via `workflow_dispatch` |

---

## 7. Evidence Artifact Naming

Save all validation evidence to `docs/stage-p/` with a timestamp:

```
docs/stage-p/
  p11-validation-YYYYMMDDTHHMMSSZ.json      # Script JSON output
  ml-metrics-YYYYMMDDTHHMMSSZ.txt           # Raw ML Engine /metrics
  bff-metrics-YYYYMMDDTHHMMSSZ.txt          # Raw BFF /metrics
  mlflow-experiments-YYYYMMDDTHHMMSSZ.json # MLflow experiment list API response
  prometheus-alerts-YYYYMMDDTHHMMSSZ.json   # Prometheus /api/v1/alerts response
```

Reference these files in `docs/STAGE_P_PRODUCTION_ACTIVATION_PROOF.md` to prove P11 is complete.
