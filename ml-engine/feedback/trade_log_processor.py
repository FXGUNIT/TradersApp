"""
Trade Log Processor — matches closed trades to consensus signals.

Workflow:
  1. get_closed_trades_since() — fetch trades closed since last run
  2. match_trades_to_signals()  — link each trade to the nearest prior signal
  3. compute_outcomes()         — determine if signal was correct (correct/incorrect)
  4. record_all_outcomes()      — write to signal_outcome + feed ConceptDriftDetector
  5. get_performance_summary()  — rolling win rate, expectancy, drift metrics
"""

import pandas as pd
from datetime import datetime, timezone


class TradeLogProcessor:
    """
    Processes closed trades and matches them to logged consensus signals.

    Matching logic:
      - For each closed trade, find the most recent signal_log entry
        with signal_time <= trade.entry_time (within 30-minute window)
      - Compare: signal direction vs trade direction + trade result
      - Record: correct (signal matched result) or incorrect

    This feeds the ConceptDriftDetector for rolling accuracy monitoring.
    """

    def __init__(self, db, feedback_logger):
        self.db = db
        self.logger = feedback_logger
        # Track last processed trade ID to only process new trades
        self._last_processed_id: int | None = None

    # ─── Step 1: Fetch closed trades ───────────────────────────────────────────

    def get_closed_trades_since(
        self,
        since_entry_time: str | None = None,
        symbol: str = "MNQ",
    ) -> pd.DataFrame:
        """
        Get trades that have closed since last run.

        If since_entry_time is None, processes all unprocessed closed trades.
        """
        with self.db.conn() as c:
            if since_entry_time:
                query = """
                    SELECT * FROM trade_log
                    WHERE symbol = ?
                      AND exit_time IS NOT NULL
                      AND entry_time > ?
                    ORDER BY entry_time ASC
                """
                params = (symbol, since_entry_time)
            else:
                query = """
                    SELECT * FROM trade_log
                    WHERE symbol = ?
                      AND exit_time IS NOT NULL
                      AND id > COALESCE(?, 0)
                    ORDER BY entry_time ASC
                """
                params = (symbol, self._last_processed_id or 0)

            return pd.read_sql_query(
                query, c, params=params,
                parse_dates=["entry_time", "exit_time"],
            )

    def get_unmatched_closed_trades(self, symbol: str = "MNQ") -> pd.DataFrame:
        """
        Get closed trades that haven't been matched to any signal yet.
        """
        with self.db.conn() as c:
            return pd.read_sql_query(
                """
                SELECT t.* FROM trade_log t
                LEFT JOIN signal_outcome so ON so.trade_id = t.id
                WHERE t.symbol = ?
                  AND t.exit_time IS NOT NULL
                  AND so.id IS NULL
                ORDER BY t.entry_time DESC
                """,
                c,
                params=[symbol],
                parse_dates=["entry_time", "exit_time"],
            )

    # ─── Step 2: Match trades to signals ────────────────────────────────────────

    def match_trades_to_signals(
        self,
        trades_df: pd.DataFrame,
        max_window_minutes: int = 30,
    ) -> pd.DataFrame:
        """
        For each closed trade, find the nearest prior consensus signal.

        Returns trades_df with added columns:
          signal_id, signal_time, signal, signal_confidence,
          correct, direction_match
        """
        if trades_df.empty:
            return trades_df

        # Get all unmatched signals within the time window
        earliest_trade = trades_df["entry_time"].min()
        # Get signals up to max_window_minutes before the earliest trade
        window_start = (earliest_trade - pd.Timedelta(minutes=max_window_minutes)).isoformat()

        signals = self.logger.get_unmatched_signals(since=window_start)
        if signals.empty:
            trades_df = trades_df.copy()
            trades_df["signal_id"] = None
            trades_df["signal_time"] = None
            trades_df["signal"] = None
            trades_df["signal_confidence"] = None
            trades_df["direction_match"] = None
            trades_df["correct"] = None
            return trades_df

        # Build lookup: for each trade, find nearest prior signal
        # Pre-sort signals by time
        signals = signals.sort_values("signal_time")
        signal_times = signals["signal_time"].values

        results = []
        for _, trade in trades_df.iterrows():
            entry = trade["entry_time"]
            # Normalize: ensure entry is tz-naive for comparison with tz-naive signal_times
            if entry.tzinfo is not None:
                entry = entry.tz_localize(None)
            direction = trade["direction"]  # 1=LONG, -1=SHORT

            # Find signals before this trade's entry time
            prior_mask = pd.to_datetime(signal_times) <= entry
            if not prior_mask.any():
                results.append({**trade.to_dict(), **{
                    "signal_id": None, "signal_time": None,
                    "signal": None, "signal_confidence": None,
                    "direction_match": None, "correct": None,
                }})
                continue

            prior_signals = signals[prior_mask]
            nearest = prior_signals.iloc[-1]  # Most recent prior signal

            sig_direction = 1 if nearest["signal"] == "LONG" else (-1 if nearest["signal"] == "SHORT" else 0)
            direction_match = sig_direction == direction
            confidence = nearest["confidence"]

            results.append({**trade.to_dict(), **{
                "signal_id": int(nearest["id"]),
                "signal_time": nearest["signal_time"],
                "signal": nearest["signal"],
                "signal_confidence": confidence,
                "direction_match": direction_match,
                "correct": None,  # Set in compute_outcomes
            }})

        return pd.DataFrame(results)

    # ─── Step 3: Compute outcomes ───────────────────────────────────────────────

    def compute_outcomes(self, matched_df: pd.DataFrame) -> pd.DataFrame:
        """
        Determine if each matched trade was a correct prediction.

        Logic:
          - direction_match = signal direction matched trade direction
          - result = trade result ("win", "loss", "be")
          - correct = direction_match AND result == "win"
            OR (no direction_match AND result == "loss") → also "correct" in sense of right directional call
          - Actually: correct = direction_match AND outcome was positive
            OR not direction_match AND outcome was negative

        Simpler: correct = predicted direction matches actual PnL direction
          - LONG with pnl_ticks > 0 → correct
          - SHORT with pnl_ticks < 0 → correct
          - NEUTRAL always → not applicable (skip)
        """
        if matched_df.empty:
            return matched_df

        df = matched_df.copy()

        # Determine correctness: signal direction vs actual PnL
        def _is_correct(row):
            sig = row.get("signal")
            if sig is None or sig == "NEUTRAL":
                return None  # Can't evaluate NEUTRAL signals
            pnl = row.get("pnl_ticks", 0)
            if pnl is None:
                return None

            if sig == "LONG":
                return pnl > 0
            elif sig == "SHORT":
                return pnl < 0
            return None

        df["correct"] = df.apply(_is_correct, axis=1)
        return df

    # ─── Step 4: Record all outcomes ─────────────────────────────────────────────

    def record_all_outcomes(
        self,
        outcomes_df: pd.DataFrame,
        drift_monitor=None,
    ) -> dict:
        """
        Write all computed outcomes to the database.
        Feed each correct/incorrect result to the ConceptDriftDetector.

        Returns summary dict.
        """
        if outcomes_df.empty:
            return {"recorded": 0, "skipped": 0, "drift_records": 0}

        recorded = 0
        skipped = 0
        drift_records = 0

        for _, row in outcomes_df.iterrows():
            trade_id = row.get("id")
            if trade_id is None:
                skipped += 1
                continue

            signal_id = row.get("signal_id")
            correct = row.get("correct")
            confidence = row.get("signal_confidence")
            pnl_ticks = row.get("pnl_ticks")
            pnl_dollars = row.get("pnl_dollars")
            result = row.get("result", "unknown")

            # If we have a signal match, record the outcome
            if signal_id is not None and correct is not None:
                try:
                    self.logger.record_outcome(
                        signal_id=signal_id,
                        trade_id=int(trade_id),
                        result=str(result) if result else "unknown",
                        correct=bool(correct),
                        pnl_ticks=float(pnl_ticks) if pnl_ticks is not None else None,
                        pnl_dollars=float(pnl_dollars) if pnl_dollars is not None else None,
                    )
                    recorded += 1
                except Exception:
                    skipped += 1
                    continue

                # Feed ConceptDriftDetector
                if drift_monitor is not None and correct is not None and confidence is not None:
                    try:
                        drift_monitor.concept_drift.record_prediction(
                            correct=bool(correct),
                            confidence=float(confidence),
                        )
                        drift_records += 1
                    except Exception:
                        pass
            else:
                skipped += 1

            # Track last processed trade
            if trade_id is not None:
                self._last_processed_id = int(trade_id)

        return {
            "recorded": recorded,
            "skipped": skipped,
            "drift_records": drift_records,
            "last_processed_trade_id": self._last_processed_id,
        }

    # ─── Step 5: Performance summary ─────────────────────────────────────────────

    def get_performance_summary(
        self,
        since: str | None = None,
        symbol: str = "MNQ",
    ) -> dict:
        """
        Compute rolling performance metrics for the feedback loop.

        Returns:
          - n_signals: total signals in window
          - n_outcomes: signals with recorded outcomes
          - win_rate: correct / total matched
          - avg_confidence: mean confidence of signals
          - expectancy: avg pnl_dollars per trade
          - profit_factor: gross win / gross loss
          - drift_status: concept drift detector status
        """
        outcomes = self.logger.get_outcomes(since=since)

        if outcomes.empty:
            return {
                "n_signals": 0,
                "n_outcomes": 0,
                "win_rate": None,
                "avg_confidence": None,
                "expectancy": None,
                "profit_factor": None,
                "drift_status": "no_data",
            }

        correct = outcomes["correct"].sum()
        total = len(outcomes)
        win_rate = correct / total if total > 0 else None

        # Avg confidence from signal_log via signal_id join
        with self.db.conn() as c:
            signal_ids = outcomes["signal_id"].tolist()
            if signal_ids:
                placeholders = ",".join("?" * len(signal_ids))
                conf_rows = c.execute(
                    f"SELECT AVG(confidence) FROM signal_log WHERE id IN ({placeholders})",
                    signal_ids,
                ).fetchone()
                avg_conf = conf_rows[0] if conf_rows and conf_rows[0] is not None else None
            else:
                avg_conf = None

        # Expectancy and profit factor from trade log
        trade_ids = outcomes["trade_id"].tolist()
        with self.db.conn() as c:
            if trade_ids:
                placeholders = ",".join("?" * len(trade_ids))
                pnl_rows = c.execute(
                    f"SELECT pnl_dollars FROM trade_log WHERE id IN ({placeholders})",
                    trade_ids,
                ).fetchall()
                pnls = [r[0] for r in pnl_rows if r[0] is not None]
            else:
                pnls = []

        if pnls:
            expectancy = sum(pnls) / len(pnls)
            wins = sum(p for p in pnls if p > 0)
            losses = abs(sum(p for p in pnls if p < 0))
            profit_factor = wins / losses if losses > 0 else None
        else:
            expectancy = None
            profit_factor = None

        return {
            "n_signals": total,
            "n_outcomes": total,
            "win_rate": round(win_rate, 4) if win_rate is not None else None,
            "avg_confidence": round(avg_conf, 4) if avg_conf is not None else None,
            "expectancy": round(expectancy, 2) if expectancy is not None else None,
            "profit_factor": round(profit_factor, 4) if profit_factor is not None else None,
            "drift_status": "ok",  # Will be overridden by drift_monitor if provided
        }

    def process_all(self, drift_monitor=None, symbol: str = "MNQ") -> dict:
        """
        Full pipeline: fetch → match → compute → record → summarize.

        Returns combined results dict.
        """
        trades = self.get_unmatched_closed_trades(symbol=symbol)
        if trades.empty:
            return {"status": "no_new_trades", "recorded": 0}

        matched = self.match_trades_to_signals(trades)
        outcomes = self.compute_outcomes(matched)
        result = self.record_all_outcomes(outcomes, drift_monitor=drift_monitor)
        summary = self.get_performance_summary(symbol=symbol)

        return {
            "status": "ok",
            **result,
            **summary,
        }
