"""
Unit tests for infrastructure.evaluation.Guardrails.
Tests output validation and sanitization via validate_output().
"""

import pytest


class TestGuardrailsSignalValidation:
    """Test signal validation and normalization."""

    def test_guardrails_accepts_valid_signals(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        for signal in ("LONG", "SHORT", "NEUTRAL"):
            result = g.validate_output({"signal": signal})
            assert result.sanitized_output["signal"] == signal
            assert len(result.violations) == 0

    def test_guardrails_invalid_signal_forced_to_neutral(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "BUY"})
        assert result.sanitized_output["signal"] == "NEUTRAL"
        assert len(result.violations) == 1
        assert "Invalid signal" in result.violations[0]


class TestGuardrailsConfidenceBounds:
    """Test confidence clamping to valid range [0, 0.9999]."""

    def test_confidence_above_max_clamped(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "confidence": 1.5})
        assert result.sanitized_output["confidence"] <= 0.9999
        assert len(result.warnings) > 0

    def test_confidence_negative_clamped(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "confidence": -0.5})
        assert result.sanitized_output["confidence"] >= 0.0
        assert len(result.warnings) > 0

    def test_confidence_within_range_unchanged(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "confidence": 0.75})
        assert result.sanitized_output["confidence"] == pytest.approx(0.75)
        assert len(result.violations) == 0

    def test_confidence_exactly_max_allowed(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "confidence": 0.9999})
        assert result.sanitized_output["confidence"] == pytest.approx(0.9999)


class TestGuardrailsOutputBounds:
    """Test output bounds enforcement on alpha, position size, and R:R."""

    def test_alpha_positive_clamped(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "alpha": 50.0})
        assert result.sanitized_output["alpha"] <= 20.0
        assert len(result.violations) > 0

    def test_alpha_negative_clamped(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "alpha": -50.0})
        assert abs(result.sanitized_output["alpha"]) <= 20.0
        assert len(result.violations) > 0

    def test_alpha_within_bounds_unchanged(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "alpha": 5.0})
        assert result.sanitized_output["alpha"] == pytest.approx(5.0)
        assert len(result.violations) == 0

    def test_position_size_exceeds_max_clamped(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "contracts": 50})
        assert result.sanitized_output["contracts"] <= 8
        assert len(result.violations) > 0

    def test_position_size_negative_unchanged(self):
        # GuardRails does not enforce a minimum position size
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "contracts": -2})
        assert result.sanitized_output["contracts"] == -2
        assert len(result.violations) == 0

    def test_rr_ratio_below_minimum_rejected(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "recommended_rr": 0.5})
        # Low R:R causes violation and gets forced to 1.0
        assert result.sanitized_output["recommended_rr"] >= 1.0
        assert len(result.violations) > 0

    def test_rr_ratio_above_minimum_accepted(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "recommended_rr": 2.0})
        assert result.sanitized_output["recommended_rr"] == pytest.approx(2.0)
        assert len(result.violations) == 0

    def test_stop_loss_too_tight_records_warning(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "stop_loss_ticks": 1})
        assert result.sanitized_output["stop_loss_ticks"] >= 5
        assert any("tight" in w for w in result.warnings)

    def test_stop_loss_valid_no_warning(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        result = g.validate_output({"signal": "LONG", "stop_loss_ticks": 50})
        assert result.sanitized_output["stop_loss_ticks"] == 50
        assert len(result.warnings) == 0


class TestGuardrailsGuardMethod:
    """Test the full validate_output() method with a complete prediction dict."""

    def test_validate_output_passes_valid_prediction(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        pred = {
            "signal": "LONG",
            "confidence": 0.75,
            "alpha": 5.0,
            "contracts": 4,
            "recommended_rr": 2.5,
        }
        result = g.validate_output(pred)
        assert result.passed is True
        assert result.sanitized_output["signal"] == "LONG"
        assert result.sanitized_output["confidence"] == pytest.approx(0.75)

    def test_validate_output_fixes_all_violations(self):
        from infrastructure.evaluation import Guardrails
        g = Guardrails()
        pred = {
            "signal": "buy",         # invalid → NEUTRAL
            "confidence": 1.5,        # > 0.9999 → clamped
            "alpha": 100.0,          # > 20 → clamped
            "contracts": 20,         # > 8 → clamped
            "recommended_rr": 0.1,  # < 1 → forced to 1.0
        }
        result = g.validate_output(pred)
        assert result.sanitized_output["signal"] == "NEUTRAL"
        assert result.sanitized_output["confidence"] <= 0.9999
        assert abs(result.sanitized_output["alpha"]) <= 20.0
        assert result.sanitized_output["contracts"] <= 8
        assert result.sanitized_output["recommended_rr"] >= 1.0
