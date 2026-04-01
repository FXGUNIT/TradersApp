"""
SVM Direction Classifier — finds optimal hyperplane for direction separation.
Uses CalibratedClassifierCV (sigmoid) for probability estimates.
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
from sklearn.svm import SVC
from sklearn.metrics import roc_auc_score, accuracy_score, log_loss


class SVMClassifier:
    """
    SVM-based directional classifier.
    Uses RBF kernel with calibration for probability estimates.
    Output: LONG / SHORT / NEUTRAL + probability + confidence
    """

    name = "svm"
    model_type = "direction"

    def __init__(self):
        self.pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", CalibratedClassifierCV(
                SVC(
                    kernel="rbf",
                    C=1.0,
                    gamma="scale",
                    probability=True,
                    random_state=42,
                    class_weight="balanced",
                ),
                method="sigmoid",
                cv=5,
            )),
        ])
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
        """Train with TimeSeriesSplit CV → final training on all data."""
        self._feature_cols = feature_cols or [c for c in X.columns if c in config.FEATURE_COLS]
        X_use = X[self._feature_cols].copy()
        y_use = y.loc[X_use.index].copy()

        mask = X_use.notna().all(axis=1) & y_use.notna()
        X_use = X_use[mask]
        y_use = y_use[mask]

        if len(X_use) < 100:
            raise ValueError(f"Need at least 100 samples, got {len(X_use)}")

        cv = TimeSeriesCrossValidator(
            n_splits=config.TSCV_N_SPLITS,
            gap=config.TSCV_GAP,
        )
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
            ll = log_loss(y_val, proba)

            self._cv_scores.append(roc_auc)
            fold_metrics.append({
                "fold": fold_idx + 1,
                "roc_auc": round(roc_auc, 4),
                "accuracy": round(acc, 4),
                "log_loss": round(ll, 4),
                "train_size": len(train_idx),
                "val_size": len(val_idx),
            })

            if verbose:
                print(f"  Fold {fold_idx + 1}: ROC-AUC={roc_auc:.4f}  Acc={acc:.4f}  LL={ll:.4f}")

        self.pipeline.fit(X_use, y_use)
        self._is_trained = True

        # Feature importance via permutation importance (approximate)
        # SVM with RBF doesn't have direct feature_importances_; use absolute mean of decision function
        importance = self._approximate_importance(X_use)

        fi = sorted(
            zip(self._feature_cols, importance),
            key=lambda x: abs(x[1]),
            reverse=True,
        )

        result = {
            "model": self.name,
            "cv_roc_auc_mean": round(np.mean(self._cv_scores), 4),
            "cv_roc_auc_std": round(np.std(self._cv_scores), 4),
            "cv_accuracy_mean": round(np.mean([f["accuracy"] for f in fold_metrics]), 4),
            "folds": fold_metrics,
            "feature_importance": {k: round(abs(v), 4) for k, v in fi[:20]},
            "training_samples": len(X_use),
        }

        if verbose:
            print(f"  SVM CV ROC-AUC: {result['cv_roc_auc_mean']:.4f} ± {result['cv_roc_auc_std']:.4f}")

        return result

    def _approximate_importance(self, X: pd.DataFrame) -> np.ndarray:
        """Approximate SVM feature importance using absolute mean of scaled weights proxy."""
        scaler = self.pipeline.named_steps["scaler"]
        clf = self.pipeline.named_steps["clf"]
        if hasattr(clf, "estimators_") and clf.estimators_:
            # Get support vectors influence (approximate)
            estimator = clf.estimators_[0]
            if hasattr(estimator, "support_vectors_"):
                # Weight support vectors by their dual coefficients
                sv = estimator.support_vectors_
                if len(sv) > 0:
                    # Simple proxy: average absolute value of support vectors per feature
                    return np.abs(sv).mean(axis=0)
        return np.ones(len(self._feature_cols)) * 0.5

    def predict(self, X: pd.DataFrame) -> dict:
        """Predict direction for a single row or DataFrame."""
        if not self._is_trained:
            return {"signal": "NEUTRAL", "probability": 0.5, "confidence": 0.0, "reason": "Model not trained"}

        X_use = X[self._feature_cols].copy() if self._feature_cols else X.copy()
        if len(X_use) == 0:
            return {"signal": "NEUTRAL", "probability": 0.5, "confidence": 0.0, "reason": "No features"}

        proba = self.pipeline.predict_proba(X_use)

        if proba.shape[1] == 2:
            long_proba = proba[:, 1]
        else:
            long_proba = np.full(proba.shape[0], 0.5)

        results = []
        for i in range(len(long_proba)):
            p = long_proba[i]
            confidence = max(p, 1 - p)
            if confidence < 0.52:
                signal = "NEUTRAL"
                reason = "Probability near 50% — no clear directional bias"
            elif p >= 0.5:
                signal = "LONG"
                reason = f"Long probability {p:.2%} exceeds 50% threshold"
            else:
                signal = "SHORT"
                reason = f"Short probability {1 - p:.2%} exceeds 50% threshold"

            results.append({
                "signal": signal,
                "probability_long": round(p, 4),
                "probability_short": round(1 - p, 4),
                "confidence": round(confidence, 4),
                "reason": reason,
            })

        if len(results) == 1:
            return results[0]
        return results

    def predict_features(self, feature_dict: dict) -> dict:
        """Predict from a flat feature dict (single sample)."""
        if not self._feature_cols:
            return {"signal": "NEUTRAL", "probability": 0.5, "confidence": 0.0}

        row = {k: feature_dict.get(k, 0.0) for k in self._feature_cols}
        df = pd.DataFrame([row])
        return self.predict(df)

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    def get_metrics(self) -> dict:
        return {
            "cv_roc_auc_mean": round(np.mean(self._cv_scores), 4) if self._cv_scores else 0.0,
            "cv_roc_auc_std": round(np.std(self._cv_scores), 4) if self._cv_scores else 0.0,
            "trained": self._is_trained,
        }
