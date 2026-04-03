"""
ONNX Exporter — exports LightGBM and sklearn models to ONNX for Triton serving.

Usage:
  python -m ml_engine.inference.onnx_exporter --model lightgbm
  python -m ml_engine.inference.onnx_exporter --all

Exports models from ml-engine/models/store/ to ml-engine/models/onnx/
as ONNX Runtime-compatible files for Triton inference.

Requirements:
  pip install onnx onnxruntime scikit-learn>=1.3 lightgbm>=4.0
"""

from __future__ import annotations

import os
import sys
import json
import argparse
import joblib
from pathlib import Path
from datetime import datetime, timezone

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import config
from training.model_store import ModelStore


try:
    import onnx
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False


def get_onnx_output_dir() -> Path:
    out = PROJECT_ROOT / "ml-engine" / "models" / "onnx"
    out.mkdir(parents=True, exist_ok=True)
    return out


def export_lightgbm(pipeline, feature_cols: list[str], model_name: str, version: str) -> Path:
    """
    Export a sklearn pipeline (StandardScaler + CalibratedClassifierCV wrapping LightGBM)
    to ONNX format.
    """
    if not ONNX_AVAILABLE:
        raise ImportError(
            "ONNX export requires: pip install onnx onnxruntime scikit-learn>=1.3 lightgbm>=4.0"
        )

    # Extract the underlying LGBMClassifier from the pipeline
    inner_clf = pipeline.named_steps["clf"].estimator
    scaler = pipeline.named_steps["scaler"]

    # Get n_features from feature_cols
    n_features = len(feature_cols)

    # Convert sklearn pipeline to ONNX
    initial_type = [("input", FloatTensorType([None, n_features]))]

    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_type,
        target_opset=15,
        options={type(inner_clf): {"zipmap": False}},
    )

    output_dir = get_onnx_output_dir()
    output_path = output_dir / f"{model_name}_{version}.onnx"

    onnx.save(onnx_model, str(output_path))

    # Save metadata alongside the ONNX file
    meta = {
        "model_name": model_name,
        "version": version,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "feature_cols": feature_cols,
        "n_features": n_features,
        "runtime": "onnxruntime",
    }
    meta_path = output_dir / f"{model_name}_{version}.onnx.meta.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"[ONNX] Exported {model_name}@{version} → {output_path} ({n_features} features)")
    return output_path


def export_sklearn_generic(pipeline, feature_cols: list[str], model_name: str, version: str) -> Path:
    """Export any sklearn pipeline to ONNX."""
    if not ONNX_AVAILABLE:
        raise ImportError(
            "ONNX export requires: pip install onnx onnxruntime"
        )

    n_features = len(feature_cols)
    initial_type = [("input", FloatTensorType([None, n_features]))]

    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_type,
        target_opset=15,
    )

    output_dir = get_onnx_output_dir()
    output_path = output_dir / f"{model_name}_{version}.onnx"

    onnx.save(onnx_model, str(output_path))

    meta = {
        "model_name": model_name,
        "version": version,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "feature_cols": feature_cols,
        "n_features": n_features,
        "runtime": "onnxruntime",
    }
    meta_path = output_dir / f"{model_name}_{version}.onnx.meta.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"[ONNX] Exported {model_name}@{version} → {output_path}")
    return output_path


def export_model(model_name: str, version: str | None = None) -> Path | None:
    """
    Export a single model by name to ONNX.
    Returns the output path or None if skipped.
    """
    store = ModelStore()

    try:
        pipeline, meta = store.load(model_name, version=version or "latest")
    except FileNotFoundError as e:
        print(f"[ONNX] Skipping {model_name}: {e}")
        return None

    feature_cols = meta.get("feature_cols", [])
    ver = meta.get("version", "unknown")

    # Route by model type
    model_type = meta.get("model_type", "generic")

    if model_type == "direction" or model_name.startswith("lightgbm"):
        return export_lightgbm(pipeline, feature_cols, model_name, ver)
    else:
        return export_sklearn_generic(pipeline, feature_cols, model_name, ver)


def export_all() -> list[Path]:
    """Export all models in the model store to ONNX."""
    store = ModelStore()
    model_names = store.list_all_models()
    exported = []

    for name in model_names:
        path = export_model(name)
        if path:
            exported.append(path)

    return exported


def list_onnx_models() -> dict:
    """List all exported ONNX models with their metadata."""
    output_dir = get_onnx_output_dir()
    models = {}

    for meta_file in output_dir.glob("*.onnx.meta.json"):
        with open(meta_file) as f:
            meta = json.load(f)
        onnx_file = meta_file.with_suffix("")
        models[meta["model_name"]] = {
            "version": meta["version"],
            "path": str(onnx_file),
            "n_features": meta["n_features"],
            "exported_at": meta["exported_at"],
            "size_mb": onnx_file.stat().st_size / (1024 * 1024) if onnx_file.exists() else 0,
        }

    return models


def main():
    parser = argparse.ArgumentParser(description="Export ML models to ONNX for Triton")
    parser.add_argument("--model", type=str, help="Export a specific model by name")
    parser.add_argument("--all", action="store_true", help="Export all models")
    parser.add_argument("--list", action="store_true", help="List exported ONNX models")
    parser.add_argument("--version", type=str, default=None, help="Model version (default: latest)")
    args = parser.parse_args()

    if args.list:
        models = list_onnx_models()
        if not models:
            print("[ONNX] No ONNX models exported yet.")
        else:
            for name, info in models.items():
                print(f"  {name}@{info['version']} — {info['n_features']} features, "
                      f"{info['size_mb']:.1f} MB → {info['path']}")
        return

    if args.all:
        exported = export_all()
        print(f"[ONNX] Exported {len(exported)} models to {get_onnx_output_dir()}")
        return

    if args.model:
        path = export_model(args.model, args.version)
        if path:
            print(f"[ONNX] Done: {path}")
        return

    print(__doc__)
    print("\nExamples:")
    print("  python -m ml_engine.inference.onnx_exporter --list")
    print("  python -m ml_engine.inference.onnx_exporter --model lightgbm")
    print("  python -m ml_engine.inference.onnx_exporter --all")


if __name__ == "__main__":
    main()
