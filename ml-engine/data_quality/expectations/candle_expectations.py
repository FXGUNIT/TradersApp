"""
Candle Data Expectations — Great Expectations suite for 5-min OHLCV candles.

Expectations validate data quality before it enters the ML pipeline.
If any critical expectation fails, the pipeline halts and alerts are fired.

Usage:
  from ml_engine.data_quality.expectations.candle_expectations import get_candle_suite
  suite = get_candle_suite()
  result = suite.validate(df)
"""

from __future__ import annotations

import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import Optional

PROJECT_ROOT_PATH = __file__.rsplit("data_quality", 1)[0]
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


class CandleExpectations:
    """
    Great Expectations-style validator for 5-min OHLCV candle data.

    Expectations are divided into:
      - critical: pipeline halts if these fail
      - warning: logged but pipeline continues
    """

    def __init__(self):
        self.results: list[dict] = []
        self._critical_failures = 0
        self._warning_failures = 0

    def validate(self, df: pd.DataFrame) -> dict:
        """
        Run all expectations on candle DataFrame.
        Returns validation report with pass/fail per expectation.
        """
        self.results = []
        self._critical_failures = 0
        self._warning_failures = 0

        if df.empty:
            return self._report("empty_dataset", False, "DataFrame is empty", "critical")

        # ── Critical expectations ─────────────────────────────────────────────

        self._check_no_null_ohlcv(df)
        self._check_high_ge_all_prices(df)
        self._check_low_le_all_prices(df)
        self._check_volume_positive(df)
        self._check_timestamp_monotonic(df)
        self._check_timestamp_utc_aligned(df)
        self._check_no_duplicate_timestamps(df)
        self._check_candle_range_valid(df)
        self._check_timestamp_aligned(df)

        # ── Warning expectations ────────────────────────────────────────────────

        self._warn_volume_not_zero(df)
        self._warn_body_not_zero(df)
        self._warn_extreme_return(df)
        self._warn_extreme_volume(df)
        self._warn_trade_count_sane(df)

        return self._summary()

    # ── Critical ──────────────────────────────────────────────────────────────

    def _check_no_null_ohlcv(self, df: pd.DataFrame):
        """OHLCV columns must not contain null values."""
        required = ["open", "high", "low", "close", "volume"]
        for col in required:
            if col in df.columns:
                null_count = df[col].isna().sum()
                if null_count > 0:
                    self._fail(f"null_ohlcv_{col}", f"{null_count} null values in {col}", "critical")
                else:
                    self._pass(f"null_ohlcv_{col}", f"0 null values in {col}")
            else:
                self._fail(f"missing_column_{col}", f"Column '{col}' not found", "critical")

    def _check_high_ge_all_prices(self, df: pd.DataFrame):
        """High must be >= open, close, low."""
        mask = ~(df["high"] >= df[["open", "low", "close"]].max(axis=1))
        bad = mask.sum()
        if bad > 0:
            pct = bad / len(df) * 100
            self._fail(
                "high_ge_all_prices",
                f"{bad} rows ({pct:.2f}%) where high < max(open, close, low)",
                "critical",
            )
        else:
            self._pass("high_ge_all_prices", "All rows have high >= max(open, close, low)")

    def _check_low_le_all_prices(self, df: pd.DataFrame):
        """Low must be <= open, close, high."""
        mask = ~(df["low"] <= df[["open", "high", "close"]].min(axis=1))
        bad = mask.sum()
        if bad > 0:
            pct = bad / len(df) * 100
            self._fail(
                "low_le_all_prices",
                f"{bad} rows ({pct:.2f}%) where low > min(open, close, high)",
                "critical",
            )
        else:
            self._pass("low_le_all_prices", "All rows have low <= min(open, close, high)")

    def _check_volume_positive(self, df: pd.DataFrame):
        """Volume must be positive (> 0)."""
        bad = (df["volume"] <= 0).sum()
        if bad > 0:
            self._fail("volume_positive", f"{bad} rows with volume <= 0", "critical")
        else:
            self._pass("volume_positive", "All rows have volume > 0")

    def _check_timestamp_monotonic(self, df: pd.DataFrame):
        """Timestamps must be monotonically increasing (no out-of-order candles)."""
        if "timestamp" not in df.columns:
            self._fail("timestamp_exists", "No timestamp column found", "critical")
            return

        ts = pd.to_datetime(df["timestamp"])
        bad = (~ts.is_monotonic_increasing).sum()
        if bad > 0:
            self._fail(
                "timestamp_monotonic",
                f"{bad} out-of-order timestamps detected",
                "critical",
            )
        else:
            self._pass("timestamp_monotonic", "Timestamps are monotonically increasing")

    def _check_timestamp_utc_aligned(self, df: pd.DataFrame):
        """Timestamps must be on 5-min boundaries."""
        if "timestamp" not in df.columns:
            return
        ts = pd.to_datetime(df["timestamp"])
        bad = (ts.dt.minute % 5 != 0).sum()
        if bad > 0:
            self._fail(
                "timestamp_5min_aligned",
                f"{bad} timestamps not on 5-min boundaries",
                "critical",
            )
        else:
            self._pass("timestamp_5min_aligned", "All timestamps on 5-min boundaries")

    def _check_no_duplicate_timestamps(self, df: pd.DataFrame):
        """No duplicate timestamps."""
        if "timestamp" not in df.columns:
            return
        ts = df["timestamp"]
        dup = ts.duplicated().sum()
        if dup > 0:
            self._fail(
                "no_duplicate_timestamps",
                f"{dup} duplicate timestamps found",
                "critical",
            )
        else:
            self._pass("no_duplicate_timestamps", "No duplicate timestamps")

    def _check_candle_range_valid(self, df: pd.DataFrame):
        """Candle range (high - low) must be non-negative and <= 5% of close (sanity check)."""
        df = df.copy()
        df["range"] = df["high"] - df["low"]
        bad = (df["range"] < 0).sum()
        if bad > 0:
            self._fail("range_non_negative", f"{bad} rows with high < low", "critical")
        else:
            self._pass("range_non_negative", "All rows have high >= low")

        # Sanity: range <= 5% of close
        pct = (df["range"] / df["close"].replace(0, np.nan)).abs()
        bad_sane = (pct > 0.05).sum()
        if bad_sane > 0:
            self._warn(
                "range_sanity",
                f"{bad_sane} rows with range > 5% of close (possible bad data)",
            )

    def _check_timestamp_aligned(self, df: pd.DataFrame):
        """Timestamps must not be in the future (with 5-min tolerance)."""
        if "timestamp" not in df.columns:
            return
        now = datetime.now(timezone.utc)
        ts = pd.to_datetime(df["timestamp"])
        future_cutoff = now + pd.Timedelta(minutes=10)
        bad = (ts > future_cutoff).sum()
        if bad > 0:
            self._fail(
                "timestamp_not_future",
                f"{bad} timestamps in the future",
                "critical",
            )
        else:
            self._pass("timestamp_not_future", "No future timestamps")

    # ── Warnings ───────────────────────────────────────────────────────────────

    def _warn_volume_not_zero(self, df: pd.DataFrame):
        """Volume should not be exactly zero (dead periods may indicate data gaps)."""
        zero = (df["volume"] == 0).sum()
        if zero > len(df) * 0.05:  # More than 5% zero volume
            self._warn("volume_not_zero", f"{zero} rows with zero volume ({zero/len(df)*100:.1f}%)")

    def _warn_body_not_zero(self, df: pd.DataFrame):
        """Candle body (|close - open|) should not be zero (doji candles are valid but rare)."""
        body = (df["close"] - df["open"]).abs()
        zero_body = (body == 0).sum()
        if zero_body > len(df) * 0.10:  # More than 10% doji
            self._warn("body_not_zero", f"{zero_body} rows with zero body ({zero_body/len(df)*100:.1f}%)")

    def _warn_extreme_return(self, df: pd.DataFrame):
        """Log returns outside ±5% are suspicious for 5-min candles."""
        ret = np.log(df["close"] / df["close"].shift(1)).abs()
        bad = (ret > 0.05).sum()
        if bad > 0:
            self._warn(
                "extreme_return",
                f"{bad} rows with |log_return| > 5% (suspicious for 5-min candle)",
            )

    def _warn_extreme_volume(self, df: pd.DataFrame):
        """Volume > 5x rolling 20-bar median is suspicious."""
        if len(df) < 20:
            return
        median_vol = df["volume"].rolling(20, min_periods=5).median()
        ratio = df["volume"] / median_vol.replace(0, 1)
        bad = (ratio > 5).sum()
        if bad > 0:
            self._warn(
                "extreme_volume",
                f"{bad} rows with volume > 5x rolling median (suspicious spike)",
            )

    def _warn_trade_count_sane(self, df: pd.DataFrame):
        """Number of candles should match expected trading hours."""
        # ~78 5-min candles per trading day (6.5 hours)
        per_day = 78
        n_days = len(df) / per_day if per_day > 0 else 0
        if n_days < 1:
            return
        expected = int(n_days) * per_day
        diff = abs(len(df) - expected)
        if diff > per_day * 2:
            self._warn(
                "candle_count_sane",
                f"{len(df)} candles for ~{n_days:.1f} days, expected ~{expected} (diff: {diff})",
            )

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _fail(self, name: str, message: str, severity: str = "critical"):
        self.results.append({"name": name, "status": "fail", "message": message, "severity": severity})
        if severity == "critical":
            self._critical_failures += 1

    def _pass(self, name: str, message: str):
        self.results.append({"name": name, "status": "pass", "message": message, "severity": "info"})

    def _warn(self, name: str, message: str):
        self.results.append({"name": name, "status": "warn", "message": message, "severity": "warning"})
        self._warning_failures += 1

    def _report(self, name: str, passed: bool, message: str, severity: str) -> dict:
        return {
            "name": name,
            "passed": passed,
            "message": message,
            "results": [],
        }

    def _summary(self) -> dict:
        """Build validation summary."""
        passed = sum(1 for r in self.results if r["status"] == "pass")
        failed = sum(1 for r in self.results if r["status"] == "fail")
        warned = sum(1 for r in self.results if r["status"] == "warn")

        critical_passed = all(
            r["status"] != "fail" for r in self.results if r["severity"] == "critical"
        )

        return {
            "suite": "candle_expectations",
            "passed": critical_passed,
            "critical_failures": self._critical_failures,
            "warning_failures": self._warning_failures,
            "checks_passed": passed,
            "checks_failed": failed,
            "checks_warned": warned,
            "total_checks": len(self.results),
            "results": self.results,
        }


def get_candle_suite() -> CandleExpectations:
    return CandleExpectations()
