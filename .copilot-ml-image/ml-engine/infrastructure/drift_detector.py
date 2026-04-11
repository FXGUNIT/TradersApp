"""
Drift Detection — Monitors for Feature and Concept Drift

Types of drift detected:
1. Feature Drift (PSI) — input feature distribution changes
   → Detected via Population Stability Index (PSI) on rolling windows
2. Concept Drift (accuracy drop) — prediction accuracy degrades
   → Tracked via rolling win rate on paper trade log
3. Regime Drift (HMM) — market regime has shifted
   → Tracked via HMM posterior probability change

Drift thresholds trigger auto-retraining pipeline.

Reference: "Domain Adaptation with Changing Market Regimes"
  — Concept drift detection via Kolmogorov-Smirnov test + PSI
"""

import numpy as np
import pandas as pd
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone


# ─── PSI Thresholds ─────────────────────────────────────────────────────────────

@dataclass
class DriftThresholds:
    """Thresholds for triggering drift alerts and retraining."""

    # Feature drift (PSI thresholds)
    psi_feature_warning: float = 0.1   # PSI > 0.1 → warning
    psi_feature_alert: float = 0.2    # PSI > 0.2 → retrain
    psi_feature_critical: float = 0.25  # PSI > 0.25 → immediate retrain

    # Concept drift (accuracy drop)
    accuracy_drop_warning: float = 0.03   # Accuracy drop > 3% → warning
    accuracy_drop_alert: float = 0.05      # Accuracy drop > 5% → retrain
    rolling_window_trades: int = 100       # Trades per rolling window

    # Regime drift
    regime_change_threshold: float = 0.7  # HMM posterior change > 70% → regime shift

    # Min samples before computing drift
    min_baseline_trades: int = 50
    min_current_trades: int = 20


# ─── Population Stability Index ───────────────────────────────────────────────

def calculate_psi(
    expected: np.ndarray,
    actual: np.ndarray,
    n_bins: int = 10,
    epsilon: float = 1e-6,
) -> float:
    """
    Calculate Population Stability Index between expected and actual distributions.

    PSI < 0.1  → No significant change
    0.1–0.2    → Moderate shift — monitor closely
    0.2–0.25   → Significant shift — investigate
    > 0.25     → Major shift — retrain recommended

    Formula: PSI = Σ [(Actual% - Expected%) × ln(Actual% / Expected%)]

    Args:
        expected: baseline distribution values
        actual: current distribution values
        n_bins: number of bins for distribution comparison
        epsilon: small value to avoid division by zero

    Returns:
        PSI float value
    """
    # Create bins from expected distribution
    breakpoints = np.percentile(expected, np.linspace(0, 100, n_bins + 1))
    breakpoints[0] = -np.inf
    breakpoints[-1] = np.inf

    # Calculate actual % in each bin
    actual_counts = np.histogram(actual, bins=breakpoints)[0]
    actual_pct = (actual_counts / len(actual) + epsilon)

    # Calculate expected % in each bin
    expected_counts = np.histogram(expected, bins=breakpoints)[0]
    expected_pct = (expected_counts / len(expected) + epsilon)

    # PSI formula
    psi_value = np.sum(
        (actual_pct - expected_pct) * np.log(actual_pct / expected_pct + epsilon)
    )

    return float(psi_value)


# ─── Feature Drift Detector ────────────────────────────────────────────────────

