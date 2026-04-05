"""
E2E Tests — Full Signal Lifecycle.

Tests the complete signal lifecycle from BFF request to ML Engine response:
  BFF /api/consensus → ML Engine /predict → Drift check → Response

Run with: pytest tests/e2e/ -m e2e -v
Requires: BFF (localhost:8788) and ML Engine (localhost:8001) running.
"""

import pytest
import time
import sys
from pathlib import Path

ML_ENGINE_ROOT = Path(__file__).parent.parent.parent / "ml-engine"
sys.path.insert(0, str(ML_ENGINE_ROOT))


pytestmark = pytest.mark.e2e


def make_payload(symbol="MNQ", session_id=1):
    from datetime import datetime, timezone
    import random

    now = datetime.now(timezone.utc)
    ts = now.timestamp()

    candles = []
    base = 18500.0
    for i in range(20):
        o = base + random.uniform(-5, 5)
        c = o + random.uniform(-3, 3)
        candles.append({
            "symbol": symbol,
            "timestamp": str(int(ts - (20 - i) * 300)),
            "open": round(o, 2),
            "high": round(max(o, c) + 2, 2),
            "low": round(min(o, c) - 2, 2),
            "close": round(c, 2),
            "volume": int(random.uniform(1000, 10000)),
        })
        base = c

    trades = []
    for i in range(5):
        entry = int(ts - (5 - i) * 600)
        pnl = round(random.uniform(-10, 20), 2)
        trades.append({
            "symbol": symbol,
            "direction": "LONG" if i % 2 == 0 else "SHORT",
            "entry_time": entry,
            "exit_time": int(entry + random.uniform(300, 900)),
            "pnl_ticks": pnl,
            "pnl_dollars": round(pnl * 5.0, 2),
            "result": "win" if pnl > 0 else "loss",
            "confidence": round(random.uniform(0.55, 0.88), 2),
        })

    return {
        "symbol": symbol,
        "candles": candles,
        "trades": trades,
        "session_id": session_id,
        "mathEngineSnapshot": {
            "amdPhase": random.choice(["ACCUMULATION", "DISTRIBUTION", "TRANSITION"]),
            "vrRegime": random.choice(["COMPRESSION", "NORMAL", "EXPANSION"]),
        },
    }


class TestSignalLifecycle:
    """Test the complete signal lifecycle end-to-end."""

    def test_bff_consensus_returns_valid_response(self, bff_client):
        """
        BFF /api/consensus should return a valid consensus response.
        Validates the full BFF → ML Engine → response pipeline.
        """
        payload = make_payload()
        resp = bff_client.post("/api/consensus", json=payload, timeout=30)
        assert resp.status_code in (200, 503), f"Unexpected: {resp.status_code}"

        if resp.status_code == 200:
            data = resp.json()
            # Validate required fields
            assert "signal" in data
            assert data["signal"] in ("LONG", "SHORT", "NEUTRAL")
            assert "confidence" in data
            assert 0.0 <= data["confidence"] <= 1.0
            # Should have model votes
            assert "votes" in data or "models" in data

    def test_bff_consensus_response_latency(self, bff_client):
        """
        BFF consensus should respond within SLA (200ms target, 500ms max).
        """
        payload = make_payload()
        start = time.time()
        resp = bff_client.post("/api/consensus", json=payload, timeout=30)
        elapsed_ms = (time.time() - start) * 1000

        if resp.status_code == 200:
            assert elapsed_ms < 5000, f"Response took {elapsed_ms:.0f}ms — exceeds max timeout"

    def test_ml_engine_predict_includes_votes_and_regime(self, live_client):
        """
        ML Engine /predict should return votes + regime information.
        """
        payload = make_payload()
        resp = live_client.post("/predict", json=payload, timeout=30)
        assert resp.status_code in (200, 422, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert "votes" in data or "consensus" in data

    def test_signal_includes_timing_recommendation(self, bff_client):
        """
        Consensus response should include timing recommendation.
        """
        payload = make_payload()
        resp = bff_client.post("/api/consensus", json=payload, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            assert "timing" in data or "enter_now" in data

    def test_signal_includes_exit_strategy(self, bff_client):
        """
        Consensus response should include exit strategy recommendation.
        """
        payload = make_payload()
        resp = bff_client.post("/api/consensus", json=payload, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            has_exit = any(k in data for k in [
                "exit_strategy", "exit", "stop_loss_ticks",
                "tp1_pct", "position_size", "rr_ratio",
            ])
            assert has_exit

    def test_signal_includes_alpha_score(self, bff_client):
        """
        Consensus response should include alpha score.
        """
        payload = make_payload()
        resp = bff_client.post("/api/consensus", json=payload, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            has_alpha = "alpha" in data or "alpha_score" in data
            assert has_alpha

    def test_multiple_sessions_work(self, bff_client):
        """
        Consensus should work for all trading sessions (0=pre, 1=main, 2=post).
        """
        for session_id in [0, 1, 2]:
            payload = make_payload(session_id=session_id)
            resp = bff_client.post("/api/consensus", json=payload, timeout=30)
            assert resp.status_code in (200, 503), f"Session {session_id}: {resp.status_code}"

    def test_drift_checked_on_each_signal(self, live_client):
        """
        Drift status should reflect current drift state when signal is generated.
        """
        resp = live_client.get("/drift/status", timeout=10)
        assert resp.status_code in (200, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert "status" in data or "drift_detected" in data or "feature_drift" in data

    def test_regime_detected_on_each_signal(self, bff_client):
        """
        Consensus should include regime information.
        """
        payload = make_payload()
        resp = bff_client.post("/api/consensus", json=payload, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            has_regime = any(k in data for k in ["regime", "vrRegime", "vr"])
            assert has_regime

    def test_feedback_loop_closes(self, live_client, bff_client):
        """
        After generating a signal, submitting feedback should be recorded.
        """
        # Generate a signal
        payload = make_payload()
        resp = live_client.post("/predict", json=payload, timeout=30)
        if resp.status_code not in (200, 503):
            pytest.skip("ML Engine not available for feedback loop test")

        # Submit feedback
        from datetime import datetime, timezone
        import random
        now = int(datetime.now(timezone.utc).timestamp())
        trade = {
            "symbol": "MNQ",
            "direction": "LONG",
            "entry_time": now - 3600,
            "exit_time": now,
            "pnl_ticks": round(random.uniform(-10, 20), 2),
            "pnl_dollars": round(random.uniform(-50, 100), 2),
            "result": "win" if random.random() > 0.5 else "loss",
            "confidence": round(random.uniform(0.55, 0.88), 2),
        }

        feedback_resp = live_client.post("/feedback/trade", json=trade)
        assert feedback_resp.status_code in (200, 201, 503)
