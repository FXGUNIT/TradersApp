"""
Session aggregate expectations for trading session metadata.

Validates trade_date, symbol, direction, gap_pct, session_range, range_vs_atr
columns in the `session_aggregates` table.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd


class SessionExpectations:
    """Data-quality expectations for `session_aggregates`."""

    REQUIRED_COLUMNS = ("trade_date", "symbol", "direction", "gap_pct", "session_range", "range_vs_atr")
    VALID_DIRECTIONS = {"LONG", "SHORT", "NEUTRAL"}

    def __init__(self) -> None:
        self.results: list[dict] = []
        self._critical_failures = 0
        self._warning_failures = 0

    def validate(self, df: pd.DataFrame) -> dict:
        self.results = []
        self._critical_failures = 0
        self._warning_failures = 0

        if df.empty:
            self._fail("empty_dataset", "Session dataset is empty", "critical")
            return self._summary()

        self._check_required_columns(df)
        if any(col not in df.columns for col in self.REQUIRED_COLUMNS):
            return self._summary()

        self._check_direction_values(df)
        self._check_gap_pct_range(df)
        self._check_session_range_positive(df)
        self._check_range_vs_atr_sanity(df)
        self._check_trade_date_parseable(df)
        self._check_no_future_dates(df)
        self._warn_duplicate_trade_dates(df)
        self._warn_empty_symbol(df)

        return self._summary()

    def _check_required_columns(self, df: pd.DataFrame) -> None:
        missing = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
        if missing:
            self._fail("required_columns", f"Missing columns: {missing}", "critical")
        else:
            self._pass("required_columns", "All required columns present")

    def _check_direction_values(self, df: pd.DataFrame) -> None:
        mapping = {
            1: "LONG",
            "1": "LONG",
            -1: "SHORT",
            "-1": "SHORT",
            0: "NEUTRAL",
            "0": "NEUTRAL",
            "long": "LONG",
            "LONG": "LONG",
            "short": "SHORT",
            "SHORT": "SHORT",
            "neutral": "NEUTRAL",
            "NEUTRAL": "NEUTRAL",
        }
        values = df["direction"].map(lambda value: mapping.get(value, value)).astype(str).str.upper().str.strip()
        bad = int((~values.isin(self.VALID_DIRECTIONS)).sum())
        if bad > 0:
            self._fail("direction_values", f"{bad} invalid direction values", "critical")
        else:
            self._pass("direction_values", "All direction values are LONG, SHORT, or NEUTRAL")

    def _check_gap_pct_range(self, df: pd.DataFrame) -> None:
        gap = pd.to_numeric(df["gap_pct"], errors="coerce")
        bad = int((~gap.between(-0.10, 0.10)).sum())
        if bad > 0:
            self._warn("gap_pct_range", f"{bad} rows with gap_pct outside [-0.10, 0.10]")
        else:
            self._pass("gap_pct_range", "All gap_pct values in [-0.10, 0.10]")

    def _check_session_range_positive(self, df: pd.DataFrame) -> None:
        sr = pd.to_numeric(df["session_range"], errors="coerce")
        bad = int((sr <= 0).sum())
        if bad > 0:
            self._fail("session_range_positive", f"{bad} rows with session_range <= 0", "critical")
        else:
            self._pass("session_range_positive", "All session_range values are positive")

    def _check_range_vs_atr_sanity(self, df: pd.DataFrame) -> None:
        if "range_vs_atr" not in df.columns:
            self._pass("range_vs_atr_sanity", "range_vs_atr column absent; skipped")
            return
        ratio = pd.to_numeric(df["range_vs_atr"], errors="coerce")
        bad = int((~ratio.between(0, 5)).sum())
        if bad > 0:
            self._warn("range_vs_atr_sanity", f"{bad} rows with range_vs_atr outside [0, 5]")
        else:
            self._pass("range_vs_atr_sanity", "All range_vs_atr values in [0, 5]")

    def _check_trade_date_parseable(self, df: pd.DataFrame) -> None:
        parsed = pd.to_datetime(df["trade_date"], errors="coerce")
        bad = int(parsed.isna().sum())
        if bad > 0:
            self._fail("trade_date_parseable", f"{bad} unparseable trade_date values", "critical")
        else:
            self._pass("trade_date_parseable", "All trade_date values are parseable")

    def _check_no_future_dates(self, df: pd.DataFrame) -> None:
        parsed = pd.to_datetime(df["trade_date"], errors="coerce", utc=True)
        cutoff = pd.Timestamp.now(tz=timezone.utc).normalize() + pd.Timedelta(days=1)
        bad = int((parsed > cutoff).sum())
        if bad > 0:
            self._fail("trade_date_not_future", f"{bad} trade_date values are in the future", "critical")
        else:
            self._pass("trade_date_not_future", "No future trade_date values")

    def _warn_duplicate_trade_dates(self, df: pd.DataFrame) -> None:
        if "symbol" not in df.columns:
            return
        dup = int(df.duplicated(subset=["trade_date", "symbol"]).sum())
        if dup > 0:
            self._warn("duplicate_trade_date_symbol", f"{dup} duplicate (trade_date, symbol) pairs found")
        else:
            self._pass("duplicate_trade_date_symbol", "No duplicate (trade_date, symbol) pairs")

    def _warn_empty_symbol(self, df: pd.DataFrame) -> None:
        if "symbol" not in df.columns:
            return
        bad = int(df["symbol"].astype(str).str.strip().eq("").sum())
        if bad > 0:
            self._warn("empty_symbol", f"{bad} rows with empty symbol")
        else:
            self._pass("empty_symbol", "No empty symbol values")

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
            "suite": "session_expectations",
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


def get_session_suite() -> SessionExpectations:
    return SessionExpectations()
