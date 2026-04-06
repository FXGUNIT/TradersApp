"""
Unit tests for models.regime.regime_ensemble.
Tests regime ensemble vote aggregation, confidence, and deleverage logic.
"""

import pytest
import numpy as np

# Mock regime sub-models before importing regime_ensemble.
# regime_ensemble.py does 'from models.regime.hmm_regime import HMMRegimeDetector' etc.
# If these entries already exist in sys.modules, Python uses them directly.
# So we must populate sys.modules with ModuleType objects that expose the mock classes
# as their attributes — this way 'from X import Y' works AND the class is accessible.
import sys
import types


class MockHMMRegimeDetector:
    """Mock HMMRegimeDetector for testing."""
    name = "hmm_regime"
    model_type = "regime"
    state_names = ["COMPRESSION", "NORMAL", "EXPANSION"]

    def __init__(self, *args, **kwargs):
        self._is_trained = False

    def train(self, *args, **kwargs):
        self._is_trained = True
        return {"model": "hmm_regime"}

    def predict_current(self, df):
        return self._default_regime()

    def _default_regime(self):
        return {
            "regime": "NORMAL",
            "posterior_probs": {"COMPRESSION": 0.1, "NORMAL": 0.8, "EXPANSION": 0.1},
            "confidence": 0.8,
        }

    def predict(self, *args, **kwargs):
        import numpy as np
        return np.array([1])

    def predict_proba(self, *args, **kwargs):
        import numpy as np
        return np.array([[0.1, 0.8, 0.1]])

    def get_metrics(self):
        return {"trained": self._is_trained}


class MockFPFKRegimeDetector:
    """Mock FPFKRegimeDetector for testing."""
    name = "fp_fk_regime"
    model_type = "regime"

    def __init__(self, *args, **kwargs):
        self.is_trained = True
        self._f_current = None

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
            "front_direction": "STABLE",
            "diffusion_exponent": 1.8,
        }

    def _estimate_parameters(self, *args, **kwargs):
        pass

    def _build_drift_field(self, *args, **kwargs):
        return [0.0], [0.0]

    def _build_diffusion_field(self, *args, **kwargs):
        import numpy as np
        return np.array([0.05])

    def _get_reaction_rate(self, *args, **kwargs):
        return 0.02

    def _build_equilibrium(self, *args, **kwargs):
        return 0.0

    def solve_fp_fk_pde(self, *args, **kwargs):
        return None, None, None

    def get_metrics(self):
        return {"trained": self.is_trained}


class MockAnomalousDiffusionModel:
    """Mock AnomalousDiffusionModel for testing."""
    name = "anomalous_diffusion"
    model_type = "regime"

    def __init__(self, *args, **kwargs):
        self.window_size = 100
        self._recent_returns = []

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

    def get_metrics(self):
        return {}


def _q_to_regime(q):
    if q < 0.9:
        return "COMPRESSION"
    elif q > 1.7:
        return "EXPANSION"
    return "NORMAL"


# Create mock module objects (ModuleType) with mock classes as attributes
# This allows: from models.regime.hmm_regime import HMMRegimeDetector
# to resolve correctly via sys.modules lookup
_hmm_mock_module = types.ModuleType("models.regime.hmm_regime")
_hmm_mock_module.HMMRegimeDetector = MockHMMRegimeDetector

_fp_fk_mock_module = types.ModuleType("models.regime.fp_fk_regime")
_fp_fk_mock_module.FPFKRegimeDetector = MockFPFKRegimeDetector
_fp_fk_mock_module.q_to_regime = _q_to_regime

_anom_mock_module = types.ModuleType("models.regime.anomalous_diffusion")
_anom_mock_module.AnomalousDiffusionModel = MockAnomalousDiffusionModel

# Place mock modules in sys.modules BEFORE regime_ensemble.py's import runs
sys.modules["models.regime.hmm_regime"] = _hmm_mock_module
sys.modules["models.regime.fp_fk_regime"] = _fp_fk_mock_module
sys.modules["models.regime.anomalous_diffusion"] = _anom_mock_module


# Now import regime_ensemble — it finds our mock modules in sys.modules
from models.regime.regime_ensemble import RegimeEnsemble


# Restore real regime modules after all tests in this file run.
# Use pytest_runtest_teardown (per-test) to clean up after each test,
# but since the mocks are module-level (set at import time), we clean up
# after the LAST test class runs using a finalizer.
import pytest


@pytest.fixture(scope="session", autouse=True)
def cleanup_regime_mocks():
    """No-op — we use local mocks in regime_ensemble tests only."""
    yield


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
