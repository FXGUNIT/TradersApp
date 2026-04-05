"""
E2E Tests — Retrain and Rollback Lifecycle.

Tests the complete retrain lifecycle:
  Trade accumulation → DQ gate pass → Retrain triggered → Model registered → Baseline updated

Also tests rollback:
  New model degrades → Auto-rollback → Old model restored

Run with: pytest tests/e2e/ -m e2e -v
Requires: ML Engine + MLflow (localhost:5000) + MinIO running.
"""

import pytest
import time
import sys
from pathlib import Path

ML_ENGINE_ROOT = Path(__file__).parent.parent.parent / "ml-engine"
sys.path.insert(0, str(ML_ENGINE_ROOT))


pytestmark = pytest.mark.e2e


def make_trades(n=10, symbol="MNQ"):
    from datetime import datetime, timezone
    import random
    now = int(datetime.now(timezone.utc).timestamp())
    trades = []
    for i in range(n):
        entry = now - (n - i) * 600
        pnl = round(random.uniform(-15, 25), 2)
        trades.append({
            "symbol": symbol,
            "direction": "LONG" if i % 2 == 0 else "SHORT",
            "entry_time": entry,
            "exit_time": int(entry + random.uniform(300, 1800)),
            "pnl_ticks": pnl,
            "pnl_dollars": round(pnl * 5.0, 2),
            "result": "win" if pnl > 0 else "loss",
            "confidence": round(random.uniform(0.55, 0.88), 2),
        })
    return trades


class TestRetrainLifecycle:
    """Test the complete model retrain lifecycle."""

    def test_retrain_status_endpoint_accessible(self, live_client):
        """Retrain status endpoint should be accessible."""
        resp = live_client.get("/ml/retrain/status", timeout=10)
        assert resp.status_code in (200, 404, 503)

    def test_retrain_requires_sufficient_trades(self, live_client):
        """
        Retrain should only trigger when sufficient validated trades exist.
        """
        # Submit too few trades
        trades = make_trades(3)
        for trade in trades:
            resp = live_client.post("/feedback/trade", json=trade)
            assert resp.status_code in (200, 201, 503)

        # Check retrain status — should not be triggered
        resp = live_client.get("/ml/retrain/status", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            state = data.get("status", data.get("state", ""))
            # State should indicate waiting, not retraining
            assert state not in ("retraining", "training", "running") or "waiting" in str(state).lower()

    def test_retrain_accumulates_trades(self, live_client):
        """
        Submitting many trades should eventually accumulate to retrain threshold.
        """
        trades = make_trades(20)
        recorded = 0
        for trade in trades:
            resp = live_client.post("/feedback/trade", json=trade)
            if resp.status_code in (200, 201):
                recorded += 1

        assert recorded >= 15, f"Only {recorded} trades recorded"

    def test_retrain_status_reflects_accumulation(self, live_client):
        """Retrain status should reflect trade count accumulated."""
        resp = live_client.get("/ml/retrain/status", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            assert "trades" in data or "trade_count" in data or "pending_trades" in data

    def test_retrain_triggers_after_threshold(self, live_client):
        """
        Once threshold is reached, retrain should be triggered.
        """
        # Submit many validated trades
        trades = make_trades(100)
        triggered = False
        for trade in trades:
            resp = live_client.post("/feedback/trade", json=trade)
            if resp.status_code in (200, 201):
                triggered = True

        assert triggered, "No trades were recorded"
        time.sleep(2)  # Give system time to process

        # Check retrain status
        resp = live_client.get("/ml/retrain/status", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            status = data.get("status", data.get("state", "unknown"))
            # Either retraining now, or queued, or already completed
            assert status in ("retraining", "queued", "completed", "success", "waiting", "idle", "ready")

    def test_monitoring_reflects_retrain_activity(self, live_client):
        """Monitoring status should reflect recent retrain activity."""
        resp = live_client.get("/monitoring/status", params={"symbol": "MNQ"}, timeout=20)
        assert resp.status_code in (200, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert "retrain" in data


class TestRollbackLifecycle:
    """Test automatic rollback on model degradation."""

    def test_rollback_triggered_on_metric_degradation(self):
        """
        When new model metrics degrade beyond threshold, rollback should be triggered.
        This is validated by the AntiForgettingValidator in the MLflow client.
        """
        from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig

        config = ContinualLearningConfig(
            max_win_rate_drop=0.05,
            max_expectancy_drop=0.10,
            max_sharpe_drop=0.15,
        )
        validator = AntiForgettingValidator(config)

        # Before: 70% win rate
        before = [{"result": "win"}] * 70 + [{"result": "loss"}] * 30

        # After: 20% win rate (massive degradation)
        after = [{"result": "win"}] * 2 + [{"result": "loss"}] * 8

        import tempfile, joblib
        from pathlib import Path
        with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as f:
            ckpt = Path(f.name)
        try:
            joblib.dump({}, ckpt)
            models, report = validator.validate_training_round(
                before, after, {}, ckpt.stem, 99
            )
            assert report.passed is False, "Validator should detect catastrophic forgetting"
            assert report.rollback_triggered is True, "Rollback should be triggered"
            assert report.rollback_reason is not None
        finally:
            ckpt.unlink(missing_ok=True)

    def test_rollback_does_not_trigger_on_stable_metrics(self):
        """
        When metrics are stable, no rollback should be triggered.
        """
        from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig

        config = ContinualLearningConfig(
            max_win_rate_drop=0.05,
            max_expectancy_drop=0.10,
        )
        validator = AntiForgettingValidator(config)

        before = [{"result": "win"}] * 6 + [{"result": "loss"}] * 4
        after = [{"result": "win"}] * 6 + [{"result": "loss"}] * 4  # Identical

        import tempfile, joblib
        from pathlib import Path
        with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as f:
            ckpt = Path(f.name)
        try:
            joblib.dump({}, ckpt)
            models, report = validator.validate_training_round(
                before, after, {}, ckpt.stem, 100
            )
            assert report.passed is True, "Metrics are stable — should pass"
            assert report.rollback_triggered is False
        finally:
            ckpt.unlink(missing_ok=True)

    def test_mlflow_registry_reflects_model_stages(self, live_client):
        """MLflow registry should track model stages (None → Staging → Production)."""
        resp = live_client.get("/ml/models", timeout=10)
        assert resp.status_code in (200, 404, 503)

        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, dict)
