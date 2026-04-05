"""
Triton Python Backend — Regime Ensemble Model

Serves the regime ensemble (HMM + FP-FK + Anomalous Diffusion)
via Triton Python backend with JSON-serialized inputs.

Input:  JSON string tensor — {"candles": [...], "returns": [...], "vr": float, "adx": float}
Output: regime, regime_id, confidence, deleverage_signal, stop_multiplier, signal_adjustment

Triton loads this via: backend="python" in config.pbtxt
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "ml-engine"))

# Lazy imports to avoid loading all models at import time
_ensemble = None


def _get_ensemble():
    """Lazy-load the regime ensemble (imports are expensive)."""
    global _ensemble
    if _ensemble is None:
        from models.regime.regime_ensemble import RegimeEnsemble
        _ensemble = RegimeEnsemble()
    return _ensemble


class TritonRegimeModel:
    """Triton Python backend model for regime detection."""

    def __init__(self, args: dict):
        self._args = args
        self._model_path = args.get("model_path", "")

    def execute(self, payloads: list) -> list:
        """Run regime ensemble inference on batched JSON inputs."""
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
                # Return default NEUTRAL on empty input
                results.append(self._build_default_output(1))
                continue

            try:
                parsed = json.loads(json_input)
                result = self._run_inference(parsed)
                results.append(result)
            except Exception as exc:
                print(f"[RegimeTriton] Inference error: {exc}")
                results.append(self._build_default_output(1))

        return results

    def _run_inference(self, parsed: dict) -> dict:
        """Run the regime ensemble on parsed input dict."""
        ensemble = _get_ensemble()

        candles = parsed.get("candles", [])
        returns = parsed.get("returns", [])
        vr = parsed.get("vr", 1.0)
        adx = parsed.get("adx", 15.0)

        # Build DataFrame from candles
        import pandas as pd
        df = pd.DataFrame(candles) if candles else pd.DataFrame()

        # Run ensemble prediction
        if not df.empty and "close" in df.columns:
            result = ensemble.predict(df)
        else:
            # Graceful fallback: return NEUTRAL
            result = {
                "regime": "NEUTRAL",
                "regime_id": 1,
                "confidence": 0.5,
                "deleverage_signal": 0.0,
                "stop_multiplier": 1.0,
                "signal_adjustment": "BALANCED",
            }

        return self._build_output([result])

    def _build_output(self, results: list) -> dict:
        """Build Triton output tensors."""
        regimes = [r.get("regime", "NEUTRAL") for r in results]
        regime_ids = [int(r.get("regime_id", 1)) for r in results]
        confidences = [float(r.get("confidence", 0.5)) for r in results]
        deleverage = [float(r.get("deleverage_signal", 0.0)) for r in results]
        stop_mult = [float(r.get("stop_multiplier", 1.0)) for r in results]
        adjustments = [str(r.get("signal_adjustment", "BALANCED")) for r in results]

        n = len(results)
        return {
            "outputs": [
                {"name": "regime",              "data": regimes,     "shape": [n], "dtype": "TYPE_STRING"},
                {"name": "regime_id",           "data": regime_ids,  "shape": [n], "dtype": "TYPE_INT32"},
                {"name": "confidence",          "data": confidences, "shape": [n], "dtype": "TYPE_FP32"},
                {"name": "deleverage_signal",   "data": deleverage,  "shape": [n], "dtype": "TYPE_FP32"},
                {"name": "stop_multiplier",      "data": stop_mult,   "shape": [n], "dtype": "TYPE_FP32"},
                {"name": "signal_adjustment",   "data": adjustments, "shape": [n], "dtype": "TYPE_STRING"},
            ]
        }

    def _build_default_output(self, batch_size: int) -> dict:
        """Build default outputs (NEUTRAL regime) for error cases."""
        return {
            "outputs": [
                {"name": "regime",             "data": ["NEUTRAL"] * batch_size,  "shape": [batch_size], "dtype": "TYPE_STRING"},
                {"name": "regime_id",          "data": [1] * batch_size,         "shape": [batch_size], "dtype": "TYPE_INT32"},
                {"name": "confidence",          "data": [0.5] * batch_size,       "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "deleverage_signal",   "data": [0.0] * batch_size,      "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "stop_multiplier",     "data": [1.0] * batch_size,      "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "signal_adjustment",   "data": ["BALANCED"] * batch_size, "shape": [batch_size], "dtype": "TYPE_STRING"},
            ]
        }
