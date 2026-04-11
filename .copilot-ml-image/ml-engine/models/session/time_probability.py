"""
Time-of-Day Probability Model — predicts best entry windows per session.
Trains on historical trade log: which 5-min buckets historically have highest win rate?
Uses LightGBM to predict P(profitable_entry | time_features).
"""
import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config
from training.cross_validator import TimeSeriesCrossValidator

from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score, log_loss
import lightgbm as lgb


class TimeProbabilityModel:
    """
    Predicts probability of profitable entry for each 5-min time bucket.
    Uses historical win rate by time-of-day + current conditions.
    """

    name = "time_probability"
    model_type = "session"

    def __init__(self):
        self.pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", CalibratedClassifierCV(
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
            )),
        ])
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
        """
        Train on trade log to predict P(profitable_entry | time_features).
        Creates one row per trade with time features and label=is_win.
        """
        if trade_log.empty:
            if verbose:
                print("  TimeProbabilityModel: no trade data, using defaults")
            self._is_trained = True
            return {"model": self.name, "note": "No training data", "training_samples": 0}

        trade_log = trade_log.dropna(subset=["entry_time"]).copy()
        trade_log["entry_time"] = pd.to_datetime(trade_log["entry_time"])

        # Create time features
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
            fold_metrics.append({
                "fold": fold_idx + 1,
                "roc_auc": round(roc_auc, 4),
                "accuracy": round(acc, 4),
            })

            if verbose:
                print(f"  Fold {fold_idx + 1}: ROC-AUC={roc_auc:.4f}  Acc={acc:.4f}")

        self.pipeline.fit(X, y)
        self._is_trained = True

        # Compute time bucket win rates
        self._compute_time_buckets(X, y)

        result = {
            "model": self.name,
            "cv_roc_auc_mean": round(np.mean(self._cv_scores), 4),
            "cv_roc_auc_std": round(np.std(self._cv_scores), 4),
            "cv_accuracy_mean": round(np.mean([f["accuracy"] for f in fold_metrics]), 4),
            "time_buckets": {str(k): round(v, 4) for k, v in self._time_bucket_win_rates.items()},
            "best_buckets": self._best_buckets(),
            "session_win_rates": {str(k): round(v, 4) for k, v in self._session_win_rates.items()},
            "training_samples": len(X),
        }

        if verbose:
            print(f"  TimeProbabilityModel CV ROC-AUC: {result['cv_roc_auc_mean']:.4f} ± {result['cv_roc_auc_std']:.4f}")
            print(f"  Best time buckets: {self._best_buckets()}")

        return result

    def _build_time_features(self, trade_log: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
        """Build time-only feature matrix from trade log."""
        et = trade_log["entry_time"].dt.tz_convert("America/New_York") if trade_log["entry_time"].dt.tz else trade_log["entry_time"]
        hm = et.dt.hour * 60 + et.dt.minute

        X = pd.DataFrame({
            "hour_of_day": et.dt.hour,
            "minute_of_hour": et.dt.minute,
            "time_bucket_5min": hm // 5,
            "time_bucket_15min": hm // 15,
            "day_of_week": et.dt.dayofweek,
            "session_id": trade_log.get("session_id", pd.Series([1] * len(trade_log))).fillna(1).astype(int),
            "minutes_into_session": self._minutes_into_session(et, trade_log.get("session_id", pd.Series([1] * len(trade_log)))),
        })

        y = (trade_log["result"] == "win").astype(int)
        return X, y

    def _minutes_into_session(self, et: pd.Series, session_ids: pd.Series) -> np.ndarray:
        """Compute minutes elapsed since session start."""
        session_starts = {
            0: 4 * 60,   # Pre-market: 4:00 AM
            1: 9 * 60 + 30,  # Main: 9:30 AM
            2: 16 * 60 + 1,  # Post: 4:01 PM
        }
        session_starts_arr = session_ids.map(session_starts).fillna(9 * 60 + 30).values
        hm = (et.dt.hour * 60 + et.dt.minute).values
        return np.maximum(0, hm - session_starts_arr)

    def _compute_time_buckets(self, X: pd.DataFrame, y: pd.Series) -> None:
        """Compute win rate per 15-min bucket."""
        self._time_bucket_win_rates = {}
        for bucket in range(0, 96):  # 0-95 for 96 15-min buckets in 24h
            mask = X["time_bucket_15min"] == bucket
            if mask.sum() >= 5:
                self._time_bucket_win_rates[bucket] = float(y[mask].mean())

        self._session_win_rates = {}
        for sid in [0, 1, 2]:
            mask = X["session_id"] == sid
            if mask.sum() >= 5:
                self._session_win_rates[sid] = float(y[mask].mean())

    def _compute_defaults(self, X: pd.DataFrame, y: pd.Series) -> None:
        """Use historical averages when not enough data."""
        self._time_bucket_win_rates = {}
        self._session_win_rates = {}
        for sid in [0, 1, 2]:
            mask = X["session_id"] == sid if "session_id" in X.columns else pd.Series([False] * len(X))
            if mask.sum() > 0:
                self._session_win_rates[sid] = float(y[mask].mean())

    def _best_buckets(self) -> list[dict]:
        """Return top 3 best performing 15-min time buckets."""
        sorted_buckets = sorted(
            self._time_bucket_win_rates.items(),
            key=lambda x: x[1],
            reverse=True,
        )[:3]
        return [
            {
                "bucket": b,
                "start_time": f"{b * 15 // 60:02d}:{(b * 15) % 60:02d}",
                "win_rate": round(wr, 4),
            }
            for b, wr in sorted_buckets
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

        X = pd.DataFrame([{
            "hour_of_day": hour,
            "minute_of_hour": minute,
            "time_bucket_5min": hm // 5,
            "time_bucket_15min": bucket,
            "day_of_week": day_of_week,
            "session_id": session_id,
            "minutes_into_session": minutes_in,
        }])

        # Blend ML prediction with historical bucket win rate
        try:
            ml_proba = float(self.pipeline.predict_proba(X)[:, 1])
        except Exception:
            ml_proba = 0.5  # fallback when not trained
        bucket_wr = self._time_bucket_win_rates.get(bucket, 0.5)
        session_wr = self._session_win_rates.get(session_id, 0.5)

        # Blend: 50% ML, 30% bucket, 20% session
        blended = 0.5 * ml_proba + 0.3 * bucket_wr + 0.2 * session_wr
        blended = float(np.clip(blended, 0.01, 0.99))

        confidence = max(blended, 1 - blended)
        best_buckets = self._best_buckets()

        recommendation = self._get_recommendation(
            blended, session_id, best_buckets, hour, minute
        )

        return {
            "P_profitable": round(blended, 4),
            "confidence": round(confidence, 4),
            "current_bucket": bucket,
            "bucket_win_rate": round(bucket_wr, 4),
            "session_win_rate": round(session_wr, 4),
            "best_buckets": best_buckets,
            "recommendation": recommendation,
        }

    def _minutes_into_session_for_time(
        self, hour: int, minute: int, session_id: int
    ) -> int:
        """Compute minutes into session for a specific hour:minute."""
        session_starts = {0: 4 * 60, 1: 9 * 60 + 30, 2: 16 * 60 + 1}
        start = session_starts.get(session_id, 9 * 60 + 30)
        return max(0, hour * 60 + minute - start)

    def _get_recommendation(
        self,
        p_profitable: float,
        session_id: int,
        best_buckets: list[dict],
        current_hour: int,
        current_minute: int,
    ) -> str:
        """Generate human-readable recommendation."""
        if session_id == 0:
            return "Pre-market: trade initial directional moves only. Best window: 04:30-05:30 ET."
        elif session_id == 2:
            return "Post-market: fade extensions only. Best window: 16:15-17:00 ET."

        # Main session
        if p_profitable >= 0.60:
            return f"HIGH PROBABILITY window. P(win)={p_profitable:.0%}. Best historical: {best_buckets[0]['start_time'] if best_buckets else 'N/A'} ET."
        elif p_profitable >= 0.52:
            return f"Moderate edge. P(win)={p_profitable:.0%}. Best historical: {best_buckets[0]['start_time'] if best_buckets else 'N/A'} ET."
        elif p_profitable >= 0.48:
            return f"Weak edge. P(win)={p_profitable:.0%}. Consider skipping this window."
        else:
            return f"NEGATIVE EDGE. P(win)={p_profitable:.0%}. Avoid entries — shift to next high-alpha window."

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    def get_metrics(self) -> dict:
        return {
            "cv_roc_auc_mean": round(np.mean(self._cv_scores), 4) if self._cv_scores else 0.0,
            "trained": self._is_trained,
            "best_buckets": self._best_buckets(),
        }
