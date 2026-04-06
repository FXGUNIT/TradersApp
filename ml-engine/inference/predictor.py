"""
Inference Predictor — runs all trained models and returns their votes.
Loads models from model store and generates directional predictions.
"""
from typing import Optional
import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
from training.model_store import ModelStore
from features.feature_pipeline import engineer_features, get_feature_vector


class Predictor:
    """
    Loads all trained models from model store and runs inference.
    Returns per-model votes + consensus.
    """

    def __init__(self, store_dir: str | None = None):
        self.store = ModelStore(store_dir)
        self._models: dict[str, tuple] = {}  # name -> (pipeline, meta)
        self._loaded = False

    def load_all_models(self) -> dict[str, dict]:
        """
        Load all models from the store.
        Returns dict of model_name -> {pipeline, meta, feature_cols}
        """
        self._models = {}
        model_names = self.store.list_all_models()

        for name in model_names:
            try:
                pipeline, meta = self.store.get_latest(name)
                self._models[name] = {
                    "pipeline": pipeline,
                    "meta": meta,
                    "feature_cols": meta.get("feature_cols", []),
                }
            except FileNotFoundError:
                pass

        self._loaded = len(self._models) > 0
        return {
            name: {
                "version": meta.get("version"),
                "trained_at": meta.get("saved_at"),
                "metrics": meta.get("metrics", {}),
            }
            for name, (_, meta) in self._models.items()
        }

    def predict(
        self,
        candles_df: pd.DataFrame,
        trade_log_df: pd.DataFrame | None = None,
        math_engine_snapshot: dict | None = None,
        key_levels: dict | None = None,
    ) -> dict:
        """
        Run all loaded models on the current market state.
        Returns per-model predictions + consensus.
        """
        if not self._loaded:
            self.load_all_models()

        if not self._models:
            return self._empty_response("No trained models available")

        # Engineer features for current state
        feature_df = engineer_features(
            candles_df=candles_df,
            trade_log_df=trade_log_df,
            session_agg_df=None,
            math_engine_snapshot=math_engine_snapshot,
            key_levels=key_levels,
        )

        if feature_df.empty:
            return self._empty_response("No features generated from input data")

        votes = {}
        confidence_scores = {}

        for name, model_data in self._models.items():
            pipeline = model_data["pipeline"]
            feature_cols = model_data["feature_cols"]

            # Build feature vector
            X = get_feature_vector(feature_df)
            X = X.fillna(0.0).replace([np.inf, -np.inf], 0.0)

            # Select only columns the model was trained on
            available = [c for c in feature_cols if c in X.columns]
            if not available:
                continue
            X = X[available]

            try:
                proba = pipeline.predict_proba(X)

                if proba.shape[1] == 2:
                    p_long = proba[0, 1]
                else:
                    p_long = 0.5

                confidence = max(p_long, 1 - p_long)

                if confidence < 0.52:
                    signal = "NEUTRAL"
                elif p_long >= 0.5:
                    signal = "LONG"
                else:
                    signal = "SHORT"

                votes[name] = {
                    "signal": signal,
                    "probability_long": round(float(p_long), 4),
                    "probability_short": round(float(1 - p_long), 4),
                    "confidence": round(float(confidence), 4),
                }
                confidence_scores[name] = float(confidence)

            except Exception as e:
                votes[name] = {
                    "signal": "NEUTRAL",
                    "probability_long": 0.5,
                    "probability_short": 0.5,
                    "confidence": 0.0,
                    "error": str(e),
                }

        # Consensus
        consensus = self._compute_consensus(votes, confidence_scores)

        return {
            "votes": votes,
            "consensus": consensus,
            "models_loaded": list(self._models.keys()),
            "feature_count": len(feature_df.columns),
        }

    def predict_from_features(
        self,
        feature_dict: dict,
        symbol: str = "MNQ",
    ) -> dict:
        """
        Predict from a flat feature dict (single sample).
        Builds a single-row DataFrame matching trained model feature columns.
        """
        if not self._loaded:
            self.load_all_models()

        if not self._models:
            return self._empty_response("No trained models available")

        # Use first model's feature columns as reference
        first_model = next(iter(self._models.values()))
        feature_cols = first_model["feature_cols"]

        # Build single-row DataFrame
        row = {k: feature_dict.get(k, 0.0) for k in feature_cols}
        X = pd.DataFrame([row])

        votes = {}
        confidence_scores = {}

        for name, model_data in self._models.items():
            pipeline = model_data["pipeline"]
            model_cols = model_data["feature_cols"]
            available = [c for c in model_cols if c in X.columns]
            if not available:
                continue
            X_use = X[available]

            try:
                proba = pipeline.predict_proba(X_use)
                if proba.shape[1] == 2:
                    p_long = proba[0, 1]
                else:
                    p_long = 0.5

                confidence = max(p_long, 1 - p_long)

                if confidence < 0.52:
                    signal = "NEUTRAL"
                elif p_long >= 0.5:
                    signal = "LONG"
                else:
                    signal = "SHORT"

                votes[name] = {
                    "signal": signal,
                    "probability_long": round(float(p_long), 4),
                    "probability_short": round(float(1 - p_long), 4),
                    "confidence": round(float(confidence), 4),
                }
                confidence_scores[name] = float(confidence)

            except Exception as e:
                votes[name] = {
                    "signal": "NEUTRAL",
                    "probability_long": 0.5,
                    "probability_short": 0.5,
                    "confidence": 0.0,
                    "error": str(e),
                }

        consensus = self._compute_consensus(votes, confidence_scores)
        return {"votes": votes, "consensus": consensus, "models_loaded": list(self._models.keys())}

    def _compute_consensus(self, votes: dict, confidence_scores: dict) -> dict:
        """
        Compute majority-vote consensus across all models.
        NEUTRAL votes count as 0.5 for each direction.
        """
        if not votes:
            return {"signal": "NEUTRAL", "confidence": 0.0, "votes_total": 0, "votes_long": 0, "votes_short": 0}

        long_score = 0.0
        short_score = 0.0
        neutral_count = 0
        long_count = 0
        short_count = 0

        for name, vote in votes.items():
            conf = confidence_scores.get(name, 1.0)
            signal = vote.get("signal", "NEUTRAL")

            if signal == "LONG":
                long_score += conf
                long_count += 1
            elif signal == "SHORT":
                short_score += conf
                short_count += 1
            else:
                # NEUTRAL: split evenly
                long_score += 0.5 * conf
                short_score += 0.5 * conf
                neutral_count += 1

        total_models = len(votes)
        total_score = long_score + short_score

        if total_score == 0:
            return {
                "signal": "NEUTRAL",
                "confidence": 0.0,
                "votes_total": total_models,
                "votes_long": long_count,
                "votes_short": short_count,
                "votes_neutral": neutral_count,
            }

        # Final confidence based on score difference
        margin = abs(long_score - short_score) / total_score
        confidence = 0.5 + margin * 0.5  # Range: 0.5 to 1.0

        if long_score > short_score:
            signal = "LONG"
        elif short_score > long_score:
            signal = "SHORT"
        else:
            signal = "NEUTRAL"

        return {
            "signal": signal,
            "confidence": round(confidence, 4),
            "long_score": round(long_score, 4),
            "short_score": round(short_score, 4),
            "votes_total": total_models,
            "votes_long": long_count,
            "votes_short": short_count,
            "votes_neutral": neutral_count,
            "score_margin": round(abs(long_score - short_score), 4),
        }

    def _empty_response(self, reason: str) -> dict:
        return {
            "votes": {},
            "consensus": {"signal": "NEUTRAL", "confidence": 0.0, "reason": reason},
            "models_loaded": [],
        }

    @property
    def is_ready(self) -> bool:
        return self._loaded and len(self._models) > 0

    def get_model_status(self) -> dict:
        """Get status of all loaded models."""
        if not self._loaded:
            self.load_all_models()
        return {
            name: {
                "version": info["meta"].get("version"),
                "trained_at": info["meta"].get("saved_at"),
                "roc_auc": info["meta"].get("metrics", {}).get("cv_roc_auc_mean"),
                "accuracy": info["meta"].get("metrics", {}).get("cv_accuracy_mean"),
                "feature_count": len(info["meta"].get("feature_cols", [])),
            }
            for name, info in self._models.items()
        }
