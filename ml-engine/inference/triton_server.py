"""
Triton Inference Server — launches and manages the Triton server process.

Usage:
  python -m ml_engine.inference.triton_server --start
  python -m ml_engine.inference.triton_server --status
  python -m ml_engine.inference.triton_server --stop
  python -m ml_engine.inference.triton_server --setup   # export models to Triton repo

Environment:
  TRITON_MODEL_REPO: Path to Triton model repository (default: ml-engine/models/triton_repo)
  TRITON_PORT_HTTP:  HTTP port (default: 8000)
  TRITON_PORT_GRPC:  gRPC port (default: 8001)
  TRITON_PORT_METRICS: Metrics port (default: 8002)
  TRITON_DEVICE:     Device: "gpu" or "cpu" (default: gpu if available)
"""

from __future__ import annotations

import os
import sys
import json
import time
import signal
import subprocess
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# ─── Model Repository Setup ────────────────────────────────────────────────────

TRITON_REPO = PROJECT_ROOT / "models" / "triton_repo"
ONNX_DIR = PROJECT_ROOT / "models" / "onnx"


def setup_model_repository():
    """
    Set up the Triton model repository by copying ONNX files into
    the expected directory structure.

    Directory structure:
      {model_name}/
        1/
          config.pbtxt
          model.onnx
        config.pbtxt  ← version directory (Triton uses version subdirs)
    """
    TRITON_REPO.mkdir(parents=True, exist_ok=True)

    # Copy ONNX files into model repository structure
    onnx_files = list(ONNX_DIR.glob("*.onnx"))

    if not onnx_files:
        print("[Triton] No ONNX models found. Run:")
        print("  python -m ml_engine.inference.onnx_exporter --all")
        return

    for onnx_file in onnx_files:
        # Parse model name from filename: {model_name}_{version}.onnx
        stem = onnx_file.stem  # e.g., "lightgbm_direction_20260403_143000"
        parts = stem.rsplit("_", 1)
        if len(parts) == 2:
            model_name = parts[0]
        else:
            model_name = stem

        # Create version directory
        version_dir = TRITON_REPO / model_name / "1"
        version_dir.mkdir(parents=True, exist_ok=True)

        # Copy ONNX model
        dest_onnx = version_dir / "model.onnx"
        dest_onnx.write_bytes(onnx_file.read_bytes())

        # Copy metadata
        meta_file = onnx_file.with_suffix(".onnx.meta.json")
        if meta_file.exists():
            dest_meta = version_dir / "model.onnx.meta.json"
            dest_meta.write_bytes(meta_file.read_bytes())

        # Generate config.pbtxt if not exists
        config_file = version_dir / "config.pbtxt"
        if not config_file.exists():
            _write_config_pbtxt(config_file, model_name, meta_file if meta_file.exists() else None)

        print(f"[Triton] Registered: {model_name} → {version_dir}")


def _write_config_pbtxt(path: Path, model_name: str, meta_file: Path | None):
    """Write a Triton model config.pbtxt for an ONNX model."""
    n_features = 50  # default, will be updated from metadata
    feature_cols = []

    if meta_file and meta_file.exists():
        with open(meta_file) as f:
            meta = json.load(f)
        n_features = meta.get("n_features", 50)
        feature_cols = meta.get("feature_cols", [])

    config = f"""name: "{model_name}"
platform: "onnxruntime_onnx"
max_batch_size: 64
version_policy: {{ specific: {{ versions: [1] }}}}

input [
  {{
    name: "input"
    data_type: TYPE_FP32
    dims: [{n_features}]
  }}
]

output [
  {{
    name: "prob_long"
    data_type: TYPE_FP32
    dims: [-1]
  }},
  {{
    name: "prob_short"
    data_type: TYPE_FP32
    dims: [-1]
  }},
  {{
    name: "confidence"
    data_type: TYPE_FP32
    dims: [-1]
  }},
  {{
    name: "signal"
    data_type: TYPE_STRING
    dims: [-1]
  }}
]

instance_group [
  {{
    count: 1
    kind: KIND_GPU
  }}
]

dynamic_batching {{
  preferred_batch_size: [1, 8, 16, 32]
  max_queue_delay_microseconds: 100
}}

optimization {{
  input_pinned_memory: {{ enable: true }}
  output_padded_memory: {{ enable: true }}
}}
"""
    path.write_text(config)


# ─── Server Process Management ─────────────────────────────────────────────────

