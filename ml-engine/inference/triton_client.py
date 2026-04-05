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
import math
from pathlib import Path
from typing import Optional

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import tritonclient.grpc as grpcclient
    TRITON_AVAILABLE = True
except ImportError:
    TRITON_AVAILABLE = False

try:
    import onnxruntime as ort
    ORT_AVAILABLE = True
except ImportError:
    ORT_AVAILABLE = False

try:
    from infrastructure.prometheus_exporter import (
        record_inference_latency,
        record_triton_roundtrip,
        record_inference_request,
        record_inference_error,
        set_triton_server_up,
        PROMETHEUS_AVAILABLE as _PROM_AVAILABLE,
    )
except ImportError:
    record_inference_latency = None
    record_triton_roundtrip = None
    record_inference_request = None
    record_inference_error = None
    set_triton_server_up = None
    _PROM_AVAILABLE = False


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
        self.use_ssl = use_ssl
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
                ssl=self.use_ssl,
            )
            if self._grpc_client.is_server_live():
                try:
                    index = self._grpc_client.get_model_repository_index()
                    model_count = len(index)
                except Exception:
                    model_count = 0
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
            if record_inference_latency and _PROM_AVAILABLE:
                record_inference_latency(
                    latency_seconds=(time.perf_counter() - t0),
                    source="triton",
                    batch_size=len(flat_features),
                )
            if record_inference_request and _PROM_AVAILABLE:
                record_inference_request(model=model)
            if set_triton_server_up and _PROM_AVAILABLE:
                set_triton_server_up(True)
            return result

        # ONNX Runtime local fallback
        if ORT_AVAILABLE:
            result = self._onnx_local_predict(flat_features, model, feature_cols)
            result["source"] = "onnx_local"
            result["inference_ms"] = round((time.perf_counter() - t0) * 1000, 2)
            if record_inference_latency and _PROM_AVAILABLE:
                record_inference_latency(
                    latency_seconds=(time.perf_counter() - t0),
                    source="onnx_local",
                    batch_size=len(flat_features),
                )
            if record_inference_request and _PROM_AVAILABLE:
                record_inference_request(model=model)
            return result

        # sklearn fallback
        result = self._sklearn_local_predict(flat_features, model, feature_cols)
        result["source"] = "sklearn_local"
        result["inference_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        if record_inference_latency and _PROM_AVAILABLE:
            record_inference_latency(
                latency_seconds=(time.perf_counter() - t0),
                source="sklearn_local",
                batch_size=len(flat_features),
            )
        if record_inference_request and _PROM_AVAILABLE:
            record_inference_request(model=model)
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

            triton_t0 = time.perf_counter()
            response = self._grpc_client.infer(model_name, inputs, outputs=outputs)
            triton_roundtrip_sec = time.perf_counter() - triton_t0
            if record_triton_roundtrip and _PROM_AVAILABLE:
                record_triton_roundtrip(triton_roundtrip_sec)

            p_long = response.as_numpy("prob_long")
            p_short = response.as_numpy("prob_short")
            confidence = response.as_numpy("confidence")
            signals = response.as_numpy("signal")

            return self._build_result(p_long, p_short, confidence, signals)

        except Exception as e:
            error_type = type(e).__name__
            if record_inference_error and _PROM_AVAILABLE:
                record_inference_error(model_name, error_type)
            if set_triton_server_up and _PROM_AVAILABLE:
                set_triton_server_up(False)
            print(f"[Triton] gRPC error: {e}, falling back to local inference")
            self._grpc_client = None  # Disable Triton for future calls
            if ORT_AVAILABLE:
                return self._onnx_local_predict(features, model_name, self._get_feature_cols(model_name))
            return self._sklearn_local_predict(features, model_name, self._get_feature_cols(model_name))

    def _onnx_local_predict(
        self,
        features: list[list[float]],
        model_name: str,
        feature_cols: list[str],
    ) -> dict:
        """Run ONNX inference locally via ONNX Runtime."""
        if model_name not in self._ort_sessions:
            onnx_files = sorted(
                self._onnx_dir.glob(f"{model_name}*.onnx"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
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

        # Parse ONNX outputs across common classifier formats:
        # - tensor probabilities [N,2]
        # - label tensor [N] + probabilities tensor [N,2]
        # - label tensor [N] + zipmap list[dict]
        probabilities = None
        for output in result:
            if isinstance(output, np.ndarray) and output.ndim == 2 and output.shape[1] >= 2:
                probabilities = output.astype(np.float32, copy=False)
                break

        if probabilities is None:
            for output in result:
                if isinstance(output, list) and output and isinstance(output[0], dict):
                    class_keys = sorted({k for row in output for k in row.keys()})
                    if len(class_keys) >= 2:
                        neg_key, pos_key = class_keys[0], class_keys[-1]
                        probabilities = np.array(
                            [
                                [float(row.get(neg_key, 0.0)), float(row.get(pos_key, 0.0))]
                                for row in output
                            ],
                            dtype=np.float32,
                        )
                        break

        if probabilities is not None:
            p_short = probabilities[:, 0]
            p_long = probabilities[:, 1]
        else:
            raw = result[0]
            if not isinstance(raw, np.ndarray):
                raise TypeError(
                    f"Unsupported ONNX output format for {model_name}: {type(raw).__name__}"
                )

            raw = np.asarray(raw, dtype=np.float32)
            if raw.ndim == 2 and raw.shape[1] >= 2:
                p_short = raw[:, 0]
                p_long = raw[:, 1]
            else:
                p_long = np.clip(raw.reshape(-1), 0.0, 1.0)
                p_short = 1.0 - p_long

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
                raw_signal = signals[i]
                if isinstance(raw_signal, bytes):
                    raw_signal = raw_signal.decode("utf-8", errors="ignore")
                signal = str(raw_signal).upper()
                if signal not in {"LONG", "SHORT", "NEUTRAL"}:
                    signal = "LONG" if float(p_long[i]) >= float(p_short[i]) else "SHORT"

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
            index = self._grpc_client.get_model_repository_index()
            for model in index:
                if isinstance(model, dict):
                    models.append(
                        {
                            "name": model.get("name", ""),
                            "version": str(model.get("version", "")),
                            "state": model.get("state", ""),
                        }
                    )
                else:
                    models.append(
                        {
                            "name": getattr(model, "name", ""),
                            "version": str(getattr(model, "version", "")),
                            "state": getattr(model, "state", ""),
                        }
                    )

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
        target_p99_ms = float(os.environ.get("INFERENCE_P99_TARGET_MS", "100"))

        # Generate synthetic features
        features = [[0.0] * n_features for _ in range(n_samples)]

        # Warm up model/session once so cold-start initialization does not skew p99.
        warmup_batch = features[: min(batch_size, n_samples)]
        if warmup_batch:
            self.predict(warmup_batch, model_name=model)

        total_t0 = time.perf_counter()
        latencies = []
        sources = set()

        for i in range(0, n_samples, batch_size):
            batch = features[i : i + batch_size]
            call_t0 = time.perf_counter()
            result = self.predict(batch, model_name=model)
            latencies.append((time.perf_counter() - call_t0) * 1000)
            if isinstance(result, dict) and result.get("source"):
                sources.add(result["source"])

        total_ms = (time.perf_counter() - total_t0) * 1000

        if not latencies:
            return {
                "model": model,
                "source": "unknown",
                "n_samples": n_samples,
                "batch_size": batch_size,
                "total_ms": round(total_ms, 2),
                "p50_ms": 0.0,
                "p95_ms": 0.0,
                "p99_ms": 0.0,
                "throughput_samples_per_sec": 0.0,
                "target_p99_ms": target_p99_ms,
                "meets_p99_target": True,
            }

        sorted_lat = sorted(latencies)
        def percentile(p: float) -> float:
            idx = max(0, min(len(sorted_lat) - 1, math.ceil(len(sorted_lat) * p) - 1))
            return sorted_lat[idx]

        p50 = percentile(0.50)
        p95 = percentile(0.95)
        p99 = percentile(0.99)
        return {
            "model": model,
            "source": next(iter(sources)) if len(sources) == 1 else ("mixed" if sources else "unknown"),
            "n_samples": n_samples,
            "batch_size": batch_size,
            "total_ms": round(total_ms, 2),
            "p50_ms": round(p50, 2),
            "p95_ms": round(p95, 2),
            "p99_ms": round(p99, 2),
            "throughput_samples_per_sec": round(n_samples / (total_ms / 1000), 1),
            "target_p99_ms": round(target_p99_ms, 2),
            "meets_p99_target": bool(p99 <= target_p99_ms),
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
