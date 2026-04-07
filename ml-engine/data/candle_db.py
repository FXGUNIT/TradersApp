"""
Database Layer — Dual-backend: SQLite (local dev) and PostgreSQL (production/k8s).

Environment variables:
  DATABASE_URL   — PostgreSQL connection string (triggers PG mode)
                  e.g. postgresql://user:pass@localhost:5432/trading
  DB_PATH        — SQLite file path (default: trading_data.db)
                  Only used when DATABASE_URL is not set.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from abc import ABC, abstractmethod
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

import pandas as pd

SCHEMA_SQLITE = Path(__file__).parent / "schema.sql"
SCHEMA_PG = Path(__file__).parent / "schema_postgres.sql"


# ─── Backend Abstraction ──────────────────────────────────────────────────────

class DatabaseBackend(ABC):
    """Abstract database backend — same interface for SQLite and PostgreSQL."""

    @abstractmethod
    def insert_candles(self, df: pd.DataFrame) -> int:
        ...

    @abstractmethod
    def get_candles(
        self,
        start: str,
        end: str,
        symbol: str = "MNQ",
        session_id: Optional[int] = None,
        limit: int = 0,
    ) -> pd.DataFrame:
        ...

    @abstractmethod
    def get_latest_candles(self, symbol: str = "MNQ", n: int = 100) -> pd.DataFrame:
        ...

    @abstractmethod
    def get_candle_count(self, symbol: str = "MNQ") -> int:
        ...

    @abstractmethod
    def get_date_range(self, symbol: str = "MNQ") -> tuple[str, str]:
        ...

    @abstractmethod
    def upsert_session_aggregate(self, row: dict) -> None:
        ...

    @abstractmethod
    def get_session_aggregates(
        self, start_date: str, end_date: str, symbol: str = "MNQ"
    ) -> pd.DataFrame:
        ...

    @abstractmethod
    def upsert_trade(self, row: dict) -> None:
        ...

    @abstractmethod
    def get_trade_log(self, limit: int = 5000, symbol: str = "MNQ") -> pd.DataFrame:
        ...

    @abstractmethod
    def get_open_trades(self, symbol: str = "MNQ") -> pd.DataFrame:
        ...

    @abstractmethod
    def get_trade_count(self, symbol: str = "MNQ") -> int:
        ...

    @abstractmethod
    def upsert_model(self, row: dict) -> None:
        ...

    @abstractmethod
    def get_active_models(self) -> pd.DataFrame:
        ...

    @abstractmethod
    def get_model_info(self, model_name: str) -> Optional[dict]:
        ...

    @abstractmethod
    def start_training(self, model_name: str, mode: str) -> int:
        ...

    @abstractmethod
    def complete_training(
        self, id: int, rows: int, duration: float, status: str = "success"
    ) -> None:
        ...

    @abstractmethod
    def fail_training(self, id: int, error: str) -> None:
        ...

    @abstractmethod
    def get_last_training(self, model_name: str) -> Optional[dict]:
        ...

    @abstractmethod
    def upsert_signal(self, row: dict) -> int:
        ...

    @abstractmethod
    def get_signal_log(self, limit: int = 500, symbol: str = "MNQ") -> pd.DataFrame:
        ...

    @abstractmethod
    def get_feedback_stats(self, symbol: str = "MNQ") -> dict:
        ...

    @abstractmethod
    def get_stats(self) -> dict:
        ...

    @abstractmethod
    def close(self) -> None:
        ...

    @abstractmethod
    def health_check(self) -> bool:
        ...


# ─── SQLite Backend ──────────────────────────────────────────────────────────

class SQLiteBackend(DatabaseBackend):
    """
    Thread-safe SQLite WAL backend.
    Uses connection-per-thread pattern + WAL mode for concurrent reads.
    Single-writer — NOT suitable for multi-pod horizontal scaling.
    """

    def __init__(self, db_path: str = "trading_data.db"):
        self.db_path = db_path
        self._local = threading.local()
        self._init_schema()

    def _get_conn(self) -> sqlite3.Connection:
        if not hasattr(self._local, "conn") or self._local.conn is None:
            conn = sqlite3.connect(
                self.db_path, timeout=30.0, check_same_thread=False
            )
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA cache_size=-64000")
            conn.execute("PRAGMA temp_store=MEMORY")
            conn.execute("PRAGMA mmap_size=268435456")
            conn.execute("PRAGMA foreign_keys=ON")
            self._local.conn = conn
        return self._local.conn

    @contextmanager
    def conn(self):
        conn = self._get_conn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    def _init_schema(self):
        schema = SCHEMA_SQLITE.read_text()
        with self.conn() as c:
            c.executescript(schema)

    # ── Candle operations ──────────────────────────────────────────────────────

    def insert_candles(self, df: pd.DataFrame) -> int:
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
        with self.conn() as c:
            row = c.execute(
                """
                SELECT MIN(timestamp), MAX(timestamp)
                FROM candles_5min WHERE symbol = ?
                """,
                (symbol,),
            ).fetchone()
            return (row[0] or "", row[1] or "")

    # ── Session aggregates ────────────────────────────────────────────────────

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

    # ── Trade log ─────────────────────────────────────────────────────────────

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

    # ── Model registry ────────────────────────────────────────────────────────

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

    # ── Training log ───────────────────────────────────────────────────────────

    def start_training(self, model_name: str, mode: str) -> int:
        with self.conn() as c:
            cursor = c.execute(
                "INSERT INTO training_log (model_name, train_mode, status) VALUES (?, ?, 'running')",
                (model_name, mode),
            )
            return int(cursor.lastrowid)

    def complete_training(
        self, id: int, rows: int, duration: float, status: str = "success"
    ) -> None:
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

    def fail_training(self, id: int, error: str) -> None:
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

    # ── Signal log ─────────────────────────────────────────────────────────────

    def upsert_signal(self, row: dict) -> int:
        with self.conn() as c:
            c.execute(
                """
                INSERT INTO signal_log
                (signal_time, symbol, session_id, signal, confidence,
                 regime, regime_confidence, market_regime, session_phase,
                 votes_json, consensus_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                """,
                (
                    row.get("signal_time"),
                    row.get("symbol", "MNQ"),
                    row.get("session_id", 1),
                    row.get("signal"),
                    row.get("confidence"),
                    row.get("regime"),
                    row.get("regime_confidence"),
                    row.get("market_regime"),
                    row.get("session_phase"),
                    json.dumps(row.get("votes_json", {})),
                    json.dumps(row.get("consensus_json", {})),
                ),
            )
            return c.lastrowid

    def get_signal_log(self, limit: int = 500, symbol: str = "MNQ") -> pd.DataFrame:
        with self.conn() as c:
            return pd.read_sql_query(
                """
                SELECT * FROM signal_log
                WHERE symbol = ?
                ORDER BY signal_time DESC
                LIMIT ?
                """,
                c,
                params=[symbol, limit],
                parse_dates=["signal_time", "created_at"],
            )

    def get_feedback_stats(self, symbol: str = "MNQ") -> dict:
        with self.conn() as c:
            total = c.execute(
                "SELECT COUNT(*) FROM signal_log WHERE symbol = ?", (symbol,)
            ).fetchone()[0]
            matched = c.execute(
                "SELECT COUNT(*) FROM signal_log WHERE symbol = ? AND matched_trade_id IS NOT NULL",
                (symbol,),
            ).fetchone()[0]
            correct = c.execute(
                "SELECT COUNT(*) FROM signal_log WHERE symbol = ? AND outcome_correct = 1",
                (symbol,),
            ).fetchone()[0]
            win_rate = correct / matched if matched > 0 else None
            return {
                "total_signals": total,
                "matched_outcomes": matched,
                "correct_predictions": correct,
                "recorded_win_rate": round(win_rate, 4) if win_rate is not None else None,
                "unmatched_signals": total - matched,
            }

    # ── Stats ─────────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
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

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def close(self) -> None:
        if hasattr(self._local, "conn") and self._local.conn is not None:
            self._local.conn.close()
            self._local.conn = None

    def health_check(self) -> bool:
        try:
            with self.conn() as c:
                c.execute("SELECT 1").fetchone()
            return True
        except Exception:
            return False


# ─── PostgreSQL Backend ───────────────────────────────────────────────────────

PSYCOPG2_AVAILABLE = False
try:
    import psycopg2
    from psycopg2 import pool

    PSYCOPG2_AVAILABLE = True
except ImportError:
    psycopg2 = None
    pool = None


class PostgresBackend(DatabaseBackend):
    """
    PostgreSQL backend using psycopg2 connection pooling.
    Supports multiple pods — each pod maintains its own connection pool.
    All tables use BIGSERIAL, TIMESTAMPTZ, and JSONB per schema_postgres.sql.
    """

    def __init__(
        self,
        database_url: str,
        min_connections: int = 1,
        max_connections: int = 10,
    ):
        if not PSYCOPG2_AVAILABLE:
            raise RuntimeError(
                "psycopg2 is required for PostgreSQL backend. "
                "Install with: pip install psycopg2-binary"
            )
        self._pool = pool.ThreadedConnectionPool(
            min_connections,
            max_connections,
            database_url,
        )
        self._init_schema()

    @contextmanager
    def conn(self):
        pg_conn = self._pool.getconn()
        try:
            yield pg_conn
            pg_conn.commit()
        except Exception:
            pg_conn.rollback()
            raise
        finally:
            self._pool.putconn(pg_conn)

    def _init_schema(self):
        schema = SCHEMA_PG.read_text()
        with self.conn() as c:
            c.execute(schema)

    def _rows_to_df(
        self, rows: list, columns: list, parse_dates: Optional[list] = None
    ) -> pd.DataFrame:
        df = pd.DataFrame(rows, columns=columns)
        if parse_dates:
            for col in parse_dates:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col])
        return df

    def _get_cols(self, conn, table: str) -> list:
        with conn.cursor() as cur:
            cur.execute(f'SELECT * FROM {table} LIMIT 0')
            return [desc[0] for desc in cur.description]

    # ── Candle operations ─────────────────────────────────────────────────────

    def insert_candles(self, df: pd.DataFrame) -> int:
        if df.empty:
            return 0
        rows = 0
        with self.conn() as c:
            for _, row in df.iterrows():
                try:
                    with c.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO candles_5min
                            (timestamp, symbol, open, high, low, close, volume, tick_volume, session_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (timestamp, symbol) DO NOTHING
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
                        rows += cur.rowcount
                except Exception:
                    pass
        return rows

    def get_candles(
        self,
        start: str,
        end: str,
        symbol: str = "MNQ",
        session_id: Optional[int] = None,
        limit: int = 0,
    ) -> pd.DataFrame:
        sql = "SELECT * FROM candles_5min WHERE timestamp BETWEEN %s AND %s AND symbol = %s"
        params: list = [start, end, symbol]
        if session_id is not None:
            sql += " AND session_id = %s"
            params.append(session_id)
        sql += " ORDER BY timestamp ASC"
        if limit > 0:
            sql += f" LIMIT {limit}"
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                cols = [desc[0] for desc in cur.description]
                return self._rows_to_df(rows, cols, parse_dates=["timestamp"])

    def get_latest_candles(self, symbol: str = "MNQ", n: int = 100) -> pd.DataFrame:
        sql = "SELECT * FROM candles_5min WHERE symbol = %s ORDER BY timestamp DESC LIMIT %s"
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(sql, (symbol, n))
                rows = cur.fetchall()
                cols = [desc[0] for desc in cur.description]
                df = self._rows_to_df(rows, cols, parse_dates=["timestamp"])
                return df.iloc[::-1].reset_index(drop=True)

    def get_candle_count(self, symbol: str = "MNQ") -> int:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM candles_5min WHERE symbol = %s", (symbol,)
                )
                row = cur.fetchone()
                return row[0] if row else 0

    def get_date_range(self, symbol: str = "MNQ") -> tuple[str, str]:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    SELECT MIN(timestamp), MAX(timestamp)
                    FROM candles_5min WHERE symbol = %s
                    """,
                    (symbol,),
                )
                row = cur.fetchone()
                return (str(row[0]) if row[0] else "", str(row[1]) if row[1] else "")

    # ── Session aggregates ────────────────────────────────────────────────────

    def upsert_session_aggregate(self, row: dict) -> None:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO session_aggregates
                    (trade_date, symbol, session_id, session_high, session_low,
                     session_open, session_close, session_range, total_volume,
                     avg_volume, volume_ratio, avg_true_range, realized_vol,
                     close_to_open, direction, gap_pct, range_vs_atr, candle_count)
                    VALUES
                    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (trade_date, symbol, session_id) DO UPDATE SET
                        session_high = EXCLUDED.session_high,
                        session_low = EXCLUDED.session_low,
                        session_open = EXCLUDED.session_open,
                        session_close = EXCLUDED.session_close,
                        session_range = EXCLUDED.session_range,
                        total_volume = EXCLUDED.total_volume,
                        avg_volume = EXCLUDED.avg_volume,
                        volume_ratio = EXCLUDED.volume_ratio,
                        avg_true_range = EXCLUDED.avg_true_range,
                        realized_vol = EXCLUDED.realized_vol,
                        close_to_open = EXCLUDED.close_to_open,
                        direction = EXCLUDED.direction,
                        gap_pct = EXCLUDED.gap_pct,
                        range_vs_atr = EXCLUDED.range_vs_atr,
                        candle_count = EXCLUDED.candle_count
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
            with c.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM session_aggregates
                    WHERE trade_date BETWEEN %s AND %s AND symbol = %s
                    ORDER BY trade_date ASC, session_id ASC
                    """,
                    (start_date, end_date, symbol),
                )
                rows = cur.fetchall()
                cols = [desc[0] for desc in cur.description]
                return self._rows_to_df(rows, cols, parse_dates=["trade_date"])

    # ── Trade log ─────────────────────────────────────────────────────────────

    def upsert_trade(self, row: dict) -> None:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO trade_log
                    (entry_time, exit_time, symbol, entry_price, exit_price,
                     direction, session_id, pnl_ticks, pnl_dollars, result,
                     target_rrr, actual_rrr, rrr_met, amd_phase,
                     adx_entry, atr_entry, ci_entry, vwap_entry,
                     vwap_slope_entry, vr_entry, volatility_regime,
                     expected_move_ticks, actual_move_ticks, alpha_raw,
                     holding_minutes, exit_type)
                    VALUES
                    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (entry_time, symbol) DO UPDATE SET
                        exit_time = EXCLUDED.exit_time,
                        exit_price = EXCLUDED.exit_price,
                        pnl_ticks = EXCLUDED.pnl_ticks,
                        pnl_dollars = EXCLUDED.pnl_dollars,
                        result = EXCLUDED.result,
                        target_rrr = EXCLUDED.target_rrr,
                        actual_rrr = EXCLUDED.actual_rrr,
                        rrr_met = EXCLUDED.rrr_met,
                        holding_minutes = EXCLUDED.holding_minutes,
                        exit_type = EXCLUDED.exit_type
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
            with c.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM trade_log
                    WHERE exit_time IS NOT NULL AND symbol = %s
                    ORDER BY entry_time DESC LIMIT %s
                    """,
                    (symbol, limit),
                )
                rows = cur.fetchall()
                cols = [desc[0] for desc in cur.description]
                return self._rows_to_df(
                    rows, cols, parse_dates=["entry_time", "exit_time"]
                )

    def get_open_trades(self, symbol: str = "MNQ") -> pd.DataFrame:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM trade_log
                    WHERE exit_time IS NULL AND symbol = %s
                    ORDER BY entry_time DESC
                    """,
                    (symbol,),
                )
                rows = cur.fetchall()
                cols = [desc[0] for desc in cur.description]
                return self._rows_to_df(rows, cols, parse_dates=["entry_time"])

    def get_trade_count(self, symbol: str = "MNQ") -> int:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM trade_log WHERE symbol = %s AND exit_time IS NOT NULL",
                    (symbol,),
                )
                row = cur.fetchone()
                return row[0] if row else 0

    # ── Model registry ────────────────────────────────────────────────────────

    def upsert_model(self, row: dict) -> None:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO model_registry
                    (model_name, model_type, version, trained_at, data_trades,
                     data_days, accuracy, roc_auc, win_rate, expectancy,
                     profit_factor, sharpe, max_drawdown, is_active, file_path)
                    VALUES
                    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (model_name) DO UPDATE SET
                        model_type = EXCLUDED.model_type,
                        version = EXCLUDED.version,
                        trained_at = EXCLUDED.trained_at,
                        data_trades = EXCLUDED.data_trades,
                        data_days = EXCLUDED.data_days,
                        accuracy = EXCLUDED.accuracy,
                        roc_auc = EXCLUDED.roc_auc,
                        win_rate = EXCLUDED.win_rate,
                        expectancy = EXCLUDED.expectancy,
                        profit_factor = EXCLUDED.profit_factor,
                        sharpe = EXCLUDED.sharpe,
                        max_drawdown = EXCLUDED.max_drawdown,
                        is_active = EXCLUDED.is_active,
                        file_path = EXCLUDED.file_path
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
            with c.cursor() as cur:
                cur.execute(
                    "SELECT * FROM model_registry WHERE is_active = 1 ORDER BY model_name"
                )
                rows = cur.fetchall()
                cols = [desc[0] for desc in cur.description]
                return self._rows_to_df(rows, cols)

    def get_model_info(self, model_name: str) -> Optional[dict]:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    "SELECT * FROM model_registry WHERE model_name = %s", (model_name,)
                )
                row = cur.fetchone()
                if row:
                    cols = [desc[0] for desc in cur.description]
                    return dict(zip(cols, row))
                return None

    # ── Training log ──────────────────────────────────────────────────────────

    def start_training(self, model_name: str, mode: str) -> int:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO training_log (model_name, train_mode, status)
                    VALUES (%s, %s, 'running')
                    RETURNING id
                    """,
                    (model_name, mode),
                )
                return cur.fetchone()[0]

    def complete_training(
        self, id: int, rows: int, duration: float, status: str = "success"
    ) -> None:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    UPDATE training_log
                    SET completed_at = NOW(),
                        rows_used = %s, duration_sec = %s, status = %s
                    WHERE id = %s
                    """,
                    (rows, duration, status, id),
                )

    def fail_training(self, id: int, error: str) -> None:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    UPDATE training_log
                    SET completed_at = NOW(), status = 'failed', error_message = %s
                    WHERE id = %s
                    """,
                    (error, id),
                )

    def get_last_training(self, model_name: str) -> Optional[dict]:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM training_log
                    WHERE model_name = %s AND status = 'success'
                    ORDER BY completed_at DESC LIMIT 1
                    """,
                    (model_name,),
                )
                row = cur.fetchone()
                if row:
                    cols = [desc[0] for desc in cur.description]
                    return dict(zip(cols, row))
                return None

    # ── Signal log ─────────────────────────────────────────────────────────────

    def upsert_signal(self, row: dict) -> int:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO signal_log
                    (signal_time, symbol, session_id, signal, confidence,
                     regime, regime_confidence, market_regime, session_phase,
                     votes_json, consensus_json)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        row.get("signal_time"),
                        row.get("symbol", "MNQ"),
                        row.get("session_id", 1),
                        row.get("signal"),
                        row.get("confidence"),
                        row.get("regime"),
                        row.get("regime_confidence"),
                        row.get("market_regime"),
                        row.get("session_phase"),
                        json.dumps(row.get("votes_json", {})),
                        json.dumps(row.get("consensus_json", {})),
                    ),
                )
                return cur.fetchone()[0]

    def get_signal_log(self, limit: int = 500, symbol: str = "MNQ") -> pd.DataFrame:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM signal_log
                    WHERE symbol = %s
                    ORDER BY signal_time DESC
                    LIMIT %s
                    """,
                    (symbol, limit),
                )
                rows = cur.fetchall()
                cols = [desc[0] for desc in cur.description]
                return self._rows_to_df(rows, cols, parse_dates=["signal_time", "created_at"])

    def get_feedback_stats(self, symbol: str = "MNQ") -> dict:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM signal_log WHERE symbol = %s", (symbol,)
                )
                total = cur.fetchone()[0]
                cur.execute(
                    "SELECT COUNT(*) FROM signal_log WHERE symbol = %s AND matched_trade_id IS NOT NULL",
                    (symbol,),
                )
                matched = cur.fetchone()[0]
                cur.execute(
                    "SELECT COUNT(*) FROM signal_log WHERE symbol = %s AND outcome_correct = 1",
                    (symbol,),
                )
                correct = cur.fetchone()[0]
                win_rate = correct / matched if matched > 0 else None
                return {
                    "total_signals": total,
                    "matched_outcomes": matched,
                    "correct_predictions": correct,
                    "recorded_win_rate": round(win_rate, 4) if win_rate is not None else None,
                    "unmatched_signals": total - matched,
                }

    # ── Stats ─────────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        with self.conn() as c:
            with c.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM candles_5min WHERE symbol = 'MNQ'"
                )
                candles = cur.fetchone()[0]
                cur.execute(
                    "SELECT COUNT(*) FROM trade_log WHERE symbol = 'MNQ' AND exit_time IS NOT NULL"
                )
                trades = cur.fetchone()[0]
                cur.execute(
                    "SELECT COUNT(*) FROM model_registry WHERE is_active = 1"
                )
                models = cur.fetchone()[0]
                cur.execute(
                    """
                    SELECT completed_at FROM training_log
                    WHERE status = 'success' ORDER BY completed_at DESC LIMIT 1
                    """
                )
                last_train = cur.fetchone()
                cur.execute(
                    "SELECT COUNT(DISTINCT trade_date) FROM session_aggregates WHERE symbol = 'MNQ'"
                )
                sessions = cur.fetchone()[0]
                return {
                    "candles": candles,
                    "trades": trades,
                    "models": models,
                    "sessions": sessions,
                    "last_training": str(last_train[0]) if last_train else None,
                }

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def close(self) -> None:
        self._pool.closeall()

    def health_check(self) -> bool:
        try:
            with self.conn() as c:
                with c.cursor() as cur:
                    cur.execute("SELECT 1")
            return True
        except Exception:
            return False


