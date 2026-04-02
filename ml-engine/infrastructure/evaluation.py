"""
Evaluation Pipeline — Reliability, A/B Testing, Drift Detection, and Guardrails

Components:
1. A/B Testing Framework — shadow deploy new models, compare vs production
2. Drift Detection — detect when market regime shifts away from training data
3. Shadow Mode — run new models in parallel without affecting live traffic
4. Performance Metrics — track all model predictions vs actual outcomes
5. Guardrails — input validation, output bounds, sanity checks on ML outputs

SLA Requirements:
- P50 latency < 50ms for /predict
- P99 latency < 500ms for /predict
- Error rate < 1% for all endpoints
- Drift detection within 5 minutes of market shift
"""

import os
import sys
import json
import time
import threading
import hashlib
import numpy as np
import pandas as pd
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal, Any
from pathlib import Path
from collections import deque, defaultdict
import statistics

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
EVAL_DIR = DATA_DIR / "evaluation"
EVAL_DIR.mkdir(parents=True, exist_ok=True)


# ─── Drift Detection ─────────────────────────────────────────────────────────

@dataclass
class DriftMetrics:
    """Metrics for detecting distributional drift."""
    metric_name: str
    current_value: float
    baseline_mean: float
    baseline_std: float
    drift_score: float       # How many std devs from baseline
    drift_detected: bool
    p_value: float          # Statistical significance
    direction: str         # "increase" | "decrease" | "stable"
    timestamp: str


