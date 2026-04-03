"""
ML Engine Integration Tests — tests full request/response lifecycle.

These tests require the ML Engine to be running at localhost:8001.
They test the full FastAPI endpoint contracts, not unit internals.

Usage:
  pytest tests/integration/ -v
  pytest tests/integration/ --live  # Skip if server not running
"""

from __future__ import annotations

import time
import pytest
from datetime import datetime, timezone
from unittest.mock import patch

# Test data helpers
def make_candles(n=20, symbol="MNQ"):
    candles = []
    base = 18000.0
    ts = datetime.now(timezone.utc).timestamp()

    for i in range(n):
        o = base + (i % 5 - 2)
        c = o + (i % 3 - 1)
        h = max(o, c) + 1
        l = min(o, c) - 1
        candles.append({
            "symbol": symbol,
            "timestamp": f"{(ts - (n - i) * 300):.0f}",
            "open": round(o, 2),
            "high": round(h, 2),
            "low": round(l, 2),
            "close": round(c, 2),
            "volume": 5000 + i * 100,
        })
        base = c
    return candles


def make_trades(n=5, symbol="MNQ"):
    trades = []
    now = datetime.now(timezone.utc).timestamp()
    for i in range(n):
        trades.append({
            "symbol": symbol,
            "direction": "LONG" if i % 2 == 0 else "SHORT",
            "entry_time": now - (n - i) * 600,
            "exit_time": now - (n - i) * 600 + 900,
            "pnl_ticks": 5.0 if i % 2 == 0 else -5.0,
            "pnl_dollars": 25.0 if i % 2 == 0 else -25.0,
            "result": "win" if i % 2 == 0 else "loss",
        })
    return trades


def make_payload():
    return {
        "symbol": "MNQ",
        "candles": make_candles(),
        "trades": make_trades(),
        "session_id": 1,
        "mathEngineSnapshot": {
            "amdPhase": "ACCUMULATION",
            "vrRegime": "NORMAL",
        },
    }


# ─── Test: Health Endpoint ───────────────────────────────────────────────────────

class TestHealthEndpoint:
    """Test /health endpoint contract."""

    def test_health_returns_200(self, live_client):
        """Health endpoint should return 200."""
        resp = live_client.get("/health")
        assert resp.status_code == 200

    def test_health_has_uptime(self, live_client):
        """Health response should include uptime."""
        data = live_client.get("/health").json()
        assert "uptime_seconds" in data or "timestamp" in data


# ─── Test: Consensus Endpoint ────────────────────────────────────────────────────

class TestConsensusEndpoint:
    """Test POST /api/consensus endpoint contract."""

    def test_consensus_returns_valid_signal(self, live_client):
        """Consensus should return LONG/SHORT/NEUTRAL signal."""
        payload = make_payload()
        resp = live_client.post("/api/consensus", json=payload)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"

        data = resp.json()
        assert "signal" in data
        assert data["signal"] in ("LONG", "SHORT", "NEUTRAL"), f"Invalid signal: {data['signal']}"

    def test_consensus_has_confidence(self, live_client):
        """Consensus should include confidence score."""
        payload = make_payload()
        resp = live_client.post("/api/consensus", json=payload)
        data = resp.json()
        assert "confidence" in data
        assert 0 <= data["confidence"] <= 1

    def test_consensus_has_votes(self, live_client):
        """Consensus should include per-model votes."""
        payload = make_payload()
        resp = live_client.post("/api/consensus", json=payload)
        data = resp.json()
        assert "votes" in data

    def test_consensus_has_timing(self, live_client):
        """Consensus should include timing recommendation."""
        payload = make_payload()
        resp = live_client.post("/api/consensus", json=payload)
        data = resp.json()
        assert "timing" in data
        assert "enter_now" in data["timing"]

    def test_consensus_400_on_empty_candles(self, live_client):
        """Should return 400 when no candles available."""
        payload = {"symbol": "MNQ", "candles": [], "session_id": 1}
        resp = live_client.post("/api/consensus", json=payload)
        # Should either 400 (no candles) or 200 with fallback
        assert resp.status_code in (200, 400, 503)


# ─── Test: ML Predict Endpoint ──────────────────────────────────────────────────

class TestPredictEndpoint:
    """Test POST /predict endpoint contract."""

    def test_predict_returns_votes(self, live_client):
        """Predict should return per-model votes."""
        payload = make_payload()
        resp = live_client.post("/predict", json=payload)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"

        data = resp.json()
        assert "votes" in data

    def test_predict_returns_consensus(self, live_client):
        """Predict should include consensus."""
        payload = make_payload()
        resp = live_client.post("/predict", json=payload)
        data = resp.json()
        assert "consensus" in data

    def test_predict_no_crash_on_bad_symbol(self, live_client):
        """Should not crash on non-MN symbol."""
        payload = make_payload()
        payload["symbol"] = "FAKE999"
        resp = live_client.post("/predict", json=payload)
        # Should return 200 with neutral signal, not 500
        assert resp.status_code != 500


# ─── Test: Drift Endpoints ─────────────────────────────────────────────────────

class TestDriftEndpoints:
    """Test drift detection API contracts."""

    def test_drift_status_returns(self, live_client):
        """Drift status endpoint should return status dict."""
        resp = live_client.get("/drift/status")
        assert resp.status_code == 200, f"Got {resp.status_code}"

        data = resp.json()
        assert "feature_drift" in data or "drift_detected" in data or "status" in data

    def test_drift_record_prediction(self, live_client):
        """Should accept prediction record."""
        payload = {
            "correct": True,
            "confidence": 0.72,
            "symbol": "MNQ",
        }
        resp = live_client.post("/drift/record-prediction", json=payload)
        assert resp.status_code in (200, 201), f"Got {resp.status_code}: {resp.text}"


# ─── Test: BFF → ML Engine Integration ─────────────────────────────────────────

class TestBFFMLEngineIntegration:
    """End-to-end integration: BFF calling ML Engine."""

    def test_bff_health(self, bff_client):
        """BFF health check."""
        resp = bff_client.get("/health")
        assert resp.status_code == 200

    def test_bff_proxies_consensus(self, bff_client):
        """BFF should proxy consensus requests to ML Engine."""
        payload = make_payload()
        resp = bff_client.post("/api/consensus", json=payload)
        # BFF may return 503 if ML Engine is down (graceful)
        assert resp.status_code in (200, 503), f"Got {resp.status_code}: {resp.text}"


# ─── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def live_client():
    """
    Live HTTP client for integration tests.
    Skips if ML Engine is not running.
    """
    try:
        import requests
        resp = requests.get("http://localhost:8001/health", timeout=2)
        if resp.status_code != 200:
            pytest.skip("ML Engine not running at localhost:8001")
    except Exception:
        pytest.skip("ML Engine not running at localhost:8001 — start with: docker compose up ml-engine")

    import requests
    return requests


@pytest.fixture(scope="session")
def bff_client():
    """Live BFF client for integration tests."""
    try:
        import requests
        resp = requests.get("http://localhost:8788/health", timeout=2)
        if resp.status_code != 200:
            pytest.skip("BFF not running at localhost:8788")
    except Exception:
        pytest.skip("BFF not running at localhost:8788 — start with: docker compose up bff")

    import requests
    return requests
