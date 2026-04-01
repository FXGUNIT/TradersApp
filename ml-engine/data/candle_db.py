"""
SQLite WAL Database Layer — Thread-safe, ACID-compliant, memory-optimized.
Handles candles_5min, session_aggregates, trade_log, model_registry, feature_importance, training_log.
"""
import sqlite3
import threading
import os
from pathlib import Path
from typing import Optional
from contextlib import contextmanager

import pandas as pd

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def _load_schema() -> str:
    return SCHEMA_PATH.read_text()


class CandleDatabase:
    """
    Thread-safe SQLite WAL database.
    Uses connection-per-thread pattern + WAL mode for concurrent reads.
    """

    def __init__(self, db_path: str = "trading_data.db"):
        self.db_path = db_path
        self._local = threading.local()
        self._init_schema()

    def _get_conn(self) -> sqlite3.Connection:
        """Get thread-local connection with optimized pragmas."""
        if not hasattr(self._local, "conn") or self._local.conn is None:
            conn = sqlite3.connect(
                self.db_path, timeout=30.0, check_same_thread=False
            )
            # WAL mode: concurrent reads, no writer blocking readers
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA cache_size=-64000")  # 64MB cache
            conn.execute("PRAGMA temp_store=MEMORY")
            conn.execute("PRAGMA mmap_size=268435456")  # 256MB memory-mapped I/O
            conn.execute("PRAGMA foreign_keys=ON")
            self._local.conn = conn
        return self._local.conn

    @contextmanager
    def conn(self):
        """Context manager for thread-safe transactions."""
        conn = self._get_conn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    def _init_schema(self):
        """Initialize schema from schema.sql file."""
        schema = _load_schema()
        with self.conn() as c:
            c.executescript(schema)

    # -------------------------------------------------------------------------
    # Candle operations
    # -------------------------------------------------------------------------

    def insert_candles(self, df: pd.DataFrame) -> int:
        """Bulk insert candles. Skips duplicates on (timestamp, symbol). Returns rows inserted."""
        if df.empty:
            return 0
        rows = 0
        with self.conn() as c:
            for _, row in df.iterrows():
                c.execute(
                    """
                    INSERT OR IGNORE INTO candles_5min
                    (timestamp, symbol, open, high, low, close, volume, tick_volume, session_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(row["timestamp"]),
                        row.get("symbol", "MNQ"),
                        float(row["open"]),
                        float(row["high"]),
                        float(row["low"]),
                        float(row["close"]),
                        int(row["volume"]),
                        int(row.get("tick_volume", 0)),
                        int(row.get("session_id", 1)),
                    ),
                )
                rows += c.total_changes
        return rows

    def get_candles(
        self,
        start: str,
        end: str,
        symbol: str = "MNQ",
        session_id: Optional[int] = None,
        limit: int = 0,
    ) -> pd.DataFrame:
        """Get candles in [start, end] range for symbol."""
        sql = "SELECT * FROM candles_5min WHERE timestamp BETWEEN ? AND ? AND symbol = ?"
        params: list = [start, end, symbol]
        if session_id is not None:
            sql += " AND session_id = ?"
            params.append(session_id)
        sql += " ORDER BY timestamp ASC"
        if limit > 0:
            sql += f" LIMIT {limit}"
        with self.conn() as c:
            return pd.read_sql_query(sql, c, params=params, parse_dates=["timestamp"])

    def get_latest_candles(self, symbol: str = "MNQ", n: int = 100) -> pd.DataFrame:
        """Get the N most recent candles."""
        with self.conn() as c:
            return pd.read_sql_query(
                "SELECT * FROM candles_5min WHERE symbol = ? ORDER BY timestamp DESC LIMIT ?",
                c,
                params=[symbol, n],
                parse_dates=["timestamp"],
            ).iloc[::-1]

    def get_candle_count(self, symbol: str = "MNQ") -> int:
        with self.conn() as c:
            row = c.execute(
                "SELECT COUNT(*) FROM candles_5min WHERE symbol = ?", (symbol,)
            ).fetchone()
            return row[0] if row else 0

    def get_date_range(self, symbol: str = "MNQ") -> tuple[str, str]:
        """Return (earliest_timestamp, latest_timestamp) for symbol."""
        with self.conn() as c:
            row = c.execute(
                """
                SELECT MIN(timestamp), MAX(timestamp)
                FROM candles_5min WHERE symbol = ?
                """,
                (symbol,),
            ).fetchone()
            return (row[0] or "", row[1] or "")

    # -------------------------------------------------------------------------
    # Session aggregates
    # -------------------------------------------------------------------------

    def upsert_session_aggregate(self, row: dict) -> None:
        with self.conn() as c:
            c.execute(
                """
                INSERT OR REPLACE INTO session_aggregates
                (trade_date, symbol, session_id, session_high, session_low,
                 session_open, session_close, session_range, total_volume,
                 avg_volume, volume_ratio, avg_true_range, realized_vol,
                 close_to_open, direction, gap_pct, range_vs_atr, candle_count)
                VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["trade_date"],
                    row.get("symbol", "MNQ"),
                    row["session_id"],
                    row["session_high"],
                    row["session_low"],
                    row["session_open"],
                    row["session_close"],
                    row["session_range"],
                    row["total_volume"],
                    row["avg_volume"],
                    row["volume_ratio"],
                    row["avg_true_range"],
                    row["realized_vol"],
                    row["close_to_open"],
                    row["direction"],
                    row["gap_pct"],
                    row["range_vs_atr"],
                    row["candle_count"],
                ),
            )

    def get_session_aggregates(
        self, start_date: str, end_date: str, symbol: str = "MNQ"
    ) -> pd.DataFrame:
        with self.conn() as c:
            return pd.read_sql_query(
                """
                SELECT * FROM session_aggregates
                WHERE trade_date BETWEEN ? AND ? AND symbol = ?
                ORDER BY trade_date ASC, session_id ASC
                """,
                c,
                params=[start_date, end_date, symbol],
                parse_dates=["trade_date"],
            )

    # -------------------------------------------------------------------------
    # Trade log
    # -------------------------------------------------------------------------

    def upsert_trade(self, row: dict) -> None:
        with self.conn() as c:
            c.execute(
                """
                INSERT OR REPLACE INTO trade_log
                (entry_time, exit_time, symbol, entry_price, exit_price,
                 direction, session_id, pnl_ticks, pnl_dollars, result,
                 target_rrr, actual_rrr, rrr_met, amd_phase,
                 adx_entry, atr_entry, ci_entry, vwap_entry,
                 vwap_slope_entry, vr_entry, volatility_regime,
                 expected_move_ticks, actual_move_ticks, alpha_raw,
                 holding_minutes, exit_type)
                VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row.get("entry_time"),
                    row.get("exit_time"),
                    row.get("symbol", "MNQ"),
                    row.get("entry_price"),
                    row.get("exit_price"),
                    row.get("direction"),
                    row.get("session_id"),
                    row.get("pnl_ticks"),
                    row.get("pnl_dollars"),
                    row.get("result"),
                    row.get("target_rrr"),
                    row.get("actual_rrr"),
                    row.get("rrr_met"),
                    row.get("amd_phase"),
                    row.get("adx_entry"),
                    row.get("atr_entry"),
                    row.get("ci_entry"),
                    row.get("vwap_entry"),
                    row.get("vwap_slope_entry"),
                    row.get("vr_entry"),
                    row.get("volatility_regime"),
                    row.get("expected_move_ticks"),
                    row.get("actual_move_ticks"),
                    row.get("alpha_raw"),
                    row.get("holding_minutes"),
                    row.get("exit_type"),
                ),
            )

    def get_trade_log(self, limit: int = 5000, symbol: str = "MNQ") -> pd.DataFrame:
        with self.conn() as c:
            return pd.read_sql_query(
                """
                SELECT * FROM trade_log
                WHERE exit_time IS NOT NULL AND symbol = ?
                ORDER BY entry_time DESC LIMIT ?
                """,
                c,
                params=[symbol, limit],
                parse_dates=["entry_time", "exit_time"],
            )

    def get_open_trades(self, symbol: str = "MNQ") -> pd.DataFrame:
        with self.conn() as c:
            return pd.read_sql_query(
                """
                SELECT * FROM trade_log
                WHERE exit_time IS NULL AND symbol = ?
                ORDER BY entry_time DESC
                """,
                c,
                params=[symbol],
                parse_dates=["entry_time"],
            )

    def get_trade_count(self, symbol: str = "MNQ") -> int:
        with self.conn() as c:
            row = c.execute(
                "SELECT COUNT(*) FROM trade_log WHERE symbol = ? AND exit_time IS NOT NULL",
                (symbol,),
            ).fetchone()
            return row[0] if row else 0

    # -------------------------------------------------------------------------
    # Model registry
    # -------------------------------------------------------------------------

    def upsert_model(self, row: dict) -> None:
        with self.conn() as c:
            c.execute(
                """
                INSERT OR REPLACE INTO model_registry
                (model_name, model_type, version, trained_at, data_trades,
                 data_days, accuracy, roc_auc, win_rate, expectancy,
                 profit_factor, sharpe, max_drawdown, is_active, file_path)
                VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["model_name"],
                    row["model_type"],
                    row["version"],
                    row.get("trained_at"),
                    row.get("data_trades", 0),
                    row.get("data_days", 0),
                    row.get("accuracy"),
                    row.get("roc_auc"),
                    row.get("win_rate"),
                    row.get("expectancy"),
                    row.get("profit_factor"),
                    row.get("sharpe"),
                    row.get("max_drawdown"),
                    row.get("is_active", 1),
                    row.get("file_path"),
                ),
            )

    def get_active_models(self) -> pd.DataFrame:
        with self.conn() as c:
            return pd.read_sql_query(
                "SELECT * FROM model_registry WHERE is_active = 1 ORDER BY model_name",
                c,
            )

    def get_model_info(self, model_name: str) -> Optional[dict]:
        with self.conn() as c:
            row = c.execute(
                "SELECT * FROM model_registry WHERE model_name = ?", (model_name,)
            ).fetchone()
            if row:
                cols = [desc[0] for desc in c.execute(
                    "SELECT * FROM model_registry LIMIT 0").description]
                return dict(zip(cols, row))
            return None

    # -------------------------------------------------------------------------
    # Training log
    # -------------------------------------------------------------------------

    def start_training(self, model_name: str, mode: str) -> int:
        with self.conn() as c:
            c.execute(
                "INSERT INTO training_log (model_name, train_mode, status) VALUES (?, ?, 'running')",
                (model_name, mode),
            )
            return c.lastrowid

    def complete_training(self, id: int, rows: int, duration: float, status: str = "success"):
        with self.conn() as c:
            c.execute(
                """
                UPDATE training_log
                SET completed_at = datetime('now'),
                    rows_used = ?, duration_sec = ?, status = ?
                WHERE id = ?
                """,
                (rows, duration, status, id),
            )

    def fail_training(self, id: int, error: str):
        with self.conn() as c:
            c.execute(
                """
                UPDATE training_log
                SET completed_at = datetime('now'), status = 'failed', error_message = ?
                WHERE id = ?
                """,
                (error, id),
            )

    def get_last_training(self, model_name: str) -> Optional[dict]:
        with self.conn() as c:
            row = c.execute(
                """
                SELECT * FROM training_log
                WHERE model_name = ? AND status = 'success'
                ORDER BY completed_at DESC LIMIT 1
                """,
                (model_name,),
            ).fetchone()
            if row:
                cols = [desc[0] for desc in c.execute(
                    "SELECT * FROM training_log LIMIT 0").description]
                return dict(zip(cols, row))
            return None

    # -------------------------------------------------------------------------
    # Stats
    # -------------------------------------------------------------------------

    def get_stats(self) -> dict:
        """Return high-level stats for health check."""
        with self.conn() as c:
            candles = c.execute(
                "SELECT COUNT(*) FROM candles_5min WHERE symbol = 'MNQ'"
            ).fetchone()[0]
            trades = c.execute(
                "SELECT COUNT(*) FROM trade_log WHERE symbol = 'MNQ' AND exit_time IS NOT NULL"
            ).fetchone()[0]
            models = c.execute(
                "SELECT COUNT(*) FROM model_registry WHERE is_active = 1"
            ).fetchone()[0]
            last_train = c.execute(
                """
                SELECT completed_at FROM training_log
                WHERE status = 'success' ORDER BY completed_at DESC LIMIT 1
                """
            ).fetchone()
            sessions = c.execute(
                "SELECT COUNT(DISTINCT trade_date) FROM session_aggregates WHERE symbol = 'MNQ'"
            ).fetchone()[0]
            return {
                "candles": candles,
                "trades": trades,
                "models": models,
                "sessions": sessions,
                "last_training": last_train[0] if last_train else None,
            }