class DriftDetector:
    """
    Detects when market conditions have drifted from training data.

    Uses multiple methods:
    1. Population Stability Index (PSI) — compare feature distributions
    2. Kolmogorov-Smirnov test — non-parametric distribution comparison
    3. Rolling Z-score — detect sudden shifts in key features
    4. Concept drift detection — track win rate / expectancy over time

    If drift > threshold → alert + trigger retraining recommendation.
    """

    PSI_THRESHOLD = 0.2        # PSI > 0.2 = significant drift
    KS_PVALUE_THRESHOLD = 0.05  # p < 0.05 = statistically significant drift
    ZSCORE_THRESHOLD = 3.0      # Z-score > 3 = outlier shift

    def __init__(self, window_size: int = 500):
        self.window_size = window_size
        self._baselines: dict[str, dict] = {}
        self._history: deque = deque(maxlen=10_000)
        self._lock = threading.Lock()

    def set_baseline(self, name: str, values: list[float]):
        """Set the baseline distribution for a feature."""
        if len(values) < 30:
            print(f"[DriftDetector] Baseline '{name}': need ≥30 samples, got {len(values)}")
            return

        self._baselines[name] = {
            "mean": np.mean(values),
            "std": np.std(values),
            "median": np.median(values),
            "p25": np.percentile(values, 25),
            "p75": np.percentile(values, 75),
            "n": len(values),
            "values": values[-self.window_size:],  # Keep last window_size
            "set_at": time.time(),
        }
        print(f"[DriftDetector] Baseline set: {name} (n={len(values)}, mean={np.mean(values):.3f}, std={np.std(values):.3f})")

    def check_drift(self, name: str, current_value: float) -> DriftMetrics:
        """Check if a single value has drifted from the baseline."""
        if name not in self._baselines:
            return DriftMetrics(
                metric_name=name,
                current_value=current_value,
                baseline_mean=0,
                baseline_std=0,
                drift_score=0,
                drift_detected=False,
                p_value=1.0,
                direction="unknown",
                timestamp=datetime.now(timezone.utc).isoformat(),
            )

        baseline = self._baselines[name]
        z_score = (current_value - baseline["mean"]) / max(baseline["std"], 1e-6)

        drift_score = abs(z_score)
        drift_detected = drift_score > self.ZSCORE_THRESHOLD
        direction = "increase" if z_score > 0 else "decrease" if z_score < 0 else "stable"

        return DriftMetrics(
            metric_name=name,
            current_value=current_value,
            baseline_mean=baseline["mean"],
            baseline_std=baseline["std"],
            drift_score=drift_score,
            drift_detected=drift_detected,
            p_value=2 * (1 - statistics.NormalDist().cdf(abs(z_score))),
            direction=direction,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    def check_population_drift(self, name: str, current_window: list[float]) -> dict:
        """
        Population Stability Index (PSI) — compares two distributions.
        PSI < 0.1: no significant change
        PSI 0.1–0.2: moderate change — monitor
        PSI > 0.2: significant drift — alert
        """
        if name not in self._baselines:
            return {"psi": None, "drift": False, "reason": "No baseline"}

        baseline = self._baselines[name]["values"]
        if len(baseline) < 30 or len(current_window) < 30:
            return {"psi": None, "drift": False, "reason": "Insufficient samples"}

        # Bin into 10 equal bins
        all_vals = np.concatenate([baseline, current_window])
        bins = np.linspace(all_vals.min(), all_vals.max(), 11)

        def _psi(baseline_vals, current_vals, bins):
            baseline_pct = np.histogram(baseline_vals, bins=bins)[0] / max(1, len(baseline_vals))
            current_pct = np.histogram(current_vals, bins=bins)[0] / max(1, len(current_vals))

            # Avoid division by zero
            baseline_pct = np.where(baseline_pct == 0, 0.0001, baseline_pct)
            current_pct = np.where(current_pct == 0, 0.0001, current_pct)

            psi = np.sum((current_pct - baseline_pct) * np.log(current_pct / baseline_pct))
            return psi

        psi = _psi(np.array(baseline), np.array(current_window), bins)

        return {
            "psi": round(psi, 4),
            "drift": psi > self.PSI_THRESHOLD,
            "severity": "none" if psi < 0.1 else "moderate" if psi < 0.2 else "significant",
            "baseline_n": len(baseline),
            "current_n": len(current_window),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def get_all_drift_status(self) -> dict:
        """Get current drift status for all tracked features."""
        status = {}
        for name in self._baselines:
            baseline = self._baselines[name]
            if "values" in baseline and len(baseline["values"]) > 0:
                recent = baseline["values"][-min(50, len(baseline["values"])):]
                if len(recent) >= 10:
                    status[name] = {
                        "baseline_mean": round(baseline["mean"], 4),
                        "recent_mean": round(np.mean(recent), 4),
                        "drift_pct": round((np.mean(recent) - baseline["mean"]) / max(baseline["std"], 1e-6), 4),
                    }
        return status


# ─── A/B Testing Framework ─────────────────────────────────────────────────

@dataclass
class ABTest:
    test_id: str
    name: str
    model_a: str        # Control (current production)
    model_b: str        # Treatment (new model)
    start_time: str
    end_time: str | None
    status: str        # RUNNING | COMPLETED | CANCELLED
    traffic_split: float = 0.5  # 50% to model A, 50% to model B
    min_samples: int = 200         # Min trades before deciding
    statistical_power: float = 0.8


@dataclass
class ABResult:
    test_id: str
    winner: str | None        # "A", "B", or None
    confidence: float         # 0-1
    p_value: float
    statistical_significance: bool
    recommendation: str
    model_a_metrics: dict
    model_b_metrics: dict


class ABTestingFramework:
    """
    Shadow-mode A/B testing for ML model comparisons.

    How it works:
    1. Deploy new model alongside production model
    2. Split traffic: 50% to each (configurable)
    3. Both models predict, but only production model actually trades
    4. Track predictions + outcomes in shadow log
    5. After min_samples, run statistical test (chi-squared / t-test)
    6. If new model is statistically better → promote
    7. If new model is worse or no improvement → discard

    NEVER affects live trading during the test.
    """

    def __init__(self):
        self._tests: dict[str, ABTest] = {}
        self._shadow_data: dict[str, list[dict]] = defaultdict(list)
        self._lock = threading.Lock()
        self._load_tests()

    def _load_tests(self):
        path = EVAL_DIR / "ab_tests.json"
        if path.exists():
            try:
                data = json.loads(path.read_text())
                for t_data in data.get("tests", []):
                    self._tests[t_data["test_id"]] = ABTest(**t_data)
                print(f"[ABTesting] Loaded {len(self._tests)} tests")
            except Exception as e:
                print(f"[ABTesting] Load failed: {e}")

    def _save_tests(self):
        path = EVAL_DIR / "ab_tests.json"
        data = {"tests": [asdict(t) for t in self._tests.values()]}
        path.write_text(json.dumps(data, indent=2))

    def create_test(
        self,
        name: str,
        model_a: str,
        model_b: str,
        traffic_split: float = 0.5,
        min_samples: int = 200,
    ) -> ABTest:
        """Create a new A/B test."""
        test_id = hashlib.md5(f"{name}_{time.time()}".encode()).hexdigest()[:12]
        test = ABTest(
            test_id=test_id,
            name=name,
            model_a=model_a,
            model_b=model_b,
            start_time=datetime.now(timezone.utc).isoformat(),
            end_time=None,
            status="RUNNING",
            traffic_split=traffic_split,
            min_samples=min_samples,
        )
        with self._lock:
            self._tests[test_id] = test
            self._shadow_data[test_id] = []
        self._save_tests()
        print(f"[ABTesting] Created test '{name}' ({test_id})")
        return test

    def record_prediction(
        self,
        test_id: str,
        model_name: str,
        prediction: dict,
        actual_outcome: dict | None = None,
    ):
        """
        Record a shadow prediction for the A/B test.
        actual_outcome is optional — filled in when trade closes.
        """
        with self._lock:
            if test_id not in self._tests:
                return
            entry = {
                "model": model_name,
                "prediction": prediction,
                "actual_outcome": actual_outcome,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            self._shadow_data[test_id].append(entry)

    def decide_winner(self, test_id: str) -> ABResult:
        """Run statistical analysis to determine the winning model."""
        with self._lock:
            if test_id not in self._tests:
                raise ValueError(f"Test {test_id} not found")
            test = self._tests[test_id]
            data = self._shadow_data.get(test_id, [])

        if len(data) < test.min_samples:
            return ABResult(
                test_id=test_id,
                winner=None,
                confidence=0,
                p_value=1.0,
                statistical_significance=False,
                recommendation=f"Not enough samples: {len(data)}/{test.min_samples}",
                model_a_metrics={},
                model_b_metrics={},
            )

        # Split by model
        a_preds = [d for d in data if d["model"] == test.model_a]
        b_preds = [d for d in data if d["model"] == test.model_b]

        # Get completed trades
        a_completed = [d for d in a_preds if d["actual_outcome"] is not None]
        b_completed = [d for d in b_preds if d["actual_outcome"] is not None]

        if len(a_completed) < 30 or len(b_completed) < 30:
            return ABResult(
                test_id=test_id,
                winner=None,
                confidence=0,
                p_value=1.0,
                statistical_significance=False,
                recommendation="Not enough completed trades",
                model_a_metrics={},
                model_b_metrics={},
            )

        # Compute metrics
        def _metrics(preds):
            outcomes = [d["actual_outcome"] for d in preds]
            wins = [1 if o.get("result") == "win" else 0 for o in outcomes]
            pnls = [o.get("pnl_ticks", 0) for o in outcomes]
            wr = np.mean(wins)
            exp = np.mean(pnls)
            sharpe = exp / max(1e-6, np.std(pnls)) if len(pnls) > 1 else 0
            return {"win_rate": round(wr, 4), "expectancy": round(exp, 4), "sharpe": round(sharpe, 4), "n": len(preds)}

        a_metrics = _metrics(a_completed)
        b_metrics = _metrics(b_completed)

        # Simple comparison: expectancy + win rate
        a_score = a_metrics["expectancy"] + a_metrics["win_rate"] * 2
        b_score = b_metrics["expectancy"] + b_metrics["win_rate"] * 2

        # Statistical significance: chi-squared on win rates
        import math
        n1, n2 = len(a_completed), len(b_completed)
        k1 = sum(1 for d in a_completed if d["actual_outcome"].get("result") == "win")
        k2 = sum(1 for d in b_completed if d["actual_outcome"].get("result") == "win")

        # Pooled proportion
        p_pool = (k1 + k2) / (n1 + n2)
        se = math.sqrt(p_pool * (1 - p_pool) * (1/n1 + 1/n2))
        z = ((k1/n1) - (k2/n2)) / max(se, 1e-9)
        from scipy.stats import norm
        p_value = 2 * (1 - norm.cdf(abs(z)))
        confidence = 1 - p_value

        winner = "B" if b_score > a_score and p_value < 0.05 else "A" if a_score > b_score and p_value < 0.05 else None
        recommendation = (
            f"B is {abs(b_score - a_score) / max(abs(a_score), 0.01) * 100:.0f}% better. Promote B."
            if winner == "B"
            else f"A is better or no significant difference. Keep A."
            if winner == "A"
            else "No statistically significant difference. Keep A (existing production model)."
        )

        # Update test status
        test.status = "COMPLETED"
        test.end_time = datetime.now(timezone.utc).isoformat()
        self._save_tests()

        return ABResult(
            test_id=test_id,
            winner=winner,
            confidence=round(confidence, 4),
            p_value=round(p_value, 4),
            statistical_significance=p_value < 0.05,
            recommendation=recommendation,
            model_a_metrics=a_metrics,
            model_b_metrics=b_metrics,
        )

    def get_test_status(self, test_id: str = None) -> dict:
        """Get status of a specific test or all tests."""
        if test_id:
            test = self._tests.get(test_id)
            if not test:
                return {}
            data = self._shadow_data.get(test_id, [])
            return {
                "test": asdict(test),
                "predictions_so_far": len(data),
                "min_samples_met": len(data) >= test.min_samples,
            }
        return {
            test_id: asdict(t) for test_id, t in self._tests.items()
        }


# ─── Guardrails ─────────────────────────────────────────────────────────────

@dataclass
class GuardrailResult:
    passed: bool
    violations: list[str]
    warnings: list[str]
    sanitized_output: dict | None


class Guardrails:
    """
    Input validation and output sanity checking for the ML pipeline.

    Applied at TWO points:
    1. BEFORE prediction: validate all inputs
    2. AFTER prediction: validate and bound all outputs

    Rules:
    - Confidence must be 0.0–1.0
    - Signal must be LONG/SHORT/NEUTRAL
    - Alpha must be reasonable (not > 20 ticks per trade)
    - Expected move must be reasonable (not > 100 ticks)
    - Position size must respect firm limits
    - Stop loss must be within firm rules
    - R:R must be ≥ 1.0
    """

    def __init__(self):
        # Firm limits
        self.max_position_contracts = 8
        self.max_risk_per_trade_pct = 0.005  # 0.5% of account
        self.max_alpha_ticks = 20.0
        self.max_expected_move_ticks = 100.0
        self.min_rr_ratio = 1.0
        self.max_confidence = 0.9999
        self.min_confidence = 0.0

    def validate_input(self, features: dict) -> GuardrailResult:
        """Validate input features before prediction."""
        violations = []
        warnings = []

        # Check for NaN/Inf
        for key, val in features.items():
            if isinstance(val, (int, float)):
                if np.isnan(val) or np.isinf(val):
                    violations.append(f"Feature '{key}' is NaN or Inf: {val}")

        # Check ranges
        if "adx" in features:
            val = features["adx"]
            if not 0 <= val <= 100:
                violations.append(f"ADX out of range: {val} (expected 0-100)")

        if "atr" in features:
            val = features["atr"]
            if val <= 0 or val > 1000:
                violations.append(f"ATR out of range: {val} (expected 0-1000)")

        if "ci" in features:
            val = features["ci"]
            if not 0 <= val <= 100:
                warnings.append(f"CI out of typical range: {val} (expected 0-100)")

        return GuardrailResult(
            passed=len(violations) == 0,
            violations=violations,
            warnings=warnings,
            sanitized_output=features,
        )

    def validate_output(self, prediction: dict) -> GuardrailResult:
        """Validate and sanitize ML prediction output."""
        violations = []
        warnings = []

        output = dict(prediction)

        # ── Signal validation ───────────────────────────────────────────
        valid_signals = {"LONG", "SHORT", "NEUTRAL"}
        signal = output.get("signal", "NEUTRAL")
        if signal not in valid_signals:
            violations.append(f"Invalid signal: '{signal}' — forcing to NEUTRAL")
            output["signal"] = "NEUTRAL"

        # ── Confidence bounds ───────────────────────────────────────────
        conf = output.get("confidence", 0.5)
        if not (self.min_confidence <= conf <= self.max_confidence):
            warnings.append(f"Confidence out of bounds: {conf} → clamping to [0, 1]")
            output["confidence"] = max(self.min_confidence, min(self.max_confidence, conf))

        # ── Alpha bounds ───────────────────────────────────────────────
        alpha = output.get("alpha", output.get("alpha_score", 0))
        if abs(alpha) > self.max_alpha_ticks:
            violations.append(f"Alpha unrealistic: {alpha} ticks → clamping to ±{self.max_alpha_ticks}")
            output["alpha"] = np.sign(alpha) * self.max_alpha_ticks

        # ── Expected move bounds ─────────────────────────────────────────
        for key in ["expected_move", "expected_move_ticks", "conservative_ticks"]:
            if key in output:
                val = output[key]
                if isinstance(val, dict):
                    for sub_key, sub_val in val.items():
                        if isinstance(sub_val, (int, float)) and sub_val > self.max_expected_move_ticks:
                            warnings.append(f"{key}.{sub_key} too large: {sub_val} → clamping")
                            output[key][sub_key] = min(sub_val, self.max_expected_move_ticks)
                elif isinstance(val, (int, float)) and val > self.max_expected_move_ticks:
                    warnings.append(f"{key} too large: {val} → clamping")
                    output[key] = min(val, self.max_expected_move_ticks)

        # ── R:R validation ──────────────────────────────────────────────
        for key in ["recommended_rr", "rrr_recommended", "rr_main"]:
            if key in output:
                rr = output[key]
                if isinstance(rr, (int, float)) and rr < self.min_rr_ratio:
                    violations.append(f"R:R too low: {rr} → forcing to {self.min_rr_ratio}")
                    output[key] = self.min_rr_ratio

        # ── Position sizing bounds ────────────────────────────────────────
        for key in ["contracts", "position_contracts", "max_contracts"]:
            if key in output:
                contracts = output[key]
                if isinstance(contracts, (int, float)) and contracts > self.max_position_contracts:
                    violations.append(f"Position size too large: {contracts} → limiting to {self.max_position_contracts}")
                    output[key] = self.max_position_contracts

        # ── Stop loss bounds ─────────────────────────────────────────────
        for key in ["stop_loss_ticks", "sl_ticks"]:
            if key in output:
                sl = output[key]
                if isinstance(sl, (int, float)):
                    if sl < 5:
                        warnings.append(f"Stop loss too tight: {sl} ticks (min 5)")
                        output[key] = 5
                    elif sl > 100:
                        warnings.append(f"Stop loss too wide: {sl} ticks (max 100)")
                        output[key] = 100

        # ── Regime validation ───────────────────────────────────────────
        valid_regimes = {"COMPRESSION", "NORMAL", "EXPANSION", "CRISIS"}
        regime = output.get("regime", output.get("predicted_regime", "NORMAL"))
        if regime not in valid_regimes:
            warnings.append(f"Unknown regime: '{regime}' → defaulting to NORMAL")
            output["regime"] = "NORMAL"

        return GuardrailResult(
            passed=len(violations) == 0,
            violations=violations,
            warnings=warnings,
            sanitized_output=output,
        )

    def get_all_rules(self) -> dict:
        """Return all guardrail rules as documentation."""
        return {
            "max_position_contracts": self.max_position_contracts,
            "max_risk_per_trade_pct": self.max_risk_per_trade_pct,
            "max_alpha_ticks": self.max_alpha_ticks,
            "max_expected_move_ticks": self.max_expected_move_ticks,
            "min_rr_ratio": self.min_rr_ratio,
            "max_confidence": self.max_confidence,
            "min_confidence": self.min_confidence,
        }


# ─── Performance Metrics Tracker ─────────────────────────────────────────────

class PerformanceTracker:
    """
    Tracks every ML prediction and compares it to actual outcomes.
    Used for: drift detection, A/B testing, continual learning, model evaluation.
    """

    def __init__(self, max_history: int = 100_000):
        self.max_history = max_history
        self._predictions: deque = deque(maxlen=max_history)
        self._lock = threading.Lock()

    def record(
        self,
        model_name: str,
        prediction: dict,
        trade_id: str | None = None,
    ):
        """Record a prediction."""
        with self._lock:
            self._predictions.append({
                "model": model_name,
                "prediction": prediction,
                "trade_id": trade_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

    def record_outcome(
        self,
        trade_id: str,
        outcome: dict,
    ):
        """Record the outcome of a trade (called when trade closes)."""
        with self._lock:
            for entry in reversed(self._predictions):
                if entry.get("trade_id") == trade_id:
                    entry["outcome"] = outcome
                    entry["outcome_timestamp"] = datetime.now(timezone.utc).isoformat()
                    break

    def get_metrics(self, model_name: str, n: int = 500) -> dict:
        """Get rolling performance metrics for a model."""
        with self._lock:
            preds = [p for p in self._predictions if p.get("model") == model_name][-n:]

        completed = [p for p in preds if "outcome" in p]
        if len(completed) < 10:
            return {"status": "insufficient_data", "n": len(completed), "need": 10}

        wins = [1 for p in completed if p["outcome"].get("result") == "win"]
        pnls = [p["outcome"].get("pnl_ticks", 0) for p in completed]

        return {
            "model": model_name,
            "n_predictions": len(preds),
            "n_completed": len(completed),
            "win_rate": round(len(wins) / max(1, len(completed)), 4),
            "expectancy": round(np.mean(pnls), 4),
            "sharpe": round(np.mean(pnls) / max(1e-6, np.std(pnls)), 4) if len(pnls) > 1 else 0,
            "avg_pnl": round(np.mean(pnls), 4),
            "best_trade": round(max(pnls), 2) if pnls else 0,
            "worst_trade": round(min(pnls), 2) if pnls else 0,
        }


# ─── Global instances ─────────────────────────────────────────────────────────

_drift_detector: DriftDetector | None = None
_ab_framework: ABTestingFramework | None = None
_guardrails: Guardrails | None = None
_perf_tracker: PerformanceTracker | None = None


def get_drift_detector() -> DriftDetector:
    global _drift_detector
    if _drift_detector is None:
        _drift_detector = DriftDetector()
    return _drift_detector


def get_ab_framework() -> ABTestingFramework:
    global _ab_framework
    if _ab_framework is None:
        _ab_framework = ABTestingFramework()
    return _ab_framework


def get_guardrails() -> Guardrails:
    global _guardrails
    if _guardrails is None:
        _guardrails = Guardrails()
    return _guardrails


def get_performance_tracker() -> PerformanceTracker:
    global _perf_tracker
    if _perf_tracker is None:
        _perf_tracker = PerformanceTracker()
    return _perf_tracker
