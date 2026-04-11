# ADR-013: Multi-Level Testing Strategy

**ADR ID:** ADR-013
**Title:** Multi-Level Testing Strategy (Unit, Integration, E2E, Chaos)
**Status:** Accepted
**Date:** 2026-04-06
**Author:** Claude

## Context

The TradersApp system requires comprehensive testing across:
- **ML models** — predictions must be correct, safe, and within latency bounds
- **API layer** — BFF correctly aggregates and transforms ML responses
- **Frontend** — UI renders correctly and integrates with BFF
- **Infrastructure** — Kubernetes deployments, network policies, secrets
- **Resilience** — system degrades gracefully under failures

Testing challenges:
- ML model testing is non-deterministic and requires special handling
- Integration tests require running services (ML Engine, Redis, etc.)
- End-to-end tests are slow and brittle
- Chaos engineering requires production-like environment

## Decision

We will implement a **4-tier testing pyramid** with chaos engineering:

### Tier 1: Unit Tests (Fast, Isolated)

**Coverage Target:** 80% for all services

```
ml-engine/
├── tests/
│   ├── unit/
│   │   ├── features/
│   │   │   ├── test_candle_features.py
│   │   │   ├── test_session_aggregates.py
│   │   │   └── test_feature_pipeline.py
│   │   ├── models/
│   │   │   ├── test_direction_model.py
│   │   │   ├── test_regime_model.py
│   │   │   └── test_alpha_model.py
│   │   ├── optimization/
│   │   │   ├── test_pso_optimizer.py
│   │   │   └── test_exit_optimizer.py
│   │   └── infrastructure/
│   │       ├── test_drift_detector.py
│   │       └── test_continual_learner.py
bff/
├── tests/
│   ├── unit/
│   │   ├── test_security.js
│   │   ├── test_rate_limiter.js
│   │   └── test_validators.js
src/
├── tests/
│   ├── unit/
│   │   ├── features/consensus/*.test.js
│   │   └── components/*.test.js
```

**ML Model Testing Specifics:**
```python
# test_direction_model.py
import pytest
import numpy as np
from models.direction.lgb_direction import DirectionModel

class TestDirectionModel:
    """Unit tests for LightGBM direction model."""

    @pytest.fixture
    def model(self):
        model = DirectionModel.get_instance()
        model.train(X_fake, y_fake)
        return model

    def test_output_shape(self, model):
        """Prediction returns correct shape."""
        X = np.random.randn(10, 128)
        result = model.predict(X)
        assert 'signal' in result
        assert 'confidence' in result
        assert result['signal'] in ['LONG', 'SHORT', 'NEUTRAL']
        assert 0 <= result['confidence'] <= 1

    def test_guardrails(self, model):
        """Invalid input raises appropriate error."""
        with pytest.raises(ValueError, match="Feature dimension must be 128"):
            model.predict(np.random.randn(10, 64))  # Wrong dimensions

    def test_confidence_bounds(self, model):
        """Confidence is always between 0 and 1."""
        for _ in range(100):
            X = np.random.randn(10, 128)
            result = model.predict(X)
            assert 0 <= result['confidence'] <= 0.9999

    def test_deterministic(self, model):
        """Same input produces same output."""
        X = np.random.randn(10, 128)
        result1 = model.predict(X)
        result2 = model.predict(X)
        assert result1['signal'] == result2['signal']
        assert result1['confidence'] == result2['confidence']
```

### Tier 2: Integration Tests (Service Contracts)

**Coverage Target:** All API endpoints, all service integrations

```yaml
# docker-compose.test.yml
services:
  ml-engine:
    build: ./ml-engine
    ports:
      - "8001:8001"
    environment:
      - DATABASE_URL=postgresql://test:test@postgres:5432/test

  bff:
    build: ./bff
    ports:
      - "8788:8788"
    depends_on:
      - ml-engine
      - redis
    environment:
      - ML_ENGINE_URL=http://ml-engine:8001
      - REDIS_URL=redis://redis:6379

  redis:
    image: redis:7-alpine

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=test
      - POSTGRES_USER=test
      - POSTGRES_PASSWORD=test
```

**Integration Test Example:**
```python
# test_ml_engine_integration.py
import httpx
import pytest
from consensus_aggregator import ConsensusAggregator

class TestMLEngineAPI:
    """Integration tests for ML Engine API."""

    @pytest.fixture
    async def client():
        async with httpx.AsyncClient(base_url="http://localhost:8001") as client:
            yield client

    async def test_health_endpoint(self, client):
        """Health endpoint returns ok status."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True

    async def test_predict_direction(self, client):
        """Predict endpoint returns valid consensus response."""
        payload = {
            "candles": generate_fake_candles(20),
            "features": generate_fake_features(),
            "regime": "TRENDING"
        }
        response = await client.post("/ml/predict", json=payload, timeout=10.0)
        assert response.status_code == 200
        data = response.json()
        assert "signal" in data
        assert "confidence" in data
        assert data["signal"] in ["LONG", "SHORT", "NEUTRAL"]
```

