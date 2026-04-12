"""
Self-Training Pipeline — orchestrates training of all ML models.
Handles: data loading → feature engineering → model training → model store.
Integrates MLflow for experiment tracking and model registry.
"""
import time
import traceback
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
from data.candle_db import CandleDatabase
from features.feature_pipeline import engineer_features, get_feature_vector, FEATURE_COLS
from training.model_store import ModelStore
from training.cross_validator import TimeSeriesCrossValidator
from training.training_eligibility import filter_training_eligible_trades

from models.direction.lightgbm_classifier import LightGBMClassifier
from models.direction.random_forest import RandomForestClassifierModel
from models.direction.xgboost_classifier import XGBoostClassifier

# Optional data quality gate (Great Expectations + expectation suites)
try:
    from data_quality.validation_pipeline import run_full_validation
    DATA_QUALITY_AVAILABLE = True
except ImportError:
    DATA_QUALITY_AVAILABLE = False
    run_full_validation = None

# Optional MLflow integration
try:
    from infrastructure.mlflow_client import get_mlflow_client, MLFLOW_AVAILABLE, MLFLOW_TRACKING_URI
except ImportError:
    MLFLOW_AVAILABLE = False
    MLFLOW_TRACKING_URI = "http://localhost:5000"

# Optional Prometheus integration
try:
    from infrastructure.prometheus_exporter import (
        record_training_run,
        record_training_duration,
        record_artifact_size,
        record_model_registered,
        PROMETHEUS_AVAILABLE as _PROM_AVAILABLE,
    )
    PROMETHEUS_AVAILABLE = _PROM_AVAILABLE
except ImportError:
    PROMETHEUS_AVAILABLE = False
    record_training_run = None
    record_training_duration = None
    record_artifact_size = None
    record_model_registered = None

# Drift detection — refresh baselines after each training run
try:
    from infrastructure.drift_detector import DriftMonitor
    _drift_monitor = DriftMonitor()
except ImportError:
    _drift_monitor = None
    def get_mlflow_client(*args, **kwargs):
        class NoOpClient:
            def start_run(self, *args, **kwargs): return self
            def log_params(self, *args, **kwargs): pass
            def log_metrics(self, *args, **kwargs): pass
            def log_tag(self, *args, **kwargs): pass
            def log_model(self, *args, **kwargs): return {"ok": False}
            def auto_register_if_passing(self, *args, **kwargs): return {"registered": False}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def end_run(self, *args, **kwargs): pass
        return NoOpClient()


