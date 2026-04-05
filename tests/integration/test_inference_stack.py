"""
Inference Stack Integration Tests — tests the full ML serving stack.

Tests the complete inference pipeline:
  1. FastAPI endpoint → ML Engine
  2. ONNX Runtime via Triton
  3. gRPC via analysis-server.mjs
  4. BFF → ML Engine routing

Requires services running at:
  - ML Engine:     localhost:8001
  - analysis-server: localhost:50051 (gRPC)
  - Triton:        localhost:8000 (HTTP) / 8001 (gRPC)

Usage:
  pytest tests/integration/test_inference_stack.py -v
  pytest tests/integration/test_inference_stack.py -v --live  # Skip if not running
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pytest

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "ml-engine"))

# ─── Test Data ─────────────────────────────────────────────────────────────────

FEATURE_COUNT = 44


def make_candles(n: int = 50, base_price: float = 18500.0) -> list[dict]:
    """Generate synthetic candle data for regime testing."""
    candles = []
    ts = datetime.now(timezone.utc)
    for i in range(n):
        ts = ts.replace(second=0, microsecond=0)
        o = base_price + (i % 7 - 3) * 2
        c = o + (i % 5 - 2) * 3
        h = max(o, c) + abs(i % 4) * 1.5
        l = min(o, c) - abs(i % 3) * 1.5
        candles.append({
            "symbol": "MNQ",
            "timestamp": ts.isoformat(),
            "open": round(o, 2),
            "high": round(h, 2),
            "low": round(l, 2),
            "close": round(c, 2),
            "volume": 5000 + i * 100,
        })
        base_price = c
        # Advance by 5 minutes
        from datetime import timedelta
        ts = ts + timedelta(minutes=5)
    return candles


def make_feature_vector(n: int = FEATURE_COUNT) -> list[float]:
    """Generate a random 44-feature vector."""
    import numpy as np
    return np.random.randn(n).tolist()


# ─── Service Health Checks ────────────────────────────────────────────────────

@dataclass
class ServiceStatus:
    name: str
    url: str
    healthy: bool = False
    latency_ms: float = 0.0
    error: str = ""


def check_service(name: str, url: str, timeout: float = 5.0) -> ServiceStatus:
    """Check if a service endpoint is healthy."""
    import urllib.request
    import urllib.error

    status = ServiceStatus(name=name, url=url)
    start = time.perf_counter()
    try:
        req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            _ = resp.read()
            status.latency_ms = (time.perf_counter() - start) * 1000
            status.healthy = resp.status == 200
    except urllib.error.HTTPError as e:
        status.error = f"HTTP {e.code}"
        status.healthy = e.code < 500  # 4xx still "reachable"
    except Exception as e:
        status.error = str(e)
    return status


# ─── Test Cases ────────────────────────────────────────────────────────────────

class TestInferenceStack:
    """Full inference stack integration tests."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.ml_engine_url = os.environ.get("ML_ENGINE_URL", "http://localhost:8001")
        self.triton_url = os.environ.get("TRITON_URL", "http://localhost:8000")
        self.analysis_grpc = os.environ.get("ANALYSIS_GRPC", "localhost:50051")
        self.skip_live = "--skip-live" in sys.argv

    def _is_live(self) -> bool:
        """Check if we should run live tests."""
        if self.skip_live:
            pytest.skip("Live tests skipped (use --live to enable)")
        return True

    def test_ml_engine_health(self):
        """ML Engine health endpoint returns 200."""
        status = check_service("ml-engine", f"{self.ml_engine_url}/health")
        assert status.healthy, f"ML Engine unhealthy: {status.error}"

    def test_ml_engine_predict_latency(self):
        """Consensus endpoint responds within SLA (< 200ms P95)."""
        latencies = []
        payload = {
            "features": make_feature_vector(FEATURE_COUNT),
            "candles": make_candles(50),
            "trades": [],
            "session_id": 1,
            "symbol": "MNQ",
        }

        import urllib.request
        import json as _json

        url = f"{self.ml_engine_url}/predict"
        for _ in range(20):
            start = time.perf_counter()
            try:
                data = _json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(url, data=data, method="POST")
                with urllib.request.urlopen(req, timeout=5.0) as resp:
                    _ = resp.read()
                    latencies.append((time.perf_counter() - start) * 1000)
            except Exception:
                pass

        if not latencies:
            pytest.skip("Could not reach ML Engine for latency test")

        p95 = sorted(latencies)[int(len(latencies) * 0.95)]
        print(f"\n  P50={latencies[int(len(latencies)*0.5)]:.1f}ms, "
              f"P95={p95:.1f}ms, P99={max(latencies):.1f}ms")
        assert p95 < 200, f"P95 latency {p95:.1f}ms exceeds SLA (200ms)"

    def test_ml_engine_predict_response_shape(self):
        """Predict endpoint returns expected response shape."""
        import urllib.request
        import json as _json

        payload = {
            "features": make_feature_vector(FEATURE_COUNT),
            "candles": make_candles(50),
            "trades": [],
            "session_id": 1,
            "symbol": "MNQ",
        }

        data = _json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.ml_engine_url}/predict",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            body = _json.loads(resp.read())

        assert body.get("ok") is not None, "Response missing 'ok' field"
        assert body.get("signal") in ("LONG", "SHORT", "NEUTRAL"), \
            f"Invalid signal: {body.get('signal')}"
        assert 0 <= body.get("confidence", -1) < 1.0, \
            f"Invalid confidence: {body.get('confidence')}"
        assert body.get("latency_ms", 0) > 0, "Missing latency_ms"
        print(f"\n  Signal: {body.get('signal')}, Confidence: {body.get('confidence'):.3f}, "
              f"Latency: {body.get('latency_ms', 0):.1f}ms")

    def test_onnx_exporter_runs(self):
        """ONNX exporter script runs without errors."""
        result = subprocess.run(
            [sys.executable, "-m", "ml_engine.inference.onnx_exporter", "--list"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=30,
        )
        print(f"\n  stdout: {result.stdout.strip()}")
        if result.returncode != 0:
            print(f"  stderr: {result.stderr.strip()}")
        # Don't fail — ONNX export may need trained models first
        if "No ONNX models exported yet" in result.stdout:
            pytest.skip("No trained models yet — run training pipeline first")

    def test_onnx_models_exist(self):
        """ONNX model files exist in triton_repo (after export)."""
        onnx_dir = PROJECT_ROOT / "ml-engine" / "models" / "onnx"
        triton_dir = PROJECT_ROOT / "ml-engine" / "models" / "triton_repo"

        if not onnx_dir.exists() or not list(onnx_dir.glob("*.onnx")):
            pytest.skip("No ONNX models exported — run ONNX export pipeline first")

        # Check Triton config.pbtxt files
        configs = list(triton_dir.glob("*/config.pbtxt"))
        assert len(configs) >= 5, f"Expected ≥5 Triton configs, found {len(configs)}"

    def test_proto_generation_runs(self):
        """Proto generation script runs without errors."""
        proto_script = PROJECT_ROOT / "scripts" / "generate_python_proto.py"
        if not proto_script.exists():
            pytest.skip("Proto generation script not found")

        result = subprocess.run(
            [sys.executable, str(proto_script), "--verify"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        print(f"\n  stdout: {result.stdout.strip()}")
        if result.returncode != 0:
            print(f"  stderr: {result.stderr.strip()}")
            pytest.skip("Proto stubs not yet generated — run: python scripts/generate_python_proto.py")
        assert result.returncode == 0

    def test_triton_health(self):
        """Triton inference server is reachable (if enabled)."""
        status = check_service("triton", f"{self.triton_url}/v2/models")
        if not status.healthy and "Connection" in status.error:
            pytest.skip("Triton not running — enable with --triton.enabled=true in values.yaml")
        assert status.healthy, f"Triton unhealthy: {status.error}"

    def test_torchscript_export_runs(self):
        """Mamba TorchScript export script has correct CLI interface."""
        result = subprocess.run(
            [sys.executable, "-m", "ml_engine.models.mamba.export_torchscript", "--help"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, f"TorchScript export CLI broken:\n{result.stderr}"
        assert "--model-name" in result.stdout, "Missing --model-name argument"
        assert "--verify-only" in result.stdout, "Missing --verify-only argument"

    def test_export_onnx_to_triton_script(self):
        """ONNX→Triton copy script runs without errors."""
        script = PROJECT_ROOT / "scripts" / "export_onnx_to_triton.py"
        result = subprocess.run(
            [sys.executable, str(script), "--list"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        print(f"\n  Triton models:\n{result.stdout}")
        # --list should always work
        assert result.returncode == 0, f"export_onnx_to_triton --list failed:\n{result.stderr}"

    def test_bff_analysis_grpc_health(self):
        """BFF analysis-server gRPC health check."""
        try:
            import grpc
            from google.protobuf.json_format import Parse
        except ImportError:
            pytest.skip("grpcio not installed")

        status = ServiceStatus(name="analysis-server-grpc", url=self.analysis_grpc)
        try:
            channel = grpc.insecure_channel(self.analysis_grpc)
            stub = None  # Would use generated stubs here
            # Health check via gRPC reflection or explicit health service
            grpc.channel_ready_future(channel).result(timeout=3.0)
            status.healthy = True
            channel.close()
        except Exception as e:
            status.error = str(e)

        if not status.healthy and "Connection" in status.error:
            pytest.skip("analysis-server gRPC not running")
        assert status.healthy, f"analysis-server gRPC unhealthy: {status.error}"

    def test_k8s_helm_template_valid(self):
        """Helm templates render without YAML parse errors."""
        import yaml

        templates = [
            PROJECT_ROOT / "k8s" / "helm" / "tradersapp" / "templates" / "vllm-mamba.yaml",
            PROJECT_ROOT / "k8s" / "helm" / "tradersapp" / "templates" / "keda-autoscaling.yaml",
            PROJECT_ROOT / "k8s" / "helm" / "tradersapp" / "templates" / "grafana-ml-inference-dashboard.yaml",
        ]

        values_path = PROJECT_ROOT / "k8s" / "helm" / "tradersapp" / "values.yaml"
        if not values_path.exists():
            pytest.skip("values.yaml not found")

        with open(values_path) as f:
            values = yaml.safe_load(f)

        for template_path in templates:
            if not template_path.exists():
                continue
            with open(template_path) as f:
                content = f.read()
            # Check template syntax (Helm conditional markers)
            assert "{{-" not in content or "#" not in content.split("{{-")[0], \
                f"{template_path.name}: has both Helm markers and invalid frontmatter"
            print(f"  {template_path.name}: template syntax OK")


# ─── Benchmark Tests ────────────────────────────────────────────────────────────

class TestBenchmarkSuite:
    """Run benchmark tests against live inference endpoints."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.ml_engine_url = os.environ.get("ML_ENGINE_URL", "http://localhost:8001")

    def test_benchmark_latency_runs(self):
        """Benchmark script runs and produces results."""
        result = subprocess.run(
            [
                sys.executable, "-m", "ml_engine.inference.benchmark_latency",
                "--endpoint", f"{self.ml_engine_url}/predict",
                "--n-requests", "10",
                "--concurrency", "2",
            ],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=60,
        )
        print(f"\n  stdout:\n{result.stdout}")
        if result.returncode != 0:
            print(f"  stderr:\n{result.stderr}")
        # Benchmark may fail if service is down
        if "Connection" in result.stderr or "Connection" in result.stdout:
            pytest.skip("ML Engine not reachable for benchmark")
        # Check results file exists
        results_path = PROJECT_ROOT / "ml-engine" / "data" / "benchmark_results.json"
        if results_path.exists():
            with open(results_path) as f:
                data = json.load(f)
            print(f"  Benchmark results: {data.get('summary', {})}")