### Tier 3: End-to-End Tests (Browser Automation)

**Tool:** Playwright for frontend, pytest for API chains

```python
# e2e/test_trading_flow.py
import pytest
from playwright.sync_api import Page, expect

class TestTradingFlow:
    """E2E tests for complete trading flow."""

    @pytest.fixture
    def page(self, browser):
        page = browser.new_page()
        yield page
        page.close()

    def test_consensus_display(self, page: Page):
        """Consensus panel shows current signal."""
        page.goto("http://localhost:5173")
        page.wait_for_selector("[data-testid=consensus-signal]")

        signal = page.locator("[data-testid=consensus-signal]").text_content()
        assert signal in ["LONG", "SHORT", "NEUTRAL"]

        confidence = page.locator("[data-testid=confidence-score]").text_content()
        assert "85%" in confidence or "%" in confidence

    def test_admin_login_flow(self, page: Page):
        """Admin can login and access admin panel."""
        page.goto("http://localhost:5173/admin")
        page.fill("[name=password]", "correct-password")
        page.click("[type=submit]")
        page.wait_for_url("**/admin/dashboard")
        expect(page.locator("h1")).to_contain_text("Admin Dashboard")
```

### Tier 4: Chaos Engineering (Fault Injection)

**Tool:** chaos-engineering framework (custom + existing tools)

```yaml
# chaos/experiments.yaml
experiments:
  - name: ml-engine_latency_injection
    description: "Inject 500ms latency into ML Engine responses"
    enabled: true
    schedule: "0 2 * * *"  # Daily at 2 AM
    action:
      type: delay
      target: ml-engine
      delay_ms: 500
    probes:
      - name: bff-circuit-breaker-open
        type: http
        url: http://bff:8788/health
        expected: circuit_breaker_status == "half_open"

  - name: redis_failure
    description: "Kill Redis pod and verify fallback"
    enabled: true
    schedule: "0 3 * * 0"  # Weekly Sunday 3 AM
    action:
      type: pod-kill
      target: redis
      probability: 1.0
    probes:
      - name: bff-uses-inmemory-cache
        type: log
        pattern: "Using in-memory LRU cache"
        expected: true

  - name: network_partition
    description: "Simulate network partition between BFF and ML Engine"
    enabled: false  # Disabled by default, run manually
    action:
      type: network-loss
      source: bff
      target: ml-engine
      loss_percent: 50
```

**Chaos Test Validation:**
```python
# chaos/validate_responses.py
import pytest
from chaos.report import ChaosReport

class TestChaosResilience:
    """Validate system behavior under chaos conditions."""

    def test_circuit_breaker_opens_on_ml_failure(self):
        """
        Scenario: ML Engine returns 5xx errors
        Expected: Circuit breaker opens after 5 failures
        Expected: BFF returns NEUTRAL fallback (not error)
        """
        # Simulate 5 failures
        for _ in range(5):
            ml_engine.return_500()

        # Verify circuit breaker state
        response = bff.get("/ml/consensus")
        assert response.status_code == 200
        assert response.json()["signal"] == "NEUTRAL"
        assert response.headers["X-Circuit-Breaker"] == "open"

    def test_redis_failure_uses_inmemory_cache(self):
        """
        Scenario: Redis is unavailable
        Expected: BFF falls back to in-memory LRU cache
        Expected: Requests still succeed with stale data warning
        """
        redis.stop()

        response = bff.get("/ml/consensus")
        assert response.status_code == 200
        assert "X-Cache-Status" in response.headers
        assert "stale" in response.headers["X-Cache-Status"].lower()
```

### Test Coverage Requirements

| Service | Unit | Integration | E2E |
|---------|------|------------|-----|
| ML Engine | 80% | All endpoints | — |
| BFF | 80% | All routes | Critical paths |
| Frontend | 70% | API mocking | Critical user flows |
| Infrastructure | N/A | K8s manifests | Smoke tests |

## Consequences

### Positive
- **Comprehensive coverage:** All layers tested appropriately
- **Fast feedback:** Unit tests run in seconds
- **Confidence:** Integration tests verify service contracts
- **Resilience validation:** Chaos tests prove system survives failures
- **Regression prevention:** E2E tests catch user-facing bugs

### Negative
- **Maintenance overhead:** Tests require ongoing maintenance
- **Flakiness:** E2E tests can be unreliable
- **Slow CI:** Full test suite takes ~30 minutes
- **Infrastructure:** Chaos engineering requires production-like environment
- **Specialized skills:** ML testing requires statistical knowledge

### Neutral
- Some tests may be skipped during fast iteration
- Chaos tests run on schedule, not per-commit
- Test data requires careful management

## References

- [Testing Trophy (Kent C. Dodds)](https://kentcdodds.com/blog/the-testing-trophy)
- [chaos-engineering principles](https://principlesofchaos.org/)
- [Playwright Documentation](https://playwright.dev/)
- Related ADRs: [ADR-003 Circuit Breakers](ADR-003-circuit-breakers.md) (chaos validates breakers)
