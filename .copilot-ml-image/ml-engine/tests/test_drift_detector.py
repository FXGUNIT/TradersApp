"""
Tests for drift_detector.py — Feature, Concept, and Regime Drift Detection.
Covers: calculate_psi, FeatureDriftDetector, ConceptDriftDetector,
RegimeDriftDetector, DriftMonitor.
"""
import numpy as np
import pandas as pd
import time
from datetime import datetime, timezone

import pytest
from infrastructure.drift_detector import (
    calculate_psi,
    DriftThresholds,
    FeatureDriftDetector,
    ConceptDriftDetector,
    RegimeDriftDetector,
    DriftMonitor,
)


# ─── PSI Calculation ────────────────────────────────────────────────────────────

class TestCalculatePSI:
    """Unit tests for Population Stability Index calculation."""

    def test_identical_distributions_returns_zero(self):
        """Same expected and actual → PSI ≈ 0."""
        rng = np.random.default_rng(42)
        vals = rng.normal(0, 1, size=1000)
        psi = calculate_psi(vals, vals)
        assert psi < 0.01, f"Identical distributions should give PSI near 0, got {psi:.4f}"

    def test_psi_increases_with_distribution_shift(self):
        """Greater shift → higher PSI."""
        rng = np.random.default_rng(42)
        baseline = rng.normal(0, 1, size=1000)
        moderate_shift = rng.normal(0.5, 1, size=1000)   # moderate shift
        large_shift = rng.normal(2.0, 1, size=1000)       # large shift

        psi_moderate = calculate_psi(baseline, moderate_shift)
        psi_large = calculate_psi(baseline, large_shift)

        assert psi_moderate < psi_large, (
            f"Moderate shift PSI ({psi_moderate:.4f}) should be < "
            f"large shift PSI ({psi_large:.4f})"
        )

    def test_psi_classification_thresholds(self):
        """PSI classification: <0.1 OK, 0.1-0.2 warning, 0.2-0.25 alert, >0.25 critical."""
        rng = np.random.default_rng(123)
        baseline = rng.normal(0, 1, size=2000)

        # Small shift → low PSI (near-identical distributions)
        small = rng.normal(0.1, 1, size=500)
        assert calculate_psi(baseline, small) < 0.2, (
            f"Small shift PSI should be < 0.2, got {calculate_psi(baseline, small):.4f}"
        )

        # Moderate shift → detectable but not catastrophic
        moderate = rng.normal(0.5, 1, size=500)
        psi = calculate_psi(baseline, moderate)
        assert 0.01 < psi < 1.0, f"Expected moderate PSI, got {psi:.4f}"

        # Large shift → clearly detectable
        large = rng.normal(2.0, 1, size=500)
        psi_critical = calculate_psi(baseline, large)
        assert psi_critical > 0.2, f"Expected PSI > 0.2 for large shift, got {psi_critical:.4f}"

    def test_psi_handles_empty_bins_with_epsilon(self):
        """PSI handles edge cases where bins have zero counts (epsilon fallback)."""
        baseline = np.array([0.0] * 100)
        actual = np.array([1.0] * 100)
        psi = calculate_psi(baseline, actual)
        assert 0 <= psi < 10, f"PSI should be non-negative, got {psi:.4f}"

    def test_psi_with_n_bins(self):
        """PSI works with custom bin counts."""
        rng = np.random.default_rng(99)
        baseline = rng.normal(0, 1, size=500)
        actual = rng.normal(0.5, 1, size=500)

        psi_5 = calculate_psi(baseline, actual, n_bins=5)
        psi_20 = calculate_psi(baseline, actual, n_bins=20)

        assert 0 <= psi_5 < 5, f"PSI should be bounded, got {psi_5:.4f}"
        assert 0 <= psi_20 < 5, f"PSI should be bounded, got {psi_20:.4f}"


# ─── Feature Drift Detector ────────────────────────────────────────────────────

