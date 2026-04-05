"""
Triton Python Backend — Move Magnitude (Target Profit Taker) Model

Serves LightGBM quantile regression for target profit estimation.

Input:  JSON string — {"features": [...44 floats...], "horizons": [1, 3, 5, 10]}
Output: tp1_ticks, tp2_ticks, tp3_ticks, uncertainty_band
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "ml-engine"))

_model = None


def _get_model():
    """Lazy-load the magnitude model."""
    global _model
    if _model is None:
        from training.model_store import ModelStore
        store = ModelStore()
        try:
            pipeline, _ = store.get_latest("move_magnitude")
            _model = pipeline
        except FileNotFoundError:
            _model = None
    return _model


class TritonMoveMagnitudeModel:
    """Triton Python backend model for magnitude/target profit estimation."""

    def __init__(self, args: dict):
        self._args = args
        self._default_tp = [10.0, 20.0, 30.0]   # Fallback ticks per horizon

    def execute(self, payloads: list) -> list:
        """Run magnitude inference on batched JSON inputs."""
        results = []
        for payload in payloads:
            inputs = payload.get("inputs", [])
            json_input = None
            for inp in inputs:
                if inp.get("name") == "json_input":
                    data = inp.get("data", [])
                    if data:
                        json_input = data[0]
                    break

            if not json_input:
                results.append(self._build_default(1))
                continue

            try:
                parsed = json.loads(json_input)
                result = self._run_inference(parsed)
                results.append(result)
            except Exception as exc:
                print(f"[MagnitudeTriton] Error: {exc}")
                results.append(self._build_default(1))

        return results

    def _run_inference(self, parsed: dict) -> dict:
        model = _get_model()
        features = parsed.get("features", [])

        if model is None or not features:
            return self._build_default(1)

        try:
            import numpy as np
            X = np.array([features], dtype=np.float32)
            proba = model.predict_proba(X)

            # proba[:, 0] = q25 (conservative), proba[:, 1] = q50 (expected), proba[:, 2] = q75 (aggressive)
            if proba.shape[1] >= 3:
                tp_conservative = float(proba[0, 0])
                tp_expected = float(proba[0, 1])
                tp_aggressive = float(proba[0, 2])
                uncertainty = max(0.0, tp_aggressive - tp_conservative)
            else:
                tp_conservative = tp_expected = tp_aggressive = float(proba[0, 0])
                uncertainty = 0.0

            # TP1 = conservative, TP2 = expected, TP3 = aggressive
            return self._build_output([{
                "tp1_ticks": tp_conservative,
                "tp2_ticks": tp_expected,
                "tp3_ticks": tp_aggressive,
                "uncertainty_band": uncertainty,
            }])

        except Exception as exc:
            print(f"[MagnitudeTriton] Prediction error: {exc}")
            return self._build_default(1)

    def _build_output(self, results: list) -> dict:
        n = len(results)
        return {
            "outputs": [
                {"name": "tp1_ticks",         "data": [r["tp1_ticks"]         for r in results], "shape": [n], "dtype": "TYPE_FP32"},
                {"name": "tp2_ticks",         "data": [r["tp2_ticks"]         for r in results], "shape": [n], "dtype": "TYPE_FP32"},
                {"name": "tp3_ticks",         "data": [r["tp3_ticks"]         for r in results], "shape": [n], "dtype": "TYPE_FP32"},
                {"name": "uncertainty_band",  "data": [r["uncertainty_band"]  for r in results], "shape": [n], "dtype": "TYPE_FP32"},
            ]
        }

    def _build_default(self, batch_size: int) -> dict:
        return {
            "outputs": [
                {"name": "tp1_ticks",        "data": [10.0] * batch_size, "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "tp2_ticks",         "data": [20.0] * batch_size, "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "tp3_ticks",         "data": [30.0] * batch_size, "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "uncertainty_band",  "data": [10.0] * batch_size, "shape": [batch_size], "dtype": "TYPE_FP32"},
            ]
        }
