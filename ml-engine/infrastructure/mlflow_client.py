"""
MLflow Client — Experiment Tracking and Model Registry

Integrates with the self-hosted MLflow server (docker-compose.mlflow.yml).
Automatically logs:
- Parameters, metrics, tags per training run
- Model artifacts (pipeline + feature metadata)
- Dataset version info (DVC commit hash)
- Regime-specific model variants

Usage:
    mlflow_client = get_mlflow_client()
    with mlflow_client.start_run("lightgbm_direction"):
        mlflow_client.log_params({"n_estimators": 200, "learning_rate": 0.05})
        mlflow_client.log_metrics({"cv_roc_auc": 0.72, "win_rate": 0.58})
        mlflow_client.log_model(pipeline, "lightgbm", X_train_sample)

Artifact storage: S3 (MinIO in dev, AWS S3 in prod)
Backend store:    PostgreSQL
"""

import os
import sys
import hashlib
import datetime
import tempfile
import threading
from pathlib import Path
from typing import Any, Optional

# Optional: only load MLflow if available
MLFLOW_AVAILABLE = False
try:
    import mlflow
    from mlflow.tracking import MlflowClient
    from mlflow.entities import ViewType
    MLFLOW_AVAILABLE = True
except ImportError:
    mlflow = None
    MlflowClient = None
    ViewType = None

# ─── Configuration ─────────────────────────────────────────────────────────────

MLFLOW_TRACKING_URI = os.environ.get(
    "MLFLOW_TRACKING_URI",
    "http://localhost:5000"
)
MLFLOW_EXPERIMENT_PREFIX = "tradersapp_"
REGISTRY_ARTIFACT_ROOT = os.environ.get(
    "MLFLOW_ARTIFACT_ROOT",
    "s3://mlflow-artifacts/"
)

# Stage lifecycle: None → Staging → Production → Archived
STAGES = {
    "none": "None",
    "staging": "Staging",
    "production": "Production",
    "archived": "Archived",
}

# Auto-register models that pass PBO threshold
AUTO_REGISTER_THRESHOLD = {
    "pbo": 0.05,      # Pass if PBO < 5%
    "sharpe_min": 0.5,  # Pass if Sharpe >= 0.5
    "win_rate_min": 0.50,  # Pass if win rate >= 50%
    "cv_roc_auc_min": 0.55,  # Fallback validation gate for classifiers
    "cv_accuracy_min": 0.52,  # Avoid registering near-random classifiers
}


# ─── MLflow Client ────────────────────────────────────────────────────────────

