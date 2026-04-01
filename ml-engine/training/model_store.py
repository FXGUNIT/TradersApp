"""
Model Store — joblib-based persistence for all trained ML models.
Stores: pipeline, feature_cols, metrics, version, timestamp.
"""
import json
import joblib
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


class ModelStore:
    """
    Persistent model storage using joblib.
    Each model saved as: {model_name}_{version}.pkl + {model_name}_{version}.meta.json
    """

    def __init__(self, store_dir: str | None = None):
        self.store_dir = Path(store_dir or config.MODEL_STORE)
        self.store_dir.mkdir(parents=True, exist_ok=True)

    def _model_path(self, model_name: str, version: str) -> Path:
        return self.store_dir / f"{model_name}_{version}.pkl"

    def _meta_path(self, model_name: str, version: str) -> Path:
        return self.store_dir / f"{model_name}_{version}.meta.json"

    def save(
        self,
        model_name: str,
        pipeline,
        metrics: dict,
        feature_cols: list[str],
        version: str | None = None,
        extra: dict | None = None,
    ) -> str:
        """Save a trained model. Returns version string."""
        version = version or datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        path = self._model_path(model_name, version)
        joblib.dump(pipeline, str(path))

        meta = {
            "model_name": model_name,
            "version": version,
            "saved_at": datetime.now(timezone.utc).isoformat(),
            "feature_cols": feature_cols,
            "metrics": metrics,
            "config_hash": self._hash_config(),
        }
        if extra:
            meta.update(extra)

        with open(self._meta_path(model_name, version), "w") as f:
            json.dump(meta, f, indent=2)

        return version

    def load(self, model_name: str, version: str = "latest"):
        """Load a model by name and version. version='latest' loads most recent."""
        if version == "latest":
            version = self.get_latest_version(model_name)
            if not version:
                raise FileNotFoundError(f"No versions found for model '{model_name}'")

        # Normalize version (strip any .meta suffix that might have leaked in)
        clean_version = version.rstrip(".meta")

        path = self._model_path(model_name, clean_version)
        if not path.exists():
            raise FileNotFoundError(f"Model not found: {model_name}@{clean_version} (tried {path})")

        pipeline = joblib.load(str(path))

        meta_path = self._meta_path(model_name, version)
        meta = {}
        if meta_path.exists():
            with open(meta_path) as f:
                meta = json.load(f)

        return pipeline, meta

    def load_meta(self, model_name: str, version: str = "latest") -> dict:
        """Load only metadata, without loading the model file."""
        if version == "latest":
            version = self.get_latest_version(model_name)
        path = self._meta_path(model_name, version)
        if not path.exists():
            return {}
        with open(path) as f:
            return json.load(f)

    def list_versions(self, model_name: str) -> list[str]:
        """List all saved versions for a model."""
        versions = []
        for p in self.store_dir.glob(f"{model_name}_*.meta.json"):
            # p.stem gives "test_model_20260401_052416.meta" on Windows
            # because Path.stem only strips the last extension (.json)
            # We need to strip .meta and then extract version
            base = p.stem  # e.g. "test_model_20260401_052416.meta"
            base = base[:-5] if base.endswith(".meta") else base  # remove ".meta"
            prefix = model_name + "_"
            if base.startswith(prefix):
                version = base[len(prefix):]
                versions.append(version)
            else:
                # fallback: use p.name with .meta.json stripped
                version = p.name[:-9]  # strip ".meta.json" (9 chars)
                if version.startswith(model_name + "_"):
                    versions.append(version[len(model_name) + 1:])
        versions.sort(reverse=True)
        return versions

    def get_latest_version(self, model_name: str) -> str | None:
        """Get the most recent version of a model."""
        versions = self.list_versions(model_name)
        return versions[0] if versions else None

    def get_latest(self, model_name: str):
        """Load the most recent version of a model."""
        version = self.get_latest_version(model_name)
        if not version:
            raise FileNotFoundError(f"No versions found for model '{model_name}'")
        return self.load(model_name, version)

    def delete(self, model_name: str, version: str) -> bool:
        """Delete a specific version."""
        clean_version = version.rstrip(".meta")
        model_deleted = self._model_path(model_name, clean_version).exists()
        self._model_path(model_name, clean_version).unlink(missing_ok=True)
        self._meta_path(model_name, clean_version).unlink(missing_ok=True)
        return model_deleted

    def list_all_models(self) -> list[str]:
        """List all unique model names in the store."""
        names = set()
        for p in self.store_dir.glob("*_*.meta.json"):
            name = p.stem.rsplit("_", 1)[0]
            names.add(name)
        return sorted(names)

    def _hash_config(self) -> str:
        """Hash of current config for reproducibility tracking."""
        import config as cfg
        cfg_str = json.dumps({
            "LGBM_DIRECTION": cfg.LGBM_DIRECTION,
            "XGB_DIRECTION": cfg.XGB_DIRECTION,
            "RF_DIRECTION": cfg.RF_DIRECTION,
            "TSCV_N_SPLITS": cfg.TSCV_N_SPLITS,
            "TSCV_GAP": cfg.TSCV_GAP,
        }, sort_keys=True)
        return hashlib.md5(cfg_str.encode()).hexdigest()[:8]
