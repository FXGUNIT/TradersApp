"""
Triton Python Backend — Time Probability (Session Probability) Model

Serves session/win-rate probability model via Triton Python backend.

Input:  JSON string — {"trade_log": [{"entry_time": "...", "result": "...", "session_id": "..."}]}
Output: p_profitable, confidence, current_bucket, recommendation
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "ml-engine"))

_model = None
_feature_cols = None


def _get_model_and_features():
    """Lazy-load model and feature columns."""
    global _model, _feature_cols
    if _model is None:
        from training.model_store import ModelStore
        from models.session.time_probability import TimeProbabilityModel
        store = ModelStore()
        try:
            pipeline, meta = store.get_latest("time_probability")
            _model = pipeline
            _feature_cols = meta.get("feature_cols", [])
        except FileNotFoundError:
            # Fallback: instantiate directly
            _model = TimeProbabilityModel()
            _feature_cols = []
    return _model, _feature_cols


class TritonTimeProbabilityModel:
    """Triton Python backend model for time/session probability."""

    def __init__(self, args: dict):
        self._args = args

    def execute(self, payloads: list) -> list:
        """Run time probability inference on batched JSON inputs."""
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
                print(f"[TimeProbTriton] Error: {exc}")
                results.append(self._build_default(1))

        return results

    def _run_inference(self, parsed: dict) -> dict:
        import pandas as pd
        from models.session.time_probability import TimeProbabilityModel

        trade_log = parsed.get("trade_log", [])
        df = pd.DataFrame(trade_log)

        if df.empty:
            return self._build_default(1)

        model, _ = _get_model_and_features()
        if model is None:
            return self._build_default(1)

        # Add time features
        if "entry_time" in df.columns:
            df["entry_time"] = pd.to_datetime(df["entry_time"])
            df["hour_of_day"] = df["entry_time"].dt.hour
            df["minute_of_hour"] = df["entry_time"].dt.minute
            df["time_bucket_15min"] = (df["minute_of_hour"] // 15) * 15
            df["day_of_week"] = df["entry_time"].dt.dayofweek
        else:
            # Generate dummy features for current time
            from datetime import datetime
            now = datetime.now()
            df["hour_of_day"] = now.hour
            df["minute_of_hour"] = now.minute
            df["time_bucket_15min"] = (now.minute // 15) * 15
            df["day_of_week"] = now.weekday()

        # Compute session statistics
        sessions = df.groupby("session_id") if "session_id" in df.columns else None
        bucket_stats = (
            df.groupby("time_bucket_15min")["result"]
            .apply(lambda x: (x == "WIN").sum() / len(x) if len(x) > 0 else 0.5)
            .to_dict()
        )
        session_stats = (
            {sid: (g["result"] == "WIN").sum() / len(g) if len(g) > 0 else 0.5
             for sid, g in sessions}
            if sessions is not None else {}
        )

        # Current bucket
        now = df["entry_time"].max() if "entry_time" in df.columns else None
        current_bucket = (
            f"{(now.hour * 60 + now.minute) // 15 * 15:04d}"
            if now is not None else "0900"
        )
        bucket_wr = bucket_stats.get(int(current_bucket[:2]) * 4 + int(current_bucket[2:]) // 15, 0.5)
        session_wr = 0.5

        # ML prediction (if model is fitted)
        try:
            ml_model, feature_cols = _get_model_and_features()
            if feature_cols and not df.empty:
                feature_df = df[feature_cols].tail(1)
                proba = ml_model.predict_proba(feature_df)
                p_win = float(proba[0, 1]) if proba.shape[1] >= 2 else 0.5
            else:
                p_win = 0.5
        except Exception:
            p_win = 0.5

        # Blended: 50% ML + 30% bucket + 20% session
        p_profitable = 0.5 * p_win + 0.3 * bucket_wr + 0.2 * session_wr
        confidence = min(abs(p_profitable - 0.5) * 2, 1.0)

        rec = "FAVORABLE" if p_profitable > 0.52 else "UNFAVORABLE" if p_profitable < 0.48 else "NEUTRAL"

        return self._build_output([{
            "p_profitable": p_profitable,
            "confidence": confidence,
            "current_bucket": current_bucket,
            "recommendation": rec,
        }])

    def _build_output(self, results: list) -> dict:
        n = len(results)
        return {
            "outputs": [
                {"name": "p_profitable",  "data": [r["p_profitable"]  for r in results], "shape": [n], "dtype": "TYPE_FP32"},
                {"name": "confidence",     "data": [r["confidence"]     for r in results], "shape": [n], "dtype": "TYPE_FP32"},
                {"name": "current_bucket", "data": [r["current_bucket"] for r in results], "shape": [n], "dtype": "TYPE_STRING"},
                {"name": "recommendation", "data": [r["recommendation"] for r in results], "shape": [n], "dtype": "TYPE_STRING"},
            ]
        }

    def _build_default(self, batch_size: int) -> dict:
        return {
            "outputs": [
                {"name": "p_profitable",  "data": [0.5] * batch_size,  "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "confidence",     "data": [0.0] * batch_size,  "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "current_bucket", "data": ["0900"] * batch_size, "shape": [batch_size], "dtype": "TYPE_STRING"},
                {"name": "recommendation", "data": ["NEUTRAL"] * batch_size, "shape": [batch_size], "dtype": "TYPE_STRING"},
            ]
        }
