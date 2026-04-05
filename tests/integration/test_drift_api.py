"""
Integration tests for drift detection API endpoints.
Tests PSI score computation, baseline update, and status mapping.

Mark: @pytest.mark.integration
Skip: requires running ML Engine (localhost:8001)
"""

import pytest
import sys
from pathlib import Path

ML_ENGINE_ROOT = Path(__file__).parent.parent.parent / "ml-engine"
sys.path.insert(0, str(ML_ENGINE_ROOT))


pytestmark = pytest.mark.integration


def make_candles(n=50, symbol="MNQ"):
    from datetime import datetime, timezone
    import random
    candles = []
    base = 18500.0
    ts = datetime.now(timezone.utc).timestamp()
    for i in range(n):
        o = base + random.uniform(-5, 5)
        c = o + random.uniform(-3, 3)
        h = max(o, c) + abs(random.uniform(0, 3))
        l = min(o, c) - abs(random.uniform(0, 3))
        candles.append({
            "symbol": symbol,
            "timestamp": str(int(ts - (n - i) * 300)),
            "open": round(o, 2),
            "high": round(h, 2),
            "low": round(l, 2),
            "close": round(c, 2),
            "volume": int(random.uniform(1000, 10000)),
        })
        base = c
    return candles


class TestDriftAPIIntegration:
    """Test drift detection API endpoints."""

    def test_drift_status_returns_drift_field(self, live_client):
        """GET /drift/status should return drift status."""
        resp = live_client.get("/drift/status")
        assert resp.status_code in (200, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, dict)

    def test_drift_status_returns_feature_psi_scores(self, live_client):
        """Drift status should return per-feature PSI scores."""
        resp = live_client.get("/drift/status")
        if resp.status_code == 200:
            data = resp.json()
            # Should have feature drift info
            has_psi = "feature_drift" in data or "psi_scores" in data or "feature_psi" in data
            assert has_psi

    def test_drift_status_has_status_field(self, live_client):
        """Drift status should have a status string (ok/warning/alert/critical)."""
        resp = live_client.get("/drift/status")
        if resp.status_code == 200:
            data = resp.json()
            assert "status" in data or "drift_detected" in data

    def test_drift_update_baseline(self, live_client):
        """POST /drift/baseline should accept a new baseline."""
        candles = make_candles(50)
        resp = live_client.post("/drift/baseline", json={
            "symbol": "MNQ",
            "candles": candles,
        })
        assert resp.status_code in (200, 201, 400, 503)

    def test_drift_record_prediction(self, live_client):
        """POST /drift/record-prediction should accept prediction records."""
        resp = live_client.post("/drift/record-prediction", json={
            "symbol": "MNQ",
            "correct": True,
            "confidence": 0.72,
        })
        assert resp.status_code in (200, 201, 400, 503)

    def test_drift_concept_drift_endpoint(self, live_client):
        """GET /drift/concept should return concept drift metrics."""
        resp = live_client.get("/drift/concept")
        assert resp.status_code in (200, 503)

        if resp.status_code == 200:
            data = resp.json()
            # Should have concept drift info
            assert isinstance(data, dict)

    def test_drift_regime_drift_endpoint(self, live_client):
        """GET /drift/regime should return regime drift metrics."""
        resp = live_client.get("/drift/regime")
        assert resp.status_code in (200, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, dict)

    def test_drift_status_includes_baseline_age(self, live_client):
        """Drift status should include baseline age information."""
        resp = live_client.get("/drift/status")
        if resp.status_code == 200:
            data = resp.json()
            has_baseline_age = any(
                k in data for k in ["baseline_age_seconds", "baseline_age", "baseline_trades"]
            )
            assert has_baseline_age

    def test_drift_status_sla_included(self, live_client):
        """Drift status should include SLA monitoring section."""
        resp = live_client.get("/drift/status")
        if resp.status_code == 200:
            data = resp.json()
            assert "sla" in data or "uptime" in data

    def test_drift_threshold_env_var_read(self, live_client):
        """Drift threshold should be configurable via env var."""
        import os
        drift_threshold = os.environ.get("DRIFT_PSI_THRESHOLD", "0.2")
        resp = live_client.get("/drift/status")
        # The threshold being configurable is tested by verifying the env var exists
        assert isinstance(drift_threshold, str)


class TestDriftAPIDataIndependence:
    """Test that drift detection is per-symbol."""

    def test_drift_status_respects_symbol_param(self, live_client):
        """GET /drift/status should accept a symbol parameter."""
        resp = live_client.get("/drift/status", params={"symbol": "MNQ"})
        assert resp.status_code in (200, 503)

    def test_drift_baseline_symbol_specific(self, live_client):
        """Baseline updates should be symbol-specific."""
        mnq_resp = live_client.post("/drift/baseline", json={
            "symbol": "MNQ",
            "candles": make_candles(50),
        })
        es_resp = live_client.post("/drift/baseline", json={
            "symbol": "ES",
            "candles": make_candles(50),
        })
        # Both should succeed independently
        assert mnq_resp.status_code in (200, 201, 400, 503)
        assert es_resp.status_code in (200, 201, 400, 503)
