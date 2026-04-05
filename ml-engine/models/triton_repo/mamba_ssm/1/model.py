"""
Triton Python Backend — Mamba SSM Model (TorchScript)

Serves a Mamba state-space model via TorchScript for regime-aware
sequence classification.

Input:  input_ids — Int64 tensor [batch, seq_len=512]
Output: logits, prob_long, prob_short, confidence, signal

Triton loads this via: backend="python" in config.pbtxt
Loads TorchScript model from: <model_repo>/mamba_ssm/1/model.pt
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "ml-engine"))

# ─── Import Guards ─────────────────────────────────────────────────────────────

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    torch = None

# ─── Model ─────────────────────────────────────────────────────────────────────

_mamba_model = None
_mamba_meta = None


def _load_mamba() -> tuple:
    """Lazy-load TorchScript model and metadata."""
    global _mamba_model, _mamba_meta
    if _mamba_model is not None:
        return _mamba_model, _mamba_meta

    if not TORCH_AVAILABLE:
        raise ImportError("torch is required for mamba_ssm Triton backend. "
                          "Install: pip install torch --index-url https://download.pytorch.org/whl/cu121")

    model_dir = Path(__file__).parent
    model_path = model_dir / "model.pt"
    meta_path = model_dir / "model.meta.json"

    if not model_path.exists():
        raise FileNotFoundError(
            f"TorchScript model not found: {model_path}\n"
            "Run: python -m ml_engine.models.mamba.export_torchscript"
        )

    _mamba_model = torch.jit.load(str(model_path))
    _mamba_model.eval()

    if meta_path.exists():
        with open(meta_path) as f:
            _mamba_meta = json.load(f)

    print(f"[MambaTriton] Loaded TorchScript model from {model_path}")
    return _mamba_model, _mamba_meta


# ─── Triton Model Class ────────────────────────────────────────────────────────

class TritonMambaModel:
    """
    Triton Python backend model for Mamba SSM inference.

    Input:
      input_ids: Int64 tensor [batch, seq_len=512]

    Output:
      logits:     [batch, vocab_size=50277] — raw logits
      prob_long:  [batch] — P(LONG) from softmax over direction tokens
      prob_short: [batch] — P(SHORT)
      confidence: [batch] — max(prob_long, prob_short)
      signal:     [batch] — "LONG" | "SHORT" | "NEUTRAL"
    """

    # Token IDs for directional classification (simplified — use actual vocab IDs)
    LONG_TOKEN_ID = 20001
    SHORT_TOKEN_ID = 20002
    NEUTRAL_TOKEN_ID = 20003

    def __init__(self, args: dict):
        self._args = args
        self._model_path = args.get("model_path", "")
        self._device = "cuda" if (TORCH_AVAILABLE and torch.cuda.is_available()) else "cpu"

    def execute(self, payloads: list) -> list:
        """Run Mamba inference on batched inputs."""
        try:
            model, _ = _load_mamba()
            if self._device == "cuda":
                model = model.cuda()
                model = torch.compile(model) if hasattr(torch, "compile") else model
        except Exception as exc:
            print(f"[MambaTriton] Model load failed: {exc}")
            return [self._build_default_output(1)]

        batch_results = []

        for payload in payloads:
            inputs = payload.get("inputs", [])
            input_ids = None

            for inp in inputs:
                if inp.get("name") == "input_ids":
                    raw = inp.get("data", [])
                    if raw:
                        # Reshape to [batch, seq_len]
                        dims = inp.get("shape", [])
                        if len(dims) == 2:
                            batch_size, seq_len = dims[0], dims[1]
                        else:
                            batch_size, seq_len = 1, 512
                        input_ids = torch.tensor(raw, dtype=torch.int64).view(batch_size, seq_len)
                    break

            if input_ids is None:
                batch_results.append(self._build_default_output(1))
                continue

            try:
                input_ids = input_ids.to(self._device)
                with torch.no_grad(), torch.cuda.amp.autocast(enabled=self._device == "cuda"):
                    logits = model(input_ids)  # [batch, vocab_size]

                results = self._process_logits(logits.cpu().numpy())
                batch_results.append(self._build_output(results, len(input_ids)))
            except Exception as exc:
                print(f"[MambaTriton] Inference error: {exc}")
                batch_results.append(self._build_default_output(1))

        return batch_results

    def _process_logits(self, logits: "np.ndarray") -> list[dict]:
        """Convert logits to directional signals."""
        import torch.nn.functional as F

        results = []
        for row in logits:
            logit_row = torch.tensor(row, dtype=torch.float32)
            probs = F.softmax(logit_row, dim=-1)

            p_long = float(probs[self.LONG_TOKEN_ID].item()) if self.LONG_TOKEN_ID < len(probs) else 0.0
            p_short = float(probs[self.SHORT_TOKEN_ID].item()) if self.SHORT_TOKEN_ID < len(probs) else 0.0
            p_neutral = float(probs[self.NEUTRAL_TOKEN_ID].item()) if self.NEUTRAL_TOKEN_ID < len(probs) else 0.0

            # Normalize to tradeable directions
            total = p_long + p_short + 1e-8
            p_long_norm = p_long / total
            p_short_norm = p_short / total

            confidence = max(p_long_norm, p_short_norm)
            if confidence < 0.55:
                signal = "NEUTRAL"
            elif p_long_norm > p_short_norm:
                signal = "LONG"
            else:
                signal = "SHORT"

            results.append({
                "prob_long": p_long_norm,
                "prob_short": p_short_norm,
                "confidence": confidence,
                "signal": signal,
            })
        return results

    def _build_output(self, results: list, batch_size: int) -> dict:
        n = len(results)
        logits_flat = []
        for r in results:
            logits_flat.append([r["prob_long"], r["prob_short"], r["confidence"]])

        return {
            "outputs": [
                {"name": "logits",     "data": logits_flat,       "shape": [n, 3],   "dtype": "TYPE_FP32"},
                {"name": "prob_long",  "data": [r["prob_long"]  for r in results], "shape": [n], "dtype": "TYPE_FP32"},
                {"name": "prob_short", "data": [r["prob_short"] for r in results], "shape": [n], "dtype": "TYPE_FP32"},
                {"name": "confidence", "data": [r["confidence"] for r in results], "shape": [n], "dtype": "TYPE_FP32"},
                {"name": "signal",     "data": [r["signal"]     for r in results], "shape": [n], "dtype": "TYPE_STRING"},
            ]
        }

    def _build_default_output(self, batch_size: int) -> dict:
        return {
            "outputs": [
                {"name": "logits",     "data": [[0.0, 0.0, 0.0]] * batch_size, "shape": [batch_size, 3], "dtype": "TYPE_FP32"},
                {"name": "prob_long",  "data": [0.333] * batch_size, "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "prob_short", "data": [0.333] * batch_size, "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "confidence", "data": [0.0] * batch_size,    "shape": [batch_size], "dtype": "TYPE_FP32"},
                {"name": "signal",     "data": ["NEUTRAL"] * batch_size, "shape": [batch_size], "dtype": "TYPE_STRING"},
            ]
        }
