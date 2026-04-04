"""
Candle expectations for 5-minute OHLCV data.

These checks are engine-agnostic and can run:
- directly in Python (always)
- alongside Great Expectations in the validation pipeline
"""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd


class CandleExpectations:
    """Data-quality expectations for `candles_5min`."""

    REQUIRED_COLUMNS = ("timestamp", "open", "high", "low", "close", "volume")

    def __init__(self) -> None:
        self.results: list[dict] = []
        self._critical_failures = 0
        self._warning_failures = 0

    def validate(self, df: pd.DataFrame) -> dict:
        """Run all candle checks and return a normalized report."""
        self.results = []
        self._critical_failures = 0
        self._warning_failures = 0

        if df.empty:
            self._fail("empty_dataset", "DataFrame is empty", "critical")
            return self._summary()

        self._check_required_columns(df)
        if any(col not in df.columns for col in self.REQUIRED_COLUMNS):
            # Required shape checks already recorded; abort dependent checks.
            return self._summary()

        self._check_ohlcv_not_null(df)
        self._check_high_low_consistency(df)
        self._check_volume_positive(df)
        self._check_timestamp_monotonic(df)
        self._check_timestamp_5m_aligned(df)
        self._check_no_duplicate_timestamps(df)
        self._check_not_future_timestamps(df)
        self._warn_extreme_returns(df)
        self._warn_extreme_volume_spikes(df)

        return self._summary()

    def _check_required_columns(self, df: pd.DataFrame) -> None:
        missing = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
        if missing:
            self._fail("required_columns", f"Missing columns: {missing}", "critical")
        else:
            self._pass("required_columns", "All required columns present")

    def _check_ohlcv_not_null(self, df: pd.DataFrame) -> None:
        for col in ("open", "high", "low", "close", "volume"):
            null_count = int(df[col].isna().sum())
            if null_count > 0:
                self._fail(f"{col}_not_null", f"{null_count} null values in {col}", "critical")
            else:
                self._pass(f"{col}_not_null", f"No null values in {col}")

    def _check_high_low_consistency(self, df: pd.DataFrame) -> None:
        high_bad = ~(
            (df["high"] >= df["open"]) & (df["high"] >= df["close"]) & (df["high"] >= df["low"])
        )
        low_bad = ~(
            (df["low"] <= df["open"]) & (df["low"] <= df["close"]) & (df["low"] <= df["high"])
        )
        high_bad_count = int(high_bad.sum())
        low_bad_count = int(low_bad.sum())

        if high_bad_count > 0:
            self._fail("high_consistency", f"{high_bad_count} rows where high is inconsistent", "critical")
        else:
            self._pass("high_consistency", "All rows satisfy high consistency")

        if low_bad_count > 0:
            self._fail("low_consistency", f"{low_bad_count} rows where low is inconsistent", "critical")
        else:
            self._pass("low_consistency", "All rows satisfy low consistency")

    def _check_volume_positive(self, df: pd.DataFrame) -> None:
        bad = int((df["volume"] <= 0).sum())
        if bad > 0:
            self._fail("volume_positive", f"{bad} rows with volume <= 0", "critical")
        else:
            self._pass("volume_positive", "All rows have volume > 0")

    def _check_timestamp_monotonic(self, df: pd.DataFrame) -> None:
        ts = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
        if ts.isna().any():
            self._fail("timestamp_parseable", f"{int(ts.isna().sum())} unparseable timestamps", "critical")
            return

        if not bool(ts.is_monotonic_increasing):
            self._fail("timestamp_monotonic", "Timestamps are not monotonically increasing", "critical")
        else:
            self._pass("timestamp_monotonic", "Timestamps are monotonically increasing")

    def _check_timestamp_5m_aligned(self, df: pd.DataFrame) -> None:
        ts = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
        aligned = (ts.dt.minute % 5 == 0) & (ts.dt.second == 0)
        bad = int((~aligned).sum())
        if bad > 0:
            self._fail("timestamp_5m_aligned", f"{bad} timestamps are not aligned to 5-minute boundaries", "critical")
        else:
            self._pass("timestamp_5m_aligned", "All timestamps aligned to 5-minute boundaries")

    def _check_no_duplicate_timestamps(self, df: pd.DataFrame) -> None:
        dup = int(df["timestamp"].duplicated().sum())
        if dup > 0:
            self._fail("timestamp_unique", f"{dup} duplicate timestamps found", "critical")
        else:
            self._pass("timestamp_unique", "No duplicate timestamps")

    def _check_not_future_timestamps(self, df: pd.DataFrame) -> None:
        ts = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
        cutoff = pd.Timestamp.now(tz=timezone.utc) + pd.Timedelta(minutes=10)
        bad = int((ts > cutoff).sum())
        if bad > 0:
            self._fail("timestamp_not_future", f"{bad} timestamps are in the future", "critical")
        else:
            self._pass("timestamp_not_future", "No future timestamps")

    def _warn_extreme_returns(self, df: pd.DataFrame) -> None:
        close = pd.to_numeric(df["close"], errors="coerce")
        ret = close.pct_change().abs()
        bad = int((ret > 0.05).sum())
        if bad > 0:
            self._warn("extreme_returns", f"{bad} rows with absolute return > 5%")
        else:
            self._pass("extreme_returns", "No extreme returns detected")

    def _warn_extreme_volume_spikes(self, df: pd.DataFrame) -> None:
        if len(df) < 20:
            self._pass("extreme_volume_spikes", "Insufficient rows for rolling volume spike check")
            return
        vol = pd.to_numeric(df["volume"], errors="coerce")
        median = vol.rolling(20, min_periods=5).median().replace(0, pd.NA)
        ratio = vol / median
        bad = int((ratio > 5).sum())
        if bad > 0:
            self._warn("extreme_volume_spikes", f"{bad} rows with volume > 5x rolling median")
        else:
            self._pass("extreme_volume_spikes", "No extreme volume spikes")

    def _fail(self, name: str, message: str, severity: str = "critical") -> None:
        self.results.append({"name": name, "status": "fail", "message": message, "severity": severity})
        if severity == "critical":
            self._critical_failures += 1

    def _pass(self, name: str, message: str) -> None:
        self.results.append({"name": name, "status": "pass", "message": message, "severity": "info"})

    def _warn(self, name: str, message: str) -> None:
        self.results.append({"name": name, "status": "warn", "message": message, "severity": "warning"})
        self._warning_failures += 1

    def _summary(self) -> dict:
        checks_passed = sum(1 for row in self.results if row["status"] == "pass")
        checks_failed = sum(1 for row in self.results if row["status"] == "fail")
        checks_warned = sum(1 for row in self.results if row["status"] == "warn")
        return {
            "suite": "candle_expectations",
            "passed": self._critical_failures == 0,
            "critical_failures": self._critical_failures,
            "warning_failures": self._warning_failures,
            "checks_passed": checks_passed,
            "checks_failed": checks_failed,
            "checks_warned": checks_warned,
            "total_checks": len(self.results),
            "results": self.results,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


def get_candle_suite() -> CandleExpectations:
    return CandleExpectations()

