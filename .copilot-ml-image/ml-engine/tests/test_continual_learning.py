"""
Unit tests for infrastructure.continual_learning.
Tests replay buffer, anti-forgetting validator, and rollback logic.
"""

import pytest
import tempfile
import os
from pathlib import Path
from unittest.mock import patch


class TestExperienceReplayBuffer:
    """Test replay buffer operations."""

    def test_add_and_sample(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.EXPERIENCE_REPLAY_PATH", Path(tmpdir) / "replay.jsonl"):
                from infrastructure.continual_learning import ExperienceReplayBuffer
                buf = ExperienceReplayBuffer(max_size=100)
                buf._buffer.clear()  # reset from disk load

                for i in range(10):
                    buf.add({"trade_id": i, "pnl_ticks": float(i), "result": "win", "regime": "NORMAL", "session_id": 1})

                samples = buf.sample(5)
                assert len(samples) == 5

    def test_sample_empty_buffer(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.EXPERIENCE_REPLAY_PATH", Path(tmpdir) / "replay2.jsonl"):
                from infrastructure.continual_learning import ExperienceReplayBuffer
                buf = ExperienceReplayBuffer(max_size=100)
                buf._buffer.clear()
                buf._index_by_regime = {}
                buf._index_by_session = {}

                result = buf.sample(5)
                assert result == []

    def test_sample_unbalanced_when_small(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.EXPERIENCE_REPLAY_PATH", Path(tmpdir) / "replay3.jsonl"):
                from infrastructure.continual_learning import ExperienceReplayBuffer
                buf = ExperienceReplayBuffer(max_size=100)
                buf._buffer.clear()
                buf._index_by_regime = {}
                buf._index_by_session = {}

                # Add fewer than 50 trades — should return last N
                for i in range(20):
                    buf.add({"trade_id": i, "result": "win", "regime": "NORMAL", "session_id": 1})

                samples = buf.sample(5)
                assert len(samples) <= 20

    def test_get_statistics(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.EXPERIENCE_REPLAY_PATH", Path(tmpdir) / "replay4.jsonl"):
                from infrastructure.continual_learning import ExperienceReplayBuffer
                buf = ExperienceReplayBuffer(max_size=100)
                buf._buffer.clear()
                buf._index_by_regime = {}
                buf._index_by_session = {}

                stats = buf.get_statistics()
                assert stats["total"] == 0

                buf.add({"result": "win", "regime": "NORMAL", "session_id": 1, "pnl_ticks": 5.0})
                buf.add({"result": "loss", "regime": "COMPRESSION", "session_id": 1, "pnl_ticks": -3.0})
                stats = buf.get_statistics()
                assert stats["total"] == 2
                assert stats["recent_win_rate"] == 0.5

    def test_get_by_regime(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.EXPERIENCE_REPLAY_PATH", Path(tmpdir) / "replay5.jsonl"):
                from infrastructure.continual_learning import ExperienceReplayBuffer
                buf = ExperienceReplayBuffer(max_size=100)
                buf._buffer.clear()
                buf._index_by_regime = {}
                buf._index_by_session = {}

                buf.add({"result": "win", "regime": "COMPRESSION", "session_id": 1})
                buf.add({"result": "win", "regime": "COMPRESSION", "session_id": 1})
                buf.add({"result": "win", "regime": "NORMAL", "session_id": 1})

                comp = buf.get_by_regime("COMPRESSION")
                assert len(comp) == 2

    def test_buffer_capacity_enforced(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.EXPERIENCE_REPLAY_PATH", Path(tmpdir) / "replay6.jsonl"):
                from infrastructure.continual_learning import ExperienceReplayBuffer
                buf = ExperienceReplayBuffer(max_size=10)
                buf._buffer.clear()
                buf._index_by_regime = {}
                buf._index_by_session = {}

                for i in range(20):
                    buf.add({"trade_id": i, "result": "win", "regime": "NORMAL", "session_id": 1})

                assert buf.get_statistics()["total"] == 10


class TestAntiForgettingValidator:
    """Test anti-forgetting validation and rollback triggers."""

    def test_compute_baseline_metrics_empty(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.TRAINING_HISTORY_PATH", Path(tmpdir) / "history.jsonl"):
                from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig

                config = ContinualLearningConfig()
                validator = AntiForgettingValidator(config)
                metrics = validator.compute_baseline_metrics([])
                assert metrics["win_rate"] == 0.5
                assert metrics["expectancy"] == 0.0

    def test_compute_baseline_metrics_wins_and_losses(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.TRAINING_HISTORY_PATH", Path(tmpdir) / "hist2.jsonl"):
                from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig

                validator = AntiForgettingValidator(ContinualLearningConfig())
                trades = [
                    {"result": "win", "pnl_ticks": 5.0},
                    {"result": "win", "pnl_ticks": 3.0},
                    {"result": "loss", "pnl_ticks": -2.0},
                    {"result": "loss", "pnl_ticks": -1.0},
                ]
                metrics = validator.compute_baseline_metrics(trades)
                assert metrics["win_rate"] == 0.5
                assert metrics["total_trades"] == 4

    def test_validation_passes_when_metrics_stable(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.TRAINING_HISTORY_PATH", Path(tmpdir) / "hist3.jsonl"):
                from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig

                config = ContinualLearningConfig(max_win_rate_drop=0.05, max_expectancy_drop=0.10)
                validator = AntiForgettingValidator(config)

                # Before and after are identical → no drop
                before = [{"result": "win", "pnl_ticks": 5.0}] * 10
                after = [{"result": "win", "pnl_ticks": 5.0}] * 10

                with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as f:
                    ckpt = Path(f.name)
                try:
                    import joblib
                    joblib.dump({}, ckpt)

                    models, report = validator.validate_training_round(
                        before, after, {}, ckpt.stem, 1
                    )
                    assert report.passed is True
                    assert report.rollback_triggered is False
                finally:
                    ckpt.unlink(missing_ok=True)

    def test_validation_fails_on_excessive_win_rate_drop(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.TRAINING_HISTORY_PATH", Path(tmpdir) / "hist4.jsonl"):
                from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig

                config = ContinualLearningConfig(max_win_rate_drop=0.05)
                validator = AntiForgettingValidator(config)

                # 80% win rate before, 30% after → 50% drop
                before = [{"result": "win", "pnl_ticks": 5.0}] * 8 + [{"result": "loss", "pnl_ticks": -5.0}] * 2
                after = [{"result": "win", "pnl_ticks": 5.0}] * 3 + [{"result": "loss", "pnl_ticks": -5.0}] * 7

                with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as f:
                    ckpt = Path(f.name)
                try:
                    import joblib
                    joblib.dump({}, ckpt)

                    models, report = validator.validate_training_round(
                        before, after, {}, ckpt.stem, 2
                    )
                    assert report.passed is False
                    assert report.rollback_triggered is True
                    assert "win_rate_drop" in report.rollback_reason
                finally:
                    ckpt.unlink(missing_ok=True)

    def test_validation_fails_on_excessive_sharpe_drop(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.TRAINING_HISTORY_PATH", Path(tmpdir) / "hist5.jsonl"):
                from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig

                config = ContinualLearningConfig(max_sharpe_drop=0.1)
                validator = AntiForgettingValidator(config)

                # Keep win rate constant while making the post-training distribution
                # much noisier relative to its mean so the Sharpe drop is unambiguous.
                before = [{"result": "win", "pnl_ticks": 10.0 + (i % 5)} for i in range(50)]
                after = [{"result": "win", "pnl_ticks": 0.01 if i % 2 == 0 else 0.5} for i in range(50)]

                with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as f:
                    ckpt = Path(f.name)
                try:
                    import joblib
                    joblib.dump({}, ckpt)

                    models, report = validator.validate_training_round(
                        before, after, {}, ckpt.stem, 3
                    )
                    assert report.passed is False
                    assert report.sharpe_ok is False
                    assert report.rollback_triggered is True
                    assert "sharpe_drop" in (report.rollback_reason or "")
                finally:
                    ckpt.unlink(missing_ok=True)

    def test_training_history_loaded_from_disk(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            hist_path = Path(tmpdir) / "hist6.jsonl"
            with patch("infrastructure.continual_learning.TRAINING_HISTORY_PATH", hist_path):
                from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig

                # Write a dummy training round
                hist_path.write_text('{"round_number": 1, "passed": true}\n')

                validator = AntiForgettingValidator(ContinualLearningConfig())
                history = validator.get_training_history()
                assert len(history) == 1
                assert history[0]["round_number"] == 1


class TestContinualLearningOrchestrator:
    """Test the continual learning orchestrator."""

    def test_add_trades_updates_buffer(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.TRAINING_HISTORY_PATH", Path(tmpdir) / "hist7.jsonl"):
                with patch("infrastructure.continual_learning.EXPERIENCE_REPLAY_PATH", Path(tmpdir) / "replay7.jsonl"):
                    from infrastructure.continual_learning import ContinualLearningOrchestrator, ContinualLearningConfig

                    orch = ContinualLearningOrchestrator(ContinualLearningConfig())
                    orch.replay_buffer._buffer.clear()
                    orch.replay_buffer._index_by_regime = {}
                    orch.replay_buffer._index_by_session = {}

                    trades = [
                        {"result": "win", "regime": "NORMAL", "session_id": 1, "pnl_ticks": 5.0},
                        {"result": "loss", "regime": "COMPRESSION", "session_id": 1, "pnl_ticks": -3.0},
                    ]
                    orch.add_trades(trades)
                    stats = orch.replay_buffer.get_statistics()
                    assert stats["total"] == 2

    def test_prepare_training_data_insufficient_trades(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.TRAINING_HISTORY_PATH", Path(tmpdir) / "hist8.jsonl"):
                with patch("infrastructure.continual_learning.EXPERIENCE_REPLAY_PATH", Path(tmpdir) / "replay8.jsonl"):
                    from infrastructure.continual_learning import ContinualLearningOrchestrator, ContinualLearningConfig

                    orch = ContinualLearningOrchestrator(ContinualLearningConfig(min_training_trades=100))
                    train, val = orch.prepare_training_data([{"result": "win", "regime": "NORMAL", "session_id": 1}])
                    assert train == []
                    assert val == []

    def test_get_status(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("infrastructure.continual_learning.TRAINING_HISTORY_PATH", Path(tmpdir) / "hist9.jsonl"):
                with patch("infrastructure.continual_learning.EXPERIENCE_REPLAY_PATH", Path(tmpdir) / "replay9.jsonl"):
                    from infrastructure.continual_learning import ContinualLearningOrchestrator, ContinualLearningConfig

                    orch = ContinualLearningOrchestrator(ContinualLearningConfig())
                    status = orch.get_status()
                    assert "current_round" in status
                    assert "replay_buffer" in status
                    assert "config" in status
