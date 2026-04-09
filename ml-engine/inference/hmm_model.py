"""
Triton Python Backend Model — HMM Regime Detector.

HMM models cannot be exported to ONNX (they require hmmlearn runtime).
This module serves HMM regime predictions via the Triton Python backend.

Model repository structure:
  models/
    hmm_regime/
      1/
        model.py          ← this file (copies into Triton model repo)
        config.pbtxt
        model.joblib      ← trained HMM model (from model store)
        scaler_params.json ← normalization params (mean/std per feature)

Usage:
  1. After training: python -m ml_engine.inference.hmm_model --export
     → copies model + scaler to ml-engine/models/triton_repo/hmm_regime/1/
  2. Triton automatically loads and serves via Python backend

Triton Python backend:
  https://github.com/triton-inference-server/python_backend
"""

from __future__ import annotations

import json
import os
import sys
import pickle
from pathlib import Path
from typing import Optional

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


# ─── HMM Regime Model ───────────────────────────────────────────────────────────

class HMMRegimeModel:
    """
    Triton Python backend model for HMM regime detection.

    Input:  {"features": [[vr, adx, atr_pct], ...]}  — 3D feature vector
    Output: {"regime": ["COMPRESSION" | "NORMAL" | "EXPANSION", ...],
             "confidence": [0.0-1.0, ...],
             "log_prob": [log_probability, ...]}

    States: 0=COMPRESSION, 1=NORMAL, 2=EXPANSION
    """

    STATE_NAMES = ["COMPRESSION", "NORMAL", "EXPANSION"]

    def __init__(self, args: dict):
        self._args = args
        self._model_path: str = args.get("model_path", "")
        self._model = None
        self._scaler_params: dict = {}
        self._state_names = self.STATE_NAMES
        self._n_features = 3

        self._load()

    def _load(self):
        """Load HMM model and scaler params."""
        model_dir = Path(self._model_path).parent

        # Load joblib model
        joblib_candidates = list(model_dir.glob("*.joblib")) + list(model_dir.glob("*.pkl"))
        if not joblib_candidates:
            raise FileNotFoundError(f"No HMM model found in {model_dir}")

        model_file = joblib_candidates[0]
        try:
            import joblib
            self._model = joblib.load(str(model_file))
        except Exception:
            with open(model_file, "rb") as f:
                self._model = pickle.load(f)

        # Load scaler params
        scaler_file = model_dir / "scaler_params.json"
        if scaler_file.exists():
            with open(scaler_file) as f:
                self._scaler_params = json.load(f)

        print(f"[HMM Triton] Loaded: {model_file.name}")

    def _normalize(self, X: np.ndarray) -> np.ndarray:
        """Z-score normalize features using stored params or compute online."""
        X_norm = X.copy().astype(np.float64)
        scaler = self._scaler_params

        for col in range(X_norm.shape[1]):
            mean = scaler.get(f"col_{col}_mean", X_norm[:, col].mean())
            std = scaler.get(f"col_{col}_std", X_norm[:, col].std())
            if std > 1e-8:
                X_norm[:, col] = (X_norm[:, col] - mean) / std
            else:
                X_norm[:, col] = 0.0

        return X_norm.astype(np.float32)

    def _remap_states(self, states: np.ndarray) -> np.ndarray:
        """Remap HMM state indices by VR mean ordering."""
        # State order: [COMPRESSION (lowest VR), NORMAL (medium), EXPANSION (highest)]
        # _state_map is stored during training
        state_map = getattr(self._model, "_state_map", None)
        if state_map is None:
            return states

        remapped = np.zeros_like(states)
        for orig, new in state_map.items():
            remapped[states == int(orig)] = int(new)
        return remapped

    def predict(self, features: np.ndarray) -> dict:
        """
        Run HMM prediction on feature vectors.

        Args:
            features: array of shape [batch, 3] with [vr, adx, atr_pct]
        """
        if self._model is None:
            return self._empty_output(len(features))

        # Normalize
        X = self._normalize(features)

        # Predict hidden states + compute log probabilities
        try:
            hidden_states = self._model.predict(X)
            log_probs = self._model.score_samples(X)
            remapped = self._remap_states(hidden_states)

            # State probabilities from posterior
            try:
                posteriors = self._model.predict_proba(X)
            except Exception:
                posteriors = np.eye(3)[remapped]

            regimes = [self._state_names[s] for s in remapped]
            confidences = [float(posteriors[i, remapped[i]]) for i in range(len(remapped))]
            log_prob_list = [float(lp) for lp in log_probs]

            return {
                "regime": regimes,
                "confidence": confidences,
                "log_prob": log_prob_list,
                "posteriors": posteriors.tolist(),
            }
        except Exception as e:
            print(f"[HMM Triton] Prediction error: {e}")
            return self._empty_output(len(features))

    def _empty_output(self, batch_size: int) -> dict:
        return {
            "regime": ["UNCLEAR"] * batch_size,
            "confidence": [0.0] * batch_size,
            "log_prob": [0.0] * batch_size,
            "posteriors": [[0.33, 0.33, 0.34]] * batch_size,
        }


