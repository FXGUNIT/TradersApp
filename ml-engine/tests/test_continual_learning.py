"""
Unit tests for infrastructure.continual_learning.
Tests replay buffer, anti-forgetting validator, and rollback logic.
"""

from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
import shutil
import uuid


WORKSPACE_TMP = Path(__file__).resolve().parents[2] / ".tmp" / "continual-learning-tests"
WORKSPACE_TMP.mkdir(parents=True, exist_ok=True)


@contextmanager
def writable_tmpdir(prefix: str):
    path = WORKSPACE_TMP / f"{prefix}-{uuid.uuid4().hex}"
    path.mkdir(parents=True, exist_ok=True)
    try:
        yield path
    finally:
        shutil.rmtree(path, ignore_errors=True)


@contextmanager
def patched_continual_paths(tmpdir: Path, replay_name: str, history_name: str):
    base = tmpdir / "continual-learning"
    replay_path = base / replay_name
    history_path = base / history_name
    fisher_dir = base / "fisher_matrices"
    checkpoint_dir = base / "model_checkpoints"
    rollback_dir = base / "rollbacks"

    for directory in (base, fisher_dir, checkpoint_dir, rollback_dir):
      directory.mkdir(parents=True, exist_ok=True)

    with (
        patch("infrastructure.continual_learning.CONTINUAL_LEARNING_DIR", base),
        patch("infrastructure.continual_learning.EXPERIENCE_REPLAY_PATH", replay_path),
        patch("infrastructure.continual_learning.TRAINING_HISTORY_PATH", history_path),
        patch("infrastructure.continual_learning.FISHER_DIR", fisher_dir),
        patch("infrastructure.continual_learning.CHECKPOINT_DIR", checkpoint_dir),
        patch("infrastructure.continual_learning.ROLLBACK_DIR", rollback_dir),
    ):
        yield {
            "base": base,
            "replay_path": replay_path,
            "history_path": history_path,
            "fisher_dir": fisher_dir,
            "checkpoint_dir": checkpoint_dir,
            "rollback_dir": rollback_dir,
        }


