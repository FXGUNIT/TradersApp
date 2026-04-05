"""
Integration tests for regime detection endpoints.
Tests all three regime models (HMM, FP-FK, Anomalous Diffusion) via the API.

Mark: @pytest.mark.integration
Skip: requires running ML Engine (localhost:8001)
"""

import pytest
import sys
from pathlib import Path

ML_ENGINE_ROOT = Path(__file__).parent.parent.parent / "ml-engine"
sys.path.insert(0, str(ML_ENGINE_ROOT))


pytestmark = pytest.mark.integration


def make_candles(n=60, symbol="MNQ"):
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


class TestRegimeDetectionIntegration:
    """Test regime detection API endpoints."""

    def test_regime_endpoint_returns_regime(self, live_client):
        """POST /regime should return a valid regime classification."""
        resp = live_client.post("/regime", json={
            "symbol": "MNQ",
            "candles": make_candles(60),
        })
        assert resp.status_code in (200, 503), f"Unexpected: {resp.status_code}"

        if resp.status_code == 200:
            data = resp.json()
            assert "regime" in data
            assert data["regime"] in ("COMPRESSION", "NORMAL", "EXPANSION", "CRISIS")

    def test_regime_includes_confidence(self, live_client):
        """Regime response should include confidence score."""
        resp = live_client.post("/regime", json={
            "symbol": "MNQ",
            "candles": make_candles(60),
        })
        if resp.status_code == 200:
            data = resp.json()
            assert "regime_confidence" in data
            assert 0.0 <= data["regime_confidence"] <= 1.0

    def test_regime_includes_fp_fk_fields(self, live_client):
        """Regime should include FP-FK physics parameters."""
        resp = live_client.post("/regime", json={
            "symbol": "MNQ",
            "candles": make_candles(60),
        })
        if resp.status_code == 200:
            data = resp.json()
            # FP-FK fields
            assert "q_parameter" in data or "fp_fk" in data
            assert "criticality_index" in data or "fp_fk" in data

    def test_regime_includes_hurst_exponent(self, live_client):
        """Regime should include anomalous diffusion fields."""
        resp = live_client.post("/regime", json={
            "symbol": "MNQ",
            "candles": make_candles(60),
        })
        if resp.status_code == 200:
            data = resp.json()
            assert "hurst_H" in data or "anomalous_diffusion" in data

    def test_regime_includes_deleverage_signal(self, live_client):
        """Regime should include deleverage signal."""
        resp = live_client.post("/regime", json={
            "symbol": "MNQ",
            "candles": make_candles(60),
        })
        if resp.status_code == 200:
            data = resp.json()
            assert "deleverage_signal" in data
            assert 0.0 <= data["deleverage_signal"] <= 1.0

    def test_regime_endpoint_all_three_models_present(self, live_client):
        """Regime response should reference all three model families."""
        resp = live_client.post("/regime", json={
            "symbol": "MNQ",
            "candles": make_candles(60),
        })
        if resp.status_code == 200:
            data = resp.json()
            # Ensemble should have weights for all models
            assert "model_weights" in data or "hmm" in data or "fp_fk" in data

    def test_regime_ensemble_regime_ids(self, live_client):
        """Regime ID should be in [0,1,2,3] for COMPRESSION/NORMAL/EXPANSION/CRISIS."""
        resp = live_client.post("/regime", json={
            "symbol": "MNQ",
            "candles": make_candles(60),
        })
        if resp.status_code == 200:
            data = resp.json()
            assert "regime_id" in data
            assert data["regime_id"] in (0, 1, 2, 3)

    def test_regime_includes_signal_adjustment(self, live_client):
        """Regime should include signal adjustment based on diffusion type."""
        resp = live_client.post("/regime", json={
            "symbol": "MNQ",
            "candles": make_candles(60),
        })
        if resp.status_code == 200:
            data = resp.json()
            assert "signal_adjustment" in data
            assert data["signal_adjustment"] in ("LONG_FAVORED", "SHORT_FAVORED", "BALANCED")

    def test_regime_includes_stop_multiplier(self, live_client):
        """Regime should include volatility-adjusted stop loss multiplier."""
        resp = live_client.post("/regime", json={
            "symbol": "MNQ",
            "candles": make_candles(60),
        })
        if resp.status_code == 200:
            data = resp.json()
            assert "stop_multiplier" in data
            assert 0.3 <= data["stop_multiplier"] <= 3.0

    def test_regime_includes_posteriors(self, live_client):
        """Regime posteriors should sum to approximately 1.0."""
        resp = live_client.post("/regime", json={
            "symbol": "MNQ",
            "candles": make_candles(60),
        })
        if resp.status_code == 200:
            data = resp.json()
            posteriors = data.get("regime_posteriors", {})
            total = sum(posteriors.values())
            assert abs(total - 1.0) < 0.01

    def test_regime_empty_candles_graceful(self, live_client):
        """Should handle empty candle list gracefully."""
        resp = live_client.post("/regime", json={
            "symbol": "MNQ",
            "candles": [],
        })
        assert resp.status_code in (200, 400, 503)