class TestFeatureDriftDetector:
    """Tests for FeatureDriftDetector PSI-based rolling window drift detection."""

    def test_initialization(self):
        """Detector initializes with default thresholds."""
        detector = FeatureDriftDetector()
        assert detector.thresholds is not None
        assert detector.n_baseline == 200
        assert detector.n_current == 50

    def test_update_baseline_stores_distributions(self):
        """update_baseline stores per-column distributions."""
        detector = FeatureDriftDetector()
        rng = np.random.default_rng(7)
        features = pd.DataFrame({
            "feature_a": rng.normal(0, 1, size=200),
            "feature_b": rng.normal(5, 2, size=200),
        })
        trades = pd.DataFrame({"result": ["win"] * 200})

        detector.update_baseline(features, trades)

        assert "feature_a" in detector._baselines
        assert "feature_b" in detector._baselines
        assert len(detector._baselines["feature_a"]) > 10

    def test_update_baseline_requires_minimum_trades(self):
        """update_baseline skips if not enough trades."""
        detector = FeatureDriftDetector()
        features = pd.DataFrame({"f": range(100)})
        trades = pd.DataFrame({"result": ["win"] * 5})  # less than min_baseline_trades=50

        detector.update_baseline(features, trades)
        assert len(detector._baselines) == 0

    def test_detect_returns_ok_when_insufficient_data(self):
        """detect returns 'ok' when not enough current trades."""
        detector = FeatureDriftDetector()
        result = detector.detect(pd.DataFrame(), pd.DataFrame({"result": ["win"] * 5}))

        assert result["status"] == "ok"
        assert "reason" in result

    def test_detect_initializes_baseline_on_first_call(self):
        """First detect() call with enough data initializes baseline."""
        detector = FeatureDriftDetector()
        rng = np.random.default_rng(8)
        features = pd.DataFrame({
            "price_change": rng.normal(0, 1, size=250),
        })
        trades = pd.DataFrame({"result": ["win"] * 250})

        result = detector.detect(features, trades)
        assert result["status"] == "ok"
        assert result["reason"] == "Baseline initialized"
        assert "price_change" in detector._baselines

    def test_detect_identifies_drifted_features(self):
        """detect flags features whose PSI exceeds threshold."""
        detector = FeatureDriftDetector()
        rng = np.random.default_rng(9)

        # Baseline: normal distribution
        baseline_features = pd.DataFrame({
            "price_change": rng.normal(0, 1, size=300),
            "volume": rng.normal(1000, 100, size=300),
        })
        trades = pd.DataFrame({"result": ["win"] * 300})
        detector.update_baseline(baseline_features, trades)

        # Current: same for volume, shifted for price_change
        current_features = pd.DataFrame({
            "price_change": rng.normal(3.0, 1, size=60),  # large shift
            "volume": rng.normal(1000, 100, size=60),      # same
        })

        result = detector.detect(current_features, trades)

        # price_change should be flagged (large shift)
        assert "price_change" in result["drifted_features"]
        assert result["status"] != "ok"  # at least warning

    def test_should_retrain_returns_true_for_alert_status(self):
        """should_retrain True when drift status is alert or critical."""
        detector = FeatureDriftDetector()
        assert detector.should_retrain({"status": "ok"}) is False
        assert detector.should_retrain({"status": "warning"}) is False
        assert detector.should_retrain({"status": "alert"}) is True
        assert detector.should_retrain({"status": "critical"}) is True
        # None falls back to ok
        assert detector.should_retrain(None) is False


# ─── Concept Drift Detector ────────────────────────────────────────────────────

