"""
Trade Log Expectations — Great Expectations suite for trading performance data.

Validates: trade_log table (entry/exit times, PnL, results, direction).
"""

from __future__ import annotations

import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import Optional


class TradeExpectations:
    """
    Expectation suite for the trade_log table.
    """

    VALID_RESULTS = {"win", "loss", "breakeven", "open"}
    VALID_DIRECTIONS = {"long", "short"}
    VALID_AMD_PHASES = {"ACCUMULATION", "MANIPULATION", "DISTRIBUTION", "TRANSITION", "UNCLEAR"}

    def __init__(self):
        self.results: list[dict] = []
        self._critical_failures = 0
        self._warning_failures = 0

    def validate(self, df: pd.DataFrame) -> dict:
        self.results = []
        self._critical_failures = 0
        self._warning_failures = 0

        if df.empty:
            return {"suite": "trade_expectations", "passed": False, "message": "empty dataset"}

        self._check_required_columns(df)
        self._check_no_null_pnl(df)
        self._check_result_values(df)
        self._check_direction_values(df)
        self._check_entry_before_exit(df)
        self._check_pnl_ticks_signed(df)
        self._check_win_result_matches_pnl(df)
        self._check_amd_phase_valid(df)
        self._check_confidence_range(df)
        self._check_no_duplicate_trades(df)

        return self._summary()

    def _check_required_columns(self, df: pd.DataFrame):
        required = ["entry_time", "exit_time", "pnl_dollars", "pnl_ticks", "result", "direction"]
        missing = [c for c in required if c not in df.columns]
        if missing:
            self._fail("required_columns", f"Missing columns: {missing}", "critical")
        else:
            self._pass("required_columns", "All required columns present")

    def _check_no_null_pnl(self, df: pd.DataFrame):
        if "pnl_dollars" not in df.columns:
            return
        nulls = df["pnl_dollars"].isna().sum()
        if nulls > 0:
            self._fail("no_null_pnl", f"{nulls} null pnl_dollars values", "critical")
        else:
            self._pass("no_null_pnl", "No null pnl_dollars values")

    def _check_result_values(self, df: pd.DataFrame):
        if "result" not in df.columns:
            return
        invalid = ~df["result"].isin(self.VALID_RESULTS)
        bad = invalid.sum()
        if bad > 0:
            self._fail(
                "result_values",
                f"{bad} rows with invalid result values: {df.loc[invalid, 'result'].unique()}",
                "critical",
            )
        else:
            self._pass("result_values", "All result values are valid")

    def _check_direction_values(self, df: pd.DataFrame):
        if "direction" not in df.columns:
            return
        invalid = ~df["direction"].isin(self.VALID_DIRECTIONS)
        bad = invalid.sum()
        if bad > 0:
            self._fail(
                "direction_values",
                f"{bad} rows with invalid direction values",
                "critical",
            )
        else:
            self._pass("direction_values", "All direction values are valid")

    def _check_entry_before_exit(self, df: pd.DataFrame):
        if "entry_time" not in df.columns or "exit_time" not in df.columns:
            return
        entry = pd.to_datetime(df["entry_time"])
        exit = pd.to_datetime(df["exit_time"])

        # Only check closed trades
        closed = exit.notna()
        bad = (entry[closed] >= exit[closed]).sum()
        if bad > 0:
            self._fail(
                "entry_before_exit",
                f"{bad} closed trades where entry_time >= exit_time",
                "critical",
            )
        else:
            self._pass("entry_before_exit", "All closed trades have entry < exit")

    def _check_pnl_ticks_signed(self, df: pd.DataFrame):
        """PnL ticks should be positive for wins and negative for losses."""
        if "pnl_ticks" not in df.columns or "result" not in df.columns:
            return

        # Wins should have positive ticks
        wins = df["result"] == "win"
        bad_wins = (wins & (df["pnl_ticks"] <= 0)).sum()
        if bad_wins > 0:
            self._fail(
                "pnl_ticks_signed_win",
                f"{bad_wins} win trades with pnl_ticks <= 0",
                "critical",
            )

        # Losses should have negative ticks
        losses = df["result"] == "loss"
        bad_losses = (losses & (df["pnl_ticks"] >= 0)).sum()
        if bad_losses > 0:
            self._fail(
                "pnl_ticks_signed_loss",
                f"{bad_losses} loss trades with pnl_ticks >= 0",
                "critical",
            )

        if bad_wins == 0 and bad_losses == 0:
            self._pass("pnl_ticks_signed", "All PnL signs match trade results")

    def _check_win_result_matches_pnl(self, df: pd.DataFrame):
        """Win trades should have positive pnl_dollars."""
        if "pnl_dollars" not in df.columns or "result" not in df.columns:
            return
        wins = df["result"] == "win"
        bad = (wins & (df["pnl_dollars"] <= 0)).sum()
        if bad > 0:
            self._fail(
                "win_pnl_positive",
                f"{bad} win trades with pnl_dollars <= 0",
                "warning",
            )
        else:
            self._pass("win_pnl_positive", "All win trades have positive pnl_dollars")

    def _check_amd_phase_valid(self, df: pd.DataFrame):
        if "amd_phase" not in df.columns:
            return
        invalid = ~df["amd_phase"].isin(self.VALID_AMD_PHASES)
        bad = invalid.sum()
        if bad > 0:
            self._fail(
                "amd_phase_values",
                f"{bad} rows with invalid amd_phase",
                "warning",
            )
        else:
            self._pass("amd_phase_values", "All amd_phase values are valid")

    def _check_confidence_range(self, df: pd.DataFrame):
        if "confidence" not in df.columns:
            return
        out_of_range = ~df["confidence"].between(0, 1)
        bad = out_of_range.sum()
        if bad > 0:
            self._fail(
                "confidence_range",
                f"{bad} rows with confidence outside [0, 1]",
                "critical",
            )
        else:
            self._pass("confidence_range", "All confidence values in [0, 1]")

    def _check_no_duplicate_trades(self, df: pd.DataFrame):
        if "entry_time" not in df.columns:
            return
        dup = df["entry_time"].duplicated().sum()
        if dup > 0:
            self._warn(
                "no_duplicate_entry_times",
                f"{dup} duplicate entry_time values (may be intentional for multiple strategies)",
            )
        else:
            self._pass("no_duplicate_entry_times", "No duplicate entry_time values")

    def _fail(self, name: str, message: str, severity: str = "critical"):
        self.results.append({"name": name, "status": "fail", "message": message, "severity": severity})
        if severity == "critical":
            self._critical_failures += 1

    def _pass(self, name: str, message: str):
        self.results.append({"name": name, "status": "pass", "message": message, "severity": "info"})

    def _warn(self, name: str, message: str):
        self.results.append({"name": name, "status": "warn", "message": message, "severity": "warning"})
        self._warning_failures += 1

    def _summary(self) -> dict:
        critical_passed = all(
            r["status"] != "fail" for r in self.results if r["severity"] == "critical"
        )
        return {
            "suite": "trade_expectations",
            "passed": critical_passed,
            "critical_failures": self._critical_failures,
            "warning_failures": self._warning_failures,
            "checks_passed": sum(1 for r in self.results if r["status"] == "pass"),
            "checks_failed": sum(1 for r in self.results if r["status"] == "fail"),
            "checks_warned": sum(1 for r in self.results if r["status"] == "warn"),
            "total_checks": len(self.results),
            "results": self.results,
        }


def get_trade_suite() -> TradeExpectations:
    return TradeExpectations()
