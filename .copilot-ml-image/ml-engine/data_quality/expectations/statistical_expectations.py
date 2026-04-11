"""
Statistical expectations for trading data — detects distribution drift and anomalies.

Uses Population Stability Index (PSI) to compare current window vs historical baseline.
Stores baselines in JSON so they persist across validation runs.

Run order:
  1. compute_psi() — compares current vs baseline
  2. update_baseline() — saves current window as new baseline (only when DQ passes)
  3. check_distribution_stats() — skewness, kurtosis, range sanity
"""

from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd


# ─── PSI Calculation ───────────────────────────────────────────────────────────

def _psi(expected: np.ndarray, actual: np.ndarray, bins: int = 10) -> float:
    """
    Population Stability Index between two distributions.

    PSI < 0.1  → stable, no action
    PSI 0.1-0.2 → minor shift, warning
    PSI > 0.2   → significant drift, critical
    """
    if len(expected) < 2 or len(actual) < 2:
        return 0.0

    # Clip to common range to avoid empty bins
    lo = max(expected.min(), actual.min())
    hi = min(expected.max(), actual.max())
    if lo >= hi:
        return 0.0

    edges = np.linspace(lo, hi, bins + 1)
    try:
        expected_pct = np.histogram(expected, bins=edges)[0] / len(expected)
        actual_pct = np.histogram(actual, bins=edges)[0] / len(actual)
    except Exception:
        return 0.0

    # Avoid division by zero and log(0)
    expected_pct = np.clip(expected_pct, 1e-6, None)
    actual_pct = np.clip(actual_pct, 1e-6, None)

    psi_value = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
    return float(psi_value)


# ─── Distribution Statistics ──────────────────────────────────────────────────

def _compute_stats(series: pd.Series) -> dict:
    """Compute distributional statistics for a numeric series."""
    vals = pd.to_numeric(series.dropna(), errors="coerce").dropna()
    if len(vals) < 4:
        return {"n": len(vals), "mean": None, "std": None, "skew": None, "kurt": None, "min": None, "max": None}

    return {
        "n": int(len(vals)),
        "mean": float(vals.mean()),
        "std": float(vals.std()),
        "skew": float(vals.skew()),
        "kurt": float(vals.kurt()),
        "min": float(vals.min()),
        "max": float(vals.max()),
        "median": float(vals.median()),
        "p05": float(vals.quantile(0.05)),
        "p95": float(vals.quantile(0.95)),
    }


# ─── Baseline Store ───────────────────────────────────────────────────────────

def _get_baseline_path(table: str) -> Path:
    root = Path(os.environ.get("DQ_BASELINE_DIR", "/tmp/tradersapp_dq_baselines"))
    root.mkdir(parents=True, exist_ok=True)
    return root / f"baseline_{table}.json"


def load_baseline(table: str) -> dict | None:
    path = _get_baseline_path(table)
    if not path.exists():
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def save_baseline(table: str, data: dict) -> None:
    path = _get_baseline_path(table)
    try:
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)
    except Exception as exc:
        print(f"[DQ] Failed to save baseline for {table}: {exc}")


# ─── PSI Suite ───────────────────────────────────────────────────────────────

