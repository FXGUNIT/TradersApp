"""
Triton Python Backend Model — wraps existing Predictor for GPU-accelerated serving.

This model runs inside Triton Inference Server as a Python backend model.
It loads ONNX models (LightGBM via ONNX) and serves predictions via gRPC.

Model repository structure:
  models/
    lightgbm_direction/
      1/
        model.py          ← this file
        config.pbtxt
        model.onnx        ← exported from onnx_exporter.py
      xgboost_direction/
      1/
        model.py
        config.pbtxt
        model.onnx

Usage:
  1. python -m ml_engine.inference.onnx_exporter --all
  2. cp -r ml-engine/models/onnx/* /triton/models/
  3. docker run --gpus all -p 8000:8000 -p 8001:8001 -p 8002:8002 \
       -v $(pwd)/models:/models nvcr.io/nvidia/tritonserver:24.04-py3 \
       tritonserver --model-repository=/models

Triton Python backend docs: https://github.com/triton-inference-server/python_backend
"""

from __future__ import annotations

import os
import sys
import json
import time
from pathlib import Path
from typing import Optional

import numpy as np

# ONNX Runtime
try:
    import onnxruntime as ort
    ORT_AVAILABLE = True
except ImportError:
    ORT_AVAILABLE = False

# Fallback: sklearn (if ONNX not available)
try:
    import joblib
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class TritonPythonModel:
    """
    Triton Python backend model for ONNX/sklearn ML inference.

    Input:  {"inputs": [[...float features...]]}
    Output: {"prob_long": [...], "prob_short": [...], "signal": [...]}

    Supports:
      - ONNX Runtime (GPU-accelerated)
      - sklearn/joblib fallback (CPU only)
    """

    def __init__(self, args: dict):
        self._args = args
        self._model_path: str = args.get("model_path", "")
        self._onnx_path: str = ""
        self._pkl_path: str = ""
        self._session = None
        self._pipeline = None
        self._feature_cols: list[str] = []
        self._model_name: str = "unknown"
        self._n_features: int = 0

        # Load metadata
        meta_path = Path(self._model_path).parent / (Path(self._model_path).stem + ".meta.json")
        if meta_path.exists():
            with open(meta_path) as f:
                self._meta = json.load(f)
            self._feature_cols = self._meta.get("feature_cols", [])
            self._model_name = self._meta.get("model_name", "unknown")
            self._n_features = self._meta.get("n_features", 0)

        self._load_model()

    def _load_model(self):
        """Load ONNX or sklearn model."""
        model_dir = Path(self._model_path).parent

        # Try ONNX first
        onnx_candidates = list(model_dir.glob("*.onnx"))
        if onnx_candidates:
            self._onnx_path = str(onnx_candidates[0])
            self._load_onnx()
            return

        # Fallback to sklearn joblib
        pkl_candidates = list(model_dir.glob("*.pkl"))
        if pkl_candidates:
            self._pkl_path = str(pkl_candidates[0])
            self._load_sklearn()
            return

        raise FileNotFoundError(f"No model found in {model_dir}")

    def _load_onnx(self):
        """Load ONNX model with ONNX Runtime."""
        if not ORT_AVAILABLE:
            raise ImportError("ONNX Runtime not installed: pip install onnxruntime-gpu")

        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        available = ort.get_available_providers()

        active_providers = [p for p in providers if p in available]
        if not active_providers:
            active_providers = ["CPUExecutionProvider"]

        self._session = ort.InferenceSession(
            self._onnx_path,
            providers=active_providers,
        )
        self._input_name = self._session.get_inputs()[0].name
        self._output_names = [o.name for o in self._session.get_outputs()]

        print(f"[Triton] Loaded ONNX model: {self._onnx_path}")
        print(f"[Triton] Providers: {active_providers}")
        print(f"[Triton] Input: {self._input_name}, Outputs: {self._output_names}")

    def _load_sklearn(self):
        """Load sklearn/joblib model as fallback."""
        if not SKLEARN_AVAILABLE:
            raise ImportError("sklearn not available: pip install scikit-learn")

        self._pipeline = joblib.load(self._pkl_path)
        print(f"[Triton] Loaded sklearn model: {self._pkl_path}")

    # ─── Triton required methods ─────────────────────────────────────────────────

    def execute(self, payloads: list) -> list:
        """
        Triton execute — runs inference on batched inputs.

        Each payload contains:
          inputs[0] = {"name": "input", "data": [[...float features...]], "shape": [B, N]}
        """
        results = []

        for payload in payloads:
            inputs = payload["inputs"]
            input_tensor = inputs[0]  # {"name": "input", "data": [...], "shape": [...]}

            data = np.array(input_tensor["data"], dtype=np.float32)
            shape = input_tensor.get("shape", [len(self._feature_cols)])

            # Reshape to 2D [batch, features]
            if len(shape) == 1:
                batch_size = 1
                n_features = shape[0]
            else:
                batch_size = shape[0]
                n_features = shape[1]

            X = data.reshape([batch_size, n_features])

            # Pad or truncate to expected feature count
            if X.shape[1] < self._n_features:
                pad = np.zeros((batch_size, self._n_features - X.shape[1]), dtype=np.float32)
                X = np.concatenate([X, pad], axis=1)
            elif X.shape[1] > self._n_features:
                X = X[:, : self._n_features]

            # Run inference
            if self._session is not None:
                outputs = self._onnx_predict(X)
            else:
                outputs = self._sklearn_predict(X)

            results.append(outputs)

        return results

    def _onnx_predict(self, X: np.ndarray) -> dict:
        """ONNX Runtime inference."""
        result = self._session.run(self._output_names, {self._input_name: X})

        # Parse outputs based on model type
        if len(result) == 1:
            # Single output: raw probabilities [batch, 2]
            proba = result[0]
            if proba.shape[1] == 2:
                p_long = proba[:, 1].tolist()
                p_short = proba[:, 0].tolist()
            else:
                p_long = proba[:, 0].tolist() if proba.ndim > 1 else result[0].tolist()
                p_short = [1 - p for p in p_long]
        else:
            p_long = result[0].tolist()
            p_short = result[1].tolist()

        signals = []
        confidences = []
        for pl, ps in zip(p_long, p_short):
            conf = max(pl, ps)
            if conf < 0.52:
                signals.append("NEUTRAL")
            elif pl >= ps:
                signals.append("LONG")
            else:
                signals.append("SHORT")
            confidences.append(round(float(conf), 4))

        return self._build_output(p_long, p_short, signals, confidences)

    def _sklearn_predict(self, X: np.ndarray) -> dict:
        """sklearn inference fallback."""
        proba = self._pipeline.predict_proba(X)

        p_long = proba[:, 1].tolist() if proba.shape[1] == 2 else [0.5] * len(X)
        p_short = [1 - p for p in p_long]

        signals = []
        confidences = []
        for pl, ps in zip(p_long, p_short):
            conf = max(pl, ps)
            if conf < 0.52:
                signals.append("NEUTRAL")
            elif pl >= ps:
                signals.append("LONG")
            else:
                signals.append("SHORT")
            confidences.append(round(float(conf), 4))

        return self._build_output(p_long, p_short, signals, confidences)

    def _build_output(
        self,
        p_long: list,
        p_short: list,
        signals: list,
        confidences: list,
    ) -> dict:
        """Build Triton output tensors."""
        return {
            "outputs": [
                {"name": "prob_long", "data": p_long, "shape": [len(p_long)], "dtype": "TYPE_FP32"},
                {"name": "prob_short", "data": p_short, "shape": [len(p_short)], "dtype": "TYPE_FP32"},
                {"name": "confidence", "data": confidences, "shape": [len(confidences)], "dtype": "TYPE_FP32"},
                {"name": "signal", "data": signals, "shape": [len(signals)], "dtype": "TYPE_STRING"},
            ]
        }

    def get_model_config(self) -> dict:
        """Return model config for Triton auto-complete."""
        return {
            "name": self._model_name,
            "backend": "python",
            "max_batch_size": 64,
            "input": [{"name": "input", "data_type": "TYPE_FP32", "dims": [self._n_features]}],
            "output": [
                {"name": "prob_long", "data_type": "TYPE_FP32", "dims": [-1]},
                {"name": "prob_short", "data_type": "TYPE_FP32", "dims": [-1]},
                {"name": "confidence", "data_type": "TYPE_FP32", "dims": [-1]},
                {"name": "signal", "data_type": "TYPE_STRING", "dims": [-1]},
            ],
        }
