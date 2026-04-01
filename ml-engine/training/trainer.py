"""
Self-Training Pipeline — orchestrates training of all ML models.
Handles: data loading → feature engineering → model training → model store.
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

from models.direction.lightgbm_classifier import LightGBMClassifier
from models.direction.random_forest import RandomForestClassifierModel
from models.direction.xgboost_classifier import XGBoostClassifier


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
        self.db = CandleDatabase(db_path or config.DB_PATH)
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

            # Step 1: Load data
            trade_log = self.db.get_trade_log(limit=10000, symbol=symbol)
            stats = self.db.get_stats()

            if verbose:
                print(f"\nData: {stats['candles']} candles, {stats['trades']} completed trades")

            if len(trade_log) < min_trades:
                raise ValueError(
                    f"Need at least {min_trades} completed trades to train, "
                    f"got {len(trade_log)}. Upload more journal entries."
                )

            # Step 2: Load candles for feature engineering
            start_date = trade_log["entry_time"].min()
            end_date = trade_log["entry_time"].max()
            candles = self.db.get_candles(start_date, end_date, symbol=symbol, limit=200000)

            if verbose:
                print(f"Candles loaded: {len(candles)} rows from {start_date[:10]} to {end_date[:10]}")

            if len(candles) < 500:
                raise ValueError(f"Need at least 500 candles, got {len(candles)}")

            # Step 3: Load session aggregates
            try:
                session_agg = self.db.get_session_aggregates(
                    start_date[:10], end_date[:10], symbol=symbol
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

            for model_key, model_cls in models_to_train:
                if verbose:
                    print(f"\n{'─'*40}")
                    print(f"Training: {model_key.upper()}")
                    print(f"{'─'*40}")

                try:
                    model = model_cls()
                    metrics = model.train(X, y, feature_cols=feature_cols, verbose=verbose)

                    # Store model
                    version = self.store.save(
                        model_name=model_key,
                        pipeline=model.pipeline,
                        metrics=metrics,
                        feature_cols=feature_cols,
                    )

                    # Update model registry in DB
                    self.db.upsert_model({
                        "model_name": model_key,
                        "model_type": "direction",
                        "version": version,
                        "trained_at": datetime.now(timezone.utc).isoformat(),
                        "data_trades": len(trade_log),
                        "data_days": len(candles) // 78,  # ~78 5-min candles per trading day
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

                    results[model_key] = {"status": "success", "version": version, **metrics}
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

            summary = {
                "mode": mode,
                "training_duration_sec": round(duration, 2),
                "symbol": symbol,
                "candles_used": len(candles),
                "trades_used": len(trade_log),
                "feature_count": len(feature_cols),
                "models": results,
                "trained_at": datetime.now(timezone.utc).isoformat(),
            }

            if verbose:
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
