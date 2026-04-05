"""
Unit tests for alpha.alpha_engine.
Tests alpha calculation, expected move computation, and edge detection.
"""

import pytest
import sys
from pathlib import Path

ML_ENGINE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ML_ENGINE))

from alpha.alpha_engine import (
    calculate_alpha_metrics,
    compute_expected_move,
    compute_trade_alpha,
    _empty_alpha,
)


class TestComputeExpectedMove:
    """Test expected move calculation."""

    def test_zero_atr(self):
        assert compute_expected_move(0.0, 5.0) == 0.0

    def test_negative_atr(self):
        assert compute_expected_move(-5.0, 5.0) == 0.0

    def test_zero_holding_minutes(self):
        assert compute_expected_move(20.0, 0.0) == 0.0

    def test_negative_holding_minutes(self):
        assert compute_expected_move(20.0, -5.0) == 0.0

    def test_expected_move_scaling(self):
        # 5-min vs 390-min daily → sqrt(5/390) ≈ 0.113
        em_5 = compute_expected_move(20.0, 5.0)
        em_1 = compute_expected_move(20.0, 1.0)
        # 1-min should be less than 5-min
        assert em_1 < em_5

    def test_expected_move_linear_in_atr(self):
        em_20 = compute_expected_move(20.0, 5.0)
        em_40 = compute_expected_move(40.0, 5.0)
        assert em_40 == pytest.approx(em_20 * 2, rel=1e-9)


class TestComputeTradeAlpha:
    """Test single trade alpha computation."""

    def test_long_win_trade_positive_alpha(self):
        result = compute_trade_alpha(
            entry_price=18500.0,
            exit_price=18510.0,
            atr=20.0,
            direction=1,
            holding_minutes=5.0,
        )
        assert result["edge_exists"] is True
        assert result["edge_direction"] == "LONG"
        assert result["actual_move_ticks"] == 10.0
        assert result["expected_move_ticks"] > 0

    def test_long_loss_trade_negative_alpha(self):
        result = compute_trade_alpha(
            entry_price=18500.0,
            exit_price=18495.0,
            atr=20.0,
            direction=1,
            holding_minutes=5.0,
        )
        assert result["edge_exists"] is False
        assert result["alpha_raw"] < 0

    def test_short_win_trade(self):
        result = compute_trade_alpha(
            entry_price=18500.0,
            exit_price=18490.0,
            atr=20.0,
            direction=-1,
            holding_minutes=5.0,
        )
        assert result["edge_direction"] == "SHORT"
        assert result["actual_move_ticks"] == 10.0

    def test_alpha_raw_calculation(self):
        result = compute_trade_alpha(
            entry_price=18500.0,
            exit_price=18520.0,
            atr=10.0,
            direction=1,
            holding_minutes=5.0,
        )
        expected_move = compute_expected_move(10.0, 5.0)
        assert result["alpha_raw"] == pytest.approx(result["actual_move_ticks"] - expected_move, rel=1e-6)


class TestCalculateAlphaMetrics:
    """Test full alpha analysis from trade log."""

    def test_empty_dataframe_returns_empty_alpha(self):
        import pandas as pd
        result = calculate_alpha_metrics(pd.DataFrame())
        assert result["mean_alpha"] == 0.0
        assert result["win_rate"] == 0.0
        assert result["total_trades"] == 0
        assert "note" in result

    def test_win_rate_calculation(self):
        import pandas as pd
        df = pd.DataFrame({
            "result": ["win", "win", "loss", "win"],
            "pnl_dollars": [10.0, 15.0, -5.0, 8.0],
            "pnl_ticks": [2.0, 3.0, -1.0, 1.6],
            "direction": [1, 1, 1, 1],
        })
        result = calculate_alpha_metrics(df)
        assert result["win_rate"] == 0.75  # 3 wins / 4 trades
        assert result["total_trades"] == 4

    def test_profit_factor_calculation(self):
        import pandas as pd
        df = pd.DataFrame({
            "result": ["win", "win", "loss"],
            "pnl_dollars": [20.0, 30.0, -10.0],
            "pnl_ticks": [2.0, 3.0, -1.0],
            "direction": [1, 1, 1],
        })
        result = calculate_alpha_metrics(df)
        assert result["profit_factor"] == pytest.approx(50.0 / 10.0)

    def test_directional_accuracy(self):
        import pandas as pd
        df = pd.DataFrame({
            "result": ["win", "win", "win"],
            "pnl_dollars": [10.0, 10.0, 10.0],
            "pnl_ticks": [1.0, 2.0, 3.0],
            "direction": [1, 1, 1],
        })
        result = calculate_alpha_metrics(df)
        assert result["directional_accuracy"] == 1.0
        assert result["directional_alpha"] == 0.5

    def test_expectancy_calculation(self):
        import pandas as pd
        df = pd.DataFrame({
            "result": ["win", "win", "loss", "loss"],
            "pnl_dollars": [20.0, 20.0, -10.0, -10.0],
            "pnl_ticks": [2.0, 2.0, -1.0, -1.0],
            "direction": [1, 1, 1, 1],
        })
        result = calculate_alpha_metrics(df)
        # Total P&L = 20+20-10-10 = 20; 4 trades → expectancy = 5
        assert result["expectancy"] == 5.0

    def test_avg_win_and_loss(self):
        import pandas as pd
        df = pd.DataFrame({
            "result": ["win", "win", "loss"],
            "pnl_dollars": [20.0, 30.0, -10.0],
            "pnl_ticks": [2.0, 3.0, -1.0],
            "direction": [1, 1, 1],
        })
        result = calculate_alpha_metrics(df)
        assert result["avg_win_dollars"] == 25.0
        assert result["avg_loss_dollars"] == 10.0

    def test_empty_alpha_matches_empty_dataframe(self):
        empty = _empty_alpha()
        import pandas as pd
        result = calculate_alpha_metrics(pd.DataFrame())
        assert result["mean_alpha"] == empty["mean_alpha"]
        assert result["win_rate"] == empty["win_rate"]

    def test_alpha_stability_positive(self):
        import pandas as pd
        # 60 positive alpha trades
        df = pd.DataFrame({
            "alpha_raw": [1.0] * 60,
            "result": ["win"] * 60,
            "pnl_dollars": [10.0] * 60,
            "pnl_ticks": [1.0] * 60,
            "direction": [1] * 60,
        })
        result = calculate_alpha_metrics(df)
        assert result["alpha_stability"] == 1.0

    def test_alpha_by_session_columns(self):
        import pandas as pd
        df = pd.DataFrame({
            "session_id": [1, 1, 1, 2, 2, 0],
            "alpha_raw": [1.0, 2.0, -1.0, 3.0, -2.0, 1.0],
            "result": ["win", "win", "loss", "win", "loss", "win"],
            "pnl_dollars": [10.0, 10.0, 10.0, 10.0, 10.0, 10.0],
            "pnl_ticks": [1.0] * 6,
            "direction": [1] * 6,
        })
        result = calculate_alpha_metrics(df)
        assert "alpha_by_session" in result
        assert "PRE-MARKET" in result["alpha_by_session"]
        assert "MAIN" in result["alpha_by_session"]
        assert "AFTER-HOURS" in result["alpha_by_session"]
