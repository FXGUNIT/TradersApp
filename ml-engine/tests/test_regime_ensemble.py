"""
Unit tests for models.regime.regime_ensemble.
Tests regime ensemble vote aggregation, confidence, and deleverage logic.
"""

import pytest
import sys
from pathlib import Path

ML_ENGINE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ML_ENGINE))

import numpy as np

# Mock regime sub-models before importing
import sys
sys.modules.setdefault("models.regime.hmm_regime", type(sys)("hmm_regime"))
sys.modules.setdefault("models.regime.fp_fk_regime", type(sys)("fp_fk_regime"))
sys.modules.setdefault("models.regime.anomalous_diffusion", type(sys)("anomalous_diffusion"))


class MockHMM:
    """Mock HMMRegimeDetector for testing."""
    def __init__(self, *args, **kwargs):
        self._trained = False

    def train(self, *args, **kwargs):
        self._trained = True
        return {}

    def predict_current(self, df):
        return self._default_regime()

    def _default_regime(self):
        return {
            "regime": "NORMAL",
            "posterior_probs": {"COMPRESSION": 0.1, "NORMAL": 0.8, "EXPANSION": 0.1},
            "confidence": 0.8,
        }


class MockFPFK:
    """Mock FPFKRegimeDetector for testing."""
    def __init__(self, *args, **kwargs):
        self.is_trained = True

    def train(self, *args, **kwargs):
        return {}

    def predict_current(self, df):
        return self._default_output()

    def _default_output(self):
        return {
            "regime": "NORMAL",
            "posterior_probs": {"COMPRESSION": 0.1, "NORMAL": 0.8, "EXPANSION": 0.1, "CRISIS": 0.0},
            "confidence": 0.8,
            "q_parameter": 1.5,
            "fk_wave_speed": 0.0,
            "fk_wave_acceleration": 0.0,
            "criticality_index": 0.0,
            "deleverage_signal": 0.0,
            "deleverage_reason": "",
            "current_vr": 1.0,
            "reaction_rate": 0.02,
            "diffusion_coeff": 0.05,
        }


class MockAnom:
    """Mock AnomalousDiffusionModel for testing."""
    def __init__(self, *args, **kwargs):
        pass

    def train(self, *args, **kwargs):
        return {}

    def predict_current(self, df):
        return {
            "hurst_H": 0.5,
            "diffusion_type": "NORMAL",
            "vol_clustering": "MODERATE",
            "multifractality": "MONOFRACTAL",
            "position_adjustment": 0.0,
        }


# Inject mocks before importing
import models.regime.regime_ensemble as re_module
re_module.HMMRegimeDetector = MockHMM
re_module.FPFKRegimeDetector = MockFPFK
re_module.AnomalousDiffusionModel = MockAnom

from models.regime.regime_ensemble import RegimeEnsemble


class TestRegimeEnsembleInit:
    """Test RegimeEnsemble initialization."""

    def test_init_not_trained(self):
        re = RegimeEnsemble(random_state=42)
        assert re.is_trained is False

    def test_regime_ids_mapping(self):
        assert RegimeEnsemble.REGIME_IDS["COMPRESSION"] == 0
        assert RegimeEnsemble.REGIME_IDS["NORMAL"] == 1
        assert RegimeEnsemble.REGIME_IDS["EXPANSION"] == 2
        assert RegimeEnsemble.REGIME_IDS["CRISIS"] == 3

    def test_get_metrics(self):
        re = RegimeEnsemble()
        metrics = re.get_metrics()
        assert "model" in metrics
        assert metrics["trained"] is False


