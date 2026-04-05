#!/usr/bin/env python3
"""
Export ONNX models to Triton model repository.

Copies ONNX files from ml-engine/models/onnx/ to the appropriate
triton_repo/*/<version>/ subdirectories.

Usage:
  python scripts/export_onnx_to_triton.py --all
  python scripts/export_onnx_to_triton.py --model lightgbm_direction --version 3
  python scripts/export_onnx_to_triton.py --dry-run --all

Triton model directory layout expected:
  ml-engine/models/triton_repo/<model_name>/<version>/model.onnx

  OR for Python backend models:
  ml-engine/models/triton_repo/<model_name>/<version>/model.py
  ml-engine/models/triton_repo/<model_name>/config.pbtxt  (must exist)
"""

from __future__ import annotations

import argparse
import shutil
import sys
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
ML_ENGINE_ROOT = PROJECT_ROOT / "ml-engine"
ONNX_DIR = ML_ENGINE_ROOT / "models" / "onnx"
TRITON_REPO_DIR = ML_ENGINE_ROOT / "models" / "triton_repo"

# ONNX model name → Triton directory name mapping
# Only models with ONNX Runtime backends (not Python backend)
ONNX_RUNTIME_MODELS = {
    "lightgbm_direction": "lightgbm_direction",
    "xgboost_direction": "xgboost_direction",
    "rf_direction": "rf_direction",
    "rf": "rf_direction",
    "svm_direction": "svm_direction",
    "mlp_direction": "mlp_direction",
    "amd_direction": "amd_direction",
    "time_probability": "time_probability",   # Python backend, ONNX optional
    "move_magnitude": "move_magnitude",        # Python backend, ONNX optional
    "regime_ensemble": "regime_ensemble",      # Python backend
}

# Models that use Python backend (not ONNX Runtime)
PYTHON_BACKEND_MODELS = {
    "time_probability",
    "move_magnitude",
    "regime_ensemble",
    "mamba_ssm",
}


def _load_meta(onnx_dir: Path, model_name: str) -> dict | None:
    """Load ONNX metadata JSON file."""
    for p in onnx_dir.glob(f"{model_name}_*.onnx.meta.json"):
        with open(p) as f:
            return json.load(f)
    # Try without version suffix
    for p in onnx_dir.glob("*.onnx.meta.json"):
        with open(p) as f:
            meta = json.load(f)
            if meta.get("model_name") == model_name:
                return meta
    return None


def export_onnx_model(
    onnx_dir: Path,
    triton_repo: Path,
    model_name: str,
    version: str = "1",
    dry_run: bool = False,
) -> Path | None:
    """
    Copy a single ONNX model to the Triton model repository.

    Returns the destination path or None if skipped.
    """
    # Find ONNX file
    onnx_files = list(onnx_dir.glob(f"{model_name}_*.onnx"))
    if not onnx_files:
        print(f"[TritonExport] No ONNX file found for '{model_name}' in {onnx_dir}")
        return None

    # Use latest version if multiple exist
    onnx_file = sorted(onnx_files)[-1]
    meta = _load_meta(onnx_dir, model_name)

    # Determine Triton directory name
    triton_name = ONNX_RUNTIME_MODELS.get(model_name, model_name)
    dest_dir = triton_repo / triton_name / str(version)
    dest_file = dest_dir / "model.onnx"

    if dry_run:
        print(f"[TritonExport] [DRY RUN] Would copy:")
        print(f"  {onnx_file}")
        print(f"  → {dest_file}")
        return dest_file

    # Create version directory
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Copy ONNX file
    shutil.copy2(onnx_file, dest_file)

    # Copy metadata
    if meta:
        meta_dest = dest_dir / "model.onnx.meta.json"
        with open(meta_dest, "w") as f:
            json.dump(meta, f, indent=2)

    # Verify config.pbtxt exists (required)
    config_path = triton_repo / triton_name / "config.pbtxt"
    if not config_path.exists():
        print(f"[TritonExport] WARNING: config.pbtxt missing for '{triton_name}' — create it before serving")
    else:
        # Patch platform to onnxruntime_onnx
        _patch_platform(config_path, triton_name)

    print(f"[TritonExport] Exported {onnx_file.name} → {dest_file}")
    return dest_file