class TritonServer:
    """
    Manages the Triton Inference Server process.
    """

    def __init__(self, model_repo: str | Path | None = None):
        self.model_repo = Path(model_repo or TRITON_REPO)
        self.process: Optional[subprocess.Popen] = None
        self.grpc_port = int(os.environ.get("TRITON_PORT_GRPC", "8001"))
        self.http_port = int(os.environ.get("TRITON_PORT_HTTP", "8000"))
        self.metrics_port = int(os.environ.get("TRITON_PORT_METRICS", "8002"))

        self._check_gpu()

    def _check_gpu(self):
        """Check if GPU is available for inference."""
        try:
            import torch
            if torch.cuda.is_available():
                self._gpu_count = torch.cuda.device_count()
                self._gpu_name = torch.cuda.get_device_name(0)
                print(f"[Triton] GPU available: {self._gpu_name} ({self._gpu_count} device(s))")
                self._record_gpu_prometheus()
            else:
                self._gpu_count = 0
                print("[Triton] No GPU — will run CPU-only inference")
        except ImportError:
            self._gpu_count = 0
            print("[Triton] PyTorch not available — CPU inference only")

    def _record_gpu_prometheus(self):
        """Record GPU metrics to Prometheus on startup."""
        try:
            from infrastructure.prometheus_exporter import record_gpu_metrics, PROMETHEUS_AVAILABLE
            if PROMETHEUS_AVAILABLE and record_gpu_metrics:
                record_gpu_metrics()
                print("[Triton] GPU metrics exported to Prometheus")
        except Exception:
            pass

    def _build_command(self, model_repo: Path | None = None) -> list[str]:
        """Build the Triton server launch command."""
        repo = model_repo or self.model_repo

        if not repo.exists():
            print(f"[Triton] Model repo not found at {repo}")
            print(f"[Triton] Running setup first...")
            setup_model_repository()

        cmd = [
            "tritonserver",
            f"--model-repository={repo}",
            f"--http-port={self.http_port}",
            f"--grpc-port={self.grpc_port}",
            f"--metrics-port={self.metrics_port}",
            "--allow-http=True",
            "--allow-grpc=True",
            "--allow-metrics=True",
            "--log-verbose=1",
        ]

        if self._gpu_count == 0:
            cmd.append("--no-backend-polling")

        return cmd

    def start(self, wait_ready: bool = True, timeout: int = 60) -> bool:
        """
        Start the Triton server process.

        Args:
            wait_ready: Block until server is ready
            timeout: Max seconds to wait for ready
        """
        if self.process is not None:
            print("[Triton] Server already running (PID: {})".format(self.process.pid))
            return True

        cmd = self._build_command()
        print(f"[Triton] Starting: {' '.join(cmd)}")

        # Check if tritonserver is available
        try:
            subprocess.run(["tritonserver", "--version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("[Triton] ERROR: tritonserver not found in PATH")
            print("[Triton] Install Triton: https://github.com/triton-inference-server/server/releases")
            print("[Triton] Or use Docker:")
            print("  docker run --rm -p 8000:8000 -p 8001:8001 -p 8002:8002 \\")
            print(f"    -v {self.model_repo}:/models nvcr.io/nvidia/tritonserver:24.04-py3 \\")
            print("    tritonserver --model-repository=/models")
            return False

        self.process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        if wait_ready:
            return self._wait_ready(timeout)

        return True

    def _wait_ready(self, timeout: int) -> bool:
        """Wait for server to become ready."""
        print(f"[Triton] Waiting for server ready (timeout: {timeout}s)...")
        deadline = time.time() + timeout

        while time.time() < deadline:
            if self.process.poll() is not None:
                stdout, stderr = self.process.communicate()
                print(f"[Triton] Process exited: {self.process.returncode}")
                print(f"[Triton] stdout: {stdout.decode()[:500]}")
                print(f"[Triton] stderr: {stderr.decode()[:500]}")
                return False

            # Check via gRPC
            try:
                import tritonclient.grpc as grpcclient
                client = grpcclient.InferenceServerClient(
                    url=f"localhost:{self.grpc_port}",
                    verbose=False,
                )
                if client.is_server_ready():
                    print(f"[Triton] Server ready at localhost:{self.grpc_port} (gRPC)")
                    return True
            except Exception:
                pass

            time.sleep(2)

        print(f"[Triton] Timeout waiting for server to become ready")
        return False

    def stop(self):
        """Stop the Triton server process."""
        if self.process is None:
            print("[Triton] No process running")
            return

        print(f"[Triton] Stopping PID {self.process.pid}...")
        self.process.terminate()
        try:
            self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait()
        print("[Triton] Stopped")
        self.process = None

    def status(self) -> dict:
        """Get server status."""
        if self.process is None or self.process.poll() is not None:
            return {"running": False, "pid": None}

        status = {"running": True, "pid": self.process.pid, "gpu_count": self._gpu_count}

        try:
            import tritonclient.grpc as grpcclient
            client = grpcclient.InferenceServerClient(
                url=f"localhost:{self.grpc_port}",
                verbose=False,
            )
            status["server_live"] = client.is_server_live()
            status["server_ready"] = client.is_server_ready()
        except Exception:
            pass

        return status


# ─── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Triton Inference Server manager")
    parser.add_argument("--start", action="store_true", help="Start the server")
    parser.add_argument("--stop", action="store_true", help="Stop the server")
    parser.add_argument("--status", action="store_true", help="Check server status")
    parser.add_argument("--setup", action="store_true", help="Set up model repository")
    parser.add_argument("--model-repo", type=str, default=None, help="Model repository path")
    args = parser.parse_args()

    server = TritonServer(model_repo=args.model_repo)

    if args.setup:
        setup_model_repository()
        print(f"[Triton] Model repository ready at: {TRITON_REPO}")
        return

    if args.status:
        status = server.status()
        print(f"[Triton] Status: {status}")
        return

    if args.stop:
        server.stop()
        return

    if args.start:
        success = server.start(wait_ready=True)
        if success:
            print(f"[Triton] Server running: localhost:{server.grpc_port} (gRPC)")
        else:
            print("[Triton] Failed to start server")
            print("\nDocker alternative:")
            print(f"  docker run --gpus all -p {server.http_port}:8000 -p {server.grpc_port}:8001 -p {server.metrics_port}:8002 \\")
            print(f"    -v {server.model_repo}:/models nvcr.io/nvidia/tritonserver:24.04-py3 \\")
            print("    tritonserver --model-repository=/models --grpc-port=8001 --http-port=8000")
        return

    # Default: show info
    print(__doc__)
    print("\nCommands:")
    for cmd in ["--setup", "--start", "--status", "--stop"]:
        print(f"  python -m ml_engine.inference.triton_server {cmd}")


if __name__ == "__main__":
    main()