# ─── CandleDatabase Facade ───────────────────────────────────────────────────

class CandleDatabase:
    """
    Unified database facade — auto-selects SQLite or PostgreSQL based on
    DATABASE_URL environment variable.

    Usage:
        # Local dev (SQLite)
        db = CandleDatabase()

        # Production / k8s (PostgreSQL)
        export DATABASE_URL=postgresql://user:pass@postgres:5432/trading
        db = CandleDatabase()
    """

    def __init__(
        self,
        db_path: Optional[str] = None,
        database_url: Optional[str] = None,
    ):
        # DATABASE_URL env var always wins (production override)
        env_url = os.getenv("DATABASE_URL")
        self.database_url = env_url or database_url
        self.db_path = db_path or os.getenv("DB_PATH", "trading_data.db")
        if env_url:
            self._backend: DatabaseBackend = PostgresBackend(env_url)
            self._backend_type = "postgresql"
        elif database_url:
            self._backend = PostgresBackend(database_url)
            self._backend_type = "postgresql"
        else:
            self._backend = SQLiteBackend(self.db_path)
            self._backend_type = "sqlite"

    @property
    def backend_type(self) -> str:
        return self._backend_type

    # ── Proxy all public methods to the active backend ─────────────────────────

    def insert_candles(self, df: pd.DataFrame) -> int:
        return self._backend.insert_candles(df)

    def get_candles(
        self,
        start: str,
        end: str,
        symbol: str = "MNQ",
        session_id: Optional[int] = None,
        limit: int = 0,
    ) -> pd.DataFrame:
        return self._backend.get_candles(start, end, symbol, session_id, limit)

    def get_latest_candles(self, symbol: str = "MNQ", n: int = 100) -> pd.DataFrame:
        return self._backend.get_latest_candles(symbol, n)

    def get_candle_count(self, symbol: str = "MNQ") -> int:
        return self._backend.get_candle_count(symbol)

    def get_date_range(self, symbol: str = "MNQ") -> tuple[str, str]:
        return self._backend.get_date_range(symbol)

    def upsert_session_aggregate(self, row: dict) -> None:
        self._backend.upsert_session_aggregate(row)

    def get_session_aggregates(
        self, start_date: str, end_date: str, symbol: str = "MNQ"
    ) -> pd.DataFrame:
        return self._backend.get_session_aggregates(start_date, end_date, symbol)

    def upsert_trade(self, row: dict) -> None:
        self._backend.upsert_trade(row)

    def get_trade_log(self, limit: int = 5000, symbol: str = "MNQ") -> pd.DataFrame:
        return self._backend.get_trade_log(limit, symbol)

    def get_open_trades(self, symbol: str = "MNQ") -> pd.DataFrame:
        return self._backend.get_open_trades(symbol)

    def get_trade_count(self, symbol: str = "MNQ") -> int:
        return self._backend.get_trade_count(symbol)

    def upsert_model(self, row: dict) -> None:
        self._backend.upsert_model(row)

    def get_active_models(self) -> pd.DataFrame:
        return self._backend.get_active_models()

    def get_model_info(self, model_name: str) -> Optional[dict]:
        return self._backend.get_model_info(model_name)

    def start_training(self, model_name: str, mode: str) -> int:
        return self._backend.start_training(model_name, mode)

    def complete_training(
        self, id: int, rows: int, duration: float, status: str = "success"
    ) -> None:
        self._backend.complete_training(id, rows, duration, status)

    def fail_training(self, id: int, error: str) -> None:
        self._backend.fail_training(id, error)

    def get_last_training(self, model_name: str) -> Optional[dict]:
        return self._backend.get_last_training(model_name)

    def upsert_signal(self, row: dict) -> int:
        return self._backend.upsert_signal(row)

    def get_signal_log(self, limit: int = 500, symbol: str = "MNQ") -> pd.DataFrame:
        return self._backend.get_signal_log(limit, symbol)

    def get_feedback_stats(self, symbol: str = "MNQ") -> dict:
        return self._backend.get_feedback_stats(symbol)

    def get_stats(self) -> dict:
        return self._backend.get_stats()

    def close(self) -> None:
        self._backend.close()

    def health_check(self) -> bool:
        return self._backend.health_check()

    # ── Internal (for tests) ─────────────────────────────────────────────────

    def _get_conn(self):
        """Expose backend connection (used by tests). SQLite only."""
        return self._backend._get_conn()

    def _get_backend(self) -> DatabaseBackend:
        """Expose backend for test introspection."""
        return self._backend

    @contextmanager
    def conn(self):
        """Context manager proxy — delegates to backend. SQLite only."""
        ctx = self._backend.conn()
        try:
            yield ctx.__enter__()
        finally:
            ctx.__exit__(None, None, None)