class TestRegimeEnsemblePredict:
    """Test RegimeEnsemble.advance() output shape and fields."""

    def test_advance_returns_required_fields(self):
        import pandas as pd
        re = RegimeEnsemble()
        re._is_trained = True

        dates = pd.date_range("2023-01-01", periods=60, freq="5min")
        df = pd.DataFrame({
            "close": 18500 + np.cumsum(np.random.randn(60)),
            "log_return": np.random.randn(60) * 0.01,
            "volume": np.random.randint(1000, 5000, 60),
        }, index=dates)

        result = re.advance(df)

        # Required ensemble fields
        assert "regime" in result
        assert "regime_id" in result
        assert "regime_confidence" in result
        assert "regime_posteriors" in result
        assert "model_weights" in result

        # FP-FK fields
        assert "q_parameter" in result
        assert "fk_wave_speed" in result
        assert "criticality_index" in result

        # Deleverage
        assert "deleverage_signal" in result
        assert "deleverage_reason" in result

        # Signal adjustment
        assert "signal_adjustment" in result
        assert "stop_multiplier" in result
        assert "explanation" in result

    def test_advance_infers_regime_type(self):
        import pandas as pd
        re = RegimeEnsemble()
        re._is_trained = True

        dates = pd.date_range("2023-01-01", periods=60, freq="5min")
        df = pd.DataFrame({
            "close": 18500 + np.cumsum(np.random.randn(60)),
            "log_return": np.random.randn(60) * 0.01,
            "volume": np.random.randint(1000, 5000, 60),
        }, index=dates)

        result = re.advance(df)
        assert result["regime"] in ("COMPRESSION", "NORMAL", "EXPANSION", "CRISIS")
        assert result["regime_id"] in (0, 1, 2, 3)

    def test_advance_regime_confidence_in_range(self):
        import pandas as pd
        re = RegimeEnsemble()
        re._is_trained = True

        dates = pd.date_range("2023-01-01", periods=60, freq="5min")
        df = pd.DataFrame({
            "close": 18500 + np.cumsum(np.random.randn(60)),
            "log_return": np.random.randn(60) * 0.01,
            "volume": np.random.randint(1000, 5000, 60),
        }, index=dates)

        result = re.advance(df)
        assert 0.0 <= result["regime_confidence"] <= 1.0

    def test_posteriors_sum_approximately_one(self):
        import pandas as pd
        re = RegimeEnsemble()
        re._is_trained = True

        dates = pd.date_range("2023-01-01", periods=60, freq="5min")
        df = pd.DataFrame({
            "close": 18500 + np.cumsum(np.random.randn(60)),
            "log_return": np.random.randn(60) * 0.01,
            "volume": np.random.randint(1000, 5000, 60),
        }, index=dates)

        result = re.advance(df)
        posteriors = result["regime_posteriors"]
        total = sum(posteriors.values())
        assert total == pytest.approx(1.0, abs=0.01)

    def test_weights_sum_to_one(self):
        import pandas as pd
        re = RegimeEnsemble()
        re._is_trained = True

        dates = pd.date_range("2023-01-01", periods=60, freq="5min")
        df = pd.DataFrame({
            "close": 18500 + np.cumsum(np.random.randn(60)),
            "log_return": np.random.randn(60) * 0.01,
            "volume": np.random.randint(1000, 5000, 60),
        }, index=dates)

        result = re.advance(df)
        weights = result["model_weights"]
        total = sum(weights.values())
        assert total == pytest.approx(1.0, abs=0.01)

    def test_predict_current_aliases_advance(self):
        import pandas as pd
        re = RegimeEnsemble()
        re._is_trained = True

        dates = pd.date_range("2023-01-01", periods=60, freq="5min")
        df = pd.DataFrame({
            "close": 18500 + np.cumsum(np.random.randn(60)),
            "log_return": np.random.randn(60) * 0.01,
            "volume": np.random.randint(1000, 5000, 60),
        }, index=dates)

        r1 = re.advance(df)
        r2 = re.predict_current(df)
        assert r1["regime"] == r2["regime"]


class TestDeleverageLogic:
    """Test deleverage signal combination logic."""

    def test_no_deleverage_in_normal_regime(self):
        import pandas as pd
        re = RegimeEnsemble()
        re._is_trained = True

        dates = pd.date_range("2023-01-01", periods=60, freq="5min")
        df = pd.DataFrame({
            "close": 18500 + np.cumsum(np.random.randn(60)),
            "log_return": np.random.randn(60) * 0.01,
            "volume": np.random.randint(1000, 5000, 60),
        }, index=dates)

        result = re.advance(df)
        # In normal conditions with low deleverage signals
        assert isinstance(result["deleverage_signal"], float)
        assert 0.0 <= result["deleverage_signal"] <= 1.0

    def test_deleverage_signal_capped_at_one(self):
        re = RegimeEnsemble()
        re._is_trained = True

        # Directly test _combine_deleverage with crisis regime
        fp_fk = {
            "regime": "CRISIS",
            "deleverage_signal": 1.0,
            "deleverage_reason": "CRISIS",
            "criticality_index": 1.0,
            "current_vr": 0.5,
            "fk_wave_acceleration": -0.2,
        }
        anom = {"hurst_H": 0.5}
        regime_probs = {"ensemble_regime": "NORMAL"}

        sig, reason = re._combine_deleverage(fp_fk, anom, regime_probs)
        assert sig == pytest.approx(0.95)  # crisis should cap at 0.95

    def test_signal_adjustment_sub_diffusion(self):
        import pandas as pd
        re = RegimeEnsemble()
        re._is_trained = True

        dates = pd.date_range("2023-01-01", periods=60, freq="5min")
        df = pd.DataFrame({
            "close": 18500 + np.cumsum(np.random.randn(60)),
            "log_return": np.random.randn(60) * 0.01,
            "volume": np.random.randint(1000, 5000, 60),
        }, index=dates)

        result = re.advance(df)
        assert result["signal_adjustment"] in ("LONG_FAVORED", "SHORT_FAVORED", "BALANCED")

    def test_stop_multiplier_in_valid_range(self):
        import pandas as pd
        re = RegimeEnsemble()
        re._is_trained = True

        dates = pd.date_range("2023-01-01", periods=60, freq="5min")
        df = pd.DataFrame({
            "close": 18500 + np.cumsum(np.random.randn(60)),
            "log_return": np.random.randn(60) * 0.01,
            "volume": np.random.randint(1000, 5000, 60),
        }, index=dates)

        result = re.advance(df)
        assert 0.3 <= result["stop_multiplier"] <= 3.0