class TestConceptDriftDetector:
    """Tests for ConceptDriftDetector rolling accuracy drift detection."""

    def test_initialization(self):
        """Detector initializes with rolling window."""
        detector = ConceptDriftDetector(rolling_window=50)
        assert detector.rolling_window == 50
        assert detector._baseline_win_rate is None

    def test_set_baseline_records_win_rate(self):
        """set_baseline stores the training-time win rate."""
        detector = ConceptDriftDetector()
        trades = pd.DataFrame({
            "result": ["win"] * 60 + ["loss"] * 40,  # 60% win rate
        })
        detector.set_baseline(trades)
        assert detector._baseline_win_rate == 0.6
        assert detector._baseline_count == 100

    def test_record_prediction_accumulates_results(self):
        """record_prediction stores predictions for rolling drift tracking."""
        detector = ConceptDriftDetector(rolling_window=100)
        detector.record_prediction(correct=True, confidence=0.85)
        detector.record_prediction(correct=False, confidence=0.55)
        assert len(detector._recent_results) == 2
        assert detector._recent_results[0]["correct"] is True
        assert detector._recent_results[1]["correct"] is False

    def test_detect_returns_ok_without_baseline(self):
        """detect returns ok when no baseline established yet."""
        detector = ConceptDriftDetector()
        result = detector.detect()
        assert result["status"] == "ok"
        assert "No baseline established" in result["reason"]

    def test_detect_returns_ok_without_enough_recent_predictions(self):
        """detect needs at least min_current_trades predictions."""
        detector = ConceptDriftDetector()
        trades = pd.DataFrame({"result": ["win"] * 100})
        detector.set_baseline(trades)
        detector.record_prediction(True, 0.8)
        detector.record_prediction(False, 0.5)

        result = detector.detect()
        assert result["status"] == "ok"
        assert "Only 2 recent predictions" in result["reason"]

    def test_detect_identifies_accuracy_drop(self):
        """detect flags when recent accuracy drops below baseline."""
        detector = ConceptDriftDetector(rolling_window=50)
        # Training baseline: 60% win rate
        baseline_trades = pd.DataFrame({"result": ["win"] * 60 + ["loss"] * 40})
        detector.set_baseline(baseline_trades)

        # Recent: 30% win rate (significant drop)
        for _ in range(30):
            detector.record_prediction(True, 0.6)
        for _ in range(70):
            detector.record_prediction(False, 0.4)

        result = detector.detect()
        assert result["status"] in ("warning", "alert")
        assert result["current_win_rate"] < result["baseline_win_rate"]
        assert result["win_rate_drop"] > 0

    def test_should_retrain_on_alert(self):
        """should_retrain True when accuracy drop exceeds alert threshold."""
        detector = ConceptDriftDetector(rolling_window=50)
        baseline_trades = pd.DataFrame({"result": ["win"] * 80 + ["loss"] * 20})  # 80% WR
        detector.set_baseline(baseline_trades)

        # Recent: 50% WR → >5% drop (80% → 50% = 37.5% drop relative)
        for _ in range(50):
            detector.record_prediction(True, 0.6)
        for _ in range(50):
            detector.record_prediction(False, 0.4)

        result = detector.detect()
        # Drop pct = (0.8 - 0.5) / 0.8 = 0.375 = 37.5% > 5% threshold
        assert detector.should_retrain() is True


# ─── Regime Drift Detector ─────────────────────────────────────────────────────