class TestExperienceReplayBuffer:
    """Test replay buffer operations."""

    def test_add_and_sample(self):
        with writable_tmpdir("replay-buffer") as tmpdir:
            with patched_continual_paths(tmpdir, "replay.jsonl", "history.jsonl"):
                from infrastructure.continual_learning import ExperienceReplayBuffer

                buf = ExperienceReplayBuffer(max_size=100)
                buf._buffer.clear()  # reset from disk load

                for i in range(10):
                    buf.add(
                        {
                            "trade_id": i,
                            "pnl_ticks": float(i),
                            "result": "win",
                            "regime": "NORMAL",
                            "session_id": 1,
                        }
                    )

                samples = buf.sample(5)
                assert len(samples) == 5

    def test_sample_empty_buffer(self):
        with writable_tmpdir("replay-empty") as tmpdir:
            with patched_continual_paths(tmpdir, "replay2.jsonl", "history2.jsonl"):
                from infrastructure.continual_learning import ExperienceReplayBuffer

                buf = ExperienceReplayBuffer(max_size=100)
                buf._buffer.clear()
                buf._index_by_regime = {}
                buf._index_by_session = {}

                result = buf.sample(5)
                assert result == []

    def test_sample_unbalanced_when_small(self):
        with writable_tmpdir("replay-small") as tmpdir:
            with patched_continual_paths(tmpdir, "replay3.jsonl", "history3.jsonl"):
                from infrastructure.continual_learning import ExperienceReplayBuffer

                buf = ExperienceReplayBuffer(max_size=100)
                buf._buffer.clear()
                buf._index_by_regime = {}
                buf._index_by_session = {}

                for i in range(20):
                    buf.add(
                        {
                            "trade_id": i,
                            "result": "win",
                            "regime": "NORMAL",
                            "session_id": 1,
                        }
                    )

                samples = buf.sample(5)
                assert len(samples) <= 20

    def test_get_statistics(self):
        with writable_tmpdir("replay-stats") as tmpdir:
            with patched_continual_paths(tmpdir, "replay4.jsonl", "history4.jsonl"):
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
        with writable_tmpdir("replay-regime") as tmpdir:
            with patched_continual_paths(tmpdir, "replay5.jsonl", "history5.jsonl"):
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
        with writable_tmpdir("replay-capacity") as tmpdir:
            with patched_continual_paths(tmpdir, "replay6.jsonl", "history6.jsonl"):
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
        with writable_tmpdir("history-empty") as tmpdir:
            with patched_continual_paths(tmpdir, "replay.jsonl", "history.jsonl"):
                from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig

                validator = AntiForgettingValidator(ContinualLearningConfig())
                metrics = validator.compute_baseline_metrics([])
                assert metrics["win_rate"] == 0.5
                assert metrics["expectancy"] == 0.0

    def test_compute_baseline_metrics_wins_and_losses(self):
        with writable_tmpdir("history-metrics") as tmpdir:
            with patched_continual_paths(tmpdir, "replay2.jsonl", "history2.jsonl"):
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
        with writable_tmpdir("history-stable") as tmpdir:
            with patched_continual_paths(tmpdir, "replay3.jsonl", "history3.jsonl") as paths:
                from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig
                import joblib

                config = ContinualLearningConfig(max_win_rate_drop=0.05, max_expectancy_drop=0.10)
                validator = AntiForgettingValidator(config)

                before = [{"result": "win", "pnl_ticks": 5.0}] * 10
                after = [{"result": "win", "pnl_ticks": 5.0}] * 10
                ckpt = paths["checkpoint_dir"] / "stable-checkpoint.pkl"

                joblib.dump({}, ckpt)
                models, report = validator.validate_training_round(before, after, {}, ckpt.stem, 1)

                assert report.passed is True
                assert report.rollback_triggered is False

    def test_validation_fails_on_excessive_win_rate_drop(self):
        with writable_tmpdir("history-winrate") as tmpdir:
            with patched_continual_paths(tmpdir, "replay4.jsonl", "history4.jsonl") as paths:
                from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig
                import joblib

                config = ContinualLearningConfig(max_win_rate_drop=0.05)
                validator = AntiForgettingValidator(config)

                before = [{"result": "win", "pnl_ticks": 5.0}] * 8 + [{"result": "loss", "pnl_ticks": -5.0}] * 2
                after = [{"result": "win", "pnl_ticks": 5.0}] * 3 + [{"result": "loss", "pnl_ticks": -5.0}] * 7
                ckpt = paths["checkpoint_dir"] / "winrate-checkpoint.pkl"

                joblib.dump({}, ckpt)
                models, report = validator.validate_training_round(before, after, {}, ckpt.stem, 2)

                assert report.passed is False
                assert report.rollback_triggered is True
                assert "win_rate_drop" in report.rollback_reason

    def test_validation_fails_on_excessive_sharpe_drop(self):
        with writable_tmpdir("history-sharpe") as tmpdir:
            with patched_continual_paths(tmpdir, "replay5.jsonl", "history5.jsonl") as paths:
                from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig
                import joblib

                config = ContinualLearningConfig(max_sharpe_drop=0.1)
                validator = AntiForgettingValidator(config)

                before = [{"result": "win", "pnl_ticks": 10.0 + (i % 5)} for i in range(50)]
                after = [{"result": "win", "pnl_ticks": 0.01 if i % 2 == 0 else 0.5} for i in range(50)]
                ckpt = paths["checkpoint_dir"] / "sharpe-checkpoint.pkl"

                joblib.dump({}, ckpt)
                models, report = validator.validate_training_round(before, after, {}, ckpt.stem, 3)

                assert report.passed is False
                assert report.sharpe_ok is False
                assert report.rollback_triggered is True
                assert "sharpe_drop" in (report.rollback_reason or "")

    def test_training_history_loaded_from_disk(self):
        with writable_tmpdir("history-load") as tmpdir:
            with patched_continual_paths(tmpdir, "replay6.jsonl", "history6.jsonl") as paths:
                from infrastructure.continual_learning import AntiForgettingValidator, ContinualLearningConfig

                paths["history_path"].write_text('{"round_number": 1, "passed": true}\n', encoding="utf-8")

                validator = AntiForgettingValidator(ContinualLearningConfig())
                history = validator.get_training_history()
                assert len(history) == 1
                assert history[0]["round_number"] == 1


class TestContinualLearningOrchestrator:
    """Test the continual learning orchestrator."""

    def test_add_trades_updates_buffer(self):
        with writable_tmpdir("orchestrator-add") as tmpdir:
            with patched_continual_paths(tmpdir, "replay7.jsonl", "history7.jsonl"):
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
        with writable_tmpdir("orchestrator-data") as tmpdir:
            with patched_continual_paths(tmpdir, "replay8.jsonl", "history8.jsonl"):
                from infrastructure.continual_learning import ContinualLearningOrchestrator, ContinualLearningConfig

                orch = ContinualLearningOrchestrator(ContinualLearningConfig(min_training_trades=100))
                train, val = orch.prepare_training_data([{"result": "win", "regime": "NORMAL", "session_id": 1}])
                assert train == []
                assert val == []

    def test_get_status(self):
        with writable_tmpdir("orchestrator-status") as tmpdir:
            with patched_continual_paths(tmpdir, "replay9.jsonl", "history9.jsonl"):
                from infrastructure.continual_learning import ContinualLearningOrchestrator, ContinualLearningConfig

                orch = ContinualLearningOrchestrator(ContinualLearningConfig())
                status = orch.get_status()
                assert "current_round" in status
                assert "replay_buffer" in status
                assert "config" in status
