"""
Feature & Concept Drift Monitoring

Monitors:
  1. Feature drift: PSI (Population Stability Index) on feature distributions
  2. Concept drift: KL divergence on model prediction distributions
  3. Regime drift: Hellinger distance on regime probability distributions
  4. Performance drift: Rolling accuracy degradation

Usage:
  # Run all drift checks
  python -m ml_engine.infrastructure.drift_monitor --check-all

  # Individual checks
  python -m ml_engine.infrastructure.drift_monitor --feature-drift
  python -m ml_engine.infrastructure.drift_monitor --concept-drift
  python -m ml_engine.infrastructure.drift_monitor --regime-drift

  # Set baseline
  python -m ml_engine.infrastructure.drift_monitor --set-baseline

  # As FastAPI endpoint (integrated with main.py)
  POST /drift/detect    — run on-demand drift detection
  POST /drift/baseline  — refresh baseline
  GET  /drift/status    — current drift status
"""

from __future__ import annotations

import os
import sys
import json
import logging
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, asdict, field
from collections import defaultdict

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "ml-engine"))

from ml_engine.data.candle_db import CandleDatabase

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("drift_monitor")

# ─── Thresholds ─────────────────────────────────────────────────────────────

DRIFT_THRESHOLDS = {
    # Feature drift: PSI > 0.2 = significant shift, > 0.1 = minor shift
    "psi_feature_minor": 0.1,
    "psi_feature_major": 0.2,
    # Concept drift: KL divergence > 0.5 = significant
    "kl_concept_major": 0.5,
    # Regime drift: Hellinger distance > 0.3 = significant
    "hellinger_regime_major": 0.3,
    # Performance: rolling accuracy < 0.50 = alert
    "accuracy_alert": 0.50,
    # Number of recent predictions to compare
    "window_size": 500,
    "baseline_window": 1000,
}


# ─── Data Classes ───────────────────────────────────────────────────────────

@dataclass
class DriftResult:
    drift_detected: bool
    severity: str  # "NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"
    score: float
    threshold: float
    drift_type: str  # "feature", "concept", "regime", "performance"
    affected_features: list = field(default_factory=list)
    message: str = ""
    timestamp: str = ""
    details: dict = field(default_factory=dict)

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class DriftBaseline:
    feature_distributions: dict  # feature_name → {bins: [], counts: []}
    concept_distribution: dict  # signal → probability
    regime_distribution: dict  # regime → probability
    accuracy_baseline: float
    created_at: str = ""
    sample_size: int = 0
    symbol: str = "MNQ"

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc).isoformat()


# ─── PSI — Population Stability Index ──────────────────────────────────────

def compute_psi(expected: np.ndarray, actual: np.ndarray, n_bins: int = 10) -> float:
    """
    Compute Population Stability Index (PSI).

    PSI < 0.1:  No significant change
    PSI 0.1-0.2: Minor change (monitor)
    PSI > 0.2:  Significant change (alert)
    PSI > 0.25: Major change (retrain)

    Formula: PSI = SUM((Actual% - Expected%) * ln(Actual% / Expected%))
    """
    # Handle edge cases
    if len(expected) == 0 or len(actual) == 0:
        return 0.0

    # Clip to avoid log(0)
    expected = np.clip(expected, 1e-6, None)
    actual = np.clip(actual, 1e-6, None)

    # Determine bin edges from combined data
    combined = np.concatenate([expected, actual])
    percentiles = np.linspace(0, 100, n_bins + 1)
    bin_edges = np.percentile(combined, percentiles)
    bin_edges[0] = -np.inf
    bin_edges[-1] = np.inf

    # Bin both distributions
    expected_counts = np.histogram(expected, bins=bin_edges)[0]
    actual_counts = np.histogram(actual, bins=bin_edges)[0]

    # Convert to proportions
    expected_pct = expected_counts / (expected_counts.sum() + 1e-10)
    actual_pct = actual_counts / (actual_counts.sum() + 1e-10)

    # PSI
    psi_values = (actual_pct - expected_pct) * np.log(actual_pct / expected_pct)
    psi = np.nansum(psi_values)

    return float(psi)


