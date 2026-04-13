"""
Consensus Aggregator — combines all model votes into the final unified signal.
Applies majority vote + confidence weighting + SHAP explanations.
"""
from typing import Optional
import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
from inference.explainer import SHAPExplainer, explain_all_votes
from infrastructure.board_room_client import ensure_heartbeat_loop, report_error


class ConsensusAggregator:
    """
    Takes all model votes + per-model predictions and aggregates
    into the final unified signal for the BFF consensus endpoint.

    Output format matches the plan's BFF Consensus Output spec:
    - signal: LONG / SHORT / NEUTRAL
    - confidence: 0-1
    - votes: per-model breakdown with SHAP reasons
    - timing: enter now vs wait + candle close rule
    - model metadata
    """

    def __init__(self):
        ensure_heartbeat_loop(
            "ML.ConsensusAggregator",
            focus="Aggregating model votes into final consensus output.",
        )
        self.explainer = SHAPExplainer()

    def aggregate(
        self,
        votes: dict[str, dict],
        consensus: dict,
        model_metas: dict,
        feature_dict: dict,
        session_id: int = 1,
        math_engine_snapshot: dict | None = None,
    ) -> dict:
        """
        Build the full consensus signal output.

        Parameters
        ----------
        votes : {model_name: {signal, probability_long, confidence, ...}}
        consensus : {signal, confidence, long_score, short_score, ...}
        model_metas : {model_name: {version, metrics, feature_cols, ...}}
        feature_dict : flat feature dict for SHAP explanations
        session_id : current session (0=pre, 1=main, 2=post)
        math_engine_snapshot : live MathEngine values for additional context
        """
        # Filter out models with errors
        valid_votes = {k: v for k, v in votes.items() if "error" not in v}

        # SHAP explanations
        try:
            explanations = explain_all_votes(valid_votes, feature_dict, model_metas)
        except Exception as exc:
            report_error(
                "ML.ConsensusAggregator",
                f"SHAP explanation failed: {exc}",
                severity="MEDIUM",
            )
            explanations = {}

        # Build vote breakdown with reasons
        vote_breakdown = {}
        for name, vote in valid_votes.items():
            exp = explanations.get(name, {})
            top_factors = exp.get("top_factors", [])
            primary_reason = top_factors[0]["impact"] if top_factors else ""

            meta = model_metas.get(name, {})
            metrics = meta.get("metrics", {})

            vote_breakdown[name] = {
                "signal": vote.get("signal", "NEUTRAL"),
                "confidence": vote.get("confidence", 0.0),
                "probability_long": vote.get("probability_long", 0.5),
                "probability_short": vote.get("probability_short", 0.5),
                "roc_auc": metrics.get("cv_roc_auc_mean"),
                "primary_reason": primary_reason,
                "top_factors": top_factors[:3],
            }

        # Final signal
        final_signal = consensus.get("signal", "NEUTRAL")
        final_confidence = consensus.get("confidence", 0.0)

        # Timing recommendation (always: wait for candle close)
        timing = self._build_timing_recommendation(
            feature_dict, session_id, final_signal, final_confidence
        )

        # Session context
        session_info = self._session_context(session_id, math_engine_snapshot)

        output = {
            "signal": final_signal,
            "confidence": round(final_confidence, 4),

            # Consensus breakdown
            "long_score": consensus.get("long_score", 0),
            "short_score": consensus.get("short_score", 0),
            "score_margin": consensus.get("score_margin", 0),
            "votes_total": consensus.get("votes_total", 0),
            "votes_long": consensus.get("votes_long", 0),
            "votes_short": consensus.get("votes_short", 0),
            "votes_neutral": consensus.get("votes_neutral", 0),

            # Model votes
            "votes": vote_breakdown,

            # Timing
            "timing": timing,

            # Session
            "session": session_info,

            # Model metadata
            "models_loaded": list(valid_votes.keys()),
            "model_count": len(valid_votes),

            # Feature dict (truncated for response size)
            "feature_snapshot": {k: round(v, 4) for k, v in list(feature_dict.items())[:30]},

            # Timestamp
            "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        }

        return output

    def _build_timing_recommendation(
        self,
        feature_dict: dict,
        session_id: int,
        signal: str,
        confidence: float,
    ) -> dict:
        """
        Build timing recommendation.
        ALWAYS: wait for candle close before entry.
        Best windows by session from plan.
        """
        hour = feature_dict.get("hour_of_day", 12)
        session_pct = feature_dict.get("session_pct", 0.5)
        minutes_into = feature_dict.get("minutes_into_session", 60)

        # Best windows by session
        best_windows = {
            0: "04:30-05:30 ET",   # Pre-market
            1: "10:00-11:30 ET",   # Main
            2: "16:15-17:00 ET",   # Post-market
        }
        best_window = best_windows.get(session_id, "10:00-11:30 ET")

        # Check if in best window
        in_best_window = False
        if session_id == 1 and 10 <= hour < 11.5:
            in_best_window = True
        elif session_id == 0 and 4 <= hour < 5.5:
            in_best_window = True
        elif session_id == 2 and 16 <= hour < 17:
            in_best_window = True

        # Calculate minutes to best window
        minutes_to_best = 0
        if not in_best_window:
            if session_id == 1:
                minutes_to_best = max(0, (10 * 60) - minutes_into)
            else:
                minutes_to_best = 30

        enter_now = signal != "NEUTRAL" and confidence >= 0.55 and in_best_window

        return {
            "enter_now": enter_now,
            "candle_close_entry": True,       # ALWAYS wait for candle close
            "wait_for_candle_close": True,    # NEVER enter mid-candle
            "best_window": best_window,
            "in_best_window": in_best_window,
            "minutes_to_best_window": minutes_to_best,
            "if_not_entry_now_then": (
                f"Wait for {best_window} window or next valid signal"
                if not enter_now else
                "Valid entry signal detected — enter on candle close"
            ),
            "stale_after_minutes": 30,
            "reason": (
                "HIGH ALPHA WINDOW — best time historically for this session"
                if in_best_window else
                f"Outside best window. Best window: {best_window}"
            ),
        }

    def _session_context(
        self,
        session_id: int,
        math_engine_snapshot: dict | None,
    ) -> dict:
        """Build session context."""
        session_names = {0: "pre_market", 1: "main_trading", 2: "post_market"}
        session_labels = {0: "Pre-Market", 1: "Main Trading", 2: "Post-Market"}

        session_name = session_names.get(session_id, "main_trading")

        # AMD phase from snapshot
        amd_phase = "UNCLEAR"
        if math_engine_snapshot:
            amd_phase = math_engine_snapshot.get("amdPhase", "UNCLEAR")

        return {
            "id": session_id,
            "name": session_name,
            "label": session_labels.get(session_id, "Main"),
            "amd_phase": amd_phase,
            "trade_style": {
                0: "scalp / fade moves",
                1: "trend following / mean reversion",
                2: "fade extended moves only",
            }.get(session_id, ""),
        }
