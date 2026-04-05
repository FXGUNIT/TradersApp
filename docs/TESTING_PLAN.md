# Testing Plan — TradersApp

**Last Updated:** 2026-04-06

---

## Overview

TradersApp enforces **multi-level automated testing** across four tiers:
1. **Unit tests** — fast, isolated, no external dependencies
2. **Integration tests** — require live services (ML Engine, BFF, MLflow)
3. **Load / Performance tests** — stress testing with Locust
4. **Chaos / E2E tests** — fault injection and full lifecycle validation

---

## Test Tiers

### Tier 1: Unit Tests (`pytest -m unit`)

| Metric | Threshold |
|--------|-----------|
| Run frequency | Every commit (PR gate) |
| Duration target | < 30s |
| Coverage | ≥ 65% overall, ≥ 60% critical paths |
| Tool | `pytest`, `pytest-cov` |
| Exit on failure | Must pass — blocks merge |

**Critical paths requiring coverage:**
- `features/` — feature engineering pipeline
- `infrastructure/` — Guardrails, CircuitBreaker, SLAMonitor, DriftDetector, MLflow client
- `inference/` — Predictor, ConsensusAggregator
- `optimization/` — Position sizer, exit optimizer, RRR optimizer
- `alpha/` — Alpha engine
- `models/regime/` — Regime ensemble
- `training/` — Trainer, cross-validator
- `session/` — Session probability

**Running unit tests:**
```bash
cd ml-engine
pytest tests/ -m unit -v
pytest tests/ -m unit --cov=ml_engine --cov-report=term-missing
pytest tests/ -m unit -n auto  # parallel with pytest-xdist
```

---

### Tier 2: Integration Tests (`pytest -m integration`)

| Metric | Threshold |
|--------|-----------|
| Run frequency | On push to `main`/`staging`, nightly |
| Duration target | < 5 min |
| Requires | ML Engine (localhost:8001), BFF (localhost:8788) |
| Tool | `pytest`, `httpx` |
| Exit on failure | Must pass on staging, warning-only on PR |

**Services required:**
```bash
# Start required services
docker compose up -d ml-engine bff redis mlflow minio

# Run integration tests
pytest tests/integration/ -v
pytest tests/integration/ --collect-only  # list without running
```

**Test categories:**
- `test_ml_engine_integration.py` — health, consensus, predict endpoints
- `test_monitoring_endpoints.py` — `/monitoring/status`, `/monitoring/config`
- `test_inference_stack.py` — full ML serving stack
- `test_consensus_pipeline.py` — BFF → ML Engine end-to-end
- `test_regime_detection.py` — HMM, FP-FK, Anomalous Diffusion models
- `test_drift_api.py` — drift detection, baseline update, PSI scores
- `test_feedback_loop.py` — trade ingestion, retrain trigger, DQ gate
- `test_ab_testing.py` — traffic splitting, statistical significance
- `test_airflow_dag.py` — DAG structure validation (no Airflow needed)

---

### Tier 3: Performance / Load Tests (`locust`)

| Metric | Threshold |
|--------|-----------|
| Run frequency | Every push to `main`, nightly |
| Tool | `locust`, `pytest -m performance` |
| SLA | p95 < 200ms (ML Engine), p99 < 500ms |

**Running load tests:**
```bash
# Standard load test
locust -f tests/load/locustfile.py \
  --host=http://localhost:8788 \
  --users 100 --spawn-rate 10 --run-time 5m --headless

# Spike test (2x users over 30s)
locust -f tests/load/locustfile.py \
  --host=http://localhost:8788 \
  --users 100 --spawn-rate 10 \
  --spike-test --spike-factor 2 --spike-duration 30 \
  --headless

# Soak test (30min at 50% load)
locust -f tests/load/locustfile.py \
  --host=http://localhost:8788 \
  --users 50 --spawn-rate 5 \
  --soak-test --soak-duration 1800 \
  --headless

# Chaos injection mode
locust -f tests/load/locustfile.py \
  --host=http://localhost:8788 \
  --chaos-injection --chaos-latency-ms 500 --chaos-error-rate 0.01 \
  --headless
```

**SLA assertions:**
- FAIL if `p95 > SLA_P95_MS` (default: 200ms)
- FAIL if `fail_ratio > MAX_FAIL_RATIO` (default: 1%)
- Exit code 1 on breach → CI fails

---

### Tier 4: Chaos / E2E Tests (`pytest -m chaos`, `pytest -m e2e`)

| Metric | Threshold |
|--------|-----------|
| Run frequency | Nightly (chaos), on-demand (e2e) |
| Tool | `pytest -m chaos`, `pytest -m e2e` |
| Requires | `CHAOS_ENABLED=true` or all services running |

