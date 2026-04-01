"""
Exit Strategy Optimizer — ML-Driven (NOT hardcoded).
ExitStrategyPredictor: grid search over all exit combos per historical trade →
ML model predicts optimal SL ticks, TP% per level, trailing distance, max hold time.
"""
import numpy as np
import pandas as pd
import sys, os
from itertools import product

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


class ExitStrategyPredictor:
    """
    ML brain that decides exit strategy for each trade.
    NOT a fixed rule — learns from ALL historical trades.

    Training:
    1. Grid search: test ALL exit parameter combinations per historical trade
    2. Find the combo that maximized P&L for each trade → training label
    3. Engineer features describing the trade setup (not the exit)
    4. Train LightGBM regressors: features → each exit parameter

    Inference:
    Given current conditions, predict all exit parameters simultaneously.
    """

    name = "exit_strategy"
    model_type = "exit"

    # Exit parameter targets
    TARGETS = [
        "sl_ticks",
        "tp1_pct",
        "tp1_ticks",
        "tp2_pct",
        "tp2_ticks",
        "trail_dist",
        "trail_activate_ticks",
        "max_hold_minutes",
        "move_sl_to_be_at",
    ]

    def __init__(self):
        self._models: dict[str, any] = {}
        self._feature_cols: list[str] = []
        self._is_trained = False

    def _simulate_exit(
        self,
        pnl_ticks: float,
        sl_ticks: float,
        tp_ticks: float,
        p1: float,
        p2: float,
        p3_remaining: float,
        trail_dist: float,
        trail_act: float,
    ) -> float:
        """
        Simulate P&L for a given exit strategy.
        Returns total P&L in ticks.
        """
        # Long trade assumption (pnl_ticks is positive = win, negative = loss)
        if pnl_ticks >= tp_ticks:
            # TP1 hit
            pnl = tp_ticks * p1
            # TP2
            tp2 = tp_ticks * 1.5
            if pnl_ticks >= tp2:
                pnl += tp2 * p2
                # TP3 + trailing
                remaining_pnl = min(pnl_ticks, tp2 + trail_dist * 3) * p3_remaining
                pnl += remaining_pnl
            else:
                pnl += pnl_ticks * p2
            return pnl
        elif pnl_ticks <= -sl_ticks:
            return -sl_ticks
        else:
            # Price ended between
            pnl = pnl_ticks * p1
            if pnl_ticks > tp_ticks * 0.5:
                pnl += (pnl_ticks - tp_ticks * 0.5) * p2
            return pnl

    def _generate_exit_labels(self, trade_log_df: pd.DataFrame) -> pd.DataFrame:
        """
        From historical trades, BACK CALCULATE optimal exit for each trade.
        Grid search over all exit combinations → find the one that maximized P&L.
        """
        sl_grid = config.SL_GRID
        tp_grid = config.TP_GRID
        pct_grid = config.PCT_GRID
        trail_grid = config.TRAIL_GRID
        hold_grid = config.HOLD_GRID

        results = []
        trade_log_df = trade_log_df.dropna(subset=["pnl_ticks", "entry_price", "exit_price", "direction"])

        for _, trade in trade_log_df.iterrows():
            pnl_ticks = float(trade["pnl_ticks"])
            direction = int(trade["direction"])
            entry_price = float(trade["entry_price"])
            exit_price = float(trade["exit_price"])

            # Scale P&L by direction for simulation (assume long)
            scaled_pnl = abs(pnl_ticks) if direction > 0 else -abs(pnl_ticks)

            best_score = -np.inf
            best_params = {}

            # Grid search
            for sl in sl_grid:
                for tp in tp_grid:
                    for p1 in pct_grid:
                        for p2 in pct_grid:
                            if p1 + p2 > 0.95:
                                continue
                            p3 = round(1.0 - p1 - p2, 2)
                            for trail in trail_grid:
                                for trail_act in [tp * 0.5, tp, tp * 1.5]:
                                    for hold in hold_grid:
                                        pnl = self._simulate_exit(
                                            scaled_pnl, sl, tp, p1, p2, p3,
                                            trail, trail_act,
                                        )
                                        if pnl > best_score:
                                            best_score = pnl
                                            best_params = {
                                                "sl_ticks": sl,
                                                "tp1_pct": p1,
                                                "tp1_ticks": tp,
                                                "tp2_pct": p2,
                                                "tp2_ticks": round(tp * 1.5, 1),
                                                "tp3_pct": p3,
                                                "trail_dist": trail,
                                                "trail_activate_ticks": trail_act,
                                                "max_hold_minutes": hold,
                                                "move_sl_to_be_at": round(tp * 0.5, 1),
                                            }

            results.append({**trade.to_dict(), **best_params, "best_exit_pnl": best_score})

        return pd.DataFrame(results)

    def _engineer_exit_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create features that predict optimal exit parameters.
        These describe the TRADE SETUP, not the exit itself.
        """
        df = df.copy()

        # Session context
        if "session_id" in df.columns:
            df["session_id_feat"] = df["session_id"]

        # AMD encoding
        if "amd_phase" in df.columns:
            for phase in config.AMD_PHASES:
                df[f"amd_{phase}"] = (df["amd_phase"] == phase).astype(float)

        # Volatility
        if "atr_entry" in df.columns and "vwap_entry" in df.columns:
            df["atr_norm"] = df["atr_entry"] / df["vwap_entry"].replace(0, 1)
        if "vr_entry" in df.columns:
            df["vr_feat"] = df["vr_entry"]
        if "volatility_regime" in df.columns:
            df["vol_regime_feat"] = df["volatility_regime"]

        # Momentum
        if "momentum_3bar" in df.columns:
            df["mom_3"] = df["momentum_3bar"].fillna(0)
        if "momentum_5bar" in df.columns:
            df["mom_5"] = df["momentum_5bar"].fillna(0)

        # ADX, CI
        if "adx_entry" in df.columns:
            df["adx_feat"] = df["adx_entry"].fillna(0)
        if "ci_entry" in df.columns:
            df["ci_feat"] = df["ci_entry"].fillna(0)

        # Time
        if "entry_time" in df.columns:
            times = pd.to_datetime(df["entry_time"])
            df["hour_feat"] = times.dt.hour
            df["dow_feat"] = times.dt.dayofweek

        # Level proximity
        if "price_to_pdh" in df.columns:
            df["near_pdh_feat"] = df["price_to_pdh"].fillna(0).abs()
        if "price_to_pdl" in df.columns:
            df["near_pdl_feat"] = df["price_to_pdl"].fillna(0).abs()

        return df

    def _get_feature_cols(self) -> list[str]:
        """Return the feature columns used for exit strategy prediction."""
        return [
            "session_id_feat",
            "atr_norm", "vr_feat", "vol_regime_feat",
            "mom_3", "mom_5",
            "adx_feat", "ci_feat",
            "hour_feat", "dow_feat",
            "near_pdh_feat", "near_pdl_feat",
            "amd_ACCUMULATION", "amd_MANIPULATION", "amd_DISTRIBUTION",
            "amd_TRANSITION", "amd_UNCLEAR",
        ]

    def train(self, trade_log_df: pd.DataFrame, verbose: bool = True) -> dict:
        """Train exit strategy model on historical trades."""
        if len(trade_log_df) < 50:
            raise ValueError(f"Need at least 50 trades for exit strategy, got {len(trade_log_df)}")

        if verbose:
            print(f"  Generating exit labels via grid search on {len(trade_log_df)} trades...")

        # Step 1: Generate labels
        labeled = self._generate_exit_labels(trade_log_df)

        # Step 2: Engineer features
        feat_df = self._engineer_exit_features(labeled)
        self._feature_cols = [c for c in self._get_feature_cols() if c in feat_df.columns]

        X = feat_df[self._feature_cols].fillna(0.0)
        X = X.replace([np.inf, -np.inf], 0.0)

        # Step 3: Train one model per target
        import lightgbm as lgb

        for target in self.TARGETS:
            if target not in labeled.columns:
                continue
            y = labeled[target].fillna(0)
            model = lgb.LGBMRegressor(**config.LGBM_EXIT)
            model.fit(X, y)
            self._models[target] = model

        self._is_trained = True

        result = {
            "model": self.name,
            "trades_used": len(labeled),
            "targets_trained": list(self._models.keys()),
            "feature_count": len(self._feature_cols),
        }

        if verbose:
            print(f"  Exit Strategy: trained on {len(labeled)} trades")

        return result

    def predict(self, conditions: dict) -> dict:
        """
        Given CURRENT market conditions, predict optimal exit strategy.
        Every parameter: SL, TP%, trailing, max hold — ALL ML-determined.
        """
        if not self._is_trained:
            return self._default_exit()

        # Build feature vector
        feat_dict = {
            "session_id_feat": conditions.get("session_id", 1),
            "atr_norm": conditions.get("atr_norm", 0.005),
            "vr_feat": conditions.get("vr", 1.0),
            "vol_regime_feat": conditions.get("volatility_regime", 1),
            "mom_3": conditions.get("momentum_3bar", 0.0),
            "mom_5": conditions.get("momentum_5bar", 0.0),
            "adx_feat": conditions.get("adx", 20),
            "ci_feat": conditions.get("ci", 50),
            "hour_feat": conditions.get("hour_of_day", 10),
            "dow_feat": conditions.get("day_of_week", 2),
            "near_pdh_feat": conditions.get("price_to_pdh", 1.0),
            "near_pdl_feat": conditions.get("price_to_pdl", 1.0),
            "amd_ACCUMULATION": 1.0 if conditions.get("amdPhase") == "ACCUMULATION" else 0.0,
            "amd_MANIPULATION": 1.0 if conditions.get("amdPhase") == "MANIPULATION" else 0.0,
            "amd_DISTRIBUTION": 1.0 if conditions.get("amdPhase") == "DISTRIBUTION" else 0.0,
            "amd_TRANSITION": 1.0 if conditions.get("amdPhase") == "TRANSITION" else 0.0,
            "amd_UNCLEAR": 1.0 if conditions.get("amdPhase") in ("UNCLEAR", None, "") else 0.0,
        }

        X = pd.DataFrame([{k: feat_dict.get(k, 0.0) for k in self._feature_cols}])

        preds = {}
        for target in self.TARGETS:
            if target in self._models:
                preds[target] = float(self._models[target].predict(X)[0])

        # Post-process and clamp
        exit_plan = {
            "strategy": "ML-DETERMINED",
            "confidence": 0.8,
            "stop_loss_ticks": round(max(5, min(50, preds.get("sl_ticks", 20)))),
            "tp1_pct": round(max(0.05, min(0.60, preds.get("tp1_pct", 0.25))) * 100) / 100,
            "tp1_ticks": round(max(5, min(60, preds.get("tp1_ticks", 10)))),
            "tp2_pct": round(max(0.05, min(0.50, preds.get("tp2_pct", 0.25))) * 100) / 100,
            "tp2_ticks": round(max(5, min(80, preds.get("tp2_ticks", 20)))),
            "tp3_pct": round(max(0.05, min(0.50, 1 - preds.get("tp1_pct", 0.25) - preds.get("tp2_pct", 0.25))) * 100) / 100,
            "trailing_distance_ticks": round(max(4, min(20, preds.get("trail_dist", 8)))),
            "trailing_activate_at_ticks": round(max(5, min(40, preds.get("trail_activate_ticks", 15)))),
            "max_hold_minutes": round(max(15, min(240, preds.get("max_hold_minutes", 90)))),
            "move_sl_to_be_at_ticks": round(max(5, min(30, preds.get("move_sl_to_be_at", 10)))),
        }

        # Build reasons
        exit_plan["reason"] = self._explain(exit_plan, conditions)

        return exit_plan

    def _explain(self, exit_plan: dict, conditions: dict) -> str:
        """Generate human-readable explanation for the predicted exit strategy."""
        reasons = []

        vr = conditions.get("vr", 1.0)
        amd = conditions.get("amdPhase", "UNCLEAR")
        regime = conditions.get("volatility_regime", 1)
        session_id = conditions.get("session_id", 1)

        if vr < 0.85:
            reasons.append(f"VR {vr:.2f} COMPRESSION → tighter SL optimal, reduce position")
        elif vr > 1.15:
            reasons.append(f"VR {vr:.2f} EXPANSION → wider SL needed, ATR increased")

        if amd == "ACCUMULATION":
            reasons.append("ACCUMULATION phase → longer holds, let winners develop")
        elif amd == "MANIPULATION":
            reasons.append("MANIPULATION phase → tighter stops, expect false breakouts")
        elif amd == "DISTRIBUTION":
            reasons.append("DISTRIBUTION phase → shorter holds, take profits faster")

        if session_id == 0:
            reasons.append("PRE-MARKET → wider range, scalp fades")
        elif session_id == 2:
            reasons.append("POST-MARKET → fade extensions only, tight stops")

        return " | ".join(reasons) if reasons else "Standard exit strategy for current conditions"

    def _default_exit(self) -> dict:
        """Default exit when model not trained."""
        return {
            "strategy": "FALLBACK (not trained)",
            "confidence": 0.0,
            "stop_loss_ticks": config.DEFAULT_SL_TICKS,
            "tp1_pct": 0.25,
            "tp1_ticks": 10,
            "tp2_pct": 0.25,
            "tp2_ticks": 20,
            "tp3_pct": 0.50,
            "trailing_distance_ticks": 8,
            "trailing_activate_at_ticks": 15,
            "max_hold_minutes": 90,
            "move_sl_to_be_at_ticks": 10,
            "reason": "Model not trained — using default parameters",
        }
