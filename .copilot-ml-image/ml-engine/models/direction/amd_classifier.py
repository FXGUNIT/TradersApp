"""
AMD Phase Classifier — Gaussian Naive Bayes for directional signal based on AMD phase.
Uses historical win rate per AMD phase as a prior probability modifier.
Simple, fast, interpretable — adds diversity to the ensemble vote.
"""
import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config
from training.cross_validator import TimeSeriesCrossValidator

from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score, log_loss


class AMDClassifier:
    """
    AMD Phase Classifier using Gaussian Naive Bayes.
    Learns P(features | AMD_phase) to predict direction from phase + features.
    Output: LONG / SHORT / NEUTRAL + probability + confidence
    """

    name = "amd_classifier"
    model_type = "direction"

    def __init__(self):
        self.pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", GaussianNB()),
        ])
        self._is_trained = False
        self._cv_scores: list[float] = []
        self._feature_cols: list[str] = []
        self._amd_win_rates: dict[str, float] = {}

    def train(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        feature_cols: list[str] | None = None,
        trade_log: pd.DataFrame | None = None,
        verbose: bool = True,
    ) -> dict:
        """
        Train with TimeSeriesSplit CV → final training on all data.
        trade_log: if provided, used to compute AMD phase win rate priors.
        """
        self._feature_cols = feature_cols or [c for c in X.columns if c in config.FEATURE_COLS]
        X_use = X[self._feature_cols].copy()
        y_use = y.loc[X_use.index].copy()

        mask = X_use.notna().all(axis=1) & y_use.notna()
        X_use = X_use[mask]
        y_use = y_use[mask]

        if len(X_use) < 100:
            raise ValueError(f"Need at least 100 samples, got {len(X_use)}")

        # Compute AMD phase win rates from trade log
        self._compute_amd_win_rates(trade_log, X_use)

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

        # Feature importance via Naive Bayes conditional probabilities
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
            "amd_win_rates": {k: round(v, 4) for k, v in self._amd_win_rates.items()},
            "training_samples": len(X_use),
        }

        if verbose:
            print(f"  AMD NB CV ROC-AUC: {result['cv_roc_auc_mean']:.4f} ± {result['cv_roc_auc_std']:.4f}")
            print(f"  AMD Win Rates: {self._amd_win_rates}")

        return result

    def _compute_amd_win_rates(
        self, trade_log: pd.DataFrame | None, X: pd.DataFrame | None
    ) -> None:
        """Compute historical win rate per AMD phase."""
        self._amd_win_rates = {}
        for phase in config.AMD_PHASES:
            self._amd_win_rates[phase] = 0.5  # default

        if trade_log is None or trade_log.empty:
            # Fallback: use AMD phase columns from X
            if X is not None and not X.empty:
                amd_cols = [c for c in X.columns if c.startswith("amd_")]
                if amd_cols:
                    for col in amd_cols:
                        phase = col.replace("amd_", "")
                        mask = X[col] == 1 if X[col].dtype in (int, float) else X[col]
                        if mask.sum() > 0:
                            self._amd_win_rates[phase] = 0.55  # slight prior
            return

        if "result" not in trade_log.columns:
            return

        wins = trade_log["result"] == "win"
        for phase in config.AMD_PHASES:
            phase_mask = wins
            if "amd_phase" in trade_log.columns:
                phase_mask = trade_log["amd_phase"] == phase
            sub = trade_log[phase_mask]
            if len(sub) >= 5:
                self._amd_win_rates[phase] = float((sub["result"] == "win").mean())

    def _approximate_importance(self, X: pd.DataFrame) -> np.ndarray:
        """Approximate GNB feature importance via conditional probability spread."""
        clf = self.pipeline.named_steps["clf"]
        if hasattr(clf, "theta_"):
            # Class-conditional means difference per feature
            if clf.classes_.shape[0] >= 2:
                mean_diff = np.abs(clf.theta_[1] - clf.theta_[0])
                return mean_diff / (mean_diff.max() + 1e-8)
        return np.ones(len(self._feature_cols)) * 0.5

    def predict(self, X: pd.DataFrame) -> dict:
        """Predict direction using GNB + AMD phase prior adjustment."""
        if not self._is_trained:
            return {"signal": "NEUTRAL", "probability": 0.5, "confidence": 0.0, "reason": "Model not trained"}

        X_use = X[self._feature_cols].copy() if self._feature_cols else X.copy()
        if len(X_use) == 0:
            return {"signal": "NEUTRAL", "probability": 0.5, "confidence": 0.0, "reason": "No features"}

        proba = self.pipeline.predict_proba(X_use)

        if proba.shape[1] == 2:
            base_proba = proba[:, 1]
        else:
            base_proba = np.full(proba.shape[0], 0.5)

        # Adjust probability by AMD phase win rate prior
        adjusted_proba = self._adjust_by_amd_prior(base_proba, X_use)

        results = []
        for i in range(len(adjusted_proba)):
            p = adjusted_proba[i]
            confidence = max(p, 1 - p)

            # Determine current AMD phase from features
            amd_phase = self._get_amd_phase(X_use.iloc[i] if i < len(X_use) else X_use.iloc[-1])
            amd_wr = self._amd_win_rates.get(amd_phase, 0.5)

            if confidence < 0.52:
                signal = "NEUTRAL"
                reason = f"Probability near 50% — no clear bias. AMD {amd_phase} (win rate: {amd_wr:.0%})"
            elif p >= 0.5:
                signal = "LONG"
                reason = f"Long probability {p:.2%}. AMD {amd_phase} historically: {amd_wr:.0%} win rate."
            else:
                signal = "SHORT"
                reason = f"Short probability {1 - p:.2%}. AMD {amd_phase} historically: {amd_wr:.0%} win rate."

            results.append({
                "signal": signal,
                "probability_long": round(p, 4),
                "probability_short": round(1 - p, 4),
                "confidence": round(confidence, 4),
                "reason": reason,
                "amd_phase": amd_phase,
                "amd_win_rate": round(amd_wr, 4),
            })

        if len(results) == 1:
            return results[0]
        return results

    def _adjust_by_amd_prior(
        self, proba: np.ndarray, X: pd.DataFrame
    ) -> np.ndarray:
        """Blend GNB probability with AMD phase historical win rate."""
        adjusted = proba.copy()
        for i in range(len(adjusted)):
            amd_phase = self._get_amd_phase(X.iloc[i] if i < len(X) else X.iloc[-1])
            amd_wr = self._amd_win_rates.get(amd_phase, 0.5)
            # Bayesian-like blending: weight GNB prediction with AMD prior
            # Give AMD prior 30% weight
            adjusted[i] = 0.7 * adjusted[i] + 0.3 * amd_wr
        return np.clip(adjusted, 0.01, 0.99)

    def _get_amd_phase(self, row: pd.Series) -> str:
        """Extract AMD phase from one-hot encoded feature row."""
        for phase in config.AMD_PHASES:
            col = f"amd_{phase}"
            if col in row.index:
                val = row[col]
                if val == 1 or val == 1.0:
                    return phase
        return "UNCLEAR"

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
            "amd_win_rates": self._amd_win_rates,
        }