**Chaos engineering tests:**
```bash
# Run chaos tests
CHAOS_ENABLED=true pytest tests/chaos/ -v -m chaos

# Run E2E tests (all services required)
pytest tests/e2e/ -v -m e2e

# With chaos injection script
python scripts/chaos_injector.py --type latency --target ml-engine --duration 30 --delay 5000
python scripts/chaos_injector.py --type errors --target ml-engine --duration 60 --rate 0.1
python scripts/chaos_injector.py --type data --target ml-engine --duration 120 --corrupt 0.05
```

**Chaos experiments (nightly via GitHub Actions):**
```bash
# Trigger chaos nightly via gh CLI
bash scripts/chaos_schedule.sh staging
```

**SLO for chaos recovery:**
- ML Engine must recover within **60 seconds** of any chaos injection
- Circuit breaker must open after 3 consecutive failures
- Guardrails must reject NaN/negative/corrupt inputs (return 422, not 200)
- Redis failure must fall back to in-memory cache (no crashes)

---

## CI/CD Pipeline Test Gates

### Pull Request Gate
```
lint (eslint, ruff)      → must pass
type check (mypy)        → must pass (0 errors)
security scan (bandit)   → must pass (0 HIGH/critical)
unit tests (pytest)      → must pass + coverage ≥ 65%
Docker build             → must succeed
```

### Main Branch Gate
```
All PR gates +
integration tests        → against staging (after deploy)
load test (locust)       → p95 < 200ms, fail ratio < 1%
Docker push               → to GHCR
Deploy to staging         → via Railway
```

### Staging Gate (nightly)
```
integration tests         → against staging
chaos experiments         → via chaos-nightly.yml
retrain health check      → verify MLflow and monitoring
```

### Production Gate
```
All staging gates
manual review (if needed)
deploy to production
```

---

## Test Execution Schedule

| Time | Frequency | Tests | Environment |
|------|-----------|-------|-------------|
| Every commit | On-PR | Unit + lint + mypy + bandit | GitHub Actions |
| Every push to main | On-push | Integration + load + deploy staging | GitHub Actions |
| Daily 2 AM UTC | Nightly | Chaos experiments | GitHub Actions (chaos-nightly.yml) |
| Weekly | Manual | Full E2E + soak test (30min) | Staging |
| Pre-release | Manual | 2hr soak + spike + chaos | Staging |

---

## Pass Thresholds

| Test Type | Pass Rate | Blocking |
|-----------|-----------|----------|
| Unit tests | 100% | Yes — blocks merge |
| Integration tests | 100% | Yes — blocks merge |
| Load test p95 | < 200ms | Yes — blocks merge |
| Load test fail ratio | < 1% | Yes — blocks merge |
| Chaos experiments | ≥ 80% | Warning only (nightly) |
| Security scan | 0 HIGH/critical | Yes — blocks merge |

---

## Failure Escalation

| Failure Type | Action |
|-------------|--------|
| Unit test failure | Notify PR author, block merge |
| Integration test failure | Block merge, open issue |
| Load test SLA breach | Block merge, notify Slack `#alerts` |
| Chaos experiment failure | Notify Slack `#chaos`, open GitHub issue |
| Security scan HIGH | Block merge, notify `#security` |
| Chaos recovery > 60s | Auto-open GitHub issue with SLO breach label |

---

## Reporting

- **pytest-html**: Generated in CI, uploaded as artifact
- **Coverage**: Uploaded to Codecov via `codecov` GitHub Action
- **Locust**: HTML report saved as artifact
- **Chaos**: Summary posted to Slack `#alerts`, detailed logs to GitHub artifact
- **Nightly dashboard**: Grafana board `chaos-experiments` tracks recovery times

---

## Adding New Tests

**Unit test pattern:**
```python
# ml-engine/tests/test_<module>.py
import pytest
pytestmark = pytest.mark.unit

class TestFeature:
    def test_behavior(self):
        from module import ClassName
        result = ClassName().method(input)
        assert result == expected
```

**Integration test pattern:**
```python
# tests/integration/test_<feature>.py
pytestmark = pytest.mark.integration

def test_api_contract(live_client):
    resp = live_client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "ok" in data or "status" in data
```

**Chaos test pattern:**
```python
# tests/chaos/test_<system>_chaos.py
pytestmark = pytest.mark.chaos

def test_circuit_breaker_opens_on_failure(chaos_enabled):
    if not chaos_enabled:
        pytest.skip("CHAOS_ENABLED=true required")
    # ...
```

---

## Dependencies

```toml
# pyproject.toml test dependencies
[tool.pytest.ini_options]
testpaths = ["tests"]
markers = [
    "unit: fast isolated tests",
    "integration: requires live services",
    "performance: load/latency tests",
    "chaos: fault injection",
    "e2e: full lifecycle",
]
```

Install test dependencies:
```bash
pip install pytest pytest-cov pytest-xdist pytest-timeout pytest-mock pytest-html
pip install httpx fakeredis
pip install locust
pip install bandit mypy ruff
```
