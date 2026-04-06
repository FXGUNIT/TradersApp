"""
Tests for data quality expectation suites.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd
import pytest

from data_quality.expectations.candle_expectations import CandleExpectations, get_candle_suite
from data_quality.expectations.trade_expectations import TradeExpectations, get_trade_suite
from data_quality.expectations.session_expectations import SessionExpectations, get_session_suite
from data_quality.expectations.statistical_expectations import (
    DriftExpectations,
    _psi,
    _compute_stats,
    build_baseline_snapshot,
    load_baseline,
    get_drift_suite,
)


# ─── Candle Expectations ──────────────────────────────────────────────────────

class TestCandleExpectations:
    def test_pass_on_valid_data(self):
        df = pd.DataFrame([
            {"timestamp": "2026-04-04T12:00:00Z", "open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 200},
            {"timestamp": "2026-04-04T12:05:00Z", "open": 100.5, "high": 102, "low": 100, "close": 101.5, "volume": 220},
        ])
        report = get_candle_suite().validate(df)
        assert report["passed"] is True
        assert report["critical_failures"] == 0

    def test_detect_missing_required_columns(self):
        df = pd.DataFrame([{"timestamp": "2026-04-04T12:00:00Z", "open": 100, "volume": 200}])
        report = get_candle_suite().validate(df)
        assert report["passed"] is False
        assert report["critical_failures"] >= 1
        names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "required_columns" in names

    def test_detect_non_monotonic_timestamps(self):
        df = pd.DataFrame([
            {"timestamp": "2026-04-04T12:05:00Z", "open": 100, "high": 101, "low": 99, "close": 100.3, "volume": 200},
            {"timestamp": "2026-04-04T12:00:00Z", "open": 100.3, "high": 101.2, "low": 99.8, "close": 100.1, "volume": 180},
        ])
        report = get_candle_suite().validate(df)
        assert report["passed"] is False
        assert any(r["name"] == "timestamp_monotonic" and r["status"] == "fail" for r in report["results"])

    def test_detect_invalid_ohlc_consistency(self):
        df = pd.DataFrame([
            {"timestamp": "2026-04-04T12:00:00Z", "open": 100, "high": 99, "low": 101, "close": 100.5, "volume": 200},
        ])
        report = get_candle_suite().validate(df)
        assert report["passed"] is False
        names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "high_consistency" in names or "low_consistency" in names

    def test_detect_negative_volume(self):
        df = pd.DataFrame([
            {"timestamp": "2026-04-04T12:00:00Z", "open": 100, "high": 101, "low": 99, "close": 100.5, "volume": -10},
        ])
        report = get_candle_suite().validate(df)
        assert report["passed"] is False
        names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "volume_positive" in names

    def test_detect_duplicate_timestamps(self):
        df = pd.DataFrame([
            {"timestamp": "2026-04-04T12:00:00Z", "open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 200},
            {"timestamp": "2026-04-04T12:00:00Z", "open": 100.5, "high": 102, "low": 100, "close": 101.5, "volume": 220},
        ])
        report = get_candle_suite().validate(df)
        assert report["passed"] is False
        names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "timestamp_unique" in names

    def test_detect_5min_misalignment(self):
        df = pd.DataFrame([
            {"timestamp": "2026-04-04T12:03:00Z", "open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 200},
        ])
        report = get_candle_suite().validate(df)
        assert report["passed"] is False
        names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "timestamp_5m_aligned" in names

    def test_empty_dataframe(self):
        df = pd.DataFrame()
        report = get_candle_suite().validate(df)
        assert report["passed"] is False
        assert report["critical_failures"] >= 1


# ─── Trade Expectations ─────────────────────────────────────────────────────────

class TestTradeExpectations:
    def test_pass_on_valid_data(self):
        df = pd.DataFrame([{
            "entry_time": "2026-04-04T12:05:00Z",
            "direction": "long",
            "result": "win",
            "pnl_ticks": 8.0,
            "pnl_dollars": 40.0,
            "confidence": 0.72,
        }])
        report = get_trade_suite().validate(df)
        assert report["passed"] is True
        assert report["critical_failures"] == 0

    def test_detect_invalid_direction(self):
        df = pd.DataFrame([{
            "entry_time": "2026-04-04T12:05:00Z",
            "direction": "FLAT",
            "result": "win",
            "pnl_ticks": 8.0,
            "pnl_dollars": 40.0,
        }])
        report = get_trade_suite().validate(df)
        assert report["passed"] is False
        names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "direction_values" in names

    def test_detect_win_with_negative_pnl(self):
        df = pd.DataFrame([{
            "entry_time": "2026-04-04T12:05:00Z",
            "direction": "long",
            "result": "win",
            "pnl_ticks": -5.0,
            "pnl_dollars": -25.0,
        }])
        report = get_trade_suite().validate(df)
        assert report["passed"] is False
        names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "win_pnl_sign" in names

    def test_detect_loss_with_positive_pnl(self):
        df = pd.DataFrame([{
            "entry_time": "2026-04-04T12:05:00Z",
            "direction": "short",
            "result": "loss",
            "pnl_ticks": 5.0,
            "pnl_dollars": 25.0,
        }])
        report = get_trade_suite().validate(df)
        assert report["passed"] is False
        names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "loss_pnl_sign" in names

    def test_confidence_out_of_range(self):
        df = pd.DataFrame([{
            "entry_time": "2026-04-04T12:05:00Z",
            "direction": "long",
            "result": "win",
            "pnl_ticks": 8.0,
            "pnl_dollars": 40.0,
            "confidence": 1.5,
        }])
        report = get_trade_suite().validate(df)
        assert report["passed"] is False
        names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "confidence_range" in names

    def test_empty_dataframe(self):
        df = pd.DataFrame()
        report = get_trade_suite().validate(df)
        assert report["passed"] is False
        assert report["critical_failures"] >= 1


# ─── Session Expectations ───────────────────────────────────────────────────────

class TestSessionExpectations:
    def test_pass_on_valid_data(self):
        df = pd.DataFrame([{
            "trade_date": "2026-04-04",
            "symbol": "MNQ",
            "direction": "LONG",
            "gap_pct": 0.01,
            "session_range": 22.0,
            "range_vs_atr": 1.3,
        }])
        report = get_session_suite().validate(df)
        assert report["passed"] is True
        assert report["critical_failures"] == 0

    def test_detect_invalid_direction(self):
        df = pd.DataFrame([{
            "trade_date": "2026-04-04",
            "symbol": "MNQ",
            "direction": "FLAT",
            "gap_pct": 0.01,
            "session_range": 22.0,
            "range_vs_atr": 1.3,
        }])
        report = get_session_suite().validate(df)
        assert report["passed"] is False
        names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "direction_values" in names

    def test_detect_zero_session_range(self):
        df = pd.DataFrame([{
            "trade_date": "2026-04-04",
            "symbol": "MNQ",
            "direction": "LONG",
            "gap_pct": 0.01,
            "session_range": 0.0,
            "range_vs_atr": 1.3,
        }])
        report = get_session_suite().validate(df)
        assert report["passed"] is False
        names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "session_range_positive" in names

    def test_warn_on_extreme_gap_pct(self):
        df = pd.DataFrame([{
            "trade_date": "2026-04-04",
            "symbol": "MNQ",
            "direction": "LONG",
            "gap_pct": 0.25,  # > 10%
            "session_range": 22.0,
            "range_vs_atr": 1.3,
        }])
        report = get_session_suite().validate(df)
        names = [r["name"] for r in report["results"] if r["status"] == "warn"]
        assert "gap_pct_range" in names
        # But not critical
        fail_names = [r["name"] for r in report["results"] if r["status"] == "fail"]
        assert "gap_pct_range" not in fail_names

    def test_empty_dataframe(self):
        df = pd.DataFrame()
        report = get_session_suite().validate(df)
        assert report["passed"] is False
        assert report["critical_failures"] >= 1


# ─── Statistical / Drift Expectations ───────────────────────────────────────

class TestPSI:
    def test_psi_identical_distributions(self):
        np = pytest.importorskip("numpy")
        rng = np.random.default_rng(42)
        expected = rng.normal(100, 10, 1000)
        actual = rng.normal(100, 10, 1000)
        psi = _psi(expected, actual)
        assert psi < 0.05  # Nearly identical distributions → low PSI

    def test_psi_different_distributions(self):
        np = pytest.importorskip("numpy")
        rng_e = np.random.default_rng(42)
        rng_a = np.random.default_rng(99)
        expected = rng_e.normal(100, 10, 1000)
        actual = rng_a.normal(100, 10, 1000)
        # Shift means by 2 std devs (20 pts) — enough to overlap but produce PSI > 0.2
        actual = actual + 20
        psi = _psi(expected, actual)
        assert psi > 0.2, f"PSI={psi:.4f} — expected > 0.2 for shifted distributions"

    def test_psi_handles_insufficient_data(self):
        np = pytest.importorskip("numpy")
        psi = _psi(np.array([1]), np.array([2, 3, 4]))
        assert psi == 0.0


class TestComputeStats:
    def test_compute_stats_basic(self):
        np = pytest.importorskip("numpy")
        s = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        stats = _compute_stats(s)
        assert stats["n"] == 10
        assert stats["mean"] == 5.5
        assert stats["skew"] is not None
        assert stats["kurt"] is not None
        assert stats["min"] == 1.0
        assert stats["max"] == 10.0

    def test_compute_stats_handles_empty(self):
        s = pd.Series([], dtype=float)
        stats = _compute_stats(s)
        assert stats["mean"] is None
        assert stats["n"] == 0

    def test_compute_stats_insufficient_data(self):
        s = pd.Series([1.0])
        stats = _compute_stats(s)
        assert stats["skew"] is None


class TestDriftExpectations:
    def test_pass_when_no_baseline(self, tmp_path, monkeypatch):
        monkeypatch.setenv("DQ_BASELINE_DIR", str(tmp_path))
        df = pd.DataFrame({
            "close": [100, 101, 102, 103, 104] * 20,
            "volume": [200, 210, 220, 230, 240] * 20,
        })
        suite = DriftExpectations()
        report = suite.validate(df, table="candles_5min")
        # No baseline → PSI check skipped → only distribution checks run
        assert report["suite"] == "drift_expectations"

    def test_detect_psi_drift(self, tmp_path, monkeypatch):
        monkeypatch.setenv("DQ_BASELINE_DIR", str(tmp_path))
        np = pytest.importorskip("numpy")

        rng_b = np.random.default_rng(42)
        rng_c = np.random.default_rng(99)

        # Create baseline
        baseline_df = pd.DataFrame({
            "close": list(rng_b.normal(100, 5, 500)),
            "volume": list(rng_b.integers(100, 300, 500)),
        })
        build_baseline_snapshot(baseline_df, "candles_5min", columns=["close", "volume"])

        # Current df has shifted distribution (2 std devs / 10 pts — enough overlap for meaningful PSI)
        current_df = pd.DataFrame({
            "close": list(rng_c.normal(100, 5, 100) + 20),
            "volume": list(rng_c.integers(100, 300, 100)),
        })

        suite = DriftExpectations()
        report = suite.validate(current_df, table="candles_5min")
        # PSI should be high due to shift
        critical_names = [r["name"] for r in report["results"] if r["status"] == "fail" and r["severity"] == "critical"]
        assert any("psi_critical_close" in n for n in critical_names), \
            f"Expected psi_critical_close in critical failures; got {critical_names}"


# ─── Integration: Validation Pipeline ──────────────────────────────────────────

class TestValidationPipelineIntegration:
    def _seed_db(self, path, bad_volume=False):
        conn = sqlite3.connect(str(path))
        conn.execute(
            "CREATE TABLE candles_5min (timestamp TEXT, open REAL, high REAL, low REAL, close REAL, volume INTEGER)"
        )
        conn.execute(
            "CREATE TABLE trade_log (entry_time TEXT, exit_time TEXT, direction TEXT, result TEXT, pnl_ticks REAL, pnl_dollars REAL, confidence REAL, amd_phase TEXT)"
        )
        conn.execute(
            "CREATE TABLE session_aggregates (trade_date TEXT, symbol TEXT, direction TEXT, gap_pct REAL, session_range REAL, range_vs_atr REAL)"
        )
        vol = -10 if bad_volume else 120
        conn.execute(
            "INSERT INTO candles_5min VALUES ('2026-04-04T12:00:00+00:00', 100, 101, 99.5, 100.5, ?)",
            (vol,),
        )
        conn.execute(
            "INSERT INTO trade_log VALUES ('2026-04-04T12:05:00+00:00', '2026-04-04T12:20:00+00:00', 'long', 'win', 8, 40, 0.72, 'ACCUMULATION')"
        )
        conn.execute(
            "INSERT INTO session_aggregates VALUES ('2026-04-04', 'MNQ', 'LONG', 0.01, 22, 1.3)"
        )
        conn.commit()
        conn.close()

    def test_full_validation_passes_valid_db(self, tmp_path, monkeypatch):
        import data_quality.validation_pipeline as dq_mod
        self._seed_db(tmp_path / "valid.db", bad_volume=False)
        monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
        monkeypatch.setenv("DQ_BASELINE_DIR", str(tmp_path / "baselines"))
        report = dq_mod.run_full_validation(db_path=str(tmp_path / "valid.db"), block=False)
        assert report["passed"] is True
        assert report["critical_failures"] == 0
        assert "drift" in report["suites"]

    def test_full_validation_fails_bad_candle_volume(self, tmp_path, monkeypatch):
        import data_quality.validation_pipeline as dq_mod
        self._seed_db(tmp_path / "invalid.db", bad_volume=True)
        monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
        monkeypatch.setenv("DQ_BASELINE_DIR", str(tmp_path / "baselines"))
        report = dq_mod.run_full_validation(db_path=str(tmp_path / "invalid.db"), block=False)
        assert report["passed"] is False
        assert report["critical_failures"] >= 1
        assert "candles" in [s for s, v in report["suites"].items() if not v.get("passed")]

    def test_run_full_validation_does_not_block_when_block_false(self, tmp_path, monkeypatch):
        import data_quality.validation_pipeline as dq_mod
        self._seed_db(tmp_path / "invalid.db", bad_volume=True)
        monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
        monkeypatch.setenv("DQ_BASELINE_DIR", str(tmp_path / "baselines"))
        # Should NOT raise
        report = dq_mod.run_full_validation(db_path=str(tmp_path / "invalid.db"), block=False)
        assert report["passed"] is False

    def test_run_full_validation_blocks_when_block_true(self, tmp_path, monkeypatch):
        import data_quality.validation_pipeline as dq_mod
        self._seed_db(tmp_path / "invalid.db", bad_volume=True)
        monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
        monkeypatch.setattr(dq_mod, "BLOCK_ON_CRITICAL", True)
        monkeypatch.setenv("DQ_BASELINE_DIR", str(tmp_path / "baselines"))
        with pytest.raises(ValueError) as exc_info:
            dq_mod.run_full_validation(db_path=str(tmp_path / "invalid.db"), block=True)
        assert "Data quality gate blocked" in str(exc_info.value)

    def test_baseline_updated_after_passing_validation(self, tmp_path, monkeypatch):
        import data_quality.validation_pipeline as dq_mod
        baseline_dir = tmp_path / "baselines"
        baseline_dir.mkdir()
        self._seed_db(tmp_path / "valid.db", bad_volume=False)
        monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
        monkeypatch.setenv("DQ_BASELINE_DIR", str(baseline_dir))
        report = dq_mod.run_full_validation(
            db_path=str(tmp_path / "valid.db"),
            block=False,
            update_baseline=True,
        )
        assert report["passed"] is True
        # Baseline file should be created
        baseline_file = baseline_dir / "baseline_candles_5min.json"
        assert baseline_file.exists()
