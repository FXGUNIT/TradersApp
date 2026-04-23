from __future__ import annotations

import sqlite3

from data.candle_db import SQLiteBackend


def _create_legacy_schema(path: str) -> None:
    with sqlite3.connect(path) as conn:
        conn.executescript(
            """
            CREATE TABLE candles_5min (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                symbol TEXT NOT NULL DEFAULT 'MNQ',
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume INTEGER NOT NULL,
                tick_volume INTEGER DEFAULT 0,
                session_id INTEGER NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(timestamp, symbol)
            );

            CREATE TABLE session_aggregates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trade_date TEXT NOT NULL,
                symbol TEXT DEFAULT 'MNQ',
                session_id INTEGER NOT NULL,
                session_high REAL NOT NULL,
                session_low REAL NOT NULL,
                session_open REAL NOT NULL,
                session_close REAL NOT NULL,
                session_range REAL NOT NULL,
                total_volume INTEGER NOT NULL,
                avg_volume REAL NOT NULL,
                volume_ratio REAL NOT NULL,
                avg_true_range REAL NOT NULL,
                realized_vol REAL NOT NULL,
                close_to_open REAL NOT NULL,
                direction INTEGER NOT NULL,
                gap_pct REAL NOT NULL,
                range_vs_atr REAL NOT NULL,
                candle_count INTEGER NOT NULL,
                UNIQUE(trade_date, symbol, session_id)
            );

            CREATE TABLE trade_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_time TEXT NOT NULL,
                exit_time TEXT,
                symbol TEXT DEFAULT 'MNQ',
                entry_price REAL NOT NULL,
                exit_price REAL,
                direction INTEGER NOT NULL,
                session_id INTEGER NOT NULL,
                pnl_ticks REAL,
                pnl_dollars REAL,
                result TEXT,
                target_rrr REAL NOT NULL,
                actual_rrr REAL,
                rrr_met INTEGER,
                amd_phase TEXT
            );

            CREATE TABLE signal_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                signal_time TEXT NOT NULL,
                symbol TEXT NOT NULL DEFAULT 'MNQ',
                session_id INTEGER NOT NULL DEFAULT 1,
                signal TEXT NOT NULL,
                confidence REAL NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );
            """
        )


def test_sqlite_backend_migrates_legacy_session_metadata_columns(tmp_db_path):
    _create_legacy_schema(tmp_db_path)

    backend = SQLiteBackend(tmp_db_path)
    backend.close()

    with sqlite3.connect(tmp_db_path) as conn:
        candles_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(candles_5min)").fetchall()
        }
        aggregates_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(session_aggregates)").fetchall()
        }
        trade_log_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(trade_log)").fetchall()
        }
        signal_log_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(signal_log)").fetchall()
        }
        index_names = {
            row[1] for row in conn.execute("PRAGMA index_list(candles_5min)").fetchall()
        }

    assert {"session_name", "session_timezone", "trade_date_local"} <= candles_columns
    assert {"session_name", "session_timezone"} <= aggregates_columns
    assert {
        "session_name",
        "session_timezone",
        "trade_date_local",
        "partial_exit_count",
        "partial_exit_qty",
        "partial_exit_pnl_dollars",
        "remaining_qty",
        "exit_legs_json",
    } <= trade_log_columns
    assert {"session_name", "session_timezone", "trade_date_local"} <= signal_log_columns
    assert "idx_candles_session_name" in index_names


def test_sqlite_backend_upsert_trade_persists_partial_exit_metadata(tmp_db_path):
    backend = SQLiteBackend(tmp_db_path)

    backend.upsert_trade(
        {
            "entry_time": "2026-04-23T09:15:00+05:30",
            "exit_time": "2026-04-23T10:05:00+05:30",
            "symbol": "MNQ",
            "entry_price": 100.0,
            "exit_price": 108.0,
            "direction": 1,
            "session_id": 1,
            "session_name": "main_trading",
            "session_timezone": "Asia/Kolkata",
            "trade_date_local": "2026-04-23",
            "pnl_ticks": 32.0,
            "pnl_dollars": 64.0,
            "result": "win",
            "target_rrr": 2.0,
            "partial_exit_count": 2,
            "partial_exit_qty": 1.0,
            "partial_exit_pnl_dollars": 40.0,
            "remaining_qty": 0.0,
            "exit_legs_json": '[{"qty": 1, "price": 104.0}, {"qty": 1, "price": 108.0}]',
        }
    )

    trade_log = backend.get_trade_log(limit=10, symbol="MNQ")
    backend.close()

    row = trade_log.iloc[0]
    assert row["partial_exit_count"] == 2
    assert row["partial_exit_qty"] == 1.0
    assert row["partial_exit_pnl_dollars"] == 40.0
    assert row["remaining_qty"] == 0.0
    assert row["exit_legs_json"].startswith("[")