class FeatureDriftDetector:
    """
    Detects feature distribution drift using PSI.

    Uses a rolling window approach:
    - Baseline window: last N trades (established "normal" distribution)
    - Current window: most recent M trades
    - PSI computed per feature across rolling windows

    When PSI exceeds thresholds, emits alert with list of drifted features.
    """

    def __init__(
        self,
        thresholds: DriftThresholds | None = None,
        n_baseline_trades: int = 200,
        n_current_trades: int = 50,
    ):
        self.thresholds = thresholds or DriftThresholds()
        self.n_baseline = n_baseline_trades
        self.n_current = n_current_trades

        # Baseline distributions: feature_name → baseline values
        self._baselines: dict[str, np.ndarray] = {}

        # History of PSI values per feature
        self._psi_history: dict[str, list[float]] = {}

        # Alert state
        self._drifted_features: set[str] = set()

    def update_baseline(self, features_df: pd.DataFrame, trades: pd.DataFrame):
        """
        Update baseline distributions with the most recent trades.

        Called after training or periodically to refresh the baseline.
        Uses the last n_baseline_trades to build distribution.
        """
        if len(trades) < self.thresholds.min_baseline_trades:
            return  # Not enough data

        recent = features_df.tail(self.n_baseline)
        for col in recent.columns:
            if col.startswith("label_") or col.startswith("timestamp"):
                continue
            try:
                vals = recent[col].dropna().values.astype(float)
                vals = vals[np.isfinite(vals)]
                if len(vals) > 10:
                    self._baselines[col] = vals
                    if col not in self._psi_history:
                        self._psi_history[col] = []
            except (ValueError, TypeError):
                continue  # Skip non-numeric columns

    def detect(
        self,
        features_df: pd.DataFrame,
        trades: pd.DataFrame,
    ) -> dict:
        """
        Detect feature drift against current baseline.

        Returns dict with:
        - status: "ok" | "warning" | "alert" | "critical"
        - psi_scores: dict of feature → PSI values
        - drifted_features: list of features with PSI > threshold
        - most_drifted: top 5 most drifted features
        """
        if len(trades) < self.thresholds.min_current_trades:
            return {
                "status": "ok",
                "reason": "Not enough current trades for drift detection",
                "psi_scores": {},
                "drifted_features": [],
            }

        if not self._baselines:
            # No baseline yet — initialize it
            self.update_baseline(features_df, trades)
            return {
                "status": "ok",
                "reason": "Baseline initialized",
                "psi_scores": {},
                "drifted_features": [],
            }

        current = features_df.tail(self.n_current)
        psi_scores = {}
        drifted = []

        for col, baseline in self._baselines.items():
            if col not in current.columns:
                continue
            try:
                vals = current[col].dropna().values.astype(float)
                vals = vals[np.isfinite(vals)]
                if len(vals) < 5:
                    continue

                psi = calculate_psi(baseline[-500:], vals)  # last 500 for stability
                psi_scores[col] = round(psi, 4)
                self._psi_history[col].append(psi)

                # Keep history bounded
                if len(self._psi_history[col]) > 100:
                    self._psi_history[col] = self._psi_history[col][-100:]

                if psi >= self.thresholds.psi_feature_critical:
                    drifted.append({"feature": col, "psi": psi, "severity": "critical"})
                elif psi >= self.thresholds.psi_feature_alert:
                    drifted.append({"feature": col, "psi": psi, "severity": "alert"})
                elif psi >= self.thresholds.psi_feature_warning:
                    drifted.append({"feature": col, "psi": psi, "severity": "warning"})
            except Exception:
                continue

        drifted.sort(key=lambda x: x["psi"], reverse=True)
        self._drifted_features = {d["feature"] for d in drifted}

        if any(d["severity"] == "critical" for d in drifted):
            status = "critical"
        elif any(d["severity"] == "alert" for d in drifted):
            status = "alert"
        elif any(d["severity"] == "warning" for d in drifted):
            status = "warning"
        else:
            status = "ok"

        return {
            "status": status,
            "psi_scores": psi_scores,
            "drifted_features": [d["feature"] for d in drifted],
            "most_drifted": drifted[:5],
            "n_baseline_trades": len(baseline) if self._baselines else 0,
            "n_current_trades": len(current),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def should_retrain(self, drift_result: dict | None = None) -> bool:
        """Returns True if drift severity warrants model retraining."""
        if drift_result is None:
            drift_result = {"status": "ok"}
        return drift_result.get("status") in ("alert", "critical")


# ─── Concept Drift Detector ────────────────────────────────────────────────────

class ConceptDriftDetector:
    """
    Detects concept drift via rolling accuracy / win rate monitoring.

    Compares:
    - Rolling win rate on recent trades vs historical baseline
    - Prediction confidence distribution shift

    A sustained drop in rolling win rate indicates the model is outdated.
    """

    def __init__(
        self,
        thresholds: DriftThresholds | None = None,
        rolling_window: int = 100,
    ):
        self.thresholds = thresholds or DriftThresholds()
        self.rolling_window = rolling_window

        # Historical baseline: rolling win rate when model was trained
        self._baseline_win_rate: float | None = None
        self._baseline_count: int = 0

        # Recent rolling window
        self._recent_results: list[dict] = []  # list of {correct, confidence, timestamp}

    def set_baseline(self, trades_df: pd.DataFrame):
        """
        Set the baseline win rate from training-time trades.
        Call this after model training with the trades used for training.
        """
        if len(trades_df) < self.thresholds.min_baseline_trades:
            return
        correct = (trades_df["result"] == "win").sum()
        total = len(trades_df)
        self._baseline_win_rate = correct / total
        self._baseline_count = total

    def record_prediction(self, correct: bool, confidence: float):
        """Record a prediction result for rolling drift tracking."""
        self._recent_results.append({
            "correct": correct,
            "confidence": confidence,
            "timestamp": datetime.now(timezone.utc).timestamp(),
        })
        # Keep bounded
        if len(self._recent_results) > self.rolling_window * 2:
            self._recent_results = self._recent_results[-self.rolling_window:]

    def detect(self) -> dict:
        """
        Detect concept drift via win rate degradation.

        Returns:
        - status: "ok" | "warning" | "alert"
        - baseline_win_rate: established win rate at training time
        - current_win_rate: rolling window win rate
        - drop_pct: how much the win rate has dropped
        """
        if self._baseline_win_rate is None:
            return {"status": "ok", "reason": "No baseline established"}

        recent = self._recent_results[-self.rolling_window:]
        if len(recent) < self.thresholds.min_current_trades:
            return {
                "status": "ok",
                "reason": f"Only {len(recent)} recent predictions, need {self.thresholds.min_current_trades}",
            }

        current_wr = sum(1 for r in recent if r["correct"]) / len(recent)
        drop = self._baseline_win_rate - current_wr
        drop_pct = drop / max(self._baseline_win_rate, 0.01)

        # Average confidence of recent predictions
        avg_conf = sum(r["confidence"] for r in recent) / len(recent)

        if drop_pct >= self.thresholds.accuracy_drop_alert:
            status = "alert"
        elif drop_pct >= self.thresholds.accuracy_drop_warning:
            status = "warning"
        else:
            status = "ok"

        return {
            "status": status,
            "baseline_win_rate": round(self._baseline_win_rate, 4),
            "current_win_rate": round(current_wr, 4),
            "win_rate_drop": round(drop, 4),
            "win_rate_drop_pct": round(drop_pct, 4),
            "avg_confidence_recent": round(avg_conf, 4),
            "n_recent_predictions": len(recent),
            "n_baseline_predictions": self._baseline_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def should_retrain(self) -> bool:
        result = self.detect()
        return result.get("status") == "alert"


# ─── Regime Drift Detector ────────────────────────────────────────────────────

class RegimeDriftDetector:
    """
    Detects market regime shifts that may invalidate the current model.

    Uses HMM posterior probability changes:
    - Track which regime the model thinks we're in
    - If regime changes and stays changed for > N consecutive bars, flag as regime drift
    - Regime changes mean the market dynamics have shifted → model should be retrained
    """

    def __init__(
        self,
        thresholds: DriftThresholds | None = None,
        confirm_window: int = 20,
    ):
        self.thresholds = thresholds or DriftThresholds()
        self.confirm_window = confirm_window  # bars before confirming regime shift

        self._regime_history: list[str] = []
        # Baseline: the regime we last decided to retrain FOR (only updated on regime CHANGE)
        self._baseline_regime: str | None = None
        # Current: the most recently confirmed regime (updated on every detect() all_same confirmation)
        self._current_regime: str | None = None
        self._previous_regime: str | None = None  # tracks regime before last confirmed change
        self._last_seen_regime: str | None = None  # last observed regime (updated in update(), for counter)
        self._consecutive_same: int = 0

    def update(self, regime: str, regime_confidence: float):
        """
        Update with current regime prediction from HMM.

        Tracks consecutive bars of the same regime to detect sustained shifts.
        _last_seen_regime tracks what was actually observed (for counter logic).
        _current_regime is only updated in detect() when a change is confirmed.
        """
        self._regime_history.append(regime)

        if regime != self._last_seen_regime:
            self._consecutive_same = 0
            self._last_seen_regime = regime
        else:
            self._consecutive_same += 1

        if len(self._regime_history) > 100:
            self._regime_history = self._regime_history[-100:]

    def detect(self) -> dict:
        """
        Detect if market regime has shifted and persisted.

        A regime shift is confirmed when the same regime is predicted
        for self.confirm_window consecutive bars after a change.

        _current_regime holds the last CONFIRMED regime (updated here only).
        _last_seen_regime holds the last observed regime (updated in update()).
        _baseline_regime is set during warm-up and tracks what regime we started in.
        """
        if len(self._regime_history) < self.confirm_window:
            return {
                "status": "ok",
                "reason": f"Only {len(self._regime_history)} bars, need {self.confirm_window}",
            }

        # Check: last `confirm_window` bars are the same regime
        recent_window = self._regime_history[-self.confirm_window:]
        all_same = len(set(recent_window)) == 1
        new_regime = recent_window[0]

        if all_same and new_regime != self._current_regime:
            # Confirmed regime change: update confirmed regime
            self._previous_regime = self._current_regime
            self._current_regime = new_regime
            # _baseline_regime is set on first change (warm-up) and on each
            # subsequent confirmed regime transition — it tracks what we retrained for
            self._baseline_regime = new_regime
            return {
                "status": "alert",
                "regime_change": True,
                "previous_regime": self._previous_regime,
                "current_regime": new_regime,
                "consecutive_same": self._consecutive_same,
                "confidence": "sustained",
                "recommendation": f"Market regime changed to {new_regime} — consider retraining model",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        # Initialize _current_regime on first sufficient history (no alert)
        # Also set _baseline_regime to establish what regime we last retrained for
        if self._current_regime is None and all_same:
            self._current_regime = new_regime
            self._baseline_regime = new_regime  # we retrained FOR this regime

        return {
            "status": "ok",
            "current_regime": self._current_regime,
            "previous_regime": self._previous_regime,
            "consecutive_same": self._consecutive_same,
            "regime_history": self._regime_history[-10:],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def should_retrain(self) -> bool:
        """
        Read-only check: should retraining be triggered?

        Returns True when the observed regime (_last_seen_regime) differs from
        the baseline regime we trained on (_baseline_regime).
        Does NOT call detect() — reads state directly, so multiple calls are safe.
        Returns False during warm-up (baseline not yet established).
        """
        if len(self._regime_history) < self.confirm_window:
            return False
        if self._baseline_regime is None:
            return False
        # Retrain if the observed regime has drifted from the training baseline
        return self._last_seen_regime != self._baseline_regime


# ─── Unified Drift Monitor ────────────────────────────────────────────────────

class DriftMonitor:
    """
    Unified drift detection combining feature, concept, and regime drift.

    Use this as the single entry point for all drift monitoring.
    """

    def __init__(
        self,
        thresholds: DriftThresholds | None = None,
        n_baseline_trades: int = 200,
    ):
        self.thresholds = thresholds or DriftThresholds()
        self.feature_drift = FeatureDriftDetector(thresholds, n_baseline_trades)
        self.concept_drift = ConceptDriftDetector(thresholds)
        self.regime_drift = RegimeDriftDetector(thresholds)

    def check_all(
        self,
        features_df: pd.DataFrame,
        trades_df: pd.DataFrame,
        current_regime: str | None = None,
        regime_confidence: float = 1.0,
    ) -> dict:
        """Run all drift detectors and return combined assessment."""
        feature_result = self.feature_drift.detect(features_df, trades_df)
        concept_result = self.concept_drift.detect()

        if current_regime:
            self.regime_drift.update(current_regime, regime_confidence)

        regime_result = self.regime_drift.detect()

        # Overall status is the worst of all checks
        statuses = [
            feature_result.get("status", "ok"),
            concept_result.get("status", "ok"),
            regime_result.get("status", "ok"),
        ]
        priority = {"ok": 0, "warning": 1, "alert": 2, "critical": 3}
        overall = max(statuses, key=lambda s: priority.get(s, 0))

        should_retrain = (
            feature_result.get("status") in ("alert", "critical")
            or concept_result.get("status") == "alert"
            or regime_result.get("status") == "alert"
        )

        return {
            "overall_status": overall,
            "should_retrain": should_retrain,
            "feature_drift": feature_result,
            "concept_drift": concept_result,
            "regime_drift": regime_result,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
