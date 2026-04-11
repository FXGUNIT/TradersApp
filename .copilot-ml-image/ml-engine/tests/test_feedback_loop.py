"""
Tests for the Closed Feedback Loop system.

Tests cover:
- FeedbackLogger: signal logging, outcome recording, stats
- TradeLogProcessor: matching trades to signals, computing outcomes
- RetrainPipeline: retrain decision logic, rate limiting, min trades check
"""

import pytest
import tempfile
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from contextlib import contextmanager

# ─── Test Fixtures ──────────────────────────────────────────────────────────────

class TestFeedbackLogger:
    """Tests using direct sqlite3 + CandleDatabase for proper context manager behavior."""

    def setup_method(self):
        fd, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        # Use CandleDatabase which has the proper conn() context manager
        from data.candle_db import CandleDatabase
        self._candle_db = CandleDatabase(self.db_path)

    def teardown_method(self):
        # Close the thread-local connection by clearing the thread local
        try:
            os.unlink(self.db_path)
        except OSError:
            pass

    def test_log_signal_returns_id(self):
        from feedback.feedback_logger import FeedbackLogger
        logger = FeedbackLogger(self._candle_db)

        signal_id = logger.log_signal(
            signal="LONG",
            confidence=0.72,
            votes={"lightgbm": {"signal": "LONG", "confidence": 0.75}},
            consensus={"signal": "LONG", "confidence": 0.72},
            regime="EXPANSION",
            regime_confidence=0.88,
            symbol="MNQ",
            session_id=1,
        )
        assert isinstance(signal_id, int)
        assert signal_id > 0

    def test_log_signal_persists(self):
        from feedback.feedback_logger import FeedbackLogger
        logger = FeedbackLogger(self._candle_db)

        logger.log_signal("SHORT", 0.68, {}, {})
        with self._candle_db.conn() as c:
            rows = c.execute("SELECT signal, confidence FROM signal_log").fetchall()
        assert len(rows) == 1
        assert rows[0][0] == "SHORT"
        assert rows[0][1] == 0.68

    def test_get_unmatched_signals(self):
        from feedback.feedback_logger import FeedbackLogger
        logger = FeedbackLogger(self._candle_db)

        for _ in range(3):
            logger.log_signal("LONG", 0.6, {}, {})

        df = logger.get_unmatched_signals(limit=10)
        assert len(df) == 3
        assert df["matched_trade_id"].isna().all()

    def test_record_outcome(self):
        from feedback.feedback_logger import FeedbackLogger
        logger = FeedbackLogger(self._candle_db)

        signal_id = logger.log_signal("LONG", 0.72, {}, {})
        now = datetime.now(timezone.utc).isoformat()
        with self._candle_db.conn() as c:
            cursor = c.execute(
                """INSERT INTO trade_log
                (entry_time, exit_time, symbol, entry_price, exit_price,
                 direction, session_id, target_rrr, pnl_ticks, pnl_dollars, result)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (now, now, "MNQ", 20000, 20100, 1, 1, 2.0, 10.0, 50.0, "win"),
            )
            trade_id = cursor.lastrowid

        logger.record_outcome(
            signal_id=signal_id,
            trade_id=trade_id,
            result="win",
            correct=True,
            pnl_ticks=10.0,
            pnl_dollars=50.0,
        )

        with self._candle_db.conn() as c:
            row = c.execute(
                "SELECT matched_trade_id, outcome_result, outcome_correct FROM signal_log WHERE id=?",
                (signal_id,),
            ).fetchone()
        assert row[0] == trade_id
        assert row[1] == "win"
        assert row[2] == 1

    def test_get_feedback_stats(self):
        from feedback.feedback_logger import FeedbackLogger
        logger = FeedbackLogger(self._candle_db)

        for _ in range(5):
            logger.log_signal("LONG", 0.6, {}, {})

        with self._candle_db.conn() as c:
            # Insert 2 trades + mark 2 signals as matched
            for i in range(2):
                now = (datetime.now(timezone.utc) - timedelta(minutes=i)).isoformat()
                cursor = c.execute(
                    """INSERT INTO trade_log
                    (entry_time, exit_time, symbol, entry_price, exit_price,
                     direction, session_id, target_rrr, result)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (now, now, "MNQ", 20000, 20100 + i * 10, 1, 1, 2.0, "win"),
                )
                trade_id = cursor.lastrowid
            # Mark 2 signals as matched
            c.execute(
                "UPDATE signal_log SET matched_trade_id=?, outcome_result=?, outcome_correct=? WHERE id IN (SELECT id FROM signal_log LIMIT 2)",
                (trade_id, "win", 1),
            )

        stats = logger.get_feedback_stats()
        assert stats["total_signals"] == 5
        assert stats["matched_outcomes"] == 2
        assert stats["correct_predictions"] == 2
        assert stats["unmatched_signals"] == 3

    def test_signal_history_ordered_by_time(self):
        from feedback.feedback_logger import FeedbackLogger
        import time
        logger = FeedbackLogger(self._candle_db)

        for sig in ["LONG", "SHORT", "NEUTRAL"]:
            logger.log_signal(sig, 0.65, {}, {})
            time.sleep(0.01)

        df = logger.get_signal_history(limit=3)
        assert list(df["signal"].head(3)) == ["NEUTRAL", "SHORT", "LONG"]

    def test_record_outcome_inserts_signal_outcome_row(self):
        from feedback.feedback_logger import FeedbackLogger
        logger = FeedbackLogger(self._candle_db)

        signal_id = logger.log_signal("SHORT", 0.65, {}, {})
        now = datetime.now(timezone.utc).isoformat()
        with self._candle_db.conn() as c:
            cursor = c.execute(
                """INSERT INTO trade_log
                (entry_time, exit_time, symbol, entry_price, exit_price,
                 direction, session_id, target_rrr, result)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (now, now, "MNQ", 20000, 19900, -1, 1, 2.0, "win"),
            )
            trade_id = cursor.lastrowid

        logger.record_outcome(signal_id, trade_id, "win", True, pnl_ticks=-5.0, pnl_dollars=-25.0)

        with self._candle_db.conn() as c:
            so_rows = c.execute(
                "SELECT signal_id, trade_id, correct, pnl_ticks FROM signal_outcome"
            ).fetchall()
        assert len(so_rows) == 1
        assert so_rows[0][0] == signal_id
        assert so_rows[0][2] == 1


# ─── TestTradeLogProcessor ──────────────────────────────────────────────────────

class TestTradeLogProcessor:
    def setup_method(self):
        fd, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        from data.candle_db import CandleDatabase
        self._candle_db = CandleDatabase(self.db_path)

    def teardown_method(self):
        try:
            os.unlink(self.db_path)
        except OSError:
            pass

    def _insert_trade(self, direction=1, pnl_ticks=10.0, result="win", minutes_ago=10):
        entry_time = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
        with self._candle_db.conn() as c:
            cursor = c.execute(
                """INSERT INTO trade_log
                (entry_time, exit_time, symbol, entry_price, exit_price,
                 direction, session_id, target_rrr, pnl_ticks, pnl_dollars, result)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry_time.isoformat(),
                    datetime.now(timezone.utc).isoformat(),
                    "MNQ", 20000, 20000 + int(pnl_ticks),
                    direction, 1, 2.0,
                    pnl_ticks, pnl_ticks * 5.0, result,
                ),
            )
            return cursor.lastrowid

    def _insert_signal(self, signal="LONG", confidence=0.72, minutes_ago=15):
        from feedback.feedback_logger import FeedbackLogger
        logger = FeedbackLogger(self._candle_db)
        return logger.log_signal(
            signal=signal, confidence=confidence, votes={}, consensus={},
        )

    def test_match_trades_to_signals_no_signals(self):
        from feedback.trade_log_processor import TradeLogProcessor
        from feedback.feedback_logger import FeedbackLogger

        logger = FeedbackLogger(self._candle_db)
        processor = TradeLogProcessor(self._candle_db, logger)
        self._insert_trade()

        trades = processor.get_unmatched_closed_trades()
        matched = processor.match_trades_to_signals(trades)
        assert len(matched) == 1
        assert matched.iloc[0]["signal_id"] is None

    def test_match_trades_to_signals_basic(self):
        from feedback.trade_log_processor import TradeLogProcessor
        from feedback.feedback_logger import FeedbackLogger

        logger = FeedbackLogger(self._candle_db)
        processor = TradeLogProcessor(self._candle_db, logger)

        # Signal 15 min ago, trade 5 min ago
        signal_id = self._insert_signal(signal="LONG", confidence=0.72, minutes_ago=15)
        sig_time = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
        with self._candle_db.conn() as c:
            c.execute("UPDATE signal_log SET signal_time=? WHERE id=?", (sig_time, signal_id))

        trade_id = self._insert_trade(direction=1, pnl_ticks=10.0, minutes_ago=5)

        trades = processor.get_unmatched_closed_trades()
        matched = processor.match_trades_to_signals(trades)

        assert len(matched) == 1
        assert matched.iloc[0]["signal_id"] == signal_id
        assert matched.iloc[0]["signal"] == "LONG"
        assert bool(matched.iloc[0]["direction_match"]) is True

    def test_compute_outcomes_win_long(self):
        from feedback.trade_log_processor import TradeLogProcessor
        import pandas as pd

        processor = TradeLogProcessor(None, None)
        df = pd.DataFrame([{
            "id": 1, "signal": "LONG", "pnl_ticks": 10.0,
            "signal_id": 10, "signal_confidence": 0.72,
        }])
        result = processor.compute_outcomes(df)
        assert bool(result.iloc[0]["correct"]) is True

    def test_compute_outcomes_loss_short(self):
        from feedback.trade_log_processor import TradeLogProcessor
        import pandas as pd

        processor = TradeLogProcessor(None, None)
        df = pd.DataFrame([{
            "id": 2, "signal": "SHORT", "pnl_ticks": 5.0,
            "signal_id": 20, "signal_confidence": 0.68,
        }])
        result = processor.compute_outcomes(df)
        assert bool(result.iloc[0]["correct"]) is False

    def test_compute_outcomes_win_short(self):
        from feedback.trade_log_processor import TradeLogProcessor
        import pandas as pd

        processor = TradeLogProcessor(None, None)
        df = pd.DataFrame([{
            "id": 3, "signal": "SHORT", "pnl_ticks": -8.0,
            "signal_id": 30, "signal_confidence": 0.70,
        }])
        result = processor.compute_outcomes(df)
        assert bool(result.iloc[0]["correct"]) is True

    def test_compute_outcomes_neutral(self):
        from feedback.trade_log_processor import TradeLogProcessor
        import pandas as pd

        processor = TradeLogProcessor(None, None)
        df = pd.DataFrame([{
            "id": 4, "signal": "NEUTRAL", "pnl_ticks": 3.0,
            "signal_id": 40, "signal_confidence": 0.52,
        }])
        result = processor.compute_outcomes(df)
        assert result.iloc[0]["correct"] is None

    def test_process_all_no_trades(self):
        from feedback.trade_log_processor import TradeLogProcessor
        from feedback.feedback_logger import FeedbackLogger

        logger = FeedbackLogger(self._candle_db)
        processor = TradeLogProcessor(self._candle_db, logger)
        result = processor.process_all()
        assert result["status"] == "no_new_trades"

    def test_get_performance_summary_no_data(self):
        from feedback.trade_log_processor import TradeLogProcessor
        from feedback.feedback_logger import FeedbackLogger

        logger = FeedbackLogger(self._candle_db)
        processor = TradeLogProcessor(self._candle_db, logger)
        summary = processor.get_performance_summary()
        assert summary["n_signals"] == 0
        assert summary["win_rate"] is None

    def test_get_unmatched_closed_trades_only_unmatched(self):
        from feedback.trade_log_processor import TradeLogProcessor
        from feedback.feedback_logger import FeedbackLogger

        logger = FeedbackLogger(self._candle_db)
        processor = TradeLogProcessor(self._candle_db, logger)
        trade_id = self._insert_trade()

        unmatched = processor.get_unmatched_closed_trades()
        assert len(unmatched) == 1

        signal_id = logger.log_signal("LONG", 0.6, {}, {})
        logger.record_outcome(signal_id, trade_id, "win", True)

        unmatched2 = processor.get_unmatched_closed_trades()
        assert len(unmatched2) == 0

    def test_record_all_outcomes_correct(self):
        from feedback.trade_log_processor import TradeLogProcessor
        from feedback.feedback_logger import FeedbackLogger
        import pandas as pd

        logger = FeedbackLogger(self._candle_db)
        processor = TradeLogProcessor(self._candle_db, logger)
        signal_id = self._insert_signal(signal="LONG", minutes_ago=20)
        trade_id = self._insert_trade(direction=1, pnl_ticks=10.0, result="win", minutes_ago=5)

        df = pd.DataFrame([{
            "id": trade_id,
            "signal_id": signal_id,
            "signal": "LONG",
            "signal_confidence": 0.72,
            "correct": True,
            "result": "win",
            "pnl_ticks": 10.0,
            "pnl_dollars": 50.0,
        }])

        result = processor.record_all_outcomes(df)
        assert result["recorded"] == 1
        assert result["skipped"] == 0


