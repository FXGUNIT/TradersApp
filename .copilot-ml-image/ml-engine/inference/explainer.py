"""
SHAP Explainer — generates human-readable reasons for each model vote.
Uses SHAP values to explain WHY each model voted the way it did.
"""
from typing import Optional
import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class SHAPExplainer:
    """
    Generates human-readable explanations for model predictions.
    Uses LightGBM's built-in feature importance as fallback when SHAP unavailable.
    """

    def __init__(self):
        self._explainers: dict[str, any] = {}

    def explain(
        self,
        model_name: str,
        model_pipeline,
        feature_dict: dict,
        feature_cols: list[str],
        top_n: int = 5,
    ) -> dict:
        """
        Generate explanation for a single model's prediction.

        Returns:
        {
            "model": model_name,
            "signal": "LONG",
            "confidence": 0.82,
            "top_factors": [
                {"feature": "amd_ACCUMULATION", "value": 1.0, "direction": "positive", "impact": "increases LONG probability"},
                {"feature": "vr_regime", "value": 0, "direction": "positive", "impact": "COMPRESSION regime → tighter stops"},
                ...
            ],
            "summary": "..."
        }
        """
        try:
            import shap
            has_shap = True
        except ImportError:
            has_shap = False

        # Get feature values
        row = np.array([[feature_dict.get(c, 0.0) for c in feature_cols]], dtype=float)
        feature_names = feature_cols

        explanation = {
            "model": model_name,
            "top_factors": [],
            "has_shap": has_shap,
        }

        if has_shap:
            explanation["top_factors"] = self._shap_explain(
                model_pipeline, row, feature_names, top_n
            )
        else:
            explanation["top_factors"] = self._importance_explain(
                model_pipeline, feature_names, feature_dict, top_n
            )

        explanation["summary"] = self._generate_summary(explanation)

        return explanation

    def _shap_explain(
        self,
        pipeline,
        row: np.ndarray,
        feature_names: list[str],
        top_n: int,
    ) -> list[dict]:
        """Use SHAP for explanation."""
        try:
            # Get the underlying model
            clf = pipeline.named_steps.get("clf", None)
            if clf is None:
                return self._importance_explain(pipeline, feature_names, {}, top_n)

            # Try to get tree explainer
            try:
                import shap
                model = clf.estimator if hasattr(clf, "estimator") else clf
                explainer = shap.TreeExplainer(model)
                shap_values = explainer.shap_values(row)

                # For binary: shap_values[1] is LONG class
                if isinstance(shap_values, list):
                    sv = shap_values[1][0]
                else:
                    sv = shap_values[0]

                # Sort by absolute importance
                idx = np.argsort(np.abs(sv))[::-1][:top_n]

                factors = []
                for i in idx:
                    val = row[0, i]
                    sv_val = sv[i]
                    direction = "positive" if sv_val > 0 else "negative"

                    factors.append({
                        "feature": feature_names[i],
                        "value": float(val),
                        "shap_value": float(sv_val),
                        "direction": direction,
                        "impact": self._interpret_feature(feature_names[i], float(val), sv_val),
                    })

                return factors

            except Exception:
                return self._importance_explain(pipeline, feature_names, {}, top_n)

        except Exception:
            return self._importance_explain(pipeline, feature_names, {}, top_n)

    def _importance_explain(
        self,
        pipeline,
        feature_names: list[str],
        feature_dict: dict,
        top_n: int,
    ) -> list[dict]:
        """Fallback: use feature importance + feature values."""
        factors = []

        # Try to get feature importances from LightGBM/XGBoost/RF
        clf = pipeline
        try:
            if hasattr(pipeline, "named_steps"):
                clf = pipeline.named_steps.get("clf", pipeline)
            if hasattr(clf, "estimator"):
                clf = clf.estimator
        except Exception:
            pass

        try:
            importances = getattr(clf, "feature_importances_", None)
            if importances is not None:
                idx = np.argsort(importances)[::-1][:top_n]
                for i in idx:
                    val = feature_dict.get(feature_names[i], 0.0)
                    direction = "positive" if val > 0.5 else "negative"
                    factors.append({
                        "feature": feature_names[i],
                        "value": float(val),
                        "importance": float(importances[i]),
                        "direction": direction,
                        "impact": self._interpret_feature(feature_names[i], float(val), 0.0),
                    })
        except Exception:
            pass

        return factors[:top_n]

    def _interpret_feature(
        self,
        feature: str,
        value: float,
        shap_val: float,
    ) -> str:
        """Generate human-readable interpretation of a feature's impact."""
        feature_lower = feature.lower()

        if feature == "amd_ACCUMULATION":
            return "ACCUMULATION phase detected — bullish institutional accumulation pattern"
        elif feature == "amd_DISTRIBUTION":
            return "DISTRIBUTION phase — bearish institutional distribution"
        elif feature == "amd_MANIPULATION":
            return "MANIPULATION phase — expect false breakouts, reduce size"
        elif feature == "amd_TRANSITION":
            return "TRANSITION phase — market changing character, wait for clarity"
        elif feature == "amd_UNCLEAR":
            return "AMD unclear — no clear market phase"

        elif "vr_regime" in feature_lower:
            if value == 0:
                return "COMPRESSION regime (VR < 0.85) — low volatility, expect expansion"
            elif value == 2:
                return "EXPANSION regime (VR > 1.15) — high volatility, wider stops needed"
            else:
                return "NORMAL regime — balanced volatility conditions"

        elif "session_pct" in feature_lower:
            pct = int(value * 100)
            return f"{pct}% of session elapsed — {'early, high alpha potential' if pct < 50 else 'late session, reduce size'}"

        elif "is_first_30min" in feature_lower:
            return "First 30 minutes of session — high volatility, best alpha window" if value else "Past first 30 minutes"

        elif "is_lunch_hour" in feature_lower:
            return "Lunch hour — low volume, expect choppy price action" if value else "Outside lunch hour"

        elif "win_rate_20" in feature_lower:
            wr = int(value * 100)
            return f"Rolling 20-trade win rate: {wr}% — {'strong momentum' if wr > 55 else 'below average' if wr < 45 else 'neutral'}"

        elif "adx" in feature_lower:
            return f"ADX {value:.0f} — {'strong trend' if value > 30 else 'weak/tranging market'}"

        elif "atr" in feature_lower:
            return f"ATR {value:.2f} — volatility context for stop sizing"

        elif "ci" in feature_lower:
            return f"Compression Index {value:.0f} — {'compressed, expect breakout' if value < 40 else 'expanded, range-bound'}"

        elif "vwap" in feature_lower:
            return f"VWAP {'above' if value > 0 else 'below'} reference"

        elif "hour_of_day" in feature_lower:
            h = int(value)
            if h < 10:
                return f"{h}:00 ET — morning setup window"
            elif h < 12:
                return f"{h}:00 ET — best alpha window (10:00-11:30)"
            elif h < 14:
                return f"{h}:00 ET — midday, lower alpha"
            elif h < 16:
                return f"{h}:00 ET — afternoon, fading activity"
            else:
                return f"{h}:00 ET — close of main session"

        elif "day_of_week" in feature_lower:
            days = ["Monday (high volatility)", "Tuesday", "Wednesday", "Thursday", "Friday (early close)"]
            idx = int(value) % 5
            return days[idx]

        elif "range_pct" in feature_lower:
            return f"Range {value:.2%} of price — {'wide range session' if value > 0.01 else 'tight range'}"

        elif "momentum_3bar" in feature_lower:
            return f"3-bar momentum {'positive' if value > 0 else 'negative'} — recent price action direction"

        elif "volume_ratio_5" in feature_lower:
            return f"Volume {value:.1f}x average — {'high volume spike' if value > 1.5 else 'low volume'}"

        elif "amd_win_rate" in feature_lower:
            return f"AMD phase win rate: {int(value * 100)}% historically"

        else:
            return f"{feature}: {value:.3f}"

    def _generate_summary(self, explanation: dict) -> str:
        """Generate a one-sentence summary of why the model voted."""
        factors = explanation.get("top_factors", [])

        if not factors:
            return "Insufficient data for explanation."

        top = factors[0]
        feat = top["feature"]

        if "amd" in feat.lower():
            return f"AMD phase is the primary driver — {top['impact']}"
        elif "vr_regime" in feat.lower():
            return f"Volatility regime is the primary driver — {top['impact']}"
        elif "win_rate" in feat.lower():
            return f"Historical win rate is the primary driver — {top['impact']}"
        elif "session" in feat.lower():
            return f"Session timing is the primary driver — {top['impact']}"
        else:
            return f"{feat} is the primary driver — {top['impact']}"


def explain_all_votes(votes: dict, feature_dict: dict, model_metas: dict) -> dict:
    """
    Generate SHAP explanations for all model votes.

    Parameters
    ----------
    votes : dict of model_name -> vote dict
    feature_dict : flat feature dict for the current state
    model_metas : dict of model_name -> meta dict (from model store)

    Returns
    dict of model_name -> explanation dict
    """
    explainer = SHAPExplainer()
    explanations = {}

    for model_name, vote in votes.items():
        meta = model_metas.get(model_name, {})
        feature_cols = meta.get("feature_cols", [])

        if not feature_cols:
            continue

        try:
            from training.model_store import ModelStore
            store = ModelStore()
            pipeline, _ = store.get_latest(model_name)

            exp = explainer.explain(
                model_name=model_name,
                model_pipeline=pipeline,
                feature_dict=feature_dict,
                feature_cols=feature_cols,
            )
            exp["vote"] = vote
            explanations[model_name] = exp
        except Exception:
            pass

    return explanations