def detect_feature_drift(
    db: CandleDatabase,
    symbol: str,
    baseline: DriftBaseline,
    current_window: int = 500,
) -> DriftResult:
    """
    Detect feature drift by comparing PSI of all features
    between baseline period and recent period.
    """
    log.info("Checking feature drift...")

    try:
        # Get baseline candles
        baseline_candles = db.get_candles(
            start=(datetime.now(timezone.utc) - timedelta(days=7)).isoformat(),
            end=baseline.created_at,
            symbol=symbol,
            limit=baseline.sample_size,
        )

        # Get recent candles
        recent_candles = db.get_candles(
            start=(datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
            end=datetime.now(timezone.utc).isoformat(),
            symbol=symbol,
            limit=current_window,
        )

        if baseline_candles.empty or recent_candles.empty:
            return DriftResult(
                drift_detected=False,
                severity="NONE",
                score=0.0,
                threshold=DRIFT_THRESHOLDS["psi_feature_major"],
                drift_type="feature",
                message="Insufficient data for feature drift detection",
            )

        # Key features to monitor
        key_features = ["close", "volume", "log_return", "atr", "rolling_std_10", "momentum_3bar"]
        # Add all available columns
        available_features = [f for f in key_features if f in baseline_candles.columns and f in recent_candles.columns]

        psi_scores = {}
        affected = []

        for feature in available_features:
            baseline_vals = baseline_candles[feature].dropna().values
            recent_vals = recent_candles[feature].dropna().values

            if len(baseline_vals) < 30 or len(recent_vals) < 30:
                continue

            psi = compute_psi(baseline_vals, recent_vals)
            psi_scores[feature] = psi

            if psi > DRIFT_THRESHOLDS["psi_feature_major"]:
                affected.append(feature)

        if not psi_scores:
            return DriftResult(
                drift_detected=False,
                severity="NONE",
                score=0.0,
                threshold=DRIFT_THRESHOLDS["psi_feature_major"],
                drift_type="feature",
            )

        max_psi = max(psi_scores.values())
        avg_psi = np.mean(list(psi_scores.values()))

        severity = "NONE"
        if max_psi > DRIFT_THRESHOLDS["psi_feature_major"]:
            severity = "HIGH"
        elif max_psi > DRIFT_THRESHOLDS["psi_feature_minor"]:
            severity = "MEDIUM"

        return DriftResult(
            drift_detected=severity != "NONE",
            severity=severity,
            score=avg_psi,
            threshold=DRIFT_THRESHOLDS["psi_feature_minor"],
            drift_type="feature",
            affected_features=affected,
            message=f"Max PSI={max_psi:.4f}, Avg PSI={avg_psi:.4f} across {len(psi_scores)} features",
            details={"psi_per_feature": psi_scores, "n_baseline": len(baseline_candles), "n_recent": len(recent_candles)},
        )

    except Exception as e:
        log.error(f"Feature drift detection failed: {e}")
        return DriftResult(
            drift_detected=False,
            severity="NONE",
            score=0.0,
            threshold=DRIFT_THRESHOLDS["psi_feature_major"],
            drift_type="feature",
            message=f"Error: {e}",
        )


# ─── Concept Drift — KL Divergence ─────────────────────────────────────────

def kl_divergence(p: np.ndarray, q: np.ndarray, eps: float = 1e-10) -> float:
    """Compute KL divergence D(P || Q)."""
    p = np.clip(p, eps, 1.0)
    q = np.clip(q, eps, 1.0)
    return float(np.sum(p * np.log(p / q)))


def detect_concept_drift(
    db: CandleDatabase,
    symbol: str,
    baseline: DriftBaseline,
    current_window: int = 500,
) -> DriftResult:
    """
    Detect concept drift by comparing signal distribution
    between baseline and recent predictions.
    """
    log.info("Checking concept drift...")

    try:
        # Get signal log from database
        # Note: this requires signal_log table to exist
        conn = db._get_conn().__enter__()
        cursor = conn.cursor()

        # Recent predictions
        cursor.execute("""
            SELECT signal, COUNT(*) as count
            FROM signal_log
            WHERE symbol = ?
                AND timestamp >= datetime('now', '-1 day')
            GROUP BY signal
        """, (symbol,))
        recent_signals = dict(cursor.fetchall())

        # Baseline
        cursor.execute("""
            SELECT signal, COUNT(*) as count
            FROM signal_log
            WHERE symbol = ?
                AND timestamp <= ?
            GROUP BY signal
        """, (symbol, baseline.created_at))
        baseline_signals = dict(cursor.fetchall())

        if not recent_signals or not baseline_signals:
            return DriftResult(
                drift_detected=False,
                severity="NONE",
                score=0.0,
                threshold=DRIFT_THRESHOLDS["kl_concept_major"],
                drift_type="concept",
                message="Insufficient signal data for concept drift detection",
            )

        # Normalize to probabilities
        signals = list(set(list(recent_signals.keys()) + list(baseline_signals.keys())))
        recent_prob = np.array([recent_signals.get(s, 0) for s in signals], dtype=float)
        recent_prob = recent_prob / recent_prob.sum()
        baseline_prob = np.array([baseline_signals.get(s, 0) for s in signals], dtype=float)
        baseline_prob = baseline_prob / baseline_prob.sum()

        kl = kl_divergence(recent_prob, baseline_prob)

        severity = "NONE"
        if kl > DRIFT_THRESHOLDS["kl_concept_major"]:
            severity = "HIGH"
        elif kl > DRIFT_THRESHOLDS["kl_concept_major"] * 0.7:
            severity = "MEDIUM"

        return DriftResult(
            drift_detected=severity != "NONE",
            severity=severity,
            score=kl,
            threshold=DRIFT_THRESHOLDS["kl_concept_major"],
            drift_type="concept",
            message=f"KL divergence = {kl:.4f}",
            details={"recent_distribution": recent_signals, "baseline_distribution": baseline_signals},
        )

    except Exception as e:
        log.error(f"Concept drift detection failed: {e}")
        return DriftResult(
            drift_detected=False,
            severity="NONE",
            score=0.0,
            threshold=DRIFT_THRESHOLDS["kl_concept_major"],
            drift_type="concept",
            message=f"Error: {e}",
        )


# ─── Regime Drift — Hellinger Distance ─────────────────────────────────────

def hellinger_distance(p: np.ndarray, q: np.ndarray) -> float:
    """
    Compute Hellinger distance between two probability distributions.
    H = sqrt(1 - SUM(sqrt(p_i * q_i)))
    H < 0.1: No significant change
    H > 0.3: Significant change
    """
    p = np.clip(p, 1e-10, 1.0)
    q = np.clip(q, 1e-10, 1.0)
    similarity = np.sum(np.sqrt(p * q))
    return float(np.sqrt(1 - similarity))


def detect_regime_drift(
    db: CandleDatabase,
    symbol: str,
    baseline: DriftBaseline,
    current_window: int = 500,
) -> DriftResult:
    """Detect regime drift via Hellinger distance on regime probabilities."""
    log.info("Checking regime drift...")

    try:
        # Use the regime ensemble to get recent regime distribution
        # and compare to baseline
        from ml_engine.models.regime.regime_ensemble import RegimeEnsemble

        ensemble = RegimeEnsemble()
        candles = db.get_candles(
            start=(datetime.now(timezone.utc) - timedelta(days=7)).isoformat(),
            end=datetime.now(timezone.utc).isoformat(),
            symbol=symbol,
            limit=min(500, current_window),
        )

        if candles.empty or len(candles) < 50:
            return DriftResult(
                drift_detected=False,
                severity="NONE",
                score=0.0,
                threshold=DRIFT_THRESHOLDS["hellinger_regime_major"],
                drift_type="regime",
                message="Insufficient candles for regime drift detection",
            )

        # Get regime predictions
        result = ensemble.predict(candles)
        if isinstance(result, list):
            recent_regimes = [r.get("regime", "NORMAL") for r in result]
        else:
            recent_regimes = [result.get("regime", "NORMAL")]

        # Current distribution
        regime_counts = defaultdict(int)
        for r in recent_regimes:
            regime_counts[r] += 1
        regimes = list(regime_counts.keys())
        recent_prob = np.array([regime_counts[r] for r in regimes], dtype=float)
        recent_prob = recent_prob / recent_prob.sum()

        # Baseline distribution (from stored baseline)
        baseline_prob_dict = baseline.regime_distribution or {"COMPRESSION": 0.2, "NORMAL": 0.6, "EXPANSION": 0.2}
        baseline_prob = np.array([baseline_prob_dict.get(r, 0.0) for r in regimes], dtype=float)
        baseline_sum = baseline_prob.sum()
        if baseline_sum > 0:
            baseline_prob = baseline_prob / baseline_sum
        else:
            baseline_prob = np.ones(len(regimes)) / len(regimes)

        h = hellinger_distance(recent_prob, baseline_prob)

        severity = "NONE"
        if h > DRIFT_THRESHOLDS["hellinger_regime_major"]:
            severity = "HIGH"
        elif h > DRIFT_THRESHOLDS["hellinger_regime_major"] * 0.7:
            severity = "MEDIUM"

        return DriftResult(
            drift_detected=severity != "NONE",
            severity=severity,
            score=h,
            threshold=DRIFT_THRESHOLDS["hellinger_regime_major"],
            drift_type="regime",
            message=f"Hellinger distance = {h:.4f}",
            details={
                "recent_distribution": dict(regime_counts),
                "baseline_distribution": baseline_prob_dict,
                "recent_prob": recent_prob.tolist(),
            },
        )

    except Exception as e:
        log.error(f"Regime drift detection failed: {e}")
        return DriftResult(
            drift_detected=False,
            severity="NONE",
            score=0.0,
            threshold=DRIFT_THRESHOLDS["hellinger_regime_major"],
            drift_type="regime",
            message=f"Error: {e}",
        )


# ─── Performance Drift — Rolling Accuracy ──────────────────────────────────

def detect_performance_drift(
    db: CandleDatabase,
    symbol: str,
    baseline_accuracy: float,
    window_trades: int = 100,
) -> DriftResult:
    """
    Detect performance drift by comparing recent rolling accuracy
    to baseline accuracy.
    """
    log.info("Checking performance drift...")

    try:
        conn = db._get_conn().__enter__()
        cursor = conn.cursor()

        # Recent signal outcomes
        cursor.execute("""
            SELECT signal, result, COUNT(*) as count
            FROM signal_outcome
            WHERE symbol = ?
                AND timestamp >= datetime('now', '-7 days')
            GROUP BY signal, result
            ORDER BY signal, result
        """, (symbol,))
        outcomes = cursor.fetchall()

        if not outcomes:
            return DriftResult(
                drift_detected=False,
                severity="NONE",
                score=1.0,
                threshold=DRIFT_THRESHOLDS["accuracy_alert"],
                drift_type="performance",
                message="No signal outcomes available",
            )

        # Compute rolling accuracy
        total = sum(row["count"] for row in outcomes)
        correct = sum(row["count"] for row in outcomes if row["result"] == "correct")
        rolling_accuracy = correct / total if total > 0 else 0.0

        # Degradation
        degradation = baseline_accuracy - rolling_accuracy
        alert_ratio = rolling_accuracy / baseline_accuracy if baseline_accuracy > 0 else 0

        severity = "NONE"
        if rolling_accuracy < DRIFT_THRESHOLDS["accuracy_alert"]:
            severity = "HIGH"
        elif degradation > 0.05:
            severity = "MEDIUM"
        elif degradation > 0.02:
            severity = "LOW"

        return DriftResult(
            drift_detected=severity != "NONE",
            severity=severity,
            score=rolling_accuracy,
            threshold=DRIFT_THRESHOLDS["accuracy_alert"],
            drift_type="performance",
            message=f"Rolling accuracy = {rolling_accuracy:.2%} (baseline: {baseline_accuracy:.2%}, degradation: {degradation:.2%})",
            details={
                "rolling_accuracy": rolling_accuracy,
                "baseline_accuracy": baseline_accuracy,
                "degradation": degradation,
                "n_outcomes": total,
            },
        )

    except Exception as e:
        log.error(f"Performance drift detection failed: {e}")
        return DriftResult(
            drift_detected=False,
            severity="NONE",
            score=1.0,
            threshold=DRIFT_THRESHOLDS["accuracy_alert"],
            drift_type="performance",
            message=f"Error: {e}",
        )


# ─── Baseline Management ────────────────────────────────────────────────────

BASELINE_PATH = PROJECT_ROOT / "ml-engine" / "data" / "drift_baseline.json"


def load_baseline() -> DriftBaseline:
    """Load the stored drift baseline."""
    if not BASELINE_PATH.exists():
        log.warning(f"Baseline not found at {BASELINE_PATH} — run --set-baseline first")
        return DriftBaseline(
            feature_distributions={},
            concept_distribution={"LONG": 0.33, "SHORT": 0.33, "NEUTRAL": 0.34},
            regime_distribution={"COMPRESSION": 0.2, "NORMAL": 0.6, "EXPANSION": 0.2},
            accuracy_baseline=0.55,
        )

    with open(BASELINE_PATH) as f:
        data = json.load(f)
    return DriftBaseline(**data)


def save_baseline(baseline: DriftBaseline) -> None:
    """Save the drift baseline to disk."""
    BASELINE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(BASELINE_PATH, "w") as f:
        json.dump(asdict(baseline), f, indent=2)
    log.info(f"Baseline saved to {BASELINE_PATH}")


def set_baseline(symbol: str = "MNQ") -> DriftBaseline:
    """Set the current state as the new baseline."""
    log.info(f"Setting new drift baseline for {symbol}...")

    db = CandleDatabase()
    window = DRIFT_THRESHOLDS["baseline_window"]

    # Feature distributions
    candles = db.get_candles(
        start=(datetime.now(timezone.utc) - timedelta(days=7)).isoformat(),
        end=datetime.now(timezone.utc).isoformat(),
        symbol=symbol,
        limit=window,
    )

    feature_distributions = {}
    key_features = ["close", "volume", "atr", "log_return", "rolling_std_10"]
    for feature in key_features:
        if feature in candles.columns:
            vals = candles[feature].dropna().values
            if len(vals) > 0:
                feature_distributions[feature] = {
                    "mean": float(np.mean(vals)),
                    "std": float(np.std(vals)),
                    "median": float(np.median(vals)),
                    "min": float(np.min(vals)),
                    "max": float(np.max(vals)),
                    "n": len(vals),
                }

    # Signal distribution (from signal_log)
    baseline = DriftBaseline(
        feature_distributions=feature_distributions,
        concept_distribution={"LONG": 0.33, "SHORT": 0.33, "NEUTRAL": 0.34},  # Placeholder
        regime_distribution={"COMPRESSION": 0.2, "NORMAL": 0.6, "EXPANSION": 0.2},
        accuracy_baseline=0.55,  # Placeholder
        sample_size=len(candles),
        symbol=symbol,
    )

    save_baseline(baseline)
    log.info(f"Baseline set with {len(feature_distributions)} features")
    return baseline


# ─── CLI ───────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="Monitor feature and concept drift")
    parser.add_argument("--symbol", default="MNQ")
    parser.add_argument("--set-baseline", action="store_true", help="Set current state as new baseline")
    parser.add_argument("--check-all", action="store_true", help="Run all drift checks")
    parser.add_argument("--feature-drift", action="store_true")
    parser.add_argument("--concept-drift", action="store_true")
    parser.add_argument("--regime-drift", action="store_true")
    parser.add_argument("--performance-drift", action="store_true")
    parser.add_argument("--output-json", action="store_true", help="Output results as JSON")
    return parser.parse_args()


def main():
    args = parse_args()

    results = {}

    if args.set_baseline:
        baseline = set_baseline(args.symbol)
        print(json.dumps(asdict(baseline), indent=2))
        return

    baseline = load_baseline()
    db = CandleDatabase()

    if args.check_all or args.feature_drift:
        results["feature_drift"] = detect_feature_drift(db, args.symbol, baseline).to_dict()

    if args.check_all or args.concept_drift:
        results["concept_drift"] = detect_concept_drift(db, args.symbol, baseline).to_dict()

    if args.check_all or args.regime_drift:
        results["regime_drift"] = detect_regime_drift(db, args.symbol, baseline).to_dict()

    if args.check_all or args.performance_drift:
        results["performance_drift"] = detect_performance_drift(db, args.symbol, baseline.accuracy_baseline).to_dict()

    if args.output_json:
        print(json.dumps(results, indent=2))
    else:
        for drift_type, result in results.items():
            status = f"{result['severity']}" if result["drift_detected"] else "OK"
            print(f"{drift_type}: {status} (score={result['score']:.4f}, threshold={result['threshold']:.4f})")
            if result.get("message"):
                print(f"  {result['message']}")


if __name__ == "__main__":
    main()