def _patch_platform(config_path: Path, model_name: str) -> None:
    """
    Ensure config.pbtxt has platform = onnxruntime_onnx.
    Python backend models are skipped.
    """
    if model_name in PYTHON_BACKEND_MODELS:
        return

    content = config_path.read_text()
    if 'platform: "onnxruntime_onnx"' not in content:
        if "platform:" in content:
            # Replace existing platform line
            import re
            new_content = re.sub(
                r'platform: "[^"]*"',
                'platform: "onnxruntime_onnx"',
                content,
            )
        else:
            # Insert platform after first line
            lines = content.splitlines()
            new_lines = [lines[0], 'platform: "onnxruntime_onnx"', ""] + lines[1:]
            new_content = "\n".join(new_lines)
        config_path.write_text(new_content)
        print(f"[TritonExport] Patched platform in {config_path.name}")


def export_all(
    onnx_dir: Path,
    triton_repo: Path,
    version: str = "1",
    dry_run: bool = False,
) -> list[Path]:
    """Export all ONNX models to Triton repository."""
    exported = []
    for model_name in ONNX_RUNTIME_MODELS:
        path = export_onnx_model(onnx_dir, triton_repo, model_name, version, dry_run)
        if path:
            exported.append(path)
    return exported


def list_triton_models(triton_repo: Path) -> dict:
    """List all models in the Triton repository."""
    models = {}
    for model_dir in sorted(triton_repo.iterdir()):
        if not model_dir.is_dir():
            continue
        has_onnx = (model_dir / "1" / "model.onnx").exists()
        has_py = (model_dir / "1" / "model.py").exists()
        has_config = (model_dir / "config.pbtxt").exists()
        models[model_dir.name] = {
            "onnx": has_onnx,
            "python_backend": has_py,
            "config_exists": has_config,
            "versions": [v.name for v in sorted(model_dir.iterdir()) if v.is_dir()],
        }
    return models


def main():
    parser = argparse.ArgumentParser(description="Export ONNX models to Triton repository")
    parser.add_argument("--model", type=str, help="Export a specific model")
    parser.add_argument("--all", action="store_true", help="Export all ONNX models")
    parser.add_argument("--version", type=str, default="1", help="Triton model version")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    parser.add_argument("--onnx-dir", type=str, default=str(ONNX_DIR), help="ONNX source directory")
    parser.add_argument("--triton-repo", type=str, default=str(TRITON_REPO_DIR), help="Triton model repo")
    parser.add_argument("--list", action="store_true", help="List Triton model repository")
    args = parser.parse_args()

    onnx_dir = Path(args.onnx_dir)
    triton_repo = Path(args.triton_repo)

    if args.list:
        models = list_triton_models(triton_repo)
        print(f"\nTriton Model Repository: {triton_repo}")
        print(f"{'Model':<25} {'ONNX':>6} {'Py BE':>7} {'Config':>7} {'Versions'}")
        print("-" * 70)
        for name, info in sorted(models.items()):
            onnx = "✓" if info["onnx"] else "—"
            py = "✓" if info["python_backend"] else "—"
            cfg = "✓" if info["config_exists"] else "✗"
            vers = ", ".join(info["versions"]) or "none"
            print(f"{name:<25} {onnx:>6} {py:>7} {cfg:>7}  {vers}")
        return

    if not onnx_dir.exists():
        print(f"[TritonExport] ONNX directory not found: {onnx_dir}")
        print("  Run: python -m ml_engine.inference.onnx_exporter --all")
        sys.exit(1)

    if args.model:
        path = export_onnx_model(onnx_dir, triton_repo, args.model, args.version, args.dry_run)
        if path and not args.dry_run:
            print(f"[TritonExport] Done: {path}")
    elif args.all:
        exported = export_all(onnx_dir, triton_repo, args.version, args.dry_run)
        if not args.dry_run:
            print(f"[TritonExport] Exported {len(exported)} models to {triton_repo}")
        else:
            print(f"[TritonExport] [DRY RUN] Would export {len(exported)} models")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
