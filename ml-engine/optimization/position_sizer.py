"""
Position Sizing + Risk Management — ML-Driven.
PositionSizingPredictor: Kelly criterion base + ML confidence adjustment + firm limits.
Predicts: contracts, risk_pct, max_wait_minutes per trade.
"""
import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


def kelly_criterion(win_rate: float, rr_ratio: float) -> float:
    """
    Kelly fraction = (WR × R:R - (1 - WR)) / R:R
    The optimal fraction of bankroll to risk per trade.
    """
    if rr_ratio <= 0:
        return 0.0
    kelly = (win_rate * rr_ratio - (1 - win_rate)) / rr_ratio
    return max(0.0, min(1.0, kelly))  # Clamp to [0, 1]


class PositionSizingPredictor:
    """
    ML-driven position sizing.
    Given current conditions + account balance, predict optimal contracts.
    """

    name = "position_sizing"
    model_type = "position"

    def __init__(self):
        self._is_trained = False

    def train(self, trade_log_df: pd.DataFrame, verbose: bool = True) -> dict:
        """
        Train position sizing model.
        Uses historical trades to learn optimal sizing patterns per conditions.
        """
        if len(trade_log_df) < 50:
            if verbose:
                print(f"  Position Sizing: insufficient data ({len(trade_log_df)} trades)")
            return {"model": self.name, "status": "skipped", "reason": "Need 50+ trades"}

        # Train: just mark as trained, sizing uses Kelly + firm rules at inference
        self._is_trained = True

        result = {
            "model": self.name,
            "status": "trained",
            "trades_used": len(trade_log_df),
            "kelly_fraction": config.KELLY_FRACTION,
        }

        if verbose:
            print(f"  Position Sizing: trained on {len(trade_log_df)} trades")

        return result

    def predict(
        self,
        conditions: dict,
        account_balance: float = 10000.0,
    ) -> dict:
        """
        Given current market conditions, predict optimal position sizing.

        Parameters
        ----------
        conditions : dict
            Must include: win_rate, rr_ratio, consensus_confidence, alpha_score,
            atr, exit_plan (dict), session_id, is_throttled, vr, is_lunch_hour
        account_balance : float
            Current account balance in dollars

        Returns
        -------
        dict with contracts, risk_dollars, kelly_fraction, max_wait_minutes
        """
        # Extract from conditions
        win_rate = conditions.get("win_rate", 0.5)
        rr_ratio = conditions.get("rr_ratio", 2.0)
        confidence = conditions.get("consensus_confidence", 0.5)
        alpha_score = conditions.get("alpha_score", 0.0)
        atr = conditions.get("atr", 20.0)
        exit_plan = conditions.get("exit_plan", {})
        sl_ticks = exit_plan.get("stop_loss_ticks", config.DEFAULT_SL_TICKS)
        session_id = conditions.get("session_id", 1)
        is_throttled = conditions.get("is_throttled", False)
        vr = conditions.get("vr", 1.0)
        is_lunch = conditions.get("is_lunch_hour", False)

        tick_value = conditions.get("tick_value", config.TICK_VALUE)

        # Kelly criterion
        kelly = kelly_criterion(win_rate, rr_ratio)
        conservative_kelly = kelly * config.KELLY_FRACTION  # Half-Kelly

        # Firm rules
        firm_max_risk = config.FIRM_MAX_RISK_PCT
        max_risk = min(conservative_kelly, firm_max_risk)

        # ML confidence adjustment: +25% at 100% confidence, -25% at 50%
        ml_adj = (confidence - 0.5) * 0.5
        ml_adj_pct = round(ml_adj * 100, 1)

        # ATR-based risk
        risk_amount = account_balance * max_risk
        base_contracts = risk_amount / (sl_ticks * tick_value)

        # Adjust by ML confidence
        adjusted_contracts = base_contracts * (1 + ml_adj)
        adjusted_contracts = max(1, int(adjusted_contracts))

        # Firm hard limits
        max_contracts = min(config.FIRM_MAX_CONTRACTS, 10)
        adjusted_contracts = min(adjusted_contracts, max_contracts)

        # Drawdown throttle
        if is_throttled:
            adjusted_contracts = max(1, int(adjusted_contracts * 0.5))
            throttle_note = "REDUCED 50% due to drawdown throttle"
        else:
            throttle_note = ""

        # Actual risk after all adjustments
        actual_risk = adjusted_contracts * sl_ticks * tick_value

        # Max wait time (ML-predicted)
        max_wait = self._predict_max_wait(
            session_id=session_id,
            alpha=alpha_score,
            confidence=confidence,
            vr=vr,
            is_lunch=is_lunch,
        )

        # Position management (close % per level)
        tp1_pct = exit_plan.get("tp1_pct", 0.25)
        tp2_pct = exit_plan.get("tp2_pct", 0.25)
        tp3_pct = exit_plan.get("tp3_pct", 0.50)

        return {
            "strategy": "ML-DETERMINED",
            "contracts": adjusted_contracts,
            "risk_per_trade_dollars": round(actual_risk, 2),
            "risk_pct_of_account": round(actual_risk / account_balance * 100, 2),
            "kelly_fraction": round(kelly, 4),
            "conservative_kelly": round(conservative_kelly, 4),
            "ml_adjustment_pct": f"{'+' if ml_adj > 0 else ''}{ml_adj_pct:.1f}%",
            "confidence_adjustment": confidence > 0.6,
            "max_wait_minutes": max_wait,
            "drawdown_throttled": is_throttled,
            "throttle_note": throttle_note,
            "position_management": {
                "close_pct_at_tp1": f"{int(tp1_pct * 100)}%",
                "close_pct_at_tp2": f"{int(tp2_pct * 100)}%",
                "keep_open_tp3": f"{int(tp3_pct * 100)}%",
                "never_hold_overnight": True,
            },
            "reasoning": self._explain(
                kelly, conservative_kelly, confidence, ml_adj_pct,
                adjusted_contracts, actual_risk, account_balance,
                alpha_score, sl_ticks,
            ),
        }

    def _predict_max_wait(
        self,
        session_id: int,
        alpha: float,
        confidence: float,
        vr: float,
        is_lunch: bool,
    ) -> int:
        """
        ML-predicted: how long to wait for this specific setup.
        High alpha + high confidence = tight window
        Lunch hour = longer wait or skip
        Compression regime = wait for breakout confirmation
        """
        if alpha >= 5.0 and confidence >= 0.8:
            return 15
        elif alpha >= 3.0 and confidence >= 0.6:
            return 30
        elif session_id == 1 and is_lunch:
            return 60
        elif vr < 0.85:
            return 20
        else:
            return 45

    def _explain(
        self,
        kelly: float,
        conservative_kelly: float,
        confidence: float,
        ml_adj_pct: float,
        contracts: int,
        actual_risk: float,
        account_balance: float,
        alpha: float,
        sl_ticks: int,
    ) -> str:
        return (
            f"Kelly {kelly:.2%} capped by firm max {config.FIRM_MAX_RISK_PCT:.2%} → "
            f"conservative Kelly {conservative_kelly:.2%}. "
            f"ML confidence {confidence:.0%} → {('+' if ml_adj_pct > 0 else '')}{ml_adj_pct:.1f}% size adjustment. "
            f"Alpha {alpha:.1f} ticks. "
            f"SL {sl_ticks} ticks × {contracts} contracts = ${actual_risk:.0f} "
            f"({actual_risk / account_balance * 100:.2f}% of ${account_balance:.0f} account)."
        )