class TestRegimeDriftDetector:
    """Tests for RegimeDriftDetector HMM posterior regime tracking."""

    def test_initialization(self):
        """Detector initializes with confirmation window."""
        detector = RegimeDriftDetector(confirm_window=20)
        assert detector.confirm_window == 20
        assert detector._current_regime is None

    def test_update_tracks_regime_changes(self):
        """update() records regime and counts consecutive bars."""
        detector = RegimeDriftDetector(confirm_window=10)

        # First call: regime differs from None → reset to 0
        detector.update("NORMAL", 0.9)
        assert detector._current_regime is None  # _current_regime only set in detect()
        assert detector._consecutive_same == 0  # reset to 0 on new regime

        # Second call: regime matches → increment to 1
        detector.update("NORMAL", 0.9)
        assert detector._consecutive_same == 1

        # 8 more calls: 1 + 8 = 9
        for _ in range(8):
            detector.update("NORMAL", 0.9)

        assert detector._consecutive_same == 9  # 1 + 8 = 9

    def test_update_resets_counter_on_regime_change(self):
        """Changing regime resets the consecutive count."""
        detector = RegimeDriftDetector(confirm_window=5)

        # 10 calls: first resets to 0, then 9 increments → 9
        for _ in range(10):
            detector.update("NORMAL", 0.9)
        assert detector._consecutive_same == 9
        assert detector._current_regime is None  # _current_regime not updated in update()

        # New regime → reset counter
        detector.update("COMPRESSION", 0.8)
        assert detector._consecutive_same == 0  # reset
        assert detector._current_regime is None  # still None until detect()

    def test_detect_returns_ok_insufficient_history(self):
        """detect needs at least confirm_window bars."""
        detector = RegimeDriftDetector(confirm_window=20)
        for _ in range(5):
            detector.update("EXPANSION", 0.8)

        result = detector.detect()
        assert result["status"] == "ok"
        assert "Only 5 bars" in result["reason"]

    def test_detect_confirms_regime_shift(self):
        """
        detect returns alert when transitioning from a confirmed regime
        to a new regime that has persisted for confirm_window bars.

        With _current_regime only updated in detect() (not in update()),
        the counter accumulates across regime transitions, allowing detect()
        to fire on the second regime after confirm_window consecutive bars.
        """
        detector = RegimeDriftDetector(confirm_window=5)

        # Warm up: 6 NORMAL calls
        # Call 1: reset to 0; calls 2-6: increment to 5
        for _ in range(6):
            detector.update("NORMAL", 0.8)
        assert detector._current_regime is None  # updated in detect() only
        assert detector._consecutive_same == 5

        # Add 5 COMPRESSION bars: first call resets to 0, then increments to 4
        for _ in range(5):
            detector.update("COMPRESSION", 0.9)
        assert detector._consecutive_same == 4  # first resets, then +4 increments
        assert detector._current_regime is None  # still None

        result = detector.detect()

        assert result["status"] == "alert"
        assert result["regime_change"] is True
        assert result["current_regime"] == "COMPRESSION"
        assert result["previous_regime"] is None  # was None (unconfirmed NORMAL)
        # After detect(): _current_regime updated to COMPRESSION
        assert detector._current_regime == "COMPRESSION"

    def test_should_retrain_on_regime_alert(self):
        """
        should_retrain True when sustained regime shift detected.

        - Warm-up EXPANSION calls + first detect() → establishes baseline (EXPANSION)
        - should_retrain() → False (still in EXPANSION regime)
        - CRISIS bars accumulate
        - should_retrain() → True (CRISIS != established EXPANSION)
        - detect() also fires alert on first call after warm-up
        """
        detector = RegimeDriftDetector(confirm_window=5)

        # Warm up with EXPANSION
        for _ in range(10):
            detector.update("EXPANSION", 0.9)

        # First detect() after warm-up: fires ALERT (establishes EXPANSION baseline)
        warmup_result = detector.detect()
        assert warmup_result["status"] == "alert"
        assert detector._current_regime == "EXPANSION"

        # Same regime (EXPANSION) → no retrain needed
        assert detector.should_retrain() is False

        # Add CRISIS bars: consecutive_same resets and builds up
        for _ in range(10):
            detector.update("CRISIS", 0.9)

        # CRISIS != _current_regime (EXPANSION) → retrain recommended
        assert detector.should_retrain() is True

        # detect() fires alert (CRISIS different from established EXPANSION)
        result = detector.detect()
        assert result["status"] == "alert"


# ─── Unified Drift Monitor ────────────────────────────────────────────────────

