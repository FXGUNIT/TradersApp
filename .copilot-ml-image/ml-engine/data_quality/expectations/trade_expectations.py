"""
Trade log expectations for model training safety.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd


class TradeExpectations:
    """Data-quality expectations for `trade_log`."""

    REQUIRED_COLUMNS = ("entry_time", "direction", "result", "pnl_ticks", "pnl_dollars")
    VALID_RESULTS = {"win", "loss", "breakeven", "open"}
    VALID_DIRECTIONS = {"long", "short"}
    VALID_AMD_PHASES = {"ACCUMULATION", "MANIPULATION", "DISTRIBUTION", "TRANSITION", "UNCLEAR"}

    def __init__(self) -> None:
        self.results: list[dict] = []
        self._critical_failures = 0
        self._warning_failures = 0

    def validate(self, df: pd.DataFrame) -> dict:
        self.results = []
        self._critical_failures = 0
        self._warning_failures = 0

        if df.empty:
            self._fail("empty_dataset", "Trade dataset is empty", "critical")
            return self._summary()

        self._check_required_columns(df)
        if any(col not in df.columns for col in self.REQUIRED_COLUMNS):
            return self._summary()

        self._check_entry_time_parseable(df)
        self._check_result_values(df)
        self._check_direction_values(df)
        self._check_pnl_not_null(df)
        self._check_pnl_sign_vs_result(df)
        self._check_exit_after_entry(df)
        self._check_confidence_range(df)
        self._warn_duplicate_entry_times(df)
        self._warn_amd_phase_values(df)

        return self._summary()

    def _check_required_columns(self, df: pd.DataFrame) -> None:
        missing = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
        if missing:
            self._fail("required_columns", f"Missing columns: {missing}", "critical")
        else:
            self._pass("required_columns", "All required columns present")

    def _check_entry_time_parseable(self, df: pd.DataFrame) -> None:
        parsed = pd.to_datetime(df["entry_time"], errors="coerce", utc=True)
        bad = int(parsed.isna().sum())
        if bad > 0:
            self._fail("entry_time_parseable", f"{bad} rows have invalid entry_time", "critical")
        else:
            self._pass("entry_time_parseable", "All entry_time values are parseable")

    def _check_result_values(self, df: pd.DataFrame) -> None:
        values = df["result"].astype(str).str.lower().str.strip()
        bad = int((~values.isin(self.VALID_RESULTS)).sum())
        if bad > 0:
            self._fail("result_values", f"{bad} invalid result values", "critical")
        else:
            self._pass("result_values", "All result values valid")

    def _check_direction_values(self, df: pd.DataFrame) -> None:
        mapping = {
            1: "long",
            "1": "long",
            -1: "short",
            "-1": "short",
            "long": "long",
            "short": "short",
            "LONG": "long",
            "SHORT": "short",
        }
        values = df["direction"].map(lambda value: mapping.get(value, value)).astype(str).str.lower().str.strip()
        bad = int((~values.isin(self.VALID_DIRECTIONS)).sum())
        if bad > 0:
            self._fail("direction_values", f"{bad} invalid direction values", "critical")
        else:
            self._pass("direction_values", "All direction values valid")

    def _check_pnl_not_null(self, df: pd.DataFrame) -> None:
        bad_ticks = int(df["pnl_ticks"].isna().sum())
        bad_dollars = int(df["pnl_dollars"].isna().sum())
        if bad_ticks > 0:
            self._fail("pnl_ticks_not_null", f"{bad_ticks} null pnl_ticks values", "critical")
        else:
            self._pass("pnl_ticks_not_null", "No null pnl_ticks values")
        if bad_dollars > 0:
            self._fail("pnl_dollars_not_null", f"{bad_dollars} null pnl_dollars values", "critical")
        else:
            self._pass("pnl_dollars_not_null", "No null pnl_dollars values")

    def _check_pnl_sign_vs_result(self, df: pd.DataFrame) -> None:
        result = df["result"].astype(str).str.lower().str.strip()
        pnl_ticks = pd.to_numeric(df["pnl_ticks"], errors="coerce")

        bad_win = int(((result == "win") & (pnl_ticks <= 0)).sum())
        bad_loss = int(((result == "loss") & (pnl_ticks >= 0)).sum())
        if bad_win > 0:
            self._fail("win_pnl_sign", f"{bad_win} winning trades have non-positive pnl_ticks", "critical")
        else:
            self._pass("win_pnl_sign", "Winning trade pnl signs are correct")
        if bad_loss > 0:
            self._fail("loss_pnl_sign", f"{bad_loss} losing trades have non-negative pnl_ticks", "critical")
        else:
            self._pass("loss_pnl_sign", "Losing trade pnl signs are correct")

    def _check_exit_after_entry(self, df: pd.DataFrame) -> None:
        if "exit_time" not in df.columns:
            self._pass("exit_after_entry", "exit_time column absent; skipped")
            return
        entry = pd.to_datetime(df["entry_time"], errors="coerce", utc=True)
        exit_time = pd.to_datetime(df["exit_time"], errors="coerce", utc=True)
        closed = exit_time.notna()
        bad = int((entry[closed] >= exit_time[closed]).sum())
        if bad > 0:
            self._fail("exit_after_entry", f"{bad} trades have exit_time <= entry_time", "critical")
        else:
            self._pass("exit_after_entry", "Closed trades have exit_time > entry_time")

    def _check_confidence_range(self, df: pd.DataFrame) -> None:
        if "confidence" not in df.columns:
            self._pass("confidence_range", "confidence column absent; skipped")
            return
        confidence = pd.to_numeric(df["confidence"], errors="coerce")
        bad = int((~confidence.between(0, 1)).sum())
        if bad > 0:
            self._fail("confidence_range", f"{bad} rows have confidence outside [0, 1]", "critical")
        else:
            self._pass("confidence_range", "Confidence values in [0, 1]")

    def _warn_duplicate_entry_times(self, df: pd.DataFrame) -> None:
        dup = int(df["entry_time"].duplicated().sum())
        if dup > 0:
            self._warn("duplicate_entry_time", f"{dup} duplicate entry_time rows found")
        else:
            self._pass("duplicate_entry_time", "No duplicate entry_time rows")

    def _warn_amd_phase_values(self, df: pd.DataFrame) -> None:
        if "amd_phase" not in df.columns:
            self._pass("amd_phase_values", "amd_phase column absent; skipped")
            return
        values = df["amd_phase"].astype(str).str.strip().str.upper()
        bad = int((~values.isin(self.VALID_AMD_PHASES)).sum())
        if bad > 0:
            self._warn("amd_phase_values", f"{bad} rows have non-standard amd_phase values")
        else:
            self._pass("amd_phase_values", "AMD phase values are valid")

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
            "suite": "trade_expectations",
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


def get_trade_suite() -> TradeExpectations:
    return TradeExpectations()