class MLflowTrackingClient:
    """
    Thread-safe MLflow tracking client.

    Features:
    - Auto-creates experiment per model family
    - Logs DVC commit hash as run tag (data lineage)
    - Auto-registers to model registry if PBO/sharpe thresholds met
    - Returns run metadata (run_id, artifact_uri) for downstream use
    - Fallback: no-op if MLflow unavailable
    """

    _instances: dict[str, "MLflowTrackingClient"] = {}
    _lock = threading.Lock()

    def __init__(
        self,
        experiment_name: str,
        tracking_uri: str = MLFLOW_TRACKING_URI,
        artifact_root: str = REGISTRY_ARTIFACT_ROOT,
    ):
        self.experiment_name = experiment_name
        self.tracking_uri = tracking_uri
        self.artifact_root = artifact_root
        self._active_run = None
        self._client = None
        self._run_stack: list[str] = []

        if MLFLOW_AVAILABLE:
            self._setup()

    def _setup(self):
        """Configure MLflow URI and ensure experiment exists."""
        mlflow.set_tracking_uri(self.tracking_uri)
        mlflow.set_experiment(f"{MLFLOW_EXPERIMENT_PREFIX}{self.experiment_name}")
        self._client = MlflowClient(self.tracking_uri)

        endpoint_url = os.environ.get("MLFLOW_S3_ENDPOINT_URL")
        if endpoint_url:
            os.environ["MLFLOW_S3_ENDPOINT_URL"] = endpoint_url

        print(f"[MLflow] Tracking at {self.tracking_uri}, experiment: {self.experiment_name}")

    # ── Run Management ─────────────────────────────────────────────────────────

    def start_run(
        self,
        run_name: str | None = None,
        tags: dict | None = None,
        description: str | None = None,
        nested: bool = False,
    ) -> "MLflowTrackingClient":
        """
        Start a new MLflow run and return self for chaining.
        Usage:
            with mlflow_client.start_run("lightgbm_v2"):
                mlflow_client.log_params(...)
                mlflow_client.log_metrics(...)
        """
        if not MLFLOW_AVAILABLE:
            return self

        # Add DVC data version tag if available
        extra_tags = dict(tags or {})
        dvc_commit = self._get_dvc_commit()
        if dvc_commit:
            extra_tags["dvc_commit"] = dvc_commit
        extra_tags["timestamp"] = datetime.datetime.utcnow().isoformat()

        run = mlflow.start_run(
            run_name=run_name,
            description=description,
            tags=extra_tags,
            nested=nested,
        )
        self._active_run = run
        self._run_stack.append(run.info.run_id)
        return self

    def end_run(self, status: str = "FINISHED"):
        """End the current MLflow run."""
        if MLFLOW_AVAILABLE and mlflow.active_run():
            mlflow.end_run(status=status)
            if self._run_stack:
                self._run_stack.pop()
            self._active_run = mlflow.active_run()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.end_run(status="FAILED")
        else:
            self.end_run(status="FINISHED")
        return False

    # ── Logging ───────────────────────────────────────────────────────────────

    def log_params(self, params: dict[str, Any]):
        """Log hyperparameters."""
        if not MLFLOW_AVAILABLE or not self._has_active_run():
            return
        for key, value in params.items():
            mlflow.log_param(key, value)

    def log_metrics(
        self,
        metrics: dict[str, float],
        step: int | None = None,
    ):
        """Log evaluation metrics."""
        if not MLFLOW_AVAILABLE or not self._has_active_run():
            return
        for key, value in metrics.items():
            if value is None:
                continue
            try:
                mlflow.log_metric(key, float(value), step=step)
            except (TypeError, ValueError):
                continue

    def log_tag(self, key: str, value: str):
        """Log a tag on the active run."""
        if not MLFLOW_AVAILABLE or not self._has_active_run():
            return
        mlflow.set_tag(key, value)

    def log_params_and_metrics(
        self,
        params: dict,
        metrics: dict,
        regime: str | None = None,
        session_id: int | None = None,
    ):
        """Convenience: log params + metrics + context tags in one call."""
        self.log_params(params)
        self.log_metrics(metrics)
        if regime:
            self.log_tag("regime", regime)
        if session_id is not None:
            self.log_tag("session_id", str(session_id))

    # ── Model Artifact Logging ────────────────────────────────────────────────

    def log_model(
        self,
        model: Any,
        model_name: str,
        sample_input: Any | None = None,
        metadata: dict | None = None,
        registered: bool = False,
    ):
        """
        Log a model artifact with optional auto-registration.

        Args:
            model: sklearn/pipeline or compatible model object
            model_name: name for model registry (e.g., "lightgbm_direction")
            sample_input: optional X sample for signature inference
            metadata: dict of additional info to save alongside model
            registered: if True, register to model registry
        """
        if not MLFLOW_AVAILABLE:
            return {"ok": False, "reason": "MLflow not available"}
        if not self._has_active_run():
            return {"ok": False, "reason": "No active MLflow run"}

        try:
            # Build artifact path
            artifact_path = f"{model_name}"
            model_to_log = getattr(model, "pipeline", model)
            model_info = None

            # Build log dict for extra files
            meta_path = None
            if metadata:
                import json
                with tempfile.NamedTemporaryFile(
                    mode="w",
                    suffix=".json",
                    prefix="mlflow-metadata-",
                    delete=False,
                    encoding="utf-8",
                ) as f:
                    json.dump(metadata, f, indent=2, default=str)
                    meta_path = f.name

            logged_run = mlflow.active_run()

            # Log sklearn model
            if hasattr(model_to_log, "predict") or hasattr(model_to_log, "fit"):
                try:
                    # Try sklearn autolog first (handles most models)
                    mlflow.sklearn.autolog(
                        log_input_examples=False,
                        log_models=False,  # We log manually below
                    )

                    if sample_input is not None:
                        # Infer signature
                        import numpy as np
                        from mlflow.models import infer_signature
                        X_sample = sample_input[:5] if hasattr(sample_input, "__len__") else sample_input
                        try:
                            if hasattr(model_to_log, "predict"):
                                pred = model_to_log.predict(X_sample)
                            else:
                                pred = None
                            signature = infer_signature(X_sample, pred)
                        except Exception:
                            signature = None

                        model_info = mlflow.sklearn.log_model(
                            sk_model=model_to_log,
                            artifact_path=artifact_path,
                            signature=signature,
                            registered_model_name=model_name if registered else None,
                        )
                    else:
                        model_info = mlflow.sklearn.log_model(
                            sk_model=model_to_log,
                            artifact_path=artifact_path,
                            registered_model_name=model_name if registered else None,
                        )
                except Exception as e:
                    # Fallback: log as generic pickle
                    import joblib
                    with tempfile.NamedTemporaryFile(
                        suffix=".pkl",
                        prefix="mlflow-model-",
                        delete=False,
                    ) as f:
                        model_path = f.name
                    joblib.dump(model_to_log, model_path)
                    mlflow.log_artifact(model_path, artifact_path)
                    try:
                        os.unlink(model_path)
                    except OSError:
                        pass

            # Log metadata
            if meta_path:
                mlflow.log_artifact(meta_path, artifact_path)
                try:
                    os.unlink(meta_path)
                except OSError:
                    pass

            # Get run info
            run_id = logged_run.info.run_id if logged_run else None
            artifact_uri = mlflow.get_artifact_uri(artifact_path) if run_id else None
            version = None
            if registered and run_id and self._client:
                version_info = self._find_model_version(model_name, run_id)
                if version_info:
                    version = version_info.version

            return {
                "ok": True,
                "run_id": run_id,
                "artifact_uri": artifact_uri,
                "model_name": model_name,
                "model_uri": getattr(model_info, "model_uri", None) if model_info else None,
                "version": version,
            }

        except Exception as e:
            print(f"[MLflow] Failed to log model: {e}")
            return {"ok": False, "error": str(e)}

    def auto_register_if_passing(
        self,
        model_name: str,
        metrics: dict,
        model: Any,
        metadata: dict | None = None,
        stage: str = "staging",
    ) -> dict:
        """
        Register model if PBO/sharpe/win_rate thresholds are met.
        Returns registration result dict.
        """
        pbo = metrics.get("pbo", 1.0)
        sharpe = metrics.get("sharpe_oracle", 0.0)
        win_rate = metrics.get("win_rate", 0.0)
        cv_auc = metrics.get("cv_roc_auc_mean", 0.0)
        cv_accuracy = metrics.get("cv_accuracy_mean", 0.0)

        strategy_thresholds_met = (
            pbo < AUTO_REGISTER_THRESHOLD["pbo"]
            and sharpe >= AUTO_REGISTER_THRESHOLD["sharpe_min"]
            and win_rate >= AUTO_REGISTER_THRESHOLD["win_rate_min"]
        )
        classifier_thresholds_met = (
            cv_auc >= AUTO_REGISTER_THRESHOLD["cv_roc_auc_min"]
            and cv_accuracy >= AUTO_REGISTER_THRESHOLD["cv_accuracy_min"]
        )
        should_register = strategy_thresholds_met or classifier_thresholds_met

        if not should_register:
            return {
                "registered": False,
                "reason": "Thresholds not met",
                "pbo": pbo,
                "sharpe": sharpe,
                "win_rate": win_rate,
                "cv_roc_auc_mean": cv_auc,
                "cv_accuracy_mean": cv_accuracy,
                "thresholds": AUTO_REGISTER_THRESHOLD,
            }

        # Log model with registration
        result = self.log_model(
            model=model,
            model_name=model_name,
            metadata=metadata,
            registered=True,
        )
        if not result.get("ok"):
            result["registered"] = False
            result["reason"] = "Model logging failed"
            return result

        if result.get("ok") and self._client:
            try:
                normalized_stage = self._normalize_stage(stage)
                version = result.get("version")
                if version is None and result.get("run_id"):
                    version_info = self._find_model_version(model_name, result["run_id"])
                    version = version_info.version if version_info else None
                if version is not None:
                    self._client.transition_model_version_stage(
                        name=model_name,
                        version=version,
                        stage=normalized_stage,
                        archive_existing_versions=(normalized_stage == "Production"),
                    )
                    result["version"] = version
                    result["stage"] = normalized_stage
            except Exception as e:
                result["registration_warning"] = str(e)

        result["registered"] = True
        result["reason"] = "Thresholds met"
        result["validation_strategy"] = (
            "strategy" if strategy_thresholds_met else "classifier"
        )
        return result

    # ── Registry ─────────────────────────────────────────────────────────────

    def promote_model(
        self,
        model_name: str,
        from_stage: str = "staging",
        to_stage: str = "production",
    ) -> dict:
        """Promote a model version from one stage to another."""
        if not MLFLOW_AVAILABLE or not self._client:
            return {"ok": False, "reason": "MLflow not available"}

        try:
            from_stage = self._normalize_stage(from_stage)
            to_stage = self._normalize_stage(to_stage)
            versions = self._client.get_latest_versions(model_name, stages=[from_stage])
            if not versions:
                return {"ok": False, "error": f"No model in {from_stage} stage"}

            version = versions[0]
            self._client.transition_model_version_stage(
                name=model_name,
                version=version.version,
                stage=to_stage,
                archive_existing_versions=(to_stage == "Production"),
            )
            return {
                "ok": True,
                "model_name": model_name,
                "version": version.version,
                "from_stage": from_stage,
                "to_stage": to_stage,
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def get_production_model(self, model_name: str) -> dict | None:
        """Get the current production model info."""
        if not MLFLOW_AVAILABLE or not self._client:
            return None

        try:
            versions = self._client.get_latest_versions(
                model_name, stages=[self._normalize_stage("production")]
            )
            if versions:
                v = versions[0]
                return {
                    "name": v.name,
                    "version": v.version,
                    "stage": v.current_stage,
                    "run_id": v.run_id,
                    "created": v.creation_timestamp,
                }
        except Exception:
            pass
        return None

    def archive_stale_models(
        self,
        model_name: str,
        max_age_days: int = 7,
    ) -> list[dict]:
        """Archive production models older than max_age_days."""
        if not MLFLOW_AVAILABLE or not self._client:
            return []

        archived = []
        try:
            versions = self._client.get_latest_versions(
                model_name, stages=[self._normalize_stage("production")]
            )
            cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=max_age_days)
            for v in versions:
                if v.creation_timestamp / 1000 < cutoff.timestamp():
                    self._client.transition_model_version_stage(
                        name=model_name,
                        version=v.version,
                        stage=self._normalize_stage("archived"),
                    )
                    archived.append({"version": v.version, "archived": True})
        except Exception as e:
            print(f"[MLflow] Archive failed: {e}")
        return archived

    def get_registry_models(self, model_prefix: str | None = None) -> dict[str, list[dict]]:
        """List registered model versions, optionally filtered by name prefix."""
        if not MLFLOW_AVAILABLE or not self._client:
            return {}

        registry: dict[str, list[dict]] = {}
        try:
            for registered_model in self._client.search_registered_models():
                if model_prefix and not registered_model.name.startswith(model_prefix):
                    continue

                versions = sorted(
                    self._client.search_model_versions(
                        f"name='{registered_model.name}'"
                    ),
                    key=lambda version: int(version.version),
                    reverse=True,
                )
                registry[registered_model.name] = [
                    {
                        "version": version.version,
                        "stage": version.current_stage,
                        "run_id": version.run_id,
                        "status": version.status,
                        "source": version.source,
                        "created": getattr(version, "creation_timestamp", None),
                        "last_updated": getattr(version, "last_updated_timestamp", None),
                    }
                    for version in versions
                ]
        except Exception as e:
            print(f"[MLflow] Registry query failed: {e}")
        return registry

    # ── Experiment & Run Queries ─────────────────────────────────────────────

    def get_best_run(
        self,
        metric: str = "cv_roc_auc_mean",
        maximize: bool = True,
        filter_str: str | None = None,
        max_results: int = 10,
    ) -> dict | None:
        """Get the best run by a metric."""
        if not MLFLOW_AVAILABLE:
            return None

        try:
            sort_key = f"metrics.{metric}"
            sort_order = "DESC" if maximize else "ASC"
            filter_str = filter_str or ""
            query = f"{filter_str} attribute.status = 'FINISHED'"

            results = mlflow.search_runs(
                experiment_names=[f"{MLFLOW_EXPERIMENT_PREFIX}{self.experiment_name}"],
                filter_string=query,
                run_view_type=ViewType.ACTIVE_ONLY,
                max_results=max_results,
                order_by=[f"{sort_key} {sort_order}"],
            )

            if results.empty:
                return None

            best = results.iloc[0]
            return {
                "run_id": best.run_id,
                "metrics": {c: best[c] for c in best.index if c.startswith("metrics.")},
                "params": {c: best[c] for c in best.index if c.startswith("params.")},
                "tags": {c: best[c] for c in best.index if c.startswith("tags.")},
                "artifact_uri": best.artifact_uri,
            }
        except Exception as e:
            print(f"[MLflow] get_best_run failed: {e}")
            return None

    def get_experiment_summary(self) -> dict:
        """Get summary of all experiments."""
        if not MLFLOW_AVAILABLE:
            return {"available": False}

        try:
            exp = mlflow.get_experiment_by_name(
                f"{MLFLOW_EXPERIMENT_PREFIX}{self.experiment_name}"
            )
            if not exp:
                return {"runs": 0}

            runs = mlflow.search_runs(
                [exp.experiment_id],
                max_results=100,
                order_by=["attributes.start_time DESC"],
            )
            return {
                "experiment_id": exp.experiment_id,
                "runs": len(runs),
                "available": True,
            }
        except Exception:
            return {"available": False}

    def get_tracking_overview(self) -> dict:
        """
        Return high-level MLflow tracking counters for observability.

        Includes:
        - active experiment count
        - active (RUNNING) run count across active experiments
        """
        if not MLFLOW_AVAILABLE:
            return {"available": False}

        try:
            experiments = mlflow.search_experiments(view_type=ViewType.ACTIVE_ONLY)
            active_runs = 0

            for exp in experiments:
                running = mlflow.search_runs(
                    experiment_ids=[exp.experiment_id],
                    filter_string="attributes.status = 'RUNNING'",
                    run_view_type=ViewType.ACTIVE_ONLY,
                    max_results=5000,
                )
                active_runs += len(running)

            return {
                "available": True,
                "experiments": len(experiments),
                "active_runs": active_runs,
            }
        except Exception as e:
            return {"available": False, "error": str(e)}

    # ── Utilities ─────────────────────────────────────────────────────────────

    def _get_dvc_commit(self) -> str | None:
        """Get current DVC commit hash for data lineage tracking."""
        try:
            import subprocess
            result = subprocess.run(
                ["git", "describe", "--always", "--dirty"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass
        return None

    def _has_active_run(self) -> bool:
        return MLFLOW_AVAILABLE and mlflow.active_run() is not None

    def _normalize_stage(self, stage: str | None) -> str:
        if stage is None:
            return STAGES["none"]

        normalized = STAGES.get(str(stage).strip().lower())
        if normalized is None:
            valid = ", ".join(STAGES.values())
            raise ValueError(f"Invalid MLflow stage '{stage}'. Expected one of: {valid}")
        return normalized

    def _find_model_version(self, model_name: str, run_id: str):
        if not self._client:
            return None

        try:
            versions = sorted(
                self._client.search_model_versions(f"name='{model_name}'"),
                key=lambda version: int(version.version),
                reverse=True,
            )
            for version in versions:
                if version.run_id == run_id:
                    return version
        except Exception:
            return None
        return None


# ─── Global Factory ─────────────────────────────────────────────────────────────

def get_mlflow_client(
    experiment: str = "default",
    **kwargs,
) -> MLflowTrackingClient:
    """Get or create a singleton MLflow client per experiment."""
    key = f"{experiment}"
    with MLflowTrackingClient._lock:
        if key not in MLflowTrackingClient._instances:
            MLflowTrackingClient._instances[key] = MLflowTrackingClient(experiment, **kwargs)
        return MLflowTrackingClient._instances[key]


# ─── Decorators ────────────────────────────────────────────────────────────────

def mlflow_run(
    experiment: str = "default",
    run_name: str | None = None,
    tags: dict | None = None,
):
    """
    Decorator to automatically wrap a function with MLflow tracking.

    Usage:
        @mlflow_run(experiment="direction", run_name="lightgbm_v2")
        def train_model(X, y, params):
            # training logic...
            return {"roc_auc": 0.72, "win_rate": 0.58}

    The decorated function should return a dict of metrics.
    """
    def decorator(fn):
        def wrapper(*args, **kwargs):
            client = get_mlflow_client(experiment)
            with client.start_run(run_name=run_name or fn.__name__):
                try:
                    result = fn(*args, **kwargs)
                    if isinstance(result, dict):
                        client.log_metrics(result)
                    return result
                except Exception as e:
                    client.log_tag("error", str(e))
                    raise
        return wrapper
    return decorator