class TestDriftMonitor:
    """Tests for DriftMonitor orchestration of all three detectors."""

    def test_initialization_creates_all_sub_detectors(self):
        """DriftMonitor creates FeatureDrift, ConceptDrift, and RegimeDrift."""
        monitor = DriftMonitor()
        assert monitor.feature_drift is not None
        assert monitor.concept_drift is not None
        assert monitor.regime_drift is not None

    def test_check_all_returns_combined_result(self):
        """check_all runs all three detectors and returns unified assessment."""
        monitor = DriftMonitor()
        rng = np.random.default_rng(11)

        # Setup baselines
        features = pd.DataFrame({
            "price": rng.normal(0, 1, size=300),
        })
        trades = pd.DataFrame({"result": ["win"] * 300})
        monitor.feature_drift.update_baseline(features, trades)
        monitor.concept_drift.set_baseline(trades)

        # Run check
        result = monitor.check_all(features, trades)

        assert "overall_status" in result
        assert "feature_drift" in result
        assert "concept_drift" in result
        assert "regime_drift" in result
        assert "should_retrain" in result
        assert "timestamp" in result

    def test_should_retrain_fires_on_any_alert(self):
        """should_retrain True if ANY detector fires alert."""
        monitor = DriftMonitor()

        # Feature drift → alert (via check_all would need a real drift)
        # Concept drift → alert
        rng = np.random.default_rng(12)
        baseline_trades = pd.DataFrame({"result": ["win"] * 100})
        monitor.concept_drift.set_baseline(baseline_trades)
        for _ in range(50):
            monitor.concept_drift.record_prediction(False, 0.3)

        result = monitor.check_all(pd.DataFrame(), pd.DataFrame())
        assert result["should_retrain"] is True

    def test_regime_detection_integrates_with_check_all(self):
        """check_all accepts current_regime for regime drift tracking."""
        monitor = DriftMonitor()
        for _ in range(25):
            monitor.regime_drift.update("TRENDING", 0.85)

        result = monitor.check_all(
            features_df=pd.DataFrame(),
            trades_df=pd.DataFrame(),
            current_regime="TRENDING",
            regime_confidence=0.85,
        )
        assert result["regime_drift"]["status"] in ("ok", "alert")

    def test_regime_alert_via_check_all(self):
        """
        Sustained regime shift detected via check_all triggers should_retrain.

        - After 7 EXPANSION calls: _current_regime=None, _last_seen_regime=EXPANSION, consecutive=6
        - After 5 CRISIS calls: consecutive builds to 4, history ends with 5×CRISIS
        - check_all() → update(CRISIS) → detect() → alert (CRISIS != None)
        - should_retrain() → True
        """
        # confirm_window=5 so 7+5=12 bars exceeds threshold
        monitor = DriftMonitor()
        monitor.regime_drift.confirm_window = 5

        # Warm up: 7 EXPANSION calls
        for _ in range(7):
            monitor.regime_drift.update("EXPANSION", 0.9)
        assert monitor.regime_drift._current_regime is None
        assert monitor.regime_drift._consecutive_same == 6
        assert monitor.regime_drift._last_seen_regime == "EXPANSION"

        # Add 5 CRISIS bars
        for _ in range(5):
            monitor.regime_drift.update("CRISIS", 0.95)
        assert monitor.regime_drift._consecutive_same == 4
        assert monitor.regime_drift._current_regime is None  # still None

        result = monitor.check_all(pd.DataFrame(), pd.DataFrame())
        assert result["should_retrain"] is True
        assert result["regime_drift"]["status"] == "alert"
        assert result["regime_drift"]["current_regime"] == "CRISIS"


# ─── PSI Classification ─────────────────────────────────────────────────────────

class TestPSIClassification:
    """Integration tests: verify PSI values map to correct severity levels."""

    def test_severity_escalation_with_increasing_shift(self):
        """PSI severity escalates: no shift → warning → alert → critical."""
        rng = np.random.default_rng(13)
        detector = FeatureDriftDetector()

        baseline = pd.DataFrame({
            "feature": rng.normal(0, 1, size=500),
        })
        trades = pd.DataFrame({"result": ["win"] * 500})
        detector.update_baseline(baseline, trades)

        results = {}
        shifts = [0.2, 0.5, 1.0, 2.0]
        for shift in shifts:
            current = pd.DataFrame({
                "feature": rng.normal(shift, 1, size=60),
            })
            result = detector.detect(current, trades)
            psi_val = result["psi_scores"].get("feature", 0)
            results[shift] = psi_val

        # PSI should increase with shift magnitude
        assert results[0.2] < results[0.5] < results[1.0] < results[2.0]

    def test_drifted_features_list_ordered_by_severity(self):
        """most_drifted returns top 5 features sorted by PSI descending."""
        rng = np.random.default_rng(14)
        detector = FeatureDriftDetector()

        baseline = pd.DataFrame({
            f"feat_{i}": rng.normal(0, 1, size=500) for i in range(8)
        })
        trades = pd.DataFrame({"result": ["win"] * 500})
        detector.update_baseline(baseline, trades)

        current = pd.DataFrame({
            f"feat_{i}": rng.normal(shift, 1, size=60)
            for i, shift in enumerate([0.0, 0.1, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0])
        })

        result = detector.detect(current, trades)

        # Most drifted should be feat_7 (shift=3.0) then feat_6 (shift=2.5)
        most_drifted = result["most_drifted"]
        assert len(most_drifted) <= 5
        # Verify sorted by PSI descending
        psis = [d["psi"] for d in most_drifted]
        assert psis == sorted(psis, reverse=True)
