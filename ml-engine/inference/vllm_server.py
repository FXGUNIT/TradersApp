"""
vLLM Inference Server — serves the Mamba sequence model via vLLM.

vLLM provides PagedAttention for memory-efficient LLM inference with:
  - Automatic KV cache management
  - Continuous batching
  - Tensor parallelism
  - Quantization support (AWQ, GPTQ, Fp8)

Usage:
  python -m ml_engine.inference.vllm_server --start
  python -m ml_engine.inference.vllm_server --status
  python -m ml_engine.inference.vllm_server --benchmark

Environment:
  VLLM_MODEL_NAME: HuggingFace model name or local path (default: state-spaces/mamba-2.8b)
  VLLM_PORT: vLLM HTTP port (default: 8003)
  VLLM_GPUS: Number of GPUs for tensor parallelism (default: 1)
  VLLM_QUANTIZATION: Quantization method (AWQ, GPTQ, Fp8) — optional

Docker:
  docker run --gpus all -p 8003:8000 -v ~/.cache/huggingface:/root/.cache/huggingface \
    vllm/vllm-openai:latest \
    --model state-spaces/mamba-2.8b --gpu-memory-utilization 0.85
"""

from __future__ import annotations

import os
import sys
import json
import time
import subprocess
import argparse
import signal
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


# ─── Mamba Feature Extraction ──────────────────────────────────────────────────

def extract_sequence_features(sequence_text: str) -> dict:
    """
    Extract structured features from a market narrative sequence using the Mamba model.

    Input:  Natural language description of recent price action + market context
    Output: Structured feature dict for downstream ML models

    Example:
      Input:  "Gap up 20 ticks, hitting resistance at PDH. Volume 2x average.
               Breaking out of 30-min consolidation. AMD phase shift to ACCUMULATION."
      Output: {
        "mamba_direction_score": 0.73,
        "mamba_momentum_score": 0.82,
        "mamba_regime_confidence": 0.91,
        "mamba_narrative_summary": "bullish breakout from consolidation",
        "mamba_features": [0.73, 0.82, 0.91, ...]
      }
    """
    # Placeholder — requires vLLM running with a fine-tuned Mamba model
    # In production: POST to vLLM OpenAI-compatible API
    return {
        "mamba_direction_score": 0.5,
        "mamba_momentum_score": 0.5,
        "mamba_regime_confidence": 0.5,
        "mamba_narrative_summary": "unavailable (vllm not running)",
        "mamba_features": [0.5] * 16,
        "note": "Set VLLM_URL to enable Mamba inference",
    }


def call_vllm(prompt: str, model: str = "mamba-sequence") -> dict:
    """
    Call vLLM server for sequence model inference.

    Uses the OpenAI-compatible API:
      POST http://localhost:8003/v1/completions
    """
    vllm_url = os.environ.get("VLLM_URL", "http://localhost:8003")
    model_name = os.environ.get("VLLM_MODEL_NAME", "mamba-sequence")

    try:
        import requests
        response = requests.post(
            f"{vllm_url}/v1/completions",
            json={
                "model": model_name,
                "prompt": prompt,
                "max_tokens": 64,
                "temperature": 0.1,
                "stream": False,
            },
            timeout=10,
        )
        response.raise_for_status()
        result = response.json()

        text = result["choices"][0]["text"]
        return _parse_sequence_output(text)

    except Exception as e:
        return extract_sequence_features(prompt)


def _parse_sequence_output(text: str) -> dict:
    """Parse structured output from the Mamba model."""
    # The fine-tuned Mamba model outputs JSON: {"dir": 0.73, "mom": 0.82, ...}
    try:
        data = json.loads(text.strip())
        return {
            "mamba_direction_score": float(data.get("dir", 0.5)),
            "mamba_momentum_score": float(data.get("mom", 0.5)),
            "mamba_regime_confidence": float(data.get("reg_conf", 0.5)),
            "mamba_narrative_summary": data.get("summary", text[:100]),
            "mamba_features": [
                float(data.get(k, 0.5))
                for k in ["dir", "mom", "reg_conf", "vol", "trend", "rev", "amd", "vr"]
            ],
        }
    except json.JSONDecodeError:
        return {
            "mamba_direction_score": 0.5,
            "mamba_momentum_score": 0.5,
            "mamba_regime_confidence": 0.5,
            "mamba_narrative_summary": text[:200],
            "mamba_features": [0.5] * 16,
        }


# ─── vLLM Server Process ────────────────────────────────────────────────────────

