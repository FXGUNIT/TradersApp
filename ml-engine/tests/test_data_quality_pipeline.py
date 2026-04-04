import sqlite3
import sys
from pathlib import Path

import pandas as pd


ML_ENGINE = Path(__file__).parent.parent
sys.path.insert(0, str(ML_ENGINE))

from data_quality.expectations.candle_expectations import get_candle_suite
from data_quality.validation_pipeline import run_full_validation
import data_quality.validation_pipeline as dq_mod


def _seed_db(db_path: Path, *, bad_volume: bool = False) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE candles_5min (
              timestamp TEXT,
              open REAL,
              high REAL,
              low REAL,
              close REAL,
              volume INTEGER
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE trade_log (
              entry_time TEXT,
              exit_time TEXT,
              direction TEXT,
              result TEXT,
              pnl_ticks REAL,
              pnl_dollars REAL,
              confidence REAL,
              amd_phase TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE session_aggregates (
              trade_date TEXT,
              symbol TEXT,
              direction TEXT,
              gap_pct REAL,
              session_range REAL,
              range_vs_atr REAL
            )
            """
        )

        volume = -10 if bad_volume else 120
        conn.execute(
            """
            INSERT INTO candles_5min (timestamp, open, high, low, close, volume)
            VALUES ('2026-04-04T12:00:00+00:00', 100, 101, 99.5, 100.5, ?)
            """,
            (volume,),
        )
        conn.execute(
            """
            INSERT INTO trade_log (entry_time, exit_time, direction, result, pnl_ticks, pnl_dollars, confidence, amd_phase)
            VALUES ('2026-04-04T12:05:00+00:00', '2026-04-04T12:20:00+00:00', 'long', 'win', 8, 40, 0.72, 'ACCUMULATION')
            """
        )
        conn.execute(
            """
            INSERT INTO session_aggregates (trade_date, symbol, direction, gap_pct, session_range, range_vs_atr)
            VALUES ('2026-04-04', 'MNQ', 'LONG', 0.01, 22, 1.3)
            """
        )
        conn.commit()
    finally:
        conn.close()


def test_candle_expectations_detect_non_monotonic_timestamps():
    df = pd.DataFrame(
        [
            {"timestamp": "2026-04-04T12:05:00Z", "open": 100, "high": 101, "low": 99, "close": 100.3, "volume": 200},
            {"timestamp": "2026-04-04T12:00:00Z", "open": 100.3, "high": 101.2, "low": 99.8, "close": 100.1, "volume": 180},
        ]
    )
    report = get_candle_suite().validate(df)
    assert report["passed"] is False
    assert any(row["name"] == "timestamp_monotonic" and row["status"] == "fail" for row in report["results"])


def test_run_full_validation_passes_with_valid_seed_when_gx_optional(tmp_path, monkeypatch):
    db_path = tmp_path / "dq_valid.db"
    _seed_db(db_path, bad_volume=False)

    monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
    report = run_full_validation(db_path=str(db_path), block=False)
    assert report["passed"] is True
    assert report["critical_failures"] == 0


def test_run_full_validation_fails_on_critical_data_issue(tmp_path, monkeypatch):
    db_path = tmp_path / "dq_invalid.db"
    _seed_db(db_path, bad_volume=True)

    monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
    report = run_full_validation(db_path=str(db_path), block=False)
    assert report["passed"] is False
    assert report["critical_failures"] >= 1