class Trainer:
    """
    Orchestrates the full ML training pipeline.

    Steps:
    1. Load data from SQLite (candles + trade_log + session_aggregates)
    2. Engineer features
    3. Train direction models with TimeSeriesSplit CV
    4. Store trained models + metrics in model store
    5. Update model registry in SQLite
    """

    def __init__(self, db_path: str | None = None, store_dir: str | None = None):
        self.db = CandleDatabase(db_path=db_path or config.DB_PATH, database_url=config.DATABASE_URL)
        self.store = ModelStore(store_dir)
        self._trained_models: list[dict] = []

    def train_direction_models(
        self,
        mode: str = "full",
        symbol: str = "MNQ",
        min_trades: int = 100,
        verbose: bool = True,
    ) -> dict:
        """
        Train all direction models (LightGBM, RandomForest, XGBoost).

        Parameters
        ----------
        mode : "full" | "incremental"
            full: retrain from scratch
            incremental: update existing models with new data
        symbol : str
            Trading symbol (default MNQ)
        min_trades : int
            Minimum completed trades needed to train (default 100)

        Returns
        -------
        dict with training results per model
        """
        started_at = time.time()
        train_log_id = self.db.start_training("direction_ensemble", mode)

        try:
            if verbose:
                print(f"\n{'='*60}")
                print(f"ML TRAINING PIPELINE — {mode.upper()} mode")
                print(f"{'='*60}")

            dq_gate_enabled = os.environ.get("DQ_VALIDATE_BEFORE_TRAIN", "true").lower() == "true"
            if dq_gate_enabled:
                if not DATA_QUALITY_AVAILABLE or run_full_validation is None:
                    raise RuntimeError(
                        "Data quality gate is enabled (DQ_VALIDATE_BEFORE_TRAIN=true) but validation pipeline is unavailable."
                    )

                if self.db.backend_type != "sqlite":
                    if verbose:
                        print("[DQ] SQLite-only pre-train validation skipped for PostgreSQL backend")
                else:
                    try:
                        dq_days = max(1, int(os.environ.get("DQ_VALIDATE_DAYS", "90")))
                    except ValueError:
                        dq_days = 90

                    dq_report = run_full_validation(
                        db_path=self.db.db_path,
                        block=False,
                        candles_days=dq_days,
                        trades_days=dq_days,
                        sessions_days=dq_days,
                    )
                    if verbose:
                        print(
                            "[DQ] Pre-train gate: "
                            f"{'PASS' if dq_report.get('passed', False) else 'FAIL'} | "
                            f"critical_failures={dq_report.get('critical_failures', 0)} | "
                            f"warning_failures={dq_report.get('warning_failures', 0)}"
                        )

                    if not dq_report.get("passed", False):
                        failed_suites = [
                            name
                            for name, suite in dq_report.get("suites", {}).items()
                            if not suite.get("passed", False)
                        ]
                        raise ValueError(
                            "Data quality gate blocked training. "
                            f"critical_failures={dq_report.get('critical_failures', 0)}, "
                            f"failed_suites={failed_suites}"
                        )

            # Step 1: Load data
            trade_log = self.db.get_trade_log(limit=10000, symbol=symbol)
            raw_trade_count = len(trade_log)
            trade_log = filter_training_eligible_trades(trade_log)
            stats = self.db.get_stats()

            if verbose:
                print(f"\nData: {stats['candles']} candles, {stats['trades']} completed trades")
                excluded_count = max(raw_trade_count - len(trade_log), 0)
                if excluded_count:
                    print(
                        "Training eligibility filter excluded "
                        f"{excluded_count} ineligible user trade(s)"
                    )

            if len(trade_log) < min_trades:
                raise ValueError(
                    f"Need at least {min_trades} completed trades to train, "
                    f"got {len(trade_log)}. Upload more journal entries."
                )

            # Step 2: Load candles for feature engineering
            start_date = pd.to_datetime(trade_log["entry_time"].min())
            end_date = pd.to_datetime(trade_log["entry_time"].max())
            start_date_str = start_date.isoformat()
            end_date_str = end_date.isoformat()
            candles = self.db.get_candles(start_date_str, end_date_str, symbol=symbol, limit=200000)

            if verbose:
                print(
                    "Candles loaded: "
                    f"{len(candles)} rows from {start_date.strftime('%Y-%m-%d')} "
                    f"to {end_date.strftime('%Y-%m-%d')}"
                )

            if len(candles) < 500:
                raise ValueError(f"Need at least 500 candles, got {len(candles)}")

            # Step 3: Load session aggregates
            try:
                session_agg = self.db.get_session_aggregates(
                    start_date.strftime("%Y-%m-%d"),
                    end_date.strftime("%Y-%m-%d"),
                    symbol=symbol,
                )
            except Exception:
                session_agg = pd.DataFrame()

            # Step 4: Engineer features
            if verbose:
                print(f"\nEngineering features...")

            feature_df = engineer_features(
                candles_df=candles,
                trade_log_df=trade_log,
                session_agg_df=session_agg,
                math_engine_snapshot=None,
                key_levels=None,
            )

            # Filter to rows with valid labels
            feature_df = feature_df.dropna(subset=["label_direction"])
            feature_df = feature_df[feature_df["label_direction"].notna()]

            if verbose:
                print(f"Feature matrix: {len(feature_df)} rows × {len(feature_df.columns)} columns")

            # Step 5: Prepare X and y
            X = get_feature_vector(feature_df)
            y = feature_df["label_direction"]

            # Fill NaN with 0 for tree models (they handle this)
            X = X.fillna(0.0)
            X = X.replace([np.inf, -np.inf], 0.0)

            feature_cols = list(X.columns)

            if verbose:
                class_dist = y.value_counts().to_dict()
                print(f"Label distribution: {class_dist}")
                print(f"Feature columns: {len(feature_cols)}")

            # Step 6: Train each direction model
            models_to_train = [
                ("lightgbm", LightGBMClassifier),
                ("random_forest", RandomForestClassifierModel),
                ("xgboost", XGBoostClassifier),
            ]

            results = {}
            self._trained_models = []

            # ── MLflow: start experiment run ──────────────────────────────────
            mlflow_client = get_mlflow_client("direction")
            training_run_name = f"direction_training_{symbol.lower()}_{mode}"
            with mlflow_client.start_run(
                run_name=training_run_name,
                tags={
                    "pipeline": "direction_training",
                    "mode": mode,
                    "symbol": symbol,
                },
                description="Train direction models and register validated candidates.",
            ):
                mlflow_client.log_params({
                    "mode": mode,
                    "symbol": symbol,
                    "min_trades": min_trades,
                    "n_candles": len(candles),
                    "n_trades": len(trade_log),
                    "n_features": len(feature_cols),
                })

                for model_key, model_cls in models_to_train:
                    if verbose:
                        print(f"\n{'─'*40}")
                        print(f"Training: {model_key.upper()}")
                        print(f"{'─'*40}")

                    try:
                        with mlflow_client.start_run(
                            run_name=f"direction_{model_key}_{mode}",
                            tags={
                                "model_family": "direction",
                                "model_type": model_key,
                                "mode": mode,
                                "symbol": symbol,
                            },
                            description=f"Train and evaluate the {model_key} direction model.",
                            nested=True,
                        ):
                            mlflow_client.log_params({
                                "model_type": model_key,
                                "training_samples": len(trade_log),
                                "feature_count": len(feature_cols),
                            })

                            model = model_cls()
                            metrics = model.train(X, y, feature_cols=feature_cols, verbose=verbose)

                            mlflow_client.log_metrics(metrics)
                            mlflow_client.log_tag("model", model_key)
                            mlflow_client.log_tag(
                                "validation_cv_auc",
                                str(metrics.get("cv_roc_auc_mean", 0))
                            )

                            version = self.store.save(
                                model_name=model_key,
                                pipeline=model.pipeline,
                                metrics=metrics,
                                feature_cols=feature_cols,
                            )

                            model_metadata = {
                                "model_type": model_key,
                                "version": version,
                                "mode": mode,
                                "feature_count": len(feature_cols),
                                "training_samples": len(trade_log),
                                "symbol": symbol,
                            }
                            mlflow_result = mlflow_client.log_model(
                                model=model.pipeline,
                                model_name=f"direction_{model_key}",
                                sample_input=X.head(5),
                                metadata=model_metadata,
                                registered=False,
                            )
                            if verbose and mlflow_result.get("ok"):
                                print(f"  [MLflow] Artifact logged: {mlflow_result.get('artifact_uri', '')}")

                            reg_result = mlflow_client.auto_register_if_passing(
                                model_name=f"direction_{model_key}",
                                metrics=metrics,
                                model=model.pipeline,
                                metadata=model_metadata,
                                stage="Staging",
                            )
                            if verbose and reg_result.get("registered"):
                                print(f"  [MLflow] Auto-registered: {reg_result.get('stage', '')} "
                                      f"v{reg_result.get('version', '')}")

                            self.db.upsert_model({
                                "model_name": model_key,
                                "model_type": "direction",
                                "version": version,
                                "trained_at": datetime.now(timezone.utc).isoformat(),
                                "data_trades": len(trade_log),
                                "data_days": len(candles) // 78,
                                "accuracy": metrics.get("cv_accuracy_mean", 0),
                                "roc_auc": metrics.get("cv_roc_auc_mean", 0),
                                "win_rate": None,
                                "expectancy": None,
                                "profit_factor": None,
                                "sharpe": None,
                                "max_drawdown": None,
                                "is_active": 1,
                                "file_path": str(self.store._model_path(model_key, version)),
                            })

                            results[model_key] = {
                                "status": "success",
                                "version": version,
                                "mlflow_artifact_uri": mlflow_result.get("artifact_uri"),
                                "mlflow_registered": reg_result.get("registered", False),
                                "mlflow_stage": reg_result.get("stage"),
                                "mlflow_registry_version": reg_result.get("version"),
                                **metrics,
                            }
                            self._trained_models.append({
                                "name": model_key,
                                "version": version,
                                "metrics": metrics,
                            })

                            if verbose:
                                print(f"  ✓ Saved as {model_key}_{version}")

                    except Exception as e:
                        error = f"{type(e).__name__}: {e}"
                        if verbose:
                            print(f"  ✗ Failed: {error}")
                            traceback.print_exc()
                        results[model_key] = {"status": "error", "error": error}

                duration = time.time() - started_at
                self.db.complete_training(train_log_id, len(trade_log), duration, "success")
                mlflow_client.log_metrics({
                    "training_duration_sec": round(duration, 2),
                    "candles_used": len(candles),
                    "trades_used": len(trade_log),
                    "n_models_trained": sum(1 for r in results.values() if r["status"] == "success"),
                })
                mlflow_client.log_tag("training_status", "success")

            # ── Drift Monitor: refresh baselines after training ───────────────
            if _drift_monitor is not None:
                try:
                    _drift_monitor.feature_drift.update_baseline(feature_df, trade_log)
                    _drift_monitor.concept_drift.set_baseline(trade_log)
                    if verbose:
                        print(f"  [DriftMonitor] Baselines updated: {len(trade_log)} trades, "
                              f"{len(feature_df)} feature rows")
                except Exception as e:
                    if verbose:
                        print(f"  [DriftMonitor] Baseline update skipped: {e}")

            # ── Prometheus: record training run metrics ──────────────────────
            if record_training_run and PROMETHEUS_AVAILABLE:
                record_training_run("direction", "success")
                record_training_duration("direction", training_run_name, round(duration, 2))
            if record_model_registered and PROMETHEUS_AVAILABLE:
                for model_key, result_data in results.items():
                    if result_data.get("status") == "success":
                        stage = result_data.get("mlflow_stage") or "Staging"
                        record_model_registered(f"direction_{model_key}", stage)
            if record_artifact_size and PROMETHEUS_AVAILABLE:
                for model_key, result_data in results.items():
                    version = result_data.get("version")
                    if version:
                        p = self.store._model_path(model_key, version)
                        if p.exists():
                            record_artifact_size(f"direction_{model_key}", p.stat().st_size)

            summary = {
                "mode": mode,
                "training_duration_sec": round(duration, 2),
                "symbol": symbol,
                "candles_used": len(candles),
                "trades_used": len(trade_log),
                "feature_count": len(feature_cols),
                "models": results,
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "mlflow_tracking_uri": MLFLOW_TRACKING_URI,
            }

            if verbose:
                print(f"\n  [MLflow] Tracking: {MLFLOW_TRACKING_URI}")
                if MLFLOW_AVAILABLE:
                    exp_summary = mlflow_client.get_experiment_summary()
                    print(f"  [MLflow] Total runs: {exp_summary.get('runs', 'N/A')}")
                print(f"\n{'='*60}")
                print(f"TRAINING COMPLETE — {duration:.1f}s")
                print(f"{'='*60}")
                for name, result in results.items():
                    status = "✓" if result["status"] == "success" else "✗"
                    auc = result.get("cv_roc_auc_mean", "N/A")
                    print(f"  {status} {name}: ROC-AUC={auc}")

            return summary

        except Exception as e:
            error_msg = f"{type(e).__name__}: {e}"
            if "mlflow_client" in dir():
                mlflow_client.log_tag("training_status", "failed")
                mlflow_client.log_tag("error", error_msg[:200])
            # ── Prometheus: record failed run ──────────────────────────────
            if record_training_run and PROMETHEUS_AVAILABLE:
                record_training_run("direction", "failed")
            self.db.fail_training(train_log_id, error_msg)
            traceback.print_exc()
            raise

    def get_training_summary(self) -> dict:
        """Return summary of all trained models from model store."""
        models = self.store.list_all_models()
        summary = {}
        for name in models:
            latest_meta = self.store.load_meta(name, "latest")
            summary[name] = latest_meta
        return summary

    def get_last_training_info(self, model_name: str = "direction_ensemble") -> dict:
        """Get the last training log entry for a model."""
        return self.db.get_last_training(model_name) or {}
