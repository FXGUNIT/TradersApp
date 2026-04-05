"""
Unit tests for infrastructure.evaluation.Guardrails.
Tests input validation, output bounds, and signal normalization.
"""

import pytest
import sys
from pathlib import Path

ML_ENGINE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ML_ENGINE))


class TestGuardrailsSignalValidation:
    """Test signal normalization and validation."""

    def test_guardrails_normalizes_lowercase_signal(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        normalized = g.normalize_signal("long")
        assert normalized == "LONG"

    def test_guardrails_normalizes_uppercase_signal(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        normalized = g.normalize_signal("SHORT")
        assert normalized == "SHORT"

    def test_guardrails_rejects_invalid_signal(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.normalize_signal("BUY")
        assert result == "NEUTRAL"

    def test_guardrails_accepts_valid_signals(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        for signal in ("LONG", "SHORT", "NEUTRAL"):
            assert g.normalize_signal(signal) == signal


class TestGuardrailsConfidenceBounds:
    """Test confidence clamping to valid range [0, 0.9999]."""

    def test_confidence_above_max_clamped(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        clamped = g.clamp_confidence(1.5)
        assert clamped <= 0.9999

    def test_confidence_negative_clamped(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        clamped = g.clamp_confidence(-0.5)
        assert clamped >= 0.0

    def test_confidence_within_range_unchanged(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        assert g.clamp_confidence(0.75) == pytest.approx(0.75)

    def test_confidence_exactly_max_allowed(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        assert g.clamp_confidence(0.9999) == pytest.approx(0.9999)


class TestGuardrailsOutputBounds:
    """Test output bounds enforcement on alpha, position size, and R:R."""

    def test_alpha_positive_clamped(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        clamped = g.clamp_alpha(50.0)
        assert clamped <= 20.0

    def test_alpha_negative_clamped(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        clamped = g.clamp_alpha(-50.0)
        assert clamped >= -20.0

    def test_alpha_within_bounds_unchanged(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        assert g.clamp_alpha(5.0) == pytest.approx(5.0)

    def test_position_size_exceeds_max_clamped(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        clamped = g.clamp_position_size(50)
        assert clamped <= 8

    def test_position_size_negative_clamped(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        clamped = g.clamp_position_size(-2)
        assert clamped >= 1

    def test_rr_ratio_below_minimum_rejected(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_rr_ratio(0.5)
        assert result is False

    def test_rr_ratio_above_minimum_accepted(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_rr_ratio(2.0)
        assert result is True

    def test_stop_loss_out_of_range_rejected(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        # Too small
        assert g.validate_stop_loss(1) is False
        # Too large
        assert g.validate_stop_loss(200) is False

    def test_stop_loss_valid_accepted(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        assert g.validate_stop_loss(50) is True


class TestGuardrailsGuardMethod:
    """Test the full guard() method that wraps a prediction dict."""

    def test_guard_passes_valid_prediction(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        pred = {
            "signal": "LONG",
            "confidence": 0.75,
            "alpha": 5.0,
            "position_size": 4,
            "rr_ratio": 2.5,
        }
        guarded = g.guard(pred)
        assert guarded["signal"] == "LONG"
        assert guarded["confidence"] == pytest.approx(0.75)

    def test_guard_fixes_all_violations(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        pred = {
            "signal": "buy",        # lowercase → fixed
            "confidence": 1.5,       # > 0.9999 → clamped
            "alpha": 100.0,          # > 20 → clamped
            "position_size": 20,    # > 8 → clamped
            "rr_ratio": 0.1,         # < 1 → fixed
        }
        guarded = g.guard(pred)
        assert guarded["signal"] == "LONG"
        assert guarded["confidence"] <= 0.9999
        assert abs(guarded["alpha"]) <= 20.0
        assert guarded["position_size"] <= 8
        assert guarded["rr_ratio"] >= 1.0
