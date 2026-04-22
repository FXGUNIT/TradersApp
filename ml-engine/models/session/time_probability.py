"""
Time-of-day probability model.

Predicts the probability of a profitable entry for a given wall-clock bucket,
using the canonical session configuration loaded through `config.py`.
"""

from __future__ import annotations

import os
import sys
from zoneinfo import ZoneInfo

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import config
from training.cross_validator import TimeSeriesCrossValidator


class TimeProbabilityModel:
    """
    Predicts probability of profitable entry for each time bucket.

    The model is session-aware: start times, labels, and timezone come from the
    YAML-backed session context rather than hardcoded US-market assumptions.
    """

    name = "time_probability"
    model_type = "session"

    def __init__(self):
        self._session_context = config.get_session_context()
        self._session_timezone_name = self._session_context["default_timezone"]
        self._session_timezone = ZoneInfo(self._session_timezone_name)
        self._default_session_id = config.SESSION_NAME_TO_ID["main_trading"]
        self._session_start_minutes = {
            session_id: self._to_minutes(session_cfg["start"])
            for session_id, session_cfg in self._session_context["by_id"].items()
        }
        self._session_labels = {
            session_id: session_cfg["label"]
            for session_id, session_cfg in self._session_context["by_id"].items()
        }
        self._session_display_names = {
            session_id: session_cfg["display_name"]
            for session_id, session_cfg in self._session_context["by_id"].items()
        }

        self.pipeline = Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "clf",
                    CalibratedClassifierCV(
                        lgb.LGBMClassifier(
                            n_estimators=200,
                            max_depth=4,
                            learning_rate=0.05,
                            num_leaves=15,
                            min_child_samples=30,
                            subsample=0.8,
                            colsample_bytree=0.8,
                            is_unbalance=True,
                            random_state=42,
                            n_jobs=-1,
                            verbose=-1,
                        ),
                        method="isotonic",
                        cv=5,
                    ),
                ),
            ]
        )
        self._is_trained = False
        self._cv_scores: list[float] = []
        self._time_bucket_win_rates: dict[int, float] = {}
        self._session_win_rates: dict[int, float] = {}

    def train(
        self,
        trade_log: pd.DataFrame,
        feature_cols: list[str] | None = None,
        verbose: bool = True,
    ) -> dict:
        """Train on historical trade log rows."""
        if trade_log.empty:
            if verbose:
                print("  TimeProbabilityModel: no trade data, using defaults")
            self._is_trained = True
            return {"model": self.name, "note": "No training data", "training_samples": 0}

        trade_log = trade_log.dropna(subset=["entry_time"]).copy()
        trade_log["entry_time"] = pd.to_datetime(trade_log["entry_time"])

        X, y = self._build_time_features(trade_log)

        if len(X) < 50:
            if verbose:
                print(f"  TimeProbabilityModel: only {len(X)} trades, using defaults")
            self._is_trained = False
            self._compute_defaults(X, y)
            return {"model": self.name, "note": "Insufficient data", "training_samples": len(X)}

        cv = TimeSeriesCrossValidator(
            n_splits=config.TSCV_N_SPLITS,
            gap=config.TSCV_GAP,
        )
        self._cv_scores = []
        fold_metrics = []

        for fold_idx, (train_idx, val_idx) in enumerate(cv.split(X)):
            X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

            self.pipeline.fit(X_train, y_train)
            proba = self.pipeline.predict_proba(X_val)[:, 1]
            pred = (proba >= 0.5).astype(int)

            roc_auc = roc_auc_score(y_val, proba)
            acc = accuracy_score(y_val, pred)
            ll = log_loss(y_val, proba)

            self._cv_scores.append(roc_auc)
            fold_metrics.append(
                {
                    "fold": fold_idx + 1,
                    "roc_auc": round(roc_auc, 4),
                    "accuracy": round(acc, 4),
                    "log_loss": round(ll, 4),
                }
            )

            if verbose:
                print(f"  Fold {fold_idx + 1}: ROC-AUC={roc_auc:.4f}  Acc={acc:.4f}")

        self.pipeline.fit(X, y)
        self._is_trained = True
        self._compute_time_buckets(X, y)

        result = {
            "model": self.name,
            "cv_roc_auc_mean": round(float(np.mean(self._cv_scores)), 4),
            "cv_roc_auc_std": round(float(np.std(self._cv_scores)), 4),
            "cv_accuracy_mean": round(float(np.mean([f["accuracy"] for f in fold_metrics])), 4),
            "time_buckets": {str(k): round(v, 4) for k, v in self._time_bucket_win_rates.items()},
            "best_buckets": self._best_buckets(),
            "session_win_rates": {str(k): round(v, 4) for k, v in self._session_win_rates.items()},
            "training_samples": len(X),
        }

        if verbose:
            print(
                "  TimeProbabilityModel CV ROC-AUC: "
                f"{result['cv_roc_auc_mean']:.4f} +/- {result['cv_roc_auc_std']:.4f}"
            )
            print(f"  Best time buckets: {self._best_buckets()}")

        return result

    def _build_time_features(self, trade_log: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
        session_times = self._localize_entry_times(trade_log["entry_time"])
        wall_clock_minutes = session_times.dt.hour * 60 + session_times.dt.minute
        session_ids = trade_log.get(
            "session_id",
            pd.Series([self._default_session_id] * len(trade_log), index=trade_log.index),
        ).fillna(self._default_session_id).astype(int)

        X = pd.DataFrame(
            {
                "hour_of_day": session_times.dt.hour,
                "minute_of_hour": session_times.dt.minute,
                "time_bucket_5min": wall_clock_minutes // 5,
                "time_bucket_15min": wall_clock_minutes // 15,
                "day_of_week": session_times.dt.dayofweek,
                "session_id": session_ids,
                "minutes_into_session": self._minutes_into_session(wall_clock_minutes, session_ids),
            }
        )

        y = (trade_log["result"] == "win").astype(int)
        return X, y

    def _minutes_into_session(self, wall_clock_minutes: pd.Series, session_ids: pd.Series) -> np.ndarray:
        default_start = self._session_start_minutes[self._default_session_id]
        session_starts_arr = (
            session_ids.map(self._session_start_minutes).fillna(default_start).astype(int).values
        )
        return np.maximum(0, wall_clock_minutes.astype(int).values - session_starts_arr)

    def _compute_time_buckets(self, X: pd.DataFrame, y: pd.Series) -> None:
        self._time_bucket_win_rates = {}
        for bucket in range(0, 96):
            mask = X["time_bucket_15min"] == bucket
            if mask.sum() >= 5:
                self._time_bucket_win_rates[bucket] = float(y[mask].mean())

        self._session_win_rates = {}
        for sid in self._session_context["by_id"]:
            mask = X["session_id"] == sid
            if mask.sum() >= 5:
                self._session_win_rates[sid] = float(y[mask].mean())

    def _compute_defaults(self, X: pd.DataFrame, y: pd.Series) -> None:
        self._time_bucket_win_rates = {}
        self._session_win_rates = {}
        for sid in self._session_context["by_id"]:
            mask = X["session_id"] == sid if "session_id" in X.columns else pd.Series([False] * len(X))
            if mask.sum() > 0:
                self._session_win_rates[sid] = float(y[mask].mean())

    def _best_buckets(self) -> list[dict]:
        sorted_buckets = sorted(
            self._time_bucket_win_rates.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:3]
        return [
            {
                "bucket": bucket,
                "start_time": f"{bucket * 15 // 60:02d}:{(bucket * 15) % 60:02d}",
                "win_rate": round(win_rate, 4),
            }
            for bucket, win_rate in sorted_buckets
        ]

    def predict(
        self,
        hour: int,
        minute: int,
        session_id: int,
        day_of_week: int,
    ) -> dict:
        """
        Predict P(profitable_entry) for a specific time.
        Returns: {probability, confidence, best_window, recommendation}
        """
        if not self._is_trained:
            return {"P_profitable": 0.5, "confidence": 0.0, "recommendation": "Model not trained"}

        bucket = (hour * 60 + minute) // 15
        hm = hour * 60 + minute
        minutes_in = self._minutes_into_session_for_time(hour, minute, session_id)

        X = pd.DataFrame(
            [
                {
                    "hour_of_day": hour,
                    "minute_of_hour": minute,
                    "time_bucket_5min": hm // 5,
                    "time_bucket_15min": bucket,
                    "day_of_week": day_of_week,
                    "session_id": session_id,
                    "minutes_into_session": minutes_in,
                }
            ]
        )

        try:
            ml_proba = float(self.pipeline.predict_proba(X)[:, 1])
        except Exception:
            ml_proba = 0.5

        bucket_wr = self._time_bucket_win_rates.get(bucket, 0.5)
        session_wr = self._session_win_rates.get(session_id, 0.5)
        blended = 0.5 * ml_proba + 0.3 * bucket_wr + 0.2 * session_wr
        blended = float(np.clip(blended, 0.01, 0.99))

        confidence = max(blended, 1 - blended)
        best_buckets = self._best_buckets()
        recommendation = self._get_recommendation(blended, session_id, best_buckets)

        return {
            "P_profitable": round(blended, 4),
            "confidence": round(confidence, 4),
            "current_bucket": bucket,
            "bucket_win_rate": round(bucket_wr, 4),
            "session_win_rate": round(session_wr, 4),
            "best_buckets": best_buckets,
            "recommendation": recommendation,
        }

    def _minutes_into_session_for_time(self, hour: int, minute: int, session_id: int) -> int:
        start = self._session_start_minutes.get(session_id, self._session_start_minutes[self._default_session_id])
        return max(0, hour * 60 + minute - start)

    def _get_recommendation(
        self,
        p_profitable: float,
        session_id: int,
        best_buckets: list[dict],
    ) -> str:
        session_name = self._session_display_names.get(session_id, "Main Trading Session")
        session_label = self._session_labels.get(session_id, "Main")
        best_window = best_buckets[0]["start_time"] if best_buckets else "N/A"

        if session_id == config.SESSION_NAME_TO_ID["pre_market"]:
            return (
                f"{session_name}: trade opening imbalance only. "
                f"Best historical window: {best_window} {self._session_timezone_name}."
            )

        if session_id == config.SESSION_NAME_TO_ID["post_market"]:
            return (
                f"{session_name}: treat moves as lower-liquidity continuation/fade setups. "
                f"Best historical window: {best_window} {self._session_timezone_name}."
            )

        if p_profitable >= 0.60:
            return (
                f"HIGH PROBABILITY window for {session_label}. "
                f"P(win)={p_profitable:.0%}. Best historical: {best_window} {self._session_timezone_name}."
            )
        if p_profitable >= 0.52:
            return (
                f"Moderate edge. P(win)={p_profitable:.0%}. "
                f"Best historical: {best_window} {self._session_timezone_name}."
            )
        if p_profitable >= 0.48:
            return f"Weak edge. P(win)={p_profitable:.0%}. Consider skipping this window."
        return f"NEGATIVE EDGE. P(win)={p_profitable:.0%}. Avoid entries and shift to the next high-alpha window."

    def _localize_entry_times(self, entry_times: pd.Series) -> pd.Series:
        if entry_times.dt.tz is not None:
            return entry_times.dt.tz_convert(self._session_timezone)
        return entry_times

    @staticmethod
    def _to_minutes(value: str) -> int:
        hour, minute = value.split(":")
        return int(hour) * 60 + int(minute)

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    def get_metrics(self) -> dict:
        return {
            "cv_roc_auc_mean": round(np.mean(self._cv_scores), 4) if self._cv_scores else 0.0,
            "trained": self._is_trained,
            "best_buckets": self._best_buckets(),
        }
