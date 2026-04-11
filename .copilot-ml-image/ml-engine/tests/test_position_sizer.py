"""
Unit tests for optimization.position_sizer.
Tests Kelly criterion, confidence adjustment, drawdown throttle, and boundary cases.
"""

import pytest
from optimization.position_sizer import kelly_criterion, PositionSizingPredictor


class TestKellyCriterion:
    """Test the Kelly criterion formula."""

    def test_kelly_zero_rr(self):
        assert kelly_criterion(0.6, 0.0) == 0.0

    def test_kelly_negative_rr(self):
        assert kelly_criterion(0.6, -1.0) == 0.0

    def test_kelly_50_50_2rr(self):
        # 50% win rate, 2:1 R:R
        # Kelly = (0.5 * 2 - 0.5) / 2 = (1.0 - 0.5) / 2 = 0.25
        result = kelly_criterion(0.5, 2.0)
        assert result == 0.25

    def test_kelly_high_win_rate(self):
        # 70% win rate, 2:1 R:R
        # Kelly = (0.7 * 2 - 0.3) / 2 = (1.4 - 0.3) / 2 = 0.55
        result = kelly_criterion(0.7, 2.0)
        assert result == pytest.approx(0.55)

    def test_kelly_clamped_to_one(self):
        # 90% win rate, 5:1 R:R: kelly = (0.9*5 - 0.1)/5 = 0.88
        # The implementation clamps to [0, 1], so 0.88 is returned unchanged
        result = kelly_criterion(0.9, 5.0)
        assert result == pytest.approx(0.88)

    def test_kelly_clamped_to_zero(self):
        # Negative edge
        result = kelly_criterion(0.3, 2.0)
        assert result == 0.0

    def test_kelly_clamped_to_zero_at_exactly_breakeven(self):
        # breakeven: 1/3 win rate, 2:1 R:R → kelly = 0
        result = kelly_criterion(1/3, 2.0)
        assert result == 0.0


class TestPositionSizingPredictor:
    """Test PositionSizingPredictor inference and boundary cases."""

    def test_predict_requires_train(self):
        ps = PositionSizingPredictor()
        assert ps._is_trained is False

    def test_predict_minimum_conditions(self):
        ps = PositionSizingPredictor()
        result = ps.predict({})
        assert "contracts" in result
        assert "risk_per_trade_dollars" in result
        assert result["contracts"] >= 1

    def test_predict_with_all_conditions(self):
        ps = PositionSizingPredictor()
        conditions = {
            "win_rate": 0.6,
            "rr_ratio": 2.0,
            "consensus_confidence": 0.7,
            "alpha_score": 5.0,
            "atr": 20.0,
            "exit_plan": {"stop_loss_ticks": 20},
            "session_id": 1,
            "is_throttled": False,
            "vr": 1.0,
            "is_lunch_hour": False,
        }
        result = ps.predict(conditions, account_balance=10000.0)
        assert result["contracts"] >= 1
        assert 0.0 <= result["risk_pct_of_account"] <= 100
        assert result["strategy"] == "ML-DETERMINED"
        assert "reasoning" in result

    def test_predict_drawdown_throttle(self):
        ps = PositionSizingPredictor()
        normal = ps.predict({
            "win_rate": 0.6,
            "rr_ratio": 2.0,
            "consensus_confidence": 0.7,
            "alpha_score": 5.0,
            "atr": 20.0,
            "exit_plan": {"stop_loss_ticks": 20},
            "session_id": 1,
            "is_throttled": False,
        }, account_balance=10000.0)
        throttled = ps.predict({
            "win_rate": 0.6,
            "rr_ratio": 2.0,
            "consensus_confidence": 0.7,
            "alpha_score": 5.0,
            "atr": 20.0,
            "exit_plan": {"stop_loss_ticks": 20},
            "session_id": 1,
            "is_throttled": True,
        }, account_balance=10000.0)
        assert throttled["contracts"] <= normal["contracts"]
        assert throttled["drawdown_throttled"] is True
        assert throttled["throttle_note"] != ""

    def test_predict_high_confidence_increases_size(self):
        ps = PositionSizingPredictor()
        low_conf = ps.predict({
            "consensus_confidence": 0.52,
            "rr_ratio": 2.0,
            "exit_plan": {"stop_loss_ticks": 20},
        }, account_balance=10000.0)
        high_conf = ps.predict({
            "consensus_confidence": 0.9,
            "rr_ratio": 2.0,
            "exit_plan": {"stop_loss_ticks": 20},
        }, account_balance=10000.0)
        # High confidence should produce same or larger contracts
        assert high_conf["contracts"] >= low_conf["contracts"]

    def test_predict_max_wait_tight_window(self):
        ps = PositionSizingPredictor()
        # High alpha + high confidence → tight window
        result = ps.predict({
            "alpha_score": 6.0,
            "consensus_confidence": 0.85,
            "exit_plan": {},
            "session_id": 1,
            "vr": 1.0,
        })
        assert result["max_wait_minutes"] == 15

    def test_predict_max_wait_lunch_session(self):
        ps = PositionSizingPredictor()
        result = ps.predict({
            "alpha_score": 1.0,
            "consensus_confidence": 0.5,
            "exit_plan": {},
            "session_id": 1,
            "is_lunch_hour": True,
        })
        assert result["max_wait_minutes"] == 60

    def test_predict_max_wait_vr_compression(self):
        ps = PositionSizingPredictor()
        result = ps.predict({
            "alpha_score": 2.0,
            "consensus_confidence": 0.5,
            "exit_plan": {},
            "session_id": 1,
            "vr": 0.8,
        })
        assert result["max_wait_minutes"] == 20

    def test_predict_position_management_fields(self):
        ps = PositionSizingPredictor()
        result = ps.predict({
            "consensus_confidence": 0.7,
            "exit_plan": {"tp1_pct": 0.25, "tp2_pct": 0.25, "tp3_pct": 0.50},
        })
        pm = result["position_management"]
        assert "close_pct_at_tp1" in pm
        assert "close_pct_at_tp2" in pm
        assert "keep_open_tp3" in pm
        assert pm["never_hold_overnight"] is True

    def test_train_with_insufficient_data(self):
        ps = PositionSizingPredictor()
        import pandas as pd
        df = pd.DataFrame({"a": [1, 2, 3]})
        result = ps.train(df)
        assert result["status"] == "skipped"
        assert ps._is_trained is False

    def test_train_with_sufficient_data(self):
        ps = PositionSizingPredictor()
        import pandas as pd
        df = pd.DataFrame({"pnl_ticks": [1.0] * 60, "pnl_dollars": [10.0] * 60})
        result = ps.train(df)
        assert result["status"] == "trained"
        assert ps._is_trained is True
