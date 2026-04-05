from __future__ import annotations

from pathlib import Path
import sys

import pandas as pd
import pytest

ML_ENGINE = Path(__file__).parent.parent
sys.path.insert(0, str(ML_ENGINE))

import data_quality.validation_pipeline as dq_mod


def test_validate_incoming_candles_passes(tmp_path, monkeypatch):
    monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
    monkeypatch.setattr(dq_mod, "DQ_QUARANTINE_DIR", tmp_path / "dq_rejections")

    df = pd.DataFrame(
        [
            {
                "timestamp": "2026-04-04T12:00:00Z",
                "open": 100.0,
                "high": 101.0,
                "low": 99.5,
                "close": 100.4,
                "volume": 250,
            },
            {
                "timestamp": "2026-04-04T12:05:00Z",
                "open": 100.4,
                "high": 101.2,
                "low": 100.1,
                "close": 100.9,
                "volume": 220,
            },
        ]
    )

    report = dq_mod.validate_incoming_dataset(
        df=df,
        dataset_type="candles",
        source="pytest:candles_valid",
        block=True,
        persist_rejected=True,
    )

    assert report["passed"] is True
    assert report["critical_failures"] == 0
    assert "quarantine" not in report


def test_validate_incoming_candles_quarantines_on_failure(tmp_path, monkeypatch):
    monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
    monkeypatch.setattr(dq_mod, "DQ_QUARANTINE_DIR", tmp_path / "dq_rejections")

    df = pd.DataFrame(
        [
            {
                "timestamp": "2026-04-04T12:00:00Z",
                "open": 100.0,
                "high": 101.0,
                "low": 99.5,
                "close": 100.4,
                "volume": -10,
            }
        ]
    )

    report = dq_mod.validate_incoming_dataset(
        df=df,
        dataset_type="candles",
        source="pytest:candles_invalid",
        block=False,
        persist_rejected=True,
    )

    assert report["passed"] is False
    assert report["critical_failures"] >= 1
    quarantine = report.get("quarantine")
    assert quarantine is not None
    assert Path(quarantine["report_path"]).exists()
    assert Path(quarantine["sample_path"]).exists()


def test_validate_incoming_candles_blocks_on_failure(tmp_path, monkeypatch):
    monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
    monkeypatch.setattr(dq_mod, "DQ_QUARANTINE_DIR", tmp_path / "dq_rejections")

    df = pd.DataFrame(
        [
            {
                "timestamp": "2026-04-04T12:00:00Z",
                "open": 100.0,
                "high": 101.0,
                "low": 99.5,
                "close": 100.4,
                "volume": -5,
            }
        ]
    )

    with pytest.raises(ValueError):
        dq_mod.validate_incoming_dataset(
            df=df,
            dataset_type="candles",
            source="pytest:candles_block",
            block=True,
            persist_rejected=True,
        )


def test_validate_incoming_trades_accepts_numeric_direction(tmp_path, monkeypatch):
    monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
    monkeypatch.setattr(dq_mod, "DQ_QUARANTINE_DIR", tmp_path / "dq_rejections")

    df = pd.DataFrame(
        [
            {
                "entry_time": "2026-04-04T12:05:00+00:00",
                "exit_time": "2026-04-04T12:20:00+00:00",
                "direction": 1,
                "result": "win",
                "pnl_ticks": 8,
                "pnl_dollars": 40,
                "confidence": 0.72,
            }
        ]
    )

    report = dq_mod.validate_incoming_dataset(
        df=df,
        dataset_type="trades",
        source="pytest:trades_numeric_direction",
        block=True,
        persist_rejected=True,
    )

    assert report["passed"] is True


def test_validate_incoming_sessions_accepts_neutral_direction(tmp_path, monkeypatch):
    monkeypatch.setattr(dq_mod, "REQUIRE_GX", False)
    monkeypatch.setattr(dq_mod, "DQ_QUARANTINE_DIR", tmp_path / "dq_rejections")

    df = pd.DataFrame(
        [
            {
                "trade_date": "2026-04-04",
                "symbol": "MNQ",
                "direction": 0,
                "gap_pct": 0.01,
                "session_range": 22,
                "range_vs_atr": 1.2,
            }
        ]
    )

    report = dq_mod.validate_incoming_dataset(
        df=df,
        dataset_type="sessions",
        source="pytest:sessions_neutral",
        block=True,
        persist_rejected=True,
    )

    assert report["passed"] is True
