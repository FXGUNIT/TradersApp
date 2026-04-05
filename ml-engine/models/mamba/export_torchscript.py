"""
Mamba TorchScript Export — exports state-space model to TorchScript for Triton.

Mamba SSM models (e.g., state-space models for sequence modeling) cannot be
exported directly to ONNX because they contain dynamic control flow (scan loops)
that ONNX cannot represent.

TorchScript is the correct export path:
  1. Trace or script the Mamba model with a representative input
  2. Serialize to .pt file
  3. Serve via Triton Python backend (torch compiled or via libtorch)

Requirements:
  pip install torch mamba-ssm  (or state-spaces if using alternative)
  # or: pip install mamba-ssm --index-url https://wheels.vllm.ai/main

Usage:
  # Export Mamba-1.4b to TorchScript
  python -m ml_engine.models.mamba.export_torchscript \
    --model-name mamba-1.4b \
    --checkpoint-dir ./checkpoints \
    --output-dir ./models/triton_repo/mamba_ssm/1 \
    --seq-length 512 \
    --batch-size 4

  # Verify exported model
  python -m ml_engine.models.mamba.export_torchscript --verify ./models/triton_repo/mamba_ssm/1/model.pt
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Optional

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "ml-engine"))


# ─── Import Guards ─────────────────────────────────────────────────────────────

try:
    import torch
    from torch import nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    torch = None
    nn = None

try:
    from mamba_ssm import Mamba
    MAMBA_AVAILABLE = True
except ImportError:
    MAMBA_AVAILABLE = False
    Mamba = None


# ─── Model Configurations ─────────────────────────────────────────────────────

MAMBA_CONFIGS = {
    "mamba-1.4b": {
        "d_model": 2048,
        "n_layers": 24,
        "vocab_size": 50277,
        "d_state": 16,
        "d_conv": 4,
        "expand": 2,
        "checkpoint": False,
    },
    "mamba-790m": {
        "d_model": 1024,
        "n_layers": 12,
        "vocab_size": 50277,
        "d_state": 16,
        "d_conv": 4,
        "expand": 2,
        "checkpoint": False,
    },
    "mamba-2.8b": {
        "d_model": 2560,
        "n_layers": 32,
        "vocab_size": 50277,
        "d_state": 16,
        "d_conv": 4,
        "expand": 2,
        "checkpoint": False,
    },
}


# ─── Model Wrapper ─────────────────────────────────────────────────────────────

class MambaForClassification(nn.Module if TORCH_AVAILABLE else object):
    """
    Wraps a Mamba SSM for directional classification.

    Forward pass:
      input_ids: LongTensor [batch, seq_len]
      Returns: logits [batch, vocab_size] → softmax → P(LONG), P(SHORT)
    """

    def __init__(self, config: dict):
        if not TORCH_AVAILABLE:
            raise ImportError("torch is required for Mamba TorchScript export")
        super().__init__()
        self.mamba = Mamba(
            d_model=config["d_model"],
            d_state=config["d_state"],
            d_conv=config["d_conv"],
            expand=config["expand"],
        )
        # Projection: d_model → vocab_size (simplified; real impl uses LM head)
        self.lm_head = nn.Linear(config["d_model"], config["vocab_size"], bias=False)
        self.config = config

    def forward(self, input_ids: "torch.Tensor") -> "torch.Tensor":
        """
        Args:
            input_ids: LongTensor [batch, seq_len]
        Returns:
            logits: FloatTensor [batch, vocab_size]
        """
        hidden = self.mamba(input_ids)
        # Take last token representation for classification
        logits = self.lm_head(hidden[:, -1, :])
        return logits


# ─── Export Functions ──────────────────────────────────────────────────────────

def export_traced(
    model: nn.Module,
    example_input: "torch.Tensor",
    output_path: Path,
    verify: bool = True,
) -> Path:
    """
    Trace the Mamba model with a representative input.
    Trace is the safest approach for Mamba (avoids script limitations).
    """
    model.eval()
    traced = torch.jit.trace(model, example_input)
    traced.save(str(output_path))
    print(f"[TorchScript] Traced model saved → {output_path}")

    if verify:
        rel_error = verify_exported(traced, example_input, model)
        print(f"[TorchScript] Verification: relative_error={rel_error:.2e} "
              f"{'PASS' if rel_error < 1e-3 else 'FAIL'}")

    return output_path


def export_script(
    model: nn.Module,
    output_path: Path,
    verify: bool = True,
) -> Path:
    """Script the model (preserves control flow, may fail for complex Mamba)."""
    model.eval()
    scripted = torch.jit.script(model)
    scripted.save(str(output_path))
    print(f"[TorchScript] Scripted model saved → {output_path}")
    return output_path


def verify_exported(
    traced: "torch.jit.TracedModule",
    example_input: "torch.Tensor",
    reference_model: nn.Module,
) -> float:
    """
    Verify traced output matches reference model output.
    Returns max relative error across the batch.
    """
    with torch.no_grad():
        ref_out = reference_model(example_input)
        traced_out = traced(example_input)
        diff = torch.abs(ref_out - traced_out)
        ref_abs = torch.abs(ref_out) + 1e-8
        rel_error = (diff / ref_abs).max().item()
    return rel_error


# ─── Full Export Pipeline ──────────────────────────────────────────────────────

def export_mamba(
    model_name: str,
    checkpoint_dir: Path,
    output_dir: Path,
    seq_length: int = 512,
    batch_size: int = 1,
    export_method: str = "trace",
) -> dict:
    """
    Full export pipeline: load checkpoint → wrap → trace → save → verify.
    """
    if not TORCH_AVAILABLE:
        raise ImportError("torch is required. Install: pip install torch --index-url https://download.pytorch.org/whl/cu121")

    if not MAMBA_AVAILABLE:
        raise ImportError(
            "mamba-ssm is required. Install:\n"
            "  pip install mamba-ssm --index-url https://wheels.vllm.ai/main\n"
            "Or: pip install state-spaces"
        )

    config = MAMBA_CONFIGS.get(model_name)
    if not config:
        raise ValueError(f"Unknown model '{model_name}'. Available: {list(MAMBA_CONFIGS.keys())}")

    # Load model
    print(f"[TorchScript] Loading {model_name} from {checkpoint_dir}")
    model = MambaForClassification(config)

    # Load pretrained weights if checkpoint exists
    checkpoint_path = checkpoint_dir / f"{model_name}.pt"
    if checkpoint_path.exists():
        state_dict = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
        model.load_state_dict(state_dict, strict=False)
        print(f"[TorchScript] Loaded checkpoint: {checkpoint_path}")
    else:
        print(f"[TorchScript] WARNING: No checkpoint found at {checkpoint_path} — using random weights")

    # Example input for tracing
    example_input = torch.randint(0, config["vocab_size"], (batch_size, seq_length), dtype=torch.long)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "model.pt"
    meta_path = output_dir / "model.meta.json"

    # Export
    start = time.perf_counter()
    if export_method == "trace":
        export_traced(model, example_input, model_path)
    else:
        export_script(model, model_path)

    elapsed = time.perf_counter() - start

    # Save metadata
    meta = {
        "model_name": model_name,
        "exported_at": "",  # filled by caller
        "export_method": export_method,
        "seq_length": seq_length,
        "batch_size": batch_size,
        "d_model": config["d_model"],
        "n_layers": config["n_layers"],
        "vocab_size": config["vocab_size"],
        "runtime": "torchscript",
        "input_spec": {
            "name": "input_ids",
            "shape": [batch_size, seq_length],
            "dtype": "int64",
        },
        "output_spec": {
            "name": "logits",
            "shape": [batch_size, config["vocab_size"]],
            "dtype": "float32",
        },
        "export_duration_sec": round(elapsed, 2),
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"[TorchScript] Export complete: {model_path} ({elapsed:.1f}s)")
    return meta


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="Export Mamba model to TorchScript")
    parser.add_argument("--model-name", type=str, default="mamba-1.4b",
                        choices=list(MAMBA_CONFIGS.keys()),
                        help="Mamba model variant")
    parser.add_argument("--checkpoint-dir", type=str, default="ml-engine/models/mamba/checkpoints",
                        help="Directory containing model checkpoints")
    parser.add_argument("--output-dir", type=str,
                        default="ml-engine/models/triton_repo/mamba_ssm/1",
                        help="Output directory for TorchScript .pt file")
    parser.add_argument("--seq-length", type=int, default=512, help="Sequence length for tracing")
    parser.add_argument("--batch-size", type=int, default=1, help="Batch size for tracing")
    parser.add_argument("--method", type=str, default="trace", choices=["trace", "script"],
                        help="TorchScript export method (trace=recommended)")
    parser.add_argument("--verify", action="store_true", default=True,
                        help="Verify exported model against reference")
    parser.add_argument("--verify-only", type=str, metavar="PATH",
                        help="Verify an existing .pt file only")
    return parser.parse_args()


def main():
    args = parse_args()

    if args.verify_only:
        path = Path(args.verify_only)
        if not path.exists():
            print(f"[TorchScript] File not found: {path}")
            sys.exit(1)
        print(f"[TorchScript] Verifying: {path}")
        traced = torch.jit.load(str(path))
        print(f"[TorchScript] Loaded successfully: {traced}")
        # Run a quick forward pass
        dummy = torch.randint(0, 50277, (1, 128), dtype=torch.long)
        with torch.no_grad():
            out = traced(dummy)
        print(f"[TorchScript] Forward pass OK: output shape={tuple(out.shape)}")
        return

    from datetime import datetime, timezone
    meta = export_mamba(
        model_name=args.model_name,
        checkpoint_dir=Path(args.checkpoint_dir),
        output_dir=Path(args.output_dir),
        seq_length=args.seq_length,
        batch_size=args.batch_size,
        export_method=args.method,
    )
    meta["exported_at"] = datetime.now(timezone.utc).isoformat()
    print(f"[TorchScript] Done: {meta}")


if __name__ == "__main__":
    main()
