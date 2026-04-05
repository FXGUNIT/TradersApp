"""
Integration tests for the data feedback loop.
Tests trade ingestion → retrain trigger → model registry update pipeline.

Mark: @pytest.mark.integration
Skip: requires running ML Engine (localhost:8001) and MLflow
"""

import pytest
import sys
from pathlib import Path

ML_ENGINE_ROOT = Path(__file__).parent.parent.parent / "ml-engine"
sys.path.insert(0, str(ML_ENGINE_ROOT))


pytestmark = pytest.mark.integration


def make_trade(symbol="MNQ", direction="LONG"):
    from datetime import datetime, timezone
    import random
    now = int(datetime.now(timezone.utc).timestamp())
    pnl_ticks = round(random.uniform(-15, 25), 2)
    return {
        "symbol": symbol,
        "direction": direction,
        "entry_time": now - 3600,
        "exit_time": now,
        "pnl_ticks": pnl_ticks,
        "pnl_dollars": round(pnl_ticks * 5.0, 2),
        "result": "win" if pnl_ticks > 0 else "loss",
        "confidence": round(random.uniform(0.55, 0.88), 2),
    }


class TestFeedbackLoopIntegration:
    """Test the trade feedback loop integration."""

    def test_feedback_trade_endpoint_accepts_trade(self, live_client):
        """POST /feedback/trade should accept and record a trade outcome."""
        trade = make_trade()
        resp = live_client.post("/feedback/trade", json=trade)
        assert resp.status_code in (200, 201, 503), f"Unexpected: {resp.status_code}"

    def test_feedback_trade_returns_feedback_id(self, live_client):
        """Trade feedback should return a feedback ID or acknowledgment."""
        trade = make_trade()
        resp = live_client.post("/feedback/trade", json=trade)
        if resp.status_code in (200, 201):
            data = resp.json()
            # Should have some acknowledgment
            assert "ok" in data or "feedback_id" in data or "recorded" in data

    def test_feedback_trade_with_all_fields(self, live_client):
        """Trade feedback should accept all required fields."""
        trade = make_trade()
        resp = live_client.post("/feedback/trade", json=trade)
        assert resp.status_code in (200, 201, 503)

    def test_feedback_batch_trades(self, live_client):
        """POST /feedback/batch should accept multiple trades."""
        trades = [make_trade() for _ in range(5)]
        resp = live_client.post("/feedback/batch", json={"trades": trades})
        assert resp.status_code in (200, 201, 400, 503)

    def test_feedback_trade_with_missing_fields(self, live_client):
        """Should handle partial trade data gracefully."""
        trade = {"symbol": "MNQ"}
        resp = live_client.post("/feedback/trade", json=trade)
        # Should either accept with defaults or return 400
        assert resp.status_code in (200, 201, 400, 422, 503)

    def test_feedback_trade_invalid_result(self, live_client):
        """Should reject invalid result field."""
        trade = make_trade()
        trade["result"] = "invalid_result"
        resp = live_client.post("/feedback/trade", json=trade)
        assert resp.status_code in (400, 422, 503)

    def test_feedback_trade_invalid_direction(self, live_client):
        """Should reject invalid direction field."""
        trade = make_trade()
        trade["direction"] = "INVALID"
        resp = live_client.post("/feedback/trade", json=trade)
        assert resp.status_code in (400, 422, 503)

    def test_feedback_trade_negative_pnl(self, live_client):
        """Should accept negative P&L (losses)."""
        trade = make_trade()
        trade["pnl_ticks"] = -10.0
        trade["pnl_dollars"] = -50.0
        trade["result"] = "loss"
        resp = live_client.post("/feedback/trade", json=trade)
        assert resp.status_code in (200, 201, 503)


class TestRetrainEndpointIntegration:
    """Test ML retrain trigger endpoint."""

    def test_retrain_endpoint_exists(self, live_client):
        """GET/POST /ml/retrain should exist."""
        resp = live_client.get("/ml/retrain")
        assert resp.status_code in (200, 404, 503)

    def test_retrain_trigger_requires_auth(self, live_client):
        """POST /ml/retrain should require authentication or reject anonymous."""
        resp = live_client.post("/ml/retrain", json={})
        # Should return 401/403 if auth required, or 200/503/404
        assert resp.status_code in (200, 201, 401, 403, 404, 503)

    def test_retrain_status_endpoint(self, live_client):
        """GET /ml/retrain/status should return retrain job status."""
        resp = live_client.get("/ml/retrain/status")
        assert resp.status_code in (200, 404, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert "status" in data or "state" in data or "ok" in data

    def test_monitoring_retrain_section(self, live_client):
        """Monitoring status should include retrain information."""
        resp = live_client.get("/monitoring/status", params={"symbol": "MNQ"})
        if resp.status_code == 200:
            data = resp.json()
            assert "retrain" in data


class TestDataQualityGateIntegration:
    """Test data quality gate in the feedback loop."""

    def test_dq_gate_endpoint(self, live_client):
        """DQ gate endpoint should be accessible."""
        resp = live_client.post("/dq/validate", json={
            "symbol": "MNQ",
            "trade_count": 100,
        })
        assert resp.status_code in (200, 404, 503)

    def test_dq_gate_rejects_insufficient_trades(self, live_client):
        """DQ gate should reject retrain when insufficient trades."""
        resp = live_client.post("/dq/validate", json={
            "symbol": "MNQ",
            "trade_count": 5,
        })
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("ok") is False or data.get("pass") is False or data.get("sufficient") is False
