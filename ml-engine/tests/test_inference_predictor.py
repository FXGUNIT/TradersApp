"""
Unit tests for inference.predictor.
Tests Predictor class: model loading, consensus computation, fallback behavior.
"""

import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np


class TestPredictorConsensus:
    """Test consensus computation logic."""

    def test_consensus_all_long(self):
        """All LONG votes → LONG signal."""
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        votes = {
            "model_a": {"signal": "LONG", "probability_long": 0.7},
            "model_b": {"signal": "LONG", "probability_long": 0.65},
        }
        conf = {"model_a": 0.2, "model_b": 0.35}
        result = p._compute_consensus(votes, conf)
        assert result["signal"] == "LONG"
        assert result["votes_long"] == 2
        assert result["votes_total"] == 2

    def test_consensus_all_short(self):
        """All SHORT votes → SHORT signal."""
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        votes = {
            "model_a": {"signal": "SHORT", "probability_long": 0.3},
            "model_b": {"signal": "SHORT", "probability_long": 0.35},
        }
        conf = {"model_a": 0.2, "model_b": 0.35}
        result = p._compute_consensus(votes, conf)
        assert result["signal"] == "SHORT"
        assert result["votes_short"] == 2

    def test_consensus_split_long_short(self):
        """Mixed votes → whichever has higher score wins."""
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        votes = {
            "model_a": {"signal": "LONG", "probability_long": 0.6},
            "model_b": {"signal": "SHORT", "probability_long": 0.4},
        }
        # model_a long with 0.1 conf, model_b short with 0.1 conf
        conf = {"model_a": 0.1, "model_b": 0.1}
        result = p._compute_consensus(votes, conf)
        # long_score = 0.1, short_score = 0.1 → tie → NEUTRAL
        assert result["signal"] == "NEUTRAL"

    def test_consensus_with_neutral_split(self):
        """NEUTRAL votes split evenly."""
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        votes = {
            "model_a": {"signal": "LONG", "probability_long": 0.7},
            "model_b": {"signal": "NEUTRAL", "probability_long": 0.5},
        }
        conf = {"model_a": 0.2, "model_b": 0.0}
        result = p._compute_consensus(votes, conf)
        assert result["votes_neutral"] == 1
        assert result["votes_long"] == 1

    def test_consensus_empty_votes(self):
        """No votes → NEUTRAL."""
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        result = p._compute_consensus({}, {})
        assert result["signal"] == "NEUTRAL"
        assert result["confidence"] == 0.0

    def test_consensus_confidence_range(self):
        """Confidence should be between 0.5 and 1.0."""
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        votes = {"model_a": {"signal": "LONG", "probability_long": 0.6}}
        conf = {"model_a": 0.4}
        result = p._compute_consensus(votes, conf)
        assert 0.5 <= result["confidence"] <= 1.0

    def test_consensus_score_margin(self):
        """Score margin is difference between long and short."""
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        votes = {
            "model_a": {"signal": "LONG", "probability_long": 0.9},
            "model_b": {"signal": "SHORT", "probability_long": 0.3},
        }
        conf = {"model_a": 0.4, "model_b": 0.1}
        result = p._compute_consensus(votes, conf)
        assert "score_margin" in result
        assert result["score_margin"] == pytest.approx(abs(result["long_score"] - result["short_score"]), rel=1e-9)


class TestPredictorEmptyResponse:
    """Test fallback behavior when no models are available."""

    def test_empty_response_shape(self):
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        result = p._empty_response("No models loaded")
        assert "votes" in result
        assert "consensus" in result
        assert result["consensus"]["signal"] == "NEUTRAL"
        assert result["consensus"]["confidence"] == 0.0
        assert "reason" in result["consensus"]
        assert result["models_loaded"] == []


class TestPredictorModelStatus:
    """Test model status reporting."""

    def test_is_ready_false_initially(self):
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        p._loaded = False
        p._models = {}
        assert p.is_ready is False

    def test_is_ready_true_when_models_loaded(self):
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        p._loaded = True
        p._models = {"model_a": {"pipeline": MagicMock(), "meta": {}}}
        assert p.is_ready is True

    def test_get_model_status_shape(self):
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        p._loaded = True
        p._models = {
            "direction": {
                "pipeline": MagicMock(),
                "meta": {
                    "version": "v1",
                    "saved_at": "2026-01-01",
                    "feature_cols": ["a", "b"],
                    "metrics": {"cv_roc_auc_mean": 0.75, "cv_accuracy_mean": 0.68},
                },
            },
        }
        status = p.get_model_status()
        assert "direction" in status
        assert status["direction"]["version"] == "v1"
        assert status["direction"]["feature_count"] == 2


class TestPredictorPredictFromFeatures:
    """Test predict_from_features with mocked models."""

    def test_predict_from_features_empty_models(self):
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        p._loaded = True
        p._models = {}

        result = p.predict_from_features({"feature_a": 1.0})
        assert result["consensus"]["signal"] == "NEUTRAL"

    def test_predict_from_features_no_loaded_models(self):
        from inference.predictor import Predictor
        p = Predictor.__new__(Predictor)
        p._loaded = False
        p._models = {}

        # Mock store
        p.store = MagicMock()
        p.store.list_all_models.return_value = []

        result = p.predict_from_features({"feature_a": 1.0})
        assert result["consensus"]["signal"] == "NEUTRAL"