# ─── Triton Python Backend Interface ─────────────────────────────────────────────

class TritonPythonModel(HMMRegimeModel):
    """
    Triton Python backend entry point.
    Implements the required Triton execute() method.
    """

    def execute(self, payloads: list) -> list:
        """
        Triton execute — processes batched requests.

        Each payload:
          inputs[0] = {"name": "features", "data": [vr, adx, atr_pct, vr, adx, ...], "shape": [B, 3]}
        """
        results = []

        for payload in payloads:
            inputs = payload.get("inputs", [])
            if not inputs:
                results.append(self._build_output(self._empty_output(1)))
                continue

            feat_tensor = inputs[0]  # {"name": "features", "data": [...], "shape": [...]}
            data = np.array(feat_tensor["data"], dtype=np.float32)
            shape = feat_tensor.get("shape", [len(data) // 3, 3])

            # Handle both flat [N*3] and 2D [N, 3] shapes
            if len(shape) == 1:
                batch_size = shape[0] // 3
                n_features = 3
            else:
                batch_size = shape[0]
                n_features = shape[1]

            X = data.reshape([batch_size, n_features])[:, :3]  # Take first 3 cols

            pred = self.predict(X)
            results.append(self._build_output(pred))

        return results

    def _build_output(self, pred: dict) -> dict:
        """Build Triton output tensors."""
        batch_size = len(pred["regime"])
        return {
            "outputs": [
                {"name": "regime", "data": pred["regime"], "shape": [batch_size], "dtype": "TYPE_STRING"},
                {"name": "confidence", "data": pred["confidence"], "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "log_prob", "data": pred["log_prob"], "shape": [batch_size], "dtype": "TYPE_FP32"},
            ]
        }

    def get_model_config(self) -> dict:
        return {
            "name": "hmm_regime",
            "backend": "python",
            "max_batch_size": 128,
            "input": [{"name": "features", "data_type": "TYPE_FP32", "dims": [3]}],
            "output": [
                {"name": "regime", "data_type": "TYPE_STRING", "dims": [-1]},
                {"name": "confidence", "data_type": "TYPE_FP32", "dims": [-1]},
                {"name": "log_prob", "data_type": "TYPE_FP32", "dims": [-1]},
            ],
        }


# ─── Export Utility ─────────────────────────────────────────────────────────────

def export_hmm_to_triton(model_name: str = "hmm_regime", version: str | None = None):
    """
    Copy a trained HMM model + scaler params into the Triton model repository.

    After training a new HMM:
      python -m ml_engine.inference.hmm_model --export
    """
    from training.model_store import ModelStore

    store = ModelStore()
    model, meta = store.load(model_name, version=version or "latest")

    # Build scaler params from training data statistics
    scaler_params = {}
    for col, name in enumerate(["vr", "adx", "atr_pct"]):
        scaler_params[f"col_{col}_mean"] = 0.0  # Will be updated by normalization stats
        scaler_params[f"col_{col}_std"] = 1.0

    # Save scaler params
    triton_repo = PROJECT_ROOT / "models" / "triton_repo" / model_name / "1"
    triton_repo.mkdir(parents=True, exist_ok=True)

    scaler_file = triton_repo / "scaler_params.json"
    with open(scaler_file, "w") as f:
        json.dump(scaler_params, f, indent=2)

    # Copy model
    import joblib
    model_file = triton_repo / "model.joblib"
    joblib.dump(model, str(model_file))

    # Write config.pbtxt
    config_content = '''name: "hmm_regime"
backend: "python"
max_batch_size: 128
dynamic_batching {
  preferred_batch_size: [1, 8, 16, 32, 64]
  max_queue_delay_microseconds: 100
}
instance_group [{ kind: KIND_CPU }]
input [
  { name: "features", data_type: TYPE_FP32, dims: [3] }
]
output [
  { name: "regime", data_type: TYPE_STRING, dims: [-1] },
  { name: "confidence", data_type: TYPE_FP32, dims: [-1] },
  { name: "log_prob", data_type: TYPE_FP32, dims: [-1] }
]
'''
    (triton_repo / "config.pbtxt").write_text(config_content)

    print(f"[HMM Triton] Exported to {triton_repo}")
    print(f"  - model.joblib")
    print(f"  - scaler_params.json")
    print(f"  - config.pbtxt")
    return triton_repo


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="HMM Triton Python backend")
    parser.add_argument("--export", action="store_true", help="Export HMM model to Triton repo")
    parser.add_argument("--model", type=str, default="hmm_regime", help="Model name")
    args = parser.parse_args()

    if args.export:
        export_hmm_to_triton(args.model)