class VLLMServer:
    """
    Manages the vLLM server process for Mamba model serving.
    """

    def __init__(self):
        self.model_name = os.environ.get("VLLM_MODEL_NAME", "state-spaces/mamba-2.8b-slim")
        self.port = int(os.environ.get("VLLM_PORT", "8003"))
        self.gpus = int(os.environ.get("VLLM_GPUS", "1"))
        self.quantization = os.environ.get("VLLM_QUANTIZATION", None)
        self.process: Optional[subprocess.Popen] = None

    def start(self, wait_ready: bool = True, timeout: int = 120) -> bool:
        """
        Start the vLLM server.

        Uses the vLLM OpenAI-compatible server (uvicorn + vLLM engine).
        """
        print(f"[vLLM] Starting model: {self.model_name} on port {self.port}")

        cmd = [
            sys.executable, "-m", "vllm.entrypoints.openai.api_server",
            "--model", self.model_name,
            "--port", str(self.port),
            "--gpu-memory-utilization", "0.85",
            "--max-model-len", "4096",
        ]

        if self.gpus > 1:
            cmd += ["--tensor-parallel-size", str(self.gpus)]

        if self.quantization:
            cmd += ["--quantization", self.quantization]

        print(f"[vLLM] Command: {' '.join(cmd)}")

        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
        except FileNotFoundError:
            print("[vLLM] ERROR: vLLM not installed")
            print("[vLLM] Install: pip install vllm")
            print("[vLLM] Or use Docker:")
            print(f"  docker run --gpus {self.gpus} -p {self.port}:8000 \\")
            print(f"    vllm/vllm-openai:latest --model {self.model_name}")
            return False

        if wait_ready:
            return self._wait_ready(timeout)

        return True

    def _wait_ready(self, timeout: int) -> bool:
        """Wait for vLLM server to become ready."""
        print(f"[vLLM] Waiting for server ready (timeout: {timeout}s)...")
        deadline = time.time() + timeout

        while time.time() < deadline:
            if self.process and self.process.poll() is not None:
                stdout, stderr = self.process.communicate()
                print(f"[vLLM] Process exited: {self.process.returncode}")
                print(f"[vLLM] stdout: {stdout.decode()[:300]}")
                print(f"[vLLM] stderr: {stderr.decode()[:300]}")
                return False

            try:
                import requests
                resp = requests.get(f"http://localhost:{self.port}/v1/models", timeout=5)
                if resp.status_code == 200:
                    print(f"[vLLM] Server ready at http://localhost:{self.port}")
                    return True
            except Exception:
                pass

            time.sleep(5)

        print("[vLLM] Timeout waiting for server")
        return False

    def stop(self):
        """Stop the vLLM server."""
        if self.process is None:
            return

        print("[vLLM] Stopping...")
        self.process.terminate()
        try:
            self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait()
        print("[vLLM] Stopped")
        self.process = None

    def status(self) -> dict:
        """Get vLLM server status."""
        if self.process is None or self.process.poll() is not None:
            return {"running": False}

        try:
            import requests
            resp = requests.get(f"http://localhost:{self.port}/v1/models", timeout=5)
            return {"running": True, "models": resp.json().get("data", []), "port": self.port}
        except Exception as e:
            return {"running": False, "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="vLLM Mamba server manager")
    parser.add_argument("--start", action="store_true", help="Start vLLM server")
    parser.add_argument("--stop", action="store_true", help="Stop vLLM server")
    parser.add_argument("--status", action="store_true", help="Check server status")
    parser.add_argument("--benchmark", action="store_true", help="Run inference benchmark")
    args = parser.parse_args()

    server = VLLMServer()

    if args.status:
        print(f"[vLLM] Status: {server.status()}")
        return

    if args.stop:
        server.stop()
        return

    if args.start:
        success = server.start()
        if success:
            print(f"[vLLM] Running at http://localhost:{server.port}")
        return

    if args.benchmark:
        print("[vLLM] Running benchmark...")
        prompts = [
            "Gap up 20 ticks, hitting resistance at PDH. Volume 2x average. Breaking out of 30-min consolidation.",
            "Fading a test of PDH with decreasing volume. AMD phase shifting to DISTRIBUTION.",
        ]
        for p in prompts:
            t0 = time.perf_counter()
            result = call_vllm(p)
            elapsed = (time.perf_counter() - t0) * 1000
            print(f"  Prompt: {p[:60]}...")
            print(f"  Result: {result}")
            print(f"  Latency: {elapsed:.1f}ms")
        return

    print(__doc__)


if __name__ == "__main__":
    main()
