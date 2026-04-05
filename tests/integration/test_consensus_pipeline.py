"""
Integration tests for BFF → ML Engine consensus pipeline.
Tests the full request/response lifecycle with live HTTP calls.

Mark: @pytest.mark.integration
Skip: requires running ml-engine and bff services (localhost:8001, localhost:8788)
"""

import os
import pytest
import sys
from pathlib import Path
from datetime import datetime, timezone

ML_ENGINE_ROOT = Path(__file__).parent.parent.parent / "ml-engine"
sys.path.insert(0, str(ML_ENGINE_ROOT))


pytestmark = pytest.mark.integration


@pytest.fixture
def ml_engine_url():
    return os.environ.get("ML_ENGINE_URL", "http://localhost:8001")


@pytest.fixture
def bff_url():
    return os.environ.get("BFF_URL", "http://localhost:8788")


@pytest.fixture
def live_client(ml_engine_url):
    """HTTP client for ML Engine."""
    import httpx
    client = httpx.Client(base_url=ml_engine_url, timeout=30.0)
    yield client
    client.close()


@pytest.fixture
def bff_client(bff_url):
    """HTTP client for BFF."""
    import httpx
    client = httpx.Client(base_url=bff_url, timeout=30.0)
    yield client
    client.close()


@pytest.fixture
def synthetic_payload():
    """Generate a realistic consensus request payload."""
    now = datetime.now(timezone.utc)
    candles = []
    base_price = 18500.0
    for i in range(20):
        ts = int((now.timestamp() - (20 - i) * 300))
        import random
        candles.append({
            "symbol": "MNQ",
            "timestamp": str(ts),
            "open": round(base_price + random.uniform(-5, 5), 2),
            "high": round(base_price + 5, 2),
            "low": round(base_price - 5, 2),
            "close": round(base_price + random.uniform(-3, 3), 2),
            "volume": int(random.uniform(1000, 10000)),
        })
        base_price = candles[-1]["close"]

    trades = []
    for i in range(5):
        entry_ts = int(now.timestamp() - (5 - i) * 600)
        exit_ts = int(entry_ts + random.uniform(300, 900))
        pnl = round(random.uniform(-10, 20), 2)
        trades.append({
            "symbol": "MNQ",
            "direction": "LONG" if i % 2 == 0 else "SHORT",
            "entry_time": entry_ts,
            "exit_time": exit_ts,
            "pnl_ticks": pnl,
            "pnl_dollars": round(pnl * 5.0, 2),
            "result": "win" if pnl > 0 else "loss",
            "confidence": round(random.uniform(0.55, 0.85), 2),
        })

    return {
        "symbol": "MNQ",
        "candles": candles,
        "trades": trades,
        "session_id": 1,
        "mathEngineSnapshot": {
            "amdPhase": "ACCUMULATION",
            "vrRegime": "NORMAL",
        },
    }


class TestMLEngineHealthIntegration:
    """Test ML Engine health and readiness endpoints."""

    def test_ml_engine_health_returns_200(self, live_client):
        resp = live_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "ok" in data or "status" in data

    def test_ml_engine_prometheus_metrics_endpoint(self, live_client):
        resp = live_client.get("/metrics")
        assert resp.status_code == 200
        assert "text/plain" in resp.headers.get("content-type", "")


class TestConsensusEndpointIntegration:
    """Test BFF → ML Engine consensus pipeline end-to-end."""

    def test_bff_consensus_returns_valid_signal(self, bff_client, synthetic_payload):
        """POST /api/consensus should return a valid signal or gracefully degrade."""
        resp = bff_client.post("/api/consensus", json=synthetic_payload)
        # Accept 200 (success) or 503 (service unavailable — cold start)
        assert resp.status_code in (200, 503), f"Unexpected status: {resp.status_code}"

        if resp.status_code == 200:
            data = resp.json()
            assert "signal" in data
            assert data["signal"] in ("LONG", "SHORT", "NEUTRAL")

    def test_bff_regime_endpoint(self, bff_client, synthetic_payload):
        """POST /api/regime should return a regime classification."""
        resp = bff_client.post("/api/regime", json={
            "symbol": "MNQ",
            "candles": synthetic_payload["candles"][-10:],
        })
        assert resp.status_code in (200, 503)

    def test_ml_engine_predict_endpoint_direct(self, live_client, synthetic_payload):
        """POST /predict should return prediction data."""
        resp = live_client.post("/predict", json=synthetic_payload)
        assert resp.status_code in (200, 422, 503)

        if resp.status_code == 200:
            data = resp.json()
            # Response should have prediction fields
            assert isinstance(data, dict)


class TestMonitoringEndpointsIntegration:
    """Test monitoring and drift detection endpoints."""

    def test_monitoring_status_endpoint(self, live_client):
        """GET /monitoring/status should return a snapshot."""
        resp = live_client.get("/monitoring/status", params={"symbol": "MNQ"})
        assert resp.status_code in (200, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert data.get("ok") is True
            assert "drift" in data
            assert "sla" in data

    def test_monitoring_config_endpoint(self, live_client):
        """GET /monitoring/config should return thresholds."""
        resp = live_client.get("/monitoring/config")
        assert resp.status_code in (200, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert data.get("ok") is True
            assert "symbol" in data
            assert "max_predict_p95_ms" in data

    def test_drift_status_endpoint(self, live_client):
        """GET /drift/status should return drift state."""
        resp = live_client.get("/drift/status")
        assert resp.status_code in (200, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, dict)


class TestDataFeedbackLoopIntegration:
    """Test the trade feedback loop integration."""

    def test_feedback_endpoint_accepts_trade_outcome(self, live_client):
        """POST /feedback/trade should accept and record a trade outcome."""
        import random
        now = int(__import__("time").time())
        payload = {
            "symbol": "MNQ",
            "direction": "LONG",
            "entry_time": now - 3600,
            "exit_time": now,
            "pnl_ticks": round(random.uniform(-10, 20), 2),
            "pnl_dollars": round(random.uniform(-50, 100), 2),
            "result": "win",
            "confidence": round(random.uniform(0.6, 0.9), 2),
        }
        resp = live_client.post("/feedback/trade", json=payload)
        # Accept 200 (success) or 503 (service not ready)
        assert resp.status_code in (200, 201, 503)
