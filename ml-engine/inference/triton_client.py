"""
Triton Inference Client — calls Triton server via gRPC for GPU-accelerated predictions.

Usage:
  from ml_engine.inference.triton_client import TritonInferenceClient
  client = TritonInferenceClient("localhost:8001")
  result = client.predict(features=[[0.1, 0.2, ...]], model_name="lightgbm_direction")

Environment:
  TRITON_URL: Triton gRPC URL (default: localhost:8001)
  TRITON_MODEL: Default model name (default: lightgbm_direction)
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Optional

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import tritonclient.grpc as grpcclient
    import tritonclient.http as httpclient
    from tritonclient.utils import np_to_triton_dtype
    TRITON_AVAILABLE = True
except ImportError:
    TRITON_AVAILABLE = False

try:
    import onnxruntime as ort
    ORT_AVAILABLE = True
except ImportError:
    ORT_AVAILABLE = False


class TritonInferenceClient:
    """
    Client for Triton Inference Server.

    Priority:
      1. Triton gRPC (GPU inference) — < 50ms p99 target
      2. ONNX Runtime local (CPU fallback) — for when Triton is not running
      3. sklearn joblib fallback — last resort
    """

    def __init__(
        self,
        url: str | None = None,
        model_name: str = "lightgbm_direction",
        use_ssl: bool = False,
        verbose: bool = False,
    ):
        self.url = url or os.environ.get("TRITON_URL", "localhost:8001")
        self.default_model = model_name
        self._grpc_client = None
        self._ort_sessions: dict[str, ort.InferenceSession] = {}
        self._onnx_dir = PROJECT_ROOT / "ml-engine" / "models" / "onnx"
        self._verbose = verbose

        # Try to connect to Triton
        if TRITON_AVAILABLE:
            self._connect()

    def _connect(self):
        """Connect to Triton gRPC endpoint."""
        try:
            self._grpc_client = grpcclient.InferenceServerClient(
                url=self.url,
                verbose=self._verbose,
                ssl=False,
            )
            if self._grpc_client.is_server_live():
                model_count = len(self._grpc_client.get_model_config().config.name)
                print(f"[Triton] Connected to {self.url}, {model_count} models available")
            else:
                print(f"[Triton] Warning: server at {self.url} not live, falling back to local")
                self._grpc_client = None
        except Exception as e:
            print(f"[Triton] Could not connect to {self.url}: {e}. Using local inference.")
            self._grpc_client = None

    def predict(
        self,
        features: list[list[float]] | list[dict],
        model_name: str | None = None,
        return_dict: bool = True,
    ) -> dict:
        """
        Run inference via Triton (or local fallback).

        Args:
            features: List of feature vectors. Each element is either:
                      - list[float]: flat feature vector
                      - dict: named features (will be aligned to model's feature_cols)
            model_name: Triton model name (default: self.default_model)
            return_dict: Return detailed dict (True) or just predictions (False)

        Returns:
            dict with keys: signal, confidence, probability_long, probability_short,
                           inference_ms, source ("triton" | "onnx_local" | "sklearn_local")
        """
        model = model_name or self.default_model
        t0 = time.perf_counter()

        # Convert dict features to flat vectors
        flat_features, feature_cols = self._normalize_features(features, model)

        # Try Triton first
        if self._grpc_client is not None:
            result = self._triton_predict(flat_features, model)
            result["source"] = "triton"
            result["inference_ms"] = round((time.perf_counter() - t0) * 1000, 2)
            return result

        # ONNX Runtime local fallback
        if ORT_AVAILABLE:
            result = self._onnx_local_predict(flat_features, model, feature_cols)
            result["source"] = "onnx_local"
            result["inference_ms"] = round((time.perf_counter() - t0) * 1000, 2)
            return result

        # sklearn fallback
        result = self._sklearn_local_predict(flat_features, model, feature_cols)
        result["source"] = "sklearn_local"
        result["inference_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        return result

    def _normalize_features(
        self,
        features: list[list[float]] | list[dict],
        model_name: str,
    ) -> tuple[list[list[float]], list[str]]:
        """Normalize input features to flat float arrays."""
        feature_cols = self._get_feature_cols(model_name)

        flat = []
        for item in features:
            if isinstance(item, dict):
                # Dict input: align to feature_cols
                row = [item.get(col, 0.0) for col in feature_cols]
            else:
                row = list(item)
                # Pad/truncate to expected length
                if len(row) < len(feature_cols):
                    row += [0.0] * (len(feature_cols) - len(row))
                elif len(row) > len(feature_cols):
                    row = row[: len(feature_cols)]

            flat.append(row)

        return flat, feature_cols

    def _get_feature_cols(self, model_name: str) -> list[str]:
        """Get feature columns for a model from ONNX metadata."""
        meta_files = list(self._onnx_dir.glob(f"{model_name}*.onnx.meta.json"))
        if meta_files:
            import json
            with open(meta_files[0]) as f:
                return json.load(f).get("feature_cols", [])

        # Fallback: try model store
        try:
            from training.model_store import ModelStore
            store = ModelStore()
            _, meta = store.load(model_name, "latest")
            return meta.get("feature_cols", [])
        except Exception:
            return []

    def _triton_predict(
        self,
        features: list[list[float]],
        model_name: str,
    ) -> dict:
        """Run inference via Triton gRPC."""
        try:
            X = np.array(features, dtype=np.float32)

            inputs = [grpcclient.InferInput("input", X.shape, "FP32")]
            inputs[0].set_data_from_numpy(X)

            outputs = [
                grpcclient.InferRequestedOutput("prob_long"),
                grpcclient.InferRequestedOutput("prob_short"),
                grpcclient.InferRequestedOutput("confidence"),
                grpcclient.InferRequestedOutput("signal"),
            ]

            response = self._grpc_client.infer(model_name, inputs, outputs=outputs)

            p_long = response.as_numpy("prob_long")
            p_short = response.as_numpy("prob_short")
            confidence = response.as_numpy("confidence")
            signals = response.as_numpy("signal")

            return self._build_result(p_long, p_short, confidence, signals)

        except Exception as e:
            print(f"[Triton] gRPC error: {e}, falling back to local inference")
            self._grpc_client = None  # Disable Triton for future calls
            return self._onnx_local_predict(features, model_name, self._get_feature_cols(model_name))

    def _onnx_local_predict(
        self,
        features: list[list[float]],
        model_name: str,
        feature_cols: list[str],
    ) -> dict:
        """Run ONNX inference locally via ONNX Runtime."""
        if model_name not in self._ort_sessions:
            onnx_files = list(self._onnx_dir.glob(f"{model_name}*.onnx"))
            if not onnx_files:
                raise FileNotFoundError(f"No ONNX model found for {model_name}")

            providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
            available = ort.get_available_providers()
            active = [p for p in providers if p in available]

            self._ort_sessions[model_name] = ort.InferenceSession(
                str(onnx_files[0]),
                providers=active if active else ["CPUExecutionProvider"],
            )

        session = self._ort_sessions[model_name]
        input_name = session.get_inputs()[0].name
        output_names = [o.name for o in session.get_outputs()]

        X = np.array(features, dtype=np.float32)
        result = session.run(output_names, {input_name: X})

        # Parse outputs
        if len(result) >= 2:
            p_long = result[0][:, 1] if result[0].ndim > 1 else result[0]
            p_short = result[1] if len(result) > 1 else 1 - p_long
        else:
            proba = result[0]
            p_long = proba[:, 1] if proba.ndim > 1 and proba.shape[1] == 2 else proba
            p_short = 1 - p_long

        confidence = np.maximum(p_long, p_short)
        signals = np.where(
            confidence < 0.52, "NEUTRAL",
            np.where(p_long >= p_short, "LONG", "SHORT"),
        )

        return self._build_result(p_long, p_short, confidence, signals)

    def _sklearn_local_predict(
        self,
        features: list[list[float]],
        model_name: str,
        feature_cols: list[str],
    ) -> dict:
        """sklearn/joblib fallback inference."""
        import joblib
        from training.model_store import ModelStore

        store = ModelStore()
        pipeline, _ = store.load(model_name, "latest")

        X = np.array(features, dtype=np.float32)
        proba = pipeline.predict_proba(X)

        p_long = proba[:, 1] if proba.shape[1] == 2 else np.full(len(X), 0.5)
        p_short = 1 - p_long
        confidence = np.maximum(p_long, p_short)
        signals = np.where(
            confidence < 0.52, "NEUTRAL",
            np.where(p_long >= p_short, "LONG", "SHORT"),
        )

        return self._build_result(p_long, p_short, confidence, signals)

    def _build_result(
        self,
        p_long: np.ndarray,
        p_short: np.ndarray,
        confidence: np.ndarray,
        signals: np.ndarray,
    ) -> dict:
        """Build result dict from numpy outputs."""
        results = []
        for i in range(len(p_long)):
            conf = float(confidence[i])
            if conf < 0.52:
                signal = "NEUTRAL"
            else:
                signal = str(signals[i]) if signals.dtype.kind == 'U' else (
                    "LONG" if float(p_long[i]) >= float(p_short[i]) else "SHORT"
                )

            results.append({
                "signal": signal,
                "confidence": round(conf, 4),
                "probability_long": round(float(p_long[i]), 4),
                "probability_short": round(float(p_short[i]), 4),
            })

        if len(results) == 1:
            return results[0]

        return {"predictions": results}

    def get_server_status(self) -> dict:
        """Get Triton server status and loaded models."""
        if self._grpc_client is None:
            return {
                "connected": False,
                "url": self.url,
                "models": [],
                "fallback": "onnx_local" if ORT_AVAILABLE else "sklearn_local",
            }

        try:
            models = []
            for m in self._grpc_client.get_model_config().config:
                models.append({"name": m.name, "version": m.version})

            return {
                "connected": True,
                "url": self.url,
                "server_live": self._grpc_client.is_server_live(),
                "server_ready": self._grpc_client.is_server_ready(),
                "models": models,
            }
        except Exception as e:
            return {"connected": False, "error": str(e), "fallback": "onnx_local"}

    def benchmark(
        self,
        n_samples: int = 1000,
        batch_size: int = 32,
        model_name: str | None = None,
    ) -> dict:
        """
        Benchmark inference latency.

        Returns p50, p95, p99 latency in ms.
        """
        import json

        model = model_name or self.default_model
        feature_cols = self._get_feature_cols(model)
        n_features = len(feature_cols) or 50

        # Generate synthetic features
        features = [[0.0] * n_features for _ in range(n_samples)]

        t0 = time.perf_counter()
        latencies = []

        for i in range(0, n_samples, batch_size):
            batch = features[i : i + batch_size]
            _ = self.predict(batch, model_name=model)
            lat = (time.perf_counter() - t0) * 1000 / ((i // batch_size) + 1)
            latencies.append(lat)

        total_ms = (time.perf_counter() - t0) * 1000

        latencies.sort()
        return {
            "model": model,
            "source": self._grpc_client is not None and "triton" or "onnx_local",
            "n_samples": n_samples,
            "batch_size": batch_size,
            "total_ms": round(total_ms, 2),
            "p50_ms": round(latencies[int(len(latencies) * 0.50)], 2),
            "p95_ms": round(latencies[int(len(latencies) * 0.95)], 2),
            "p99_ms": round(latencies[int(len(latencies) * 0.99)], 2),
            "throughput_samples_per_sec": round(n_samples / (total_ms / 1000), 1),
        }


def get_inference_client() -> TritonInferenceClient:
    """
    Factory: create the best available inference client.
    Priority: Triton gRPC → ONNX Runtime local → sklearn fallback.
    """
    url = os.environ.get("TRITON_URL", "localhost:8001")
    return TritonInferenceClient(url=url)


if __name__ == "__main__":
    print("[Triton] Inference Client")
    print("Usage: from ml_engine.inference.triton_client import get_inference_client")

    client = TritonInferenceClient()
    status = client.get_server_status()
    print(f"Status: {status}")
