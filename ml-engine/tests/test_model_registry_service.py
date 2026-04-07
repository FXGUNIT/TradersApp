import json

import pandas as pd
import pytest

import config
from infrastructure.model_registry_client import ModelRegistryClient
from infrastructure.model_registry_service import ModelRegistryService


class DummyPredictor:
    def __init__(self):
        self._models = {"direction": {"version": "1"}}
        self.is_ready = True

    def predict(self, candles_df, trade_log_df=None, math_engine_snapshot=None, key_levels=None):
        return {
            "votes": {"direction": {"signal": "LONG", "confidence": 0.9}},
            "consensus": {"signal": "LONG", "confidence": 0.9},
            "models_loaded": list(self._models.keys()),
            "rows": len(candles_df),
        }


class DummyRegimeEnsemble:
    def advance(self, feature_df):
        return {
            "regime": "NORMAL",
            "regime_id": 1,
            "regime_confidence": 0.75,
            "regime_posteriors": {"NORMAL": 0.75},
            "model_weights": {"hmm": 0.5, "fp_fk": 0.5},
            "fp_fk": {
                "regime": "NORMAL",
                "q_parameter": 1.1,
                "fk_wave_speed": 0.2,
                "fk_min_wave_speed": 0.1,
                "fk_wave_acceleration": 0.01,
                "criticality_index": 0.05,
                "front_direction": "STABLE",
                "front_position_normalized": 0.5,
                "reaction_rate": 0.02,
                "diffusion_coeff": 0.05,
                "drift_vr": 0.0,
                "drift_adx": 0.0,
                "entropy_rate": 0.1,
                "current_vr": 1.0,
                "current_adx": 20.0,
                "explanation": "stable",
            },
            "hmm": {"regime": "NORMAL", "confidence": 0.8, "previous_regime": "NORMAL", "regime_change": False},
            "anomalous_diffusion": {
                "hurst_H": 0.5,
                "diffusion_type": "NORMAL",
                "vol_clustering": "MODERATE",
                "multifractality": "MONOFRACTAL",
                "position_adjustment": 0.0,
            },
            "deleverage_signal": 0.0,
            "deleverage_reason": "none",
            "stop_multiplier": 1.0,
            "position_adjustment": 0.0,
            "signal_adjustment": "BALANCED",
            "explanation": "stable",
        }


@pytest.fixture()
def registry_service(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "MODEL_STORE_READ_ONLY", False)
    store_dir = tmp_path / "store"
    store_dir.mkdir(parents=True)
    (store_dir / "direction_1.meta.json").write_text(json.dumps({"version": "1"}), encoding="utf-8")

    service = ModelRegistryService(
        store_dir=str(store_dir),
        redis_url="redis://127.0.0.1:6399/0",
        max_cached_instances=1,
    )
    monkeypatch.setattr(service, "_load_predictor", lambda: DummyPredictor())
    monkeypatch.setattr(service, "_load_regime_ensemble", lambda: DummyRegimeEnsemble())
    return service


def test_model_registry_service_eviction_and_status(registry_service):
    candles = pd.DataFrame([{"timestamp": "2026-04-08T00:00:00Z", "close": 1.0}])
    predict_result = registry_service.predict(candles)
    assert predict_result["consensus"]["signal"] == "LONG"

    predictor_status = registry_service.status()
    assert predictor_status["predictor"]["ready"] is True
    assert predictor_status["cached_instances"] == ["predictor"]

    regime_result = registry_service.advance_regime(pd.DataFrame([{"timestamp": "2026-04-08T00:00:00Z", "vr": 1.0}]))
    assert regime_result["regime"] == "NORMAL"

    status = registry_service.status()
    assert status["cached_instances"] == ["regime_ensemble"]
    assert status["predictor"]["cached"] is False
    assert status["regime_ensemble"]["cached"] is True


def test_model_registry_client_direct_mode_delegates(registry_service):
    client = ModelRegistryClient(mode="direct", service=registry_service)
    status = client.warm_models(["predictor"])
    assert status["predictor"]["cached"] is True

    result = client.predict(pd.DataFrame([{"timestamp": "2026-04-08T00:00:00Z", "close": 1.0}]))
    assert result["consensus"]["signal"] == "LONG"
