"""
Feedback Logger — logs every consensus signal for later outcome matching.

Architecture:
  - Every /predict or /consensus call → log_signal() records the signal + context
  - Trade log processor matches closed trades to signals via timestamp
  - record_prediction() feeds concept drift detector for rolling accuracy tracking

Tables:
  signal_log       — one row per consensus signal call
  signal_outcome   — matched signal → trade outcome (correct/incorrect)
"""

from datetime import datetime, timezone
from typing import Optional
import pandas as pd


class FeedbackLogger:
    """
    Logs consensus signals for later outcome matching.

    Call log_signal() after every /predict or /consensus call.
    Call record_outcome() when a trade closes and its result is known.
    Call record_prediction() to feed the concept drift detector.
    """

    def __init__(self, db):
        self.db = db

    def log_signal(
        self,
        signal: str,
        confidence: float,
        votes: dict,
        consensus: dict,
        regime: str | None = None,
        regime_confidence: float | None = None,
        symbol: str = "MNQ",
        session_id: int = 1,
        market_regime: str | None = None,
        session_phase: str | None = None,
    ) -> int:
        """
        Log a consensus signal for later outcome matching.

        Returns the signal_id of the inserted row.
        """
        now = datetime.now(timezone.utc).isoformat()

        # Serialize votes: {model_name: {signal, confidence, ...}}
        import json
        votes_json = json.dumps(votes)
        consensus_json = json.dumps(consensus)

        with self.db.conn() as c:
            cursor = c.execute(
                """
                INSERT INTO signal_log
                (signal_time, symbol, session_id, signal, confidence,
                 regime, regime_confidence, market_regime, session_phase,
                 votes_json, consensus_json, matched_trade_id, outcome_result,
                 outcome_correct, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)
                """,
                (
                    now,
                    symbol,
                    session_id,
                    signal,
                    confidence,
                    regime,
                    regime_confidence,
                    market_regime,
                    session_phase,
                    votes_json,
                    consensus_json,
                    now,
                ),
            )
            return cursor.lastrowid

    def get_unmatched_signals(
        self,
        since: str | None = None,
        limit: int = 1000,
    ) -> pd.DataFrame:
        """
        Get signals that haven't been matched to a trade outcome yet.
        Used by the trade processor to find signals to match.
        """
        with self.db.conn() as c:
            if since:
                return pd.read_sql_query(
                    """
                    SELECT * FROM signal_log
                    WHERE matched_trade_id IS NULL
                      AND signal_time >= ?
                    ORDER BY signal_time DESC
                    LIMIT ?
                    """,
                    c,
                    params=[since, limit],
                    parse_dates=["signal_time", "created_at"],
                )
            return pd.read_sql_query(
                """
                SELECT * FROM signal_log
                WHERE matched_trade_id IS NULL
                ORDER BY signal_time DESC
                LIMIT ?
                """,
                c,
                params=[limit],
                parse_dates=["signal_time", "created_at"],
            )

    def record_outcome(
        self,
        signal_id: int,
        trade_id: int,
        result: str,  # "win" | "loss" | "be"
        correct: bool,
        pnl_ticks: float | None = None,
        pnl_dollars: float | None = None,
        actual_move_ticks: float | None = None,
        expected_move_ticks: float | None = None,
    ) -> None:
        """
        Record the outcome of a matched trade for a previously logged signal.
        Updates the signal_log row and inserts a signal_outcome row.
        """
        now = datetime.now(timezone.utc).isoformat()

        with self.db.conn() as c:
            # Update signal_log with match info
            c.execute(
                """
                UPDATE signal_log
                SET matched_trade_id = ?,
                    outcome_result = ?,
                    outcome_correct = ?
                WHERE id = ?
                """,
                (trade_id, result, 1 if correct else 0, signal_id),
            )

            # Insert signal_outcome row
            c.execute(
                """
                INSERT INTO signal_outcome
                (signal_id, trade_id, result, correct, pnl_ticks, pnl_dollars,
                 actual_move_ticks, expected_move_ticks, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    signal_id,
                    trade_id,
                    result,
                    1 if correct else 0,
                    pnl_ticks,
                    pnl_dollars,
                    actual_move_ticks,
                    expected_move_ticks,
                    now,
                ),
            )

    def get_outcomes(
        self,
        since: str | None = None,
        limit: int = 1000,
    ) -> pd.DataFrame:
        """Get signal outcomes for drift analysis."""
        with self.db.conn() as c:
            if since:
                return pd.read_sql_query(
                    """
                    SELECT * FROM signal_outcome
                    WHERE recorded_at >= ?
                    ORDER BY recorded_at DESC
                    LIMIT ?
                    """,
                    c,
                    params=[since, limit],
                    parse_dates=["recorded_at"],
                )
            return pd.read_sql_query(
                """
                SELECT * FROM signal_outcome
                ORDER BY recorded_at DESC
                LIMIT ?
                """,
                c,
                params=[limit],
                parse_dates=["recorded_at"],
            )

    def get_signal_history(self, limit: int = 500) -> pd.DataFrame:
        """Get recent signal history (with optional outcome)."""
        with self.db.conn() as c:
            return pd.read_sql_query(
                """
                SELECT id, signal_time, symbol, session_id, signal, confidence,
                       regime, outcome_result, outcome_correct, matched_trade_id
                FROM signal_log
                ORDER BY signal_time DESC
                LIMIT ?
                """,
                c,
                params=[limit],
                parse_dates=["signal_time"],
            )

    def get_feedback_stats(self, since: str | None = None) -> dict:
        """Return summary statistics for the feedback loop."""
        with self.db.conn() as c:
            total = c.execute(
                "SELECT COUNT(*) FROM signal_log"
            ).fetchone()[0]

            matched = c.execute(
                "SELECT COUNT(*) FROM signal_log WHERE matched_trade_id IS NOT NULL"
            ).fetchone()[0]

            correct = c.execute(
                "SELECT COUNT(*) FROM signal_log WHERE outcome_correct = 1"
            ).fetchone()[0]

            if matched > 0:
                win_rate = correct / matched
            else:
                win_rate = None

            return {
                "total_signals": total,
                "matched_outcomes": matched,
                "correct_predictions": correct,
                "recorded_win_rate": win_rate,
                "unmatched_signals": total - matched,
            }
