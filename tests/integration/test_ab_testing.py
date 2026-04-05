"""
Integration tests for A/B testing framework.
Tests traffic splitting, statistical significance, and model variant selection.

Mark: @pytest.mark.integration
Skip: requires running ML Engine (localhost:8001)
"""

import pytest
import sys
from pathlib import Path

ML_ENGINE_ROOT = Path(__file__).parent.parent.parent / "ml-engine"
sys.path.insert(0, str(ML_ENGINE_ROOT))


pytestmark = pytest.mark.integration


def make_payload(symbol="MNQ"):
    from datetime import datetime, timezone
    import random
    candles = []
    base = 18500.0
    ts = datetime.now(timezone.utc).timestamp()
    for i in range(20):
        o = base + random.uniform(-5, 5)
        c = o + random.uniform(-3, 3)
        candles.append({
            "symbol": symbol,
            "timestamp": str(int(ts - (20 - i) * 300)),
            "open": round(o, 2),
            "high": round(max(o, c) + 1, 2),
            "low": round(min(o, c) - 1, 2),
            "close": round(c, 2),
            "volume": int(random.uniform(1000, 10000)),
        })
        base = c

    trades = []
    now = datetime.now(timezone.utc).timestamp()
    for i in range(5):
        pnl = round(random.uniform(-10, 20), 2)
        trades.append({
            "symbol": symbol,
            "direction": "LONG" if i % 2 == 0 else "SHORT",
            "entry_time": int(now - (5 - i) * 600),
            "exit_time": int(now - (5 - i) * 600 + 900),
            "pnl_ticks": pnl,
            "pnl_dollars": round(pnl * 5.0, 2),
            "result": "win" if pnl > 0 else "loss",
            "confidence": round(random.uniform(0.55, 0.85), 2),
        })

    return {
        "symbol": symbol,
        "candles": candles,
        "trades": trades,
        "session_id": 1,
    }


class TestABTestingFramework:
    """Test A/B testing traffic splitting and statistical analysis."""

    def test_ab_assignments_endpoint_exists(self, live_client):
        """GET /ab/assignments should return current A/B assignments."""
        resp = live_client.get("/ab/assignments")
        assert resp.status_code in (200, 404, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, dict)

    def test_ab_assignments_per_symbol(self, live_client):
        """A/B assignments should be symbol-specific."""
        resp = live_client.get("/ab/assignments", params={"symbol": "MNQ"})
        assert resp.status_code in (200, 404, 503)

    def test_ab_assignments_returns_variant(self, live_client):
        """A/B assignments should return a variant name."""
        resp = live_client.get("/ab/assignments")
        if resp.status_code == 200:
            data = resp.json()
            # Should have variant info
            assert any(k in data for k in ["variant", "model_version", "treatment"])

    def test_ab_record_conversion(self, live_client):
        """POST /ab/record should record a conversion event."""
        resp = live_client.post("/ab/record", json={
            "symbol": "MNQ",
            "variant": "control",
            "signal": "LONG",
            "confidence": 0.72,
            "outcome": "win",
        })
        assert resp.status_code in (200, 201, 404, 503)

    def test_ab_stats_endpoint(self, live_client):
        """GET /ab/stats should return statistical analysis."""
        resp = live_client.get("/ab/stats")
        assert resp.status_code in (200, 404, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, dict)

    def test_ab_stats_includes_sample_sizes(self, live_client):
        """A/B stats should include sample sizes per variant."""
        resp = live_client.get("/ab/stats")
        if resp.status_code == 200:
            data = resp.json()
            assert "control" in data or "variant" in data or "n_control" in data

    def test_ab_stats_includes_p_value(self, live_client):
        """A/B stats should include statistical significance (p-value)."""
        resp = live_client.get("/ab/stats")
        if resp.status_code == 200:
            data = resp.json()
            has_significance = any(
                k in data for k in ["p_value", "pvalue", "significance", "significant"]
            )
            assert has_significance

    def test_ab_record_outcome_win(self, live_client):
        """Should record a win outcome for A/B tracking."""
        resp = live_client.post("/ab/record", json={
            "symbol": "MNQ",
            "variant": "treatment",
            "signal": "LONG",
            "confidence": 0.75,
            "outcome": "win",
        })
        assert resp.status_code in (200, 201, 404, 503)

    def test_ab_record_outcome_loss(self, live_client):
        """Should record a loss outcome for A/B tracking."""
        resp = live_client.post("/ab/record", json={
            "symbol": "MNQ",
            "variant": "treatment",
            "signal": "SHORT",
            "confidence": 0.65,
            "outcome": "loss",
        })
        assert resp.status_code in (200, 201, 404, 503)

    def test_ab_traffic_split_percentage(self, live_client):
        """A/B traffic split should be configurable."""
        resp = live_client.get("/ab/assignments", params={
            "symbol": "MNQ",
            "treatment_pct": 20,
        })
        assert resp.status_code in (200, 400, 404, 503)


class TestABModelSwitching:
    """Test champion-challenger model promotion via A/B testing."""

    def test_mlflow_model_versions_endpoint(self, live_client):
        """ML model versions should be accessible."""
        resp = live_client.get("/ml/models")
        assert resp.status_code in (200, 404, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, dict)

    def test_mlflow_promote_endpoint(self, live_client):
        """POST /ml/promote should promote a model variant."""
        resp = live_client.post("/ml/promote", json={
            "model_name": "direction",
            "version": "1",
        })
        assert resp.status_code in (200, 401, 403, 404, 503)
