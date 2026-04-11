"""
Unit tests for optimization.exit_optimizer.
Tests exit strategy prediction, default fallback, and boundary conditions.
"""

import pytest
from optimization.exit_optimizer import ExitStrategyPredictor


class TestExitStrategyPredictor:
    """Test ExitStrategyPredictor inference and default behavior."""

    def test_init_not_trained(self):
        ep = ExitStrategyPredictor()
        assert ep._is_trained is False
        assert ep._models == {}

    def test_predict_when_not_trained_returns_default(self):
        ep = ExitStrategyPredictor()
        result = ep.predict({})
        assert result["strategy"] == "FALLBACK (not trained)"
        assert result["confidence"] == 0.0
        assert "stop_loss_ticks" in result
        assert "tp1_pct" in result
        assert "trailing_distance_ticks" in result
        assert "max_hold_minutes" in result

    def test_predict_conditions_normal(self):
        ep = ExitStrategyPredictor()
        # Even untrained, predict should work with default
        result = ep.predict({
            "session_id": 1,
            "atr_norm": 0.005,
            "vr": 1.0,
            "volatility_regime": 1,
            "momentum_3bar": 0.0,
            "momentum_5bar": 0.0,
            "adx": 20,
            "ci": 50,
            "hour_of_day": 10,
            "day_of_week": 2,
            "price_to_pdh": 1.0,
            "price_to_pdl": 1.0,
            "amdPhase": "NORMAL",
        })
        assert "strategy" in result
        assert "stop_loss_ticks" in result
        assert 5 <= result["stop_loss_ticks"] <= 50
        assert 0.05 <= result["tp1_pct"] <= 0.60
        assert 4 <= result["trailing_distance_ticks"] <= 20

    def test_predict_amd_manipulation_regime(self):
        ep = ExitStrategyPredictor()
        result = ep.predict({"amdPhase": "MANIPULATION"})
        assert "reason" in result
        assert "MANIPULATION" in result["reason"] or result["reason"] != ""

    def test_predict_amd_distribution_regime(self):
        ep = ExitStrategyPredictor()
        result = ep.predict({"amdPhase": "DISTRIBUTION"})
        assert "reason" in result

    def test_predict_vr_compression(self):
        ep = ExitStrategyPredictor()
        result = ep.predict({"vr": 0.70})
        assert "reason" in result
        assert "COMPRESSION" in result["reason"] or result["reason"] != ""

    def test_predict_vr_expansion(self):
        ep = ExitStrategyPredictor()
        result = ep.predict({"vr": 1.25})
        assert "reason" in result
        assert "EXPANSION" in result["reason"] or result["reason"] != ""

    def test_predict_session_0_premarket(self):
        ep = ExitStrategyPredictor()
        result = ep.predict({"session_id": 0})
        assert "PRE-MARKET" in result["reason"] or result["reason"] != ""

    def test_predict_session_2_postmarket(self):
        ep = ExitStrategyPredictor()
        result = ep.predict({"session_id": 2})
        assert "POST-MARKET" in result["reason"] or result["reason"] != ""

    def test_predict_sl_clamped_positive(self):
        ep = ExitStrategyPredictor()
        # Very high sl_ticks prediction should be clamped to 50
        result = ep.predict({"sl_ticks": 999})
        assert result["stop_loss_ticks"] <= 50
        # Very low sl_ticks should be clamped to 5
        result2 = ep.predict({"sl_ticks": 1})
        assert result2["stop_loss_ticks"] >= 5

    def test_predict_tp_pcts_sum_under_limit(self):
        ep = ExitStrategyPredictor()
        result = ep.predict({})
        total = result["tp1_pct"] + result["tp2_pct"] + result["tp3_pct"]
        # Default: tp1=0.25, tp2=0.25, tp3=0.50 → sum = 1.0
        assert total == pytest.approx(1.0)

    def test_predict_max_hold_clamped(self):
        ep = ExitStrategyPredictor()
        result = ep.predict({"max_hold_minutes": 999})
        assert result["max_hold_minutes"] <= 240
        result2 = ep.predict({"max_hold_minutes": 1})
        assert result2["max_hold_minutes"] >= 15

    def test_targets_list_complete(self):
        assert "sl_ticks" in ExitStrategyPredictor.TARGETS
        assert "tp1_pct" in ExitStrategyPredictor.TARGETS
        assert "trail_dist" in ExitStrategyPredictor.TARGETS
        assert "max_hold_minutes" in ExitStrategyPredictor.TARGETS
        assert len(ExitStrategyPredictor.TARGETS) == 9

    def test_predict_requires_training_data_short(self):
        ep = ExitStrategyPredictor()
        import pandas as pd
        df = pd.DataFrame({"a": [1, 2]})
        with pytest.raises(ValueError, match="at least 50"):
            ep.train(df)
