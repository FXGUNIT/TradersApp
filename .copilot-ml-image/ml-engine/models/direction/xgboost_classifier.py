"""
XGBoost Direction Classifier.
Best for structured tabular data, handles class imbalance well.
"""
import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config
from training.cross_validator import TimeSeriesCrossValidator

from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, accuracy_score
import xgboost as xgb


class XGBoostClassifier:
    """
    XGBoost directional classifier.
    Calibrated via isotonic regression for probability estimates.
    """

    name = "xgboost"
    model_type = "direction"

    def __init__(self):
        base = xgb.XGBClassifier(**config.XGB_DIRECTION, eval_metric="auc")
        self.pipeline = CalibratedClassifierCV(base, method="isotonic", cv=5)
        self._is_trained = False
        self._cv_scores: list[float] = []
        self._feature_cols: list[str] = []

    def train(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        feature_cols: list[str] | None = None,
        verbose: bool = True,
    ) -> dict:
        self._feature_cols = feature_cols or [c for c in X.columns]
        X_use = X[self._feature_cols].copy()
        y_use = y.loc[X_use.index].copy()

        mask = X_use.notna().all(axis=1) & y_use.notna()
        X_use = X_use[mask]
        y_use = y_use[mask]

        if len(X_use) < 100:
            raise ValueError(f"Need at least 100 samples, got {len(X_use)}")

        cv = TimeSeriesCrossValidator(n_splits=config.TSCV_N_SPLITS, gap=config.TSCV_GAP)
        self._cv_scores = []
        fold_metrics = []

        for fold_idx, (train_idx, val_idx) in enumerate(cv.split(X_use)):
            X_train, X_val = X_use.iloc[train_idx], X_use.iloc[val_idx]
            y_train, y_val = y_use.iloc[train_idx], y_use.iloc[val_idx]

            self.pipeline.fit(X_train, y_train)
            proba = self.pipeline.predict_proba(X_val)[:, 1]
            pred = (proba >= 0.5).astype(int)

            roc_auc = roc_auc_score(y_val, proba)
            acc = accuracy_score(y_val, pred)
            self._cv_scores.append(roc_auc)

            fold_metrics.append({
                "fold": fold_idx + 1,
                "roc_auc": round(roc_auc, 4),
                "accuracy": round(acc, 4),
            })

            if verbose:
                print(f"  Fold {fold_idx + 1}: ROC-AUC={roc_auc:.4f}  Acc={acc:.4f}")

        self.pipeline.fit(X_use, y_use)
        self._is_trained = True

        # Feature importance
        fi = sorted(
            zip(self._feature_cols, self.pipeline.estimator.feature_importances_),
            key=lambda x: x[1],
            reverse=True,
        )

        result = {
            "model": self.name,
            "cv_roc_auc_mean": round(np.mean(self._cv_scores), 4),
            "cv_roc_auc_std": round(np.std(self._cv_scores), 4),
            "folds": fold_metrics,
            "feature_importance": {k: round(v, 4) for k, v in fi[:20]},
            "training_samples": len(X_use),
        }

        if verbose:
            print(f"  XGBoost CV ROC-AUC: {result['cv_roc_auc_mean']:.4f} ± {result['cv_roc_auc_std']:.4f}")

        return result

    def predict(self, X: pd.DataFrame) -> dict:
        if not self._is_trained:
            return {"signal": "NEUTRAL", "probability": 0.5, "confidence": 0.0, "reason": "Model not trained"}

        X_use = X[self._feature_cols].copy() if self._feature_cols else X.copy()

        proba = self.pipeline.predict_proba(X_use)
        if proba.shape[1] == 2:
            p = proba[:, 1]
        else:
            p = np.full(proba.shape[0], 0.5)

        p_val = p[0] if len(p) == 1 else p
        confidence = max(p_val, 1 - p_val)
        signal = "NEUTRAL" if confidence < 0.52 else ("LONG" if p_val >= 0.5 else "SHORT")

        return {
            "signal": signal,
            "probability_long": round(float(p_val), 4),
            "probability_short": round(float(1 - p_val), 4),
            "confidence": round(float(confidence), 4),
            "reason": f"{signal} probability {p_val:.2%}" if signal != "NEUTRAL" else "Near 50/50 probability",
        }

    def predict_features(self, feature_dict: dict) -> dict:
        if not self._feature_cols:
            return {"signal": "NEUTRAL", "probability": 0.5, "confidence": 0.0}
        row = {k: feature_dict.get(k, 0.0) for k in self._feature_cols}
        return self.predict(pd.DataFrame([row]))

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    def get_metrics(self) -> dict:
        return {
            "cv_roc_auc_mean": round(np.mean(self._cv_scores), 4) if self._cv_scores else 0.0,
            "trained": self._is_trained,
        }