class DriftExpectations:
    """
    Detects distributional drift in candle/trade data using PSI.

    PSI thresholds:
      - < 0.1  → stable
      - 0.1-0.2 → minor shift (warning)
      - > 0.2   → significant drift (critical)
    """

    PSI_CRITICAL = 0.2
    PSI_WARNING = 0.1

    def __init__(self) -> None:
        self.results: list[dict] = []
        self._critical_failures = 0
        self._warning_failures = 0

    def validate(
        self,
        df: pd.DataFrame,
        table: str = "candles_5min",
        baseline_days: int = 90,
        current_days: int = 30,
        columns: list[str] | None = None,
    ) -> dict:
        self.results = []
        self._critical_failures = 0
        self._warning_failures = 0

        if df.empty:
            self._fail("empty_dataset", "Dataset is empty for drift check", "critical")
            return self._summary()

        if len(df) < 10:
            self._pass("insufficient_rows", f"Only {len(df)} rows; drift check skipped")
            return self._summary()

        if columns is None:
            columns = ["close", "volume"]

        baseline = load_baseline(table)
        self._check_psi(df, table, baseline, columns)
        self._check_distribution_stats(df, columns)

        return self._summary()

    def _check_psi(
        self,
        df: pd.DataFrame,
        table: str,
        baseline: dict | None,
        columns: list[str],
    ) -> None:
        if baseline is None:
            self._pass("psi_baseline", "No baseline found; PSI check skipped (first run)")
            return

        # Use the baseline's 'current' window as expected, current df as actual
        for col in columns:
            if col not in df.columns:
                self._warn(f"psi_col_missing_{col}", f"Column {col} not in DataFrame; skipped")
                continue
            if col not in baseline.get("columns", {}):
                self._warn(f"psi_col_missing_baseline_{col}", f"Column {col} not in baseline; skipped")
                continue

            expected = np.array(baseline["columns"].get(col, {}).get("values", []), dtype=float)
            actual = pd.to_numeric(df[col], errors="coerce").dropna().values.astype(float)

            if len(expected) < 20 or len(actual) < 10:
                self._warn(f"psi_insufficient_data_{col}", "Not enough data for PSI; skipped")
                continue

            psi = _psi(expected, actual)
            if psi >= self.PSI_CRITICAL:
                self._fail(
                    f"psi_critical_{col}",
                    f"PSI={psi:.4f} for {col} (>= {self.PSI_CRITICAL})",
                    "critical",
                )
            elif psi >= self.PSI_WARNING:
                self._warn(
                    f"psi_warning_{col}",
                    f"PSI={psi:.4f} for {col} (>= {self.PSI_WARNING})",
                )
            else:
                self._pass(f"psi_stable_{col}", f"PSI={psi:.4f} for {col} (stable)")

    def _check_distribution_stats(
        self,
        df: pd.DataFrame,
        columns: list[str],
    ) -> None:
        for col in columns:
            if col not in df.columns:
                continue
            stats = _compute_stats(df[col])
            if stats["skew"] is None:
                continue

            # Flag extreme skewness (symmetric distribution expected for returns/prices)
            if abs(stats["skew"]) > 3:
                self._warn(
                    f"skew_extreme_{col}",
                    f"Skewness={stats['skew']:.2f} for {col} (extreme, |skew| > 3)",
                )
            else:
                self._pass(f"skew_{col}", f"Skewness={stats['skew']:.2f} for {col}")

            # Flag extreme kurtosis (heavy tails)
            if stats["kurt"] > 10:
                self._warn(
                    f"kurt_extreme_{col}",
                    f"Kurtosis={stats['kurt']:.2f} for {col} (extreme, > 10)",
                )
            else:
                self._pass(f"kurt_{col}", f"Kurtosis={stats['kurt']:.2f} for {col}")

            # Sanity: mean should be within 5 std devs of min/max
            if stats["std"] and stats["std"] > 0:
                z = abs(stats["mean"] - (stats["min"] + stats["max"]) / 2) / stats["std"]
                if z > 5:
                    self._warn(f"mean_outlier_{col}", "Mean is > 5 std from midpoint")

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
        checks_passed = sum(1 for r in self.results if r["status"] == "pass")
        checks_failed = sum(1 for r in self.results if r["status"] == "fail")
        checks_warned = sum(1 for r in self.results if r["status"] == "warn")
        return {
            "suite": "drift_expectations",
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


def get_drift_suite() -> DriftExpectations:
    return DriftExpectations()


# ─── Baseline update helpers ────────────────────────────────────────────────────

def build_baseline_snapshot(df: pd.DataFrame, table: str, columns: list[str] | None = None) -> dict:
    """
    Build a snapshot of current window to use as future baseline.
    Called after a passing DQ run to refresh the baseline.
    """
    if columns is None:
        columns = ["close", "volume"]

    snapshot: dict = {
        "table": table,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "n_rows": len(df),
        "columns": {},
    }

    for col in columns:
        if col not in df.columns:
            continue
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        snapshot["columns"][col] = {
            "values": series.tolist(),
            "stats": _compute_stats(series),
        }

    save_baseline(table, snapshot)
    return snapshot


def compute_baseline_stats(df: pd.DataFrame, table: str) -> dict:
    """
    Compute distributional statistics for the current window and store as baseline.
    Called after validate_candles() if all checks pass.
    """
    return build_baseline_snapshot(df, table, columns=["close", "volume", "high", "low"])