# ─── TestRetrainPipeline ────────────────────────────────────────────────────────

class TestRetrainPipeline:
    def setup_method(self):
        fd, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        from data.candle_db import CandleDatabase
        self._candle_db = CandleDatabase(self.db_path)

    def teardown_method(self):
        try:
            os.unlink(self.db_path)
        except OSError:
            pass

    def test_config_defaults(self):
        from feedback.retrain_pipeline import RetrainConfig
        cfg = RetrainConfig()
        assert cfg.auto_retrain_on_drift is True
        assert cfg.min_trades_before_retrain == 20
        assert cfg.max_retrains_per_day == 2
        assert cfg.training_mode == "incremental"

    def test_rate_limit_allows_under_limit(self):
        from feedback.retrain_pipeline import RetrainPipeline, RetrainConfig
        cfg = RetrainConfig()
        pipeline = RetrainPipeline(self._candle_db, None, None, None, config=cfg)
        assert pipeline._check_retrain_rate_limit() is True

    def test_rate_limit_blocks_at_limit(self):
        from feedback.retrain_pipeline import RetrainPipeline, RetrainConfig
        cfg = RetrainConfig(max_retrains_per_day=2)
        pipeline = RetrainPipeline(self._candle_db, None, None, None, config=cfg)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        pipeline._retrains_today = [today, today]
        assert pipeline._check_retrain_rate_limit() is False

    def test_rate_limit_different_day(self):
        from feedback.retrain_pipeline import RetrainPipeline, RetrainConfig
        cfg = RetrainConfig(max_retrains_per_day=2)
        pipeline = RetrainPipeline(self._candle_db, None, None, None, config=cfg)
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        pipeline._retrains_today = [yesterday, yesterday]
        assert pipeline._check_retrain_rate_limit() is True

    def test_evaluate_manual_trigger_runs(self):
        from feedback.retrain_pipeline import RetrainPipeline, RetrainConfig
        cfg = RetrainConfig()
        pipeline = RetrainPipeline(self._candle_db, None, None, None, config=cfg)
        result = pipeline._evaluate_retrain({}, "manual")
        assert result["should_run"] is True
        assert result["reason"] == "Manual trigger"

    def test_evaluate_scheduled_trigger_runs(self):
        from feedback.retrain_pipeline import RetrainPipeline, RetrainConfig
        cfg = RetrainConfig()
        pipeline = RetrainPipeline(self._candle_db, None, None, None, config=cfg)
        result = pipeline._evaluate_retrain({}, "scheduled")
        assert result["should_run"] is True
        assert result["reason"] == "Weekly scheduled retrain"

    def test_evaluate_drift_trigger_requires_confirmed_drift(self):
        from feedback.retrain_pipeline import RetrainPipeline, RetrainConfig
        cfg = RetrainConfig(require_drift_confirmation=True)
        pipeline = RetrainPipeline(self._candle_db, None, None, None, config=cfg)

        # Warning only → should NOT run
        drift = {"should_retrain": False, "overall_status": "warning"}
        result = pipeline._evaluate_retrain(drift, "drift")
        assert result["should_run"] is False

        # Alert → should run
        drift_alert = {
            "should_retrain": True,
            "overall_status": "alert",
            "feature_drift": {"status": "alert", "drifted_features": ["volume_ma_ratio"]},
            "concept_drift": {"status": "ok"},
            "regime_drift": {"status": "ok"},
        }
        result2 = pipeline._evaluate_retrain(drift_alert, "drift")
        assert result2["should_run"] is True

    def test_evaluate_auto_retrain_disabled(self):
        from feedback.retrain_pipeline import RetrainPipeline, RetrainConfig
        cfg = RetrainConfig(auto_retrain_on_drift=False)
        pipeline = RetrainPipeline(self._candle_db, None, None, None, config=cfg)
        drift = {"should_retrain": True, "overall_status": "alert"}
        result = pipeline._evaluate_retrain(drift, "drift")
        assert result["should_run"] is False
        assert "disabled" in result["reason"].lower()

    def test_evaluate_no_retrain_when_no_drift(self):
        from feedback.retrain_pipeline import RetrainPipeline, RetrainConfig
        cfg = RetrainConfig()
        pipeline = RetrainPipeline(self._candle_db, None, None, None, config=cfg)
        drift = {"should_retrain": False, "overall_status": "ok"}
        result = pipeline._evaluate_retrain(drift, "drift")
        assert result["should_run"] is False

    def test_evaluate_critical_drift_runs(self):
        from feedback.retrain_pipeline import RetrainPipeline, RetrainConfig
        cfg = RetrainConfig(require_drift_confirmation=True)
        pipeline = RetrainPipeline(self._candle_db, None, None, None, config=cfg)
        drift = {
            "should_retrain": True,
            "overall_status": "critical",
            "feature_drift": {"status": "critical", "drifted_features": ["atr_14", "volume_ma_ratio"]},
            "concept_drift": {"status": "alert"},
            "regime_drift": {"status": "ok"},
        }
        result = pipeline._evaluate_retrain(drift, "drift")
        assert result["should_run"] is True
        # Overall status is critical (confirmed drift)
        assert drift["overall_status"] == "critical"

    def test_check_min_trades_allows_first_time(self):
        from feedback.retrain_pipeline import RetrainPipeline, RetrainConfig
        cfg = RetrainConfig()
        pipeline = RetrainPipeline(self._candle_db, None, None, None, config=cfg)
        # No training log → should allow retrain
        assert pipeline._check_min_trades() is True
