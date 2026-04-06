"""
Model Store — joblib-based persistence for all trained ML models.
Stores: pipeline, feature_cols, metrics, version, timestamp.

Stateless mode (MLFLOW_USE_REGISTRY=true):
    load() queries MLflow model registry for the Production version and
    downloads from S3/MinIO if newer than local disk. All pods converge to
    the same MLflow production model — single source of truth.
"""
import json
import hashlib
import joblib
import os
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

# Lazy import to avoid hard MLflow dependency in local-only mode
_mlflow_client = None
_ML_CLIENT_INIT = False


def _get_ml_client():
    """Lazily get the MLflow tracking client (only if configured)."""
    global _mlflow_client, _ML_CLIENT_INIT
    if _ML_CLIENT_INIT:
        return _mlflow_client
    _ML_CLIENT_INIT = True
    if not getattr(config, "MLFLOW_USE_REGISTRY", False):
        return None
    try:
        from infrastructure.mlflow_client import get_mlflow_client
        _mlflow_client = get_mlflow_client("direction")
    except Exception:
        pass
    return _mlflow_client


class ModelStore:
    """
    Persistent model storage using joblib.
    Each model saved as: {model_name}_{version}.pkl + {model_name}_{version}.meta.json

    When config.MLFLOW_USE_REGISTRY=true, load() and get_latest() consult the
    MLflow model registry for the Production stage version and download from
    S3/MinIO if the remote version is newer than the local cached copy.
    """

    def __init__(self, store_dir: str | None = None):
        self.store_dir = Path(store_dir or config.MODEL_STORE)
        self.store_dir.mkdir(parents=True, exist_ok=True)
        # Track when we last checked MLflow registry (avoid hammering on every call)
        self._last_registry_check: dict[str, float] = {}
        self._check_interval = getattr(config, "MLFLOW_REGISTRY_CHECK_INTERVAL", 60)

    def _model_path(self, model_name: str, version: str) -> Path:
        return self.store_dir / f"{model_name}_{version}.pkl"

    def _meta_path(self, model_name: str, version: str) -> Path:
        return self.store_dir / f"{model_name}_{version}.meta.json"

    # ── MLflow Registry Integration ─────────────────────────────────────────

    def _registry_version(self, model_name: str) -> Optional[str]:
        """
        Query MLflow registry for the Production version of model_name.
        Returns version string (e.g. '3') or None if not registered or MLflow unavailable.
        Respects check interval to avoid excessive API calls.
        """
        now = time.time()
        last = self._last_registry_check.get(model_name, 0)
        if now - last < self._check_interval:
            return self._last_registry_check.get(f"_version_{model_name}")

        client = _get_ml_client()
        if not client:
            return None

        try:
            prod = client.get_production_model(model_name)
            if prod and prod.get("version"):
                ver = str(prod["version"])
                self._last_registry_check[model_name] = now
                self._last_registry_check[f"_version_{model_name}"] = ver
                return ver
        except Exception:
            pass

        self._last_registry_check[model_name] = now
        return None

    def _download_from_registry(self, model_name: str, version: str, meta: dict) -> bool:
        """
        Download the Production model from MLflow artifact store.
        Returns True if download succeeded and file was written.
        """
        client = _get_ml_client()
        if not client:
            return False

        try:
            import mlflow
            # Get the model_uri for this specific version
            if client._client is None:
                return False
            versions = client._client.get_latest_versions(
                model_name, stages=["production"]
            )
            if not versions:
                return False
            v = versions[0]
            model_uri = f"models:/{model_name}/{version}"

            # Load and save locally
            pipeline = mlflow.sklearn.load_model(model_uri)
            self.save(
                model_name=model_name,
                pipeline=pipeline,
                metrics=meta.get("metrics", {}),
                feature_cols=meta.get("feature_cols", []),
                version=version,
                extra={"source": "mlflow_registry", "run_id": v.run_id},
            )
            print(f"[ModelStore] Downloaded {model_name}@{version} from MLflow registry")
            return True
        except Exception as e:
            print(f"[ModelStore] Failed to download {model_name}@{version} from registry: {e}")
            return False

    def needs_reload(self, model_name: str) -> bool:
        """
        Check if the MLflow Production version differs from the locally cached version.
        Returns True if a newer production model exists remotely.
        """
        if not getattr(config, "MLFLOW_USE_REGISTRY", False):
            return False

        remote_ver = self._registry_version(model_name)
        if not remote_ver:
            return False

        local_ver = self.get_latest_version(model_name)
        # Reload if not cached locally OR if remote version differs
        if local_ver is None:
            return True
        # Version comparison: numeric string comparison works for MLflow integer versions
        try:
            return int(remote_ver) > int(local_ver)
        except (ValueError, TypeError):
            return remote_ver != local_ver

    # ── Core Persistence ──────────────────────────────────────────────────────

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
        """
        Load a model by name and version.

        When MLFLOW_USE_REGISTRY=true:
            - Queries MLflow Production stage for the current version
            - Downloads from S3/MinIO if remote version is newer than local
            - Falls back to local cache if download fails
        """
        # Resolve 'latest' — consult MLflow if configured
        if version == "latest" or getattr(config, "MLFLOW_USE_REGISTRY", False):
            remote_ver = self._registry_version(model_name)
            if remote_ver:
                version = remote_ver

        if version == "latest":
            version = self.get_latest_version(model_name)
            if not version:
                raise FileNotFoundError(f"No versions found for model '{model_name}'")

        # Normalize version (strip any .meta suffix)
        clean_version = version.rstrip(".meta")

        # If MLflow says a newer version exists, try to download it
        if getattr(config, "MLFLOW_USE_REGISTRY", False):
            remote_ver = self._registry_version(model_name)
            if remote_ver and remote_ver != clean_version:
                # Force load the remote version
                clean_version = remote_ver

        path = self._model_path(model_name, clean_version)
        if not path.exists():
            # Model not on disk — try downloading from MLflow
            if getattr(config, "MLFLOW_USE_REGISTRY", False) and clean_version:
                meta = {"metrics": {}, "feature_cols": []}
                if self._download_from_registry(model_name, clean_version, meta):
                    # Reload now that it's downloaded
                    path = self._model_path(model_name, clean_version)
                    if path.exists():
                        pipeline = joblib.load(str(path))
                        meta_path = self._meta_path(model_name, clean_version)
                        meta_data = {}
                        if meta_path.exists():
                            with open(meta_path) as f:
                                meta_data = json.load(f)
                        return pipeline, meta_data

            raise FileNotFoundError(
                f"Model not found: {model_name}@{clean_version} (tried {path})"
            )

        pipeline = joblib.load(str(path))

        meta_path = self._meta_path(model_name, clean_version)
        meta = {}
        if meta_path.exists():
            with open(meta_path) as f:
                meta = json.load(f)

        return pipeline, meta

    def load_meta(self, model_name: str, version: str = "latest") -> dict:
        """Load only metadata, without loading the model file."""
        if version == "latest":
            version = self.get_latest_version(model_name)
        if not version:
            return {}
        path = self._meta_path(model_name, version)
        if not path.exists():
            return {}
        with open(path) as f:
            return json.load(f)

    def list_versions(self, model_name: str) -> list[str]:
        """List all saved versions for a model."""
        versions = []
        for p in self.store_dir.glob(f"{model_name}_*.meta.json"):
            base = p.stem  # e.g. "direction_3.meta" on Windows
            base = base[:-5] if base.endswith(".meta") else base
            prefix = model_name + "_"
            if base.startswith(prefix):
                version = base[len(prefix):]
                versions.append(version)
            else:
                version = p.name[:-9]  # strip ".meta.json"
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
        cfg = sys.modules.get("config") or __import__("config")
        cfg_str = json.dumps({
            "LGBM_DIRECTION": getattr(cfg, "LGBM_DIRECTION", None),
            "XGB_DIRECTION": getattr(cfg, "XGB_DIRECTION", None),
            "RF_DIRECTION": getattr(cfg, "RF_DIRECTION", None),
            "TSCV_N_SPLITS": getattr(cfg, "TSCV_N_SPLITS", None),
            "TSCV_GAP": getattr(cfg, "TSCV_GAP", None),
        }, sort_keys=True)
        return hashlib.md5(cfg_str.encode()).hexdigest()[:8]
