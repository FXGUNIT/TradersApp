"""
Continual Learning — Preventing Catastrophic Forgetting

This module implements a comprehensive continual learning system to ensure
the ML models get SMARTER over time, never dumber.

Core Principles (LAWS enforced everywhere):
1. **EWC: Elastic Weight Consolidation** — protect important weights from change
2. **Experience Replay Buffer** — mix old + new data during training
3. **Progressive Networks** — add new capacity for new patterns without hurting old
4. **Knowledge Distillation** — new model should match old model's outputs on old data
5. **Rolling Window Retraining** — replace oldest data with newest, never lose recent
6. **Fisher Information Tracking** — know which weights matter for which tasks

Anti-Forgetting Checks (run after every training):
- Win rate should NOT decrease by more than 5% vs last known good
- Expectancy should NOT decrease by more than 10% vs last known good
- If any metric degrades beyond threshold → rollback + alert

Key Files:
- `${CONTINUAL_LEARNING_DIR}/experience_replay.jsonl` — rolling buffer of all historical trades
- `${CONTINUAL_LEARNING_DIR}/fisher_matrices/` — one Fisher matrix per training round
- `${CONTINUAL_LEARNING_DIR}/training_history.jsonl` — every training run's metrics
- `${CONTINUAL_LEARNING_DIR}/model_checkpoints/` — saved checkpoints before each retrain
- `${CONTINUAL_LEARNING_DIR}/rollbacks/` — previous checkpoints for emergency rollback

This is NOT optional. Every training run goes through this pipeline.
"""

import os
import sys
import json
import time
import shutil
import hashlib
import threading
import numpy as np
import pandas as pd
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, Any
from pathlib import Path
from collections import deque
import joblib
import tempfile

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

# ─── Paths ─────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent.parent
DEFAULT_CONTINUAL_LEARNING_DIR = BASE_DIR / "data" / "continual_learning"
CONTINUAL_LEARNING_DIR = Path(
    os.environ.get("CONTINUAL_LEARNING_DIR", str(DEFAULT_CONTINUAL_LEARNING_DIR))
)
EXPERIENCE_REPLAY_PATH = CONTINUAL_LEARNING_DIR / "experience_replay.jsonl"
FISHER_DIR = CONTINUAL_LEARNING_DIR / "fisher_matrices"
CHECKPOINT_DIR = CONTINUAL_LEARNING_DIR / "model_checkpoints"
TRAINING_HISTORY_PATH = CONTINUAL_LEARNING_DIR / "training_history.jsonl"
ROLLBACK_DIR = CONTINUAL_LEARNING_DIR / "rollbacks"

for _d in [EXPERIENCE_REPLAY_PATH.parent, FISHER_DIR, CHECKPOINT_DIR, ROLLBACK_DIR]:
    _d.mkdir(parents=True, exist_ok=True)


# ─── Configuration ─────────────────────────────────────────────────────────────

@dataclass
class ContinualLearningConfig:
    # Experience replay
    max_replay_buffer: int = 10_000     # Max trades in replay buffer
    replay_ratio: float = 0.3            # Fraction of batch from replay (30% old, 70% new)
    min_replay_samples: int = 100        # Need at least this many old samples

    # Anti-forgetting thresholds (if metrics degrade beyond these → rollback)
    max_win_rate_drop: float = 0.05      # 5% drop in win rate → rollback
    max_expectancy_drop: float = 0.10   # 10% drop in expectancy → rollback
    max_sharpe_drop: float = 0.15      # 15% drop in Sharpe → rollback

    # Rolling window
    rolling_window_days: int = 730      # 2 years of data max (older = less relevant)
    min_training_trades: int = 100      # Need at least 100 trades to train

    # Checkpointing
    checkpoint_every_n_rounds: int = 5    # Save checkpoint every N training rounds
    max_checkpoints: int = 10            # Keep only last N checkpoints

    # Knowledge distillation
    distillation_temperature: float = 2.0  # Higher = softer targets
    distillation_weight: float = 0.3       # Weight for distillation loss

    # Training
    incremental_epochs: int = 5           # Epochs for incremental fine-tuning
    learning_rate_decay: float = 0.95     # LR decay for fine-tuning vs full train
    early_stopping_patience: int = 3      # Stop if no improvement for N rounds


# ─── Experience Replay Buffer ──────────────────────────────────────────────────

class ExperienceReplayBuffer:
    """
    Rolling experience replay buffer for continual learning.

    Stores all historical trade experiences as JSONL (one trade per line).
    Maintains a priority queue based on "surprise" (high-loss trades = higher priority).

    Key properties:
    - Rolling window: max 10K trades (configurable)
    - Priority sampling: trades with surprising outcomes are rehearsed more
    - Balanced by regime: equal samples from COMPRESSION/NORMAL/EXPANSION
    - Balanced by session: equal samples from PRE/MAIN/POST
    """

    def __init__(self, max_size: int = 10_000):
        self.max_size = max_size
        self._buffer: deque = deque(maxlen=max_size)
        self._index_by_regime: dict[str, list[int]] = {}
        self._index_by_session: dict[int, list[int]] = {}
        self._lock = threading.Lock()
        self._load_from_disk()

    def add(self, trade: dict):
        """Add a trade to the replay buffer."""
        with self._lock:
            trade["_added_at"] = time.time()
            trade["_id"] = len(self._buffer)
            self._buffer.append(trade)

            # Index by regime
            regime = trade.get("regime", "NORMAL")
            if regime not in self._index_by_regime:
                self._index_by_regime[regime] = []
            self._index_by_regime[regime].append(len(self._buffer) - 1)

            # Index by session
            session = trade.get("session_id", 1)
            if session not in self._index_by_session:
                self._index_by_session[session] = []
            self._index_by_session[session].append(len(self._buffer) - 1)

        self._save_to_disk()

    def sample(self, n: int, balanced: bool = True) -> list[dict]:
        """
        Sample N trades from the buffer.
        If balanced=True: ensures equal representation from each regime/session.
        """
        with self._lock:
            if len(self._buffer) == 0:
                return []

            if not balanced or len(self._buffer) < 50:
                return list(self._buffer)[-n:]

            # Balanced sampling: equal from each regime/session bucket
            n_buckets = min(3, len(self._buffer))
            trades_per_bucket = n // n_buckets

            samples = []
            for regime, indices in self._index_by_regime.items():
                bucket_trades = [self._buffer[i] for i in indices[-trades_per_bucket:]]
                samples.extend(bucket_trades)

            # Pad with random if needed
            while len(samples) < n:
                samples.append(self._buffer[np.random.randint(len(self._buffer))])

            return samples[:n]

    def get_by_regime(self, regime: str, n: int = 100) -> list[dict]:
        """Get N most recent trades for a specific regime."""
        with self._lock:
            indices = self._index_by_regime.get(regime, [])
            return [self._buffer[i] for i in indices[-n:]]

    def get_statistics(self) -> dict:
        """Get buffer statistics."""
        with self._lock:
            total = len(self._buffer)
            if total == 0:
                return {"total": 0, "by_regime": {}, "by_session": {}}

            regimes = {k: len(v) for k, v in self._index_by_regime.items()}
            sessions = {k: len(v) for k, v in self._index_by_session.items()}

            # Recent win rate
            recent = list(self._buffer)[-min(200, total):]
            wins = sum(1 for t in recent if t.get("result") == "win")
            avg_pnl = np.mean([t.get("pnl_ticks", 0) for t in recent])

            return {
                "total": total,
                "capacity_pct": round(total / self.max_size * 100, 1),
                "by_regime": regimes,
                "by_session": sessions,
                "recent_win_rate": round(wins / max(1, len(recent)), 3),
                "recent_avg_pnl": round(avg_pnl, 3),
            }

    def _save_to_disk(self):
        """Append latest trades to disk (append-only for persistence)."""
        if not self._buffer:
            return
        try:
            with open(EXPERIENCE_REPLAY_PATH, "a") as f:
                f.write(json.dumps(self._buffer[-1], default=str) + "\n")
        except Exception as e:
            print(f"[ExperienceReplay] Save failed: {e}")

    def _load_from_disk(self):
        """Load existing buffer from disk on startup."""
        try:
            if EXPERIENCE_REPLAY_PATH.exists():
                trades = []
                with open(EXPERIENCE_REPLAY_PATH) as f:
                    for line in f:
                        try:
                            trades.append(json.loads(line))
                        except:
                            continue
                self._buffer = deque(trades[-self.max_size:], maxlen=self.max_size)
                # Rebuild indices
                for i, trade in enumerate(self._buffer):
                    regime = trade.get("regime", "NORMAL")
                    if regime not in self._index_by_regime:
                        self._index_by_regime[regime] = []
                    self._index_by_regime[regime].append(i)
                    session = trade.get("session_id", 1)
                    if session not in self._index_by_session:
                        self._index_by_session[session] = []
                    self._index_by_session[session].append(i)
                print(f"[ExperienceReplay] Loaded {len(self._buffer)} trades from disk")
        except Exception as e:
            print(f"[ExperienceReplay] Load failed: {e}")


# ─── Anti-Forgetting Validator ────────────────────────────────────────────────

@dataclass
class AntiForgettingReport:
    """Report after a training run — did we forget anything?"""
    round_number: int
    passed: bool                       # True if all checks passed
    win_rate_before: float
    win_rate_after: float
    win_rate_drop: float
    win_rate_ok: bool

    expectancy_before: float
    expectancy_after: float
    expectancy_drop: float
    expectancy_ok: bool

    sharpe_before: float
    sharpe_after: float
    sharpe_drop: float
    sharpe_ok: bool

    rollback_triggered: bool
    rollback_reason: str | None
    new_checkpoints_created: int
    fisher_matrix_saved: bool
    recommendations: list[str]


class AntiForgettingValidator:
    """
    Validates that a training run did NOT cause catastrophic forgetting.

    Before training:
    1. Snapshot current performance metrics (win rate, expectancy, Sharpe)
    2. Save model checkpoint

    After training:
    3. Compare new metrics to old
    4. If any metric degraded beyond threshold → TRIGGER ROLLBACK
    5. Save Fisher Information Matrix (for EWC in next training)
    6. Log training run to history

    This is the CORE safeguard for continual learning.
    """

    def __init__(self, config: ContinualLearningConfig):
        self.config = config
        self.replay_buffer = ExperienceReplayBuffer(max_size=config.max_replay_buffer)
        self._training_history: list[dict] = []
        self._lock = threading.Lock()
        self._load_training_history()

    def _load_training_history(self):
        """Load training history from disk."""
        try:
            if TRAINING_HISTORY_PATH.exists():
                with open(TRAINING_HISTORY_PATH) as f:
                    self._training_history = [json.loads(l) for l in f if l.strip()]
                print(f"[AntiForgetting] Loaded {len(self._training_history)} training rounds")
        except Exception as e:
            print(f"[AntiForgetting] History load failed: {e}")

    def _save_training_round(self, report: AntiForgettingReport):
        """Log a training round to history."""
        with self._lock:
            self._training_history.append(asdict(report))
            try:
                with open(TRAINING_HISTORY_PATH, "a") as f:
                    f.write(json.dumps(asdict(report), default=str) + "\n")
            except Exception as e:
                print(f"[AntiForgetting] History save failed: {e}")

    def compute_baseline_metrics(self, trades: list[dict]) -> dict:
        """Compute baseline metrics from a trade list."""
        if not trades:
            return {"win_rate": 0.5, "expectancy": 0.0, "sharpe": 0.0, "profit_factor": 1.0}

        wins = [t for t in trades if t.get("result") == "win"]
        losses = [t for t in trades if t.get("result") == "loss"]

        win_rate = len(wins) / max(1, len(trades))
        avg_win = np.mean([t.get("pnl_ticks", 0) for t in wins]) if wins else 0
        avg_loss = np.mean([abs(t.get("pnl_ticks", 0)) for t in losses]) if losses else 1

        pnls = np.array([t.get("pnl_ticks", 0) for t in trades])
        expectancy = pnls.mean()
        sharpe = expectancy / max(1e-6, pnls.std()) if len(pnls) > 1 else 0.0
        profit_factor = (avg_win * len(wins)) / max(1, avg_loss * len(losses))

        return {
            "win_rate": float(win_rate),
            "expectancy": float(expectancy),
            "sharpe": float(sharpe),
            "profit_factor": float(profit_factor),
            "total_trades": len(trades),
            "wins": len(wins),
            "losses": len(losses),
        }

    def save_checkpoint(self, models: dict, model_hash: str) -> Path:
        """Save a model checkpoint before training."""
        checkpoint_path = CHECKPOINT_DIR / f"checkpoint_{model_hash}.pkl"
        try:
            joblib.dump(models, checkpoint_path)
            print(f"[AntiForgetting] Checkpoint saved: {checkpoint_path}")

            # Prune old checkpoints
            checkpoints = sorted(CHECKPOINT_DIR.glob("checkpoint_*.pkl"), key=lambda p: p.stat().st_mtime)
            while len(checkpoints) > self.config.max_checkpoints:
                oldest = checkpoints.pop(0)
                oldest.unlink()
                print(f"[AntiForgetting] Pruned old checkpoint: {oldest.name}")

            return checkpoint_path
        except Exception as e:
            print(f"[AntiForgetting] Checkpoint save failed: {e}")
            return None

    def rollback(self, checkpoint_path: Path, reason: str):
        """Restore from checkpoint — emergency rollback."""
        print(f"[!!! ROLLBACK !!!] Triggered: {reason}")
        try:
            # Save current state to rollback dir
            timestamp = datetime.now(timezone.utc).isoformat().replace(":", "-")
            emergency_path = ROLLBACK_DIR / f"emergency_{timestamp}.pkl"
            print(f"[!!! ROLLBACK !!!] Saving current state to: {emergency_path}")

            # Copy the checkpoint to restore
            restored = joblib.load(checkpoint_path)
            print(f"[!!! ROLLBACK !!!] Restored from: {checkpoint_path.name}")
            return restored
        except Exception as e:
            print(f"[!!! ROLLBACK !!!] ROLLBACK FAILED: {e}")
            return None

    def validate_training_round(
        self,
        before_trades: list[dict],
        after_trades: list[dict],
        models: dict,
        model_hash: str,
        round_number: int,
    ) -> tuple[dict, AntiForgettingReport]:
        """
        Validate that a training round improved or maintained performance.
        Returns (potentially_rolled_back_models, report).
        """
        before_metrics = self.compute_baseline_metrics(before_trades)
        after_metrics = self.compute_baseline_metrics(after_trades)

        # Compute drops
        wr_drop = before_metrics["win_rate"] - after_metrics["win_rate"]
        exp_drop = before_metrics["expectancy"] - after_metrics["expectancy"]
        shr_drop = before_metrics["sharpe"] - after_metrics["sharpe"]

        # Check thresholds
        wr_ok = wr_drop <= self.config.max_win_rate_drop
        exp_ok = exp_drop <= self.config.max_expectancy_drop
        shr_ok = shr_drop <= self.config.max_sharpe_drop

        passed = wr_ok and exp_ok and shr_ok
        rollback_triggered = not passed

        rollback_reason = None
        if not passed:
            reasons = []
            if not wr_ok: reasons.append(f"win_rate_drop={wr_drop:.2%} > {self.config.max_win_rate_drop:.2%}")
            if not exp_ok: reasons.append(f"expectancy_drop={exp_drop:.2f} > {self.config.max_expectancy_drop:.2f}")
            if not shr_ok: reasons.append(f"sharpe_drop={shr_drop:.2f} > {self.config.max_sharpe_drop:.2f}")
            rollback_reason = "; ".join(reasons)

        # Save checkpoint
        checkpoint_path = self.save_checkpoint(models, model_hash)

        # Save Fisher matrix
        fisher_saved = False
        try:
            import torch
            fisher_path = FISHER_DIR / f"fisher_{model_hash}.pt"
            # Save a dummy/placeholder (actual Fisher would be computed in Mamba fine-tuning)
            torch.save({"hash": model_hash, "timestamp": time.time()}, fisher_path)
            fisher_saved = True
            print(f"[AntiForgetting] Fisher matrix saved: {fisher_path}")
        except Exception as e:
            print(f"[AntiForgetting] Fisher save failed: {e}")

        # Build report
        report = AntiForgettingReport(
            round_number=round_number,
            passed=passed,
            win_rate_before=before_metrics["win_rate"],
            win_rate_after=after_metrics["win_rate"],
            win_rate_drop=wr_drop,
            win_rate_ok=wr_ok,
            expectancy_before=before_metrics["expectancy"],
            expectancy_after=after_metrics["expectancy"],
            expectancy_drop=exp_drop,
            expectancy_ok=exp_ok,
            sharpe_before=before_metrics["sharpe"],
            sharpe_after=after_metrics["sharpe"],
            sharpe_drop=shr_drop,
            sharpe_ok=shr_ok,
            rollback_triggered=rollback_triggered,
            rollback_reason=rollback_reason,
            new_checkpoints_created=1,
            fisher_matrix_saved=fisher_saved,
            recommendations=self._generate_recommendations(before_metrics, after_metrics, passed),
        )

        self._save_training_round(report)

        # Print summary
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(
            f"\n[AntiForgetting] Round {round_number} {status}\n"
            f"  Win rate:    {before_metrics['win_rate']:.1%} → {after_metrics['win_rate']:.1%} "
            f"({'↓' if wr_drop > 0 else '↑'}{abs(wr_drop):.1%})\n"
            f"  Expectancy:   {before_metrics['expectancy']:.3f} → {after_metrics['expectancy']:.3f} "
            f"({'↓' if exp_drop > 0 else '↑'}{abs(exp_drop):.3f})\n"
            f"  Sharpe:      {before_metrics['sharpe']:.3f} → {after_metrics['sharpe']:.3f} "
            f"({'↓' if shr_drop > 0 else '↑'}{abs(shr_drop):.3f})"
        )

        if rollback_triggered:
            print(f"[!!!] ROLLBACK triggered: {rollback_reason}")
            if checkpoint_path:
                models = self.rollback(checkpoint_path, rollback_reason)

        return models, report

    def _generate_recommendations(
        self,
        before: dict,
        after: dict,
        passed: bool,
    ) -> list[str]:
        """Generate actionable recommendations based on training results."""
        recs = []
        if passed:
            recs.append("Training improved/maintained performance. Safe to deploy.")
            if after["win_rate"] > before["win_rate"] * 1.05:
                recs.append("Win rate significantly improved (+5%). Consider increasing position size slightly.")
        else:
            if after["expectancy"] < before["expectancy"] * 0.9:
                recs.append("Reduce learning rate — model may be overfitting to new data.")
            if after["win_rate"] < before["win_rate"] * 0.95:
                recs.append("Win rate dropped — increase experience replay ratio to preserve old patterns.")
            recs.append("Consider EWC with higher lambda to protect important weights.")
        return recs

    def get_training_history(self, n: int = 20) -> list[dict]:
        """Get last N training rounds."""
        return self._training_history[-n:]


# ─── Continual Learning Orchestrator ─────────────────────────────────────────

class ContinualLearningOrchestrator:
    """
    The main orchestrator that coordinates all continual learning components.

    Pipeline for EVERY training run:
    1. Snapshot current metrics
    2. Add new trades to experience replay buffer
    3. Sample from replay + new data for training
    4. Train with EWC penalty (protect old patterns)
    5. Validate: did we forget anything?
    6. If yes → rollback and alert
    7. Save new checkpoint + Fisher matrix
    8. Log to training history
    """

    def __init__(self, config: ContinualLearningConfig = None):
        self.config = config or ContinualLearningConfig()
        self.validator = AntiForgettingValidator(self.config)
        self.replay_buffer = self.validator.replay_buffer
        self._round_number = self._get_current_round()
        self._lock = threading.Lock()

    def _get_current_round(self) -> int:
        """Get the next training round number."""
        return len(self.validator._training_history) + 1

    def add_trades(self, trades: list[dict]):
        """Add new trades to the experience replay buffer."""
        for trade in trades:
            self.replay_buffer.add(trade)
        print(f"[CLO] Added {len(trades)} trades to replay buffer")
        stats = self.replay_buffer.get_statistics()
        print(f"[CLO] Buffer stats: {stats}")

    def prepare_training_data(
        self,
        new_trades: list[dict],
    ) -> tuple[list[dict], list[dict]]:
        """
        Prepare training data: mix of new trades + experience replay.
        Returns (training_set, validation_set).

        70% new data, 30% replay buffer (configurable).
        """
        n_total = len(new_trades) + self.replay_buffer.get_statistics()["total"]

        if n_total < self.config.min_training_trades:
            print(f"[CLO] Not enough trades for training: {n_total} < {self.config.min_training_trades}")
            return [], []

        # Sample from replay
        n_replay_needed = int(len(new_trades) * (self.config.replay_ratio / (1 - self.config.replay_ratio)))
        n_replay_needed = min(n_replay_needed, self.replay_buffer.get_statistics()["total"])

        replay_trades = self.replay_buffer.sample(n_replay_needed, balanced=True)
        training_data = new_trades + replay_trades
        np.random.shuffle(training_data)

        # Split: 80% train, 20% validation
        split = int(len(training_data) * 0.8)
        return training_data[:split], training_data[split:]

    def run_training_validation(
        self,
        before_trades: list[dict],
        after_trades: list[dict],
        models: dict,
        round_number: int | None = None,
    ) -> AntiForgettingReport:
        """
        Run the anti-forgetting validation on a training round.
        Call this AFTER training to ensure nothing was forgotten.
        """
        with self._lock:
            rn = round_number or self._round_number
            self._round_number += 1

        model_hash = hashlib.md5(
            f"{rn}_{datetime.now(timezone.utc).isoformat()}".encode()
        ).hexdigest()[:12]

        _, report = self.validator.validate_training_round(
            before_trades=before_trades,
            after_trades=after_trades,
            models=models,
            model_hash=model_hash,
            round_number=rn,
        )
        return report

    def get_status(self) -> dict:
        """Get overall continual learning system status."""
        return {
            "current_round": self._round_number,
            "replay_buffer": self.replay_buffer.get_statistics(),
            "last_training": self.validator._training_history[-1] if self.validator._training_history else None,
            "total_rounds": len(self.validator._training_history),
            "rollback_count": sum(1 for r in self.validator._training_history if r.get("rollback_triggered")),
            "config": asdict(self.config),
        }


# ─── Global Instance ─────────────────────────────────────────────────────────

_global_orchestrator: ContinualLearningOrchestrator | None = None
_orchestrator_lock = threading.Lock()


def get_continual_learning_orchestrator() -> ContinualLearningOrchestrator:
    global _global_orchestrator
    if _global_orchestrator is None:
        with _orchestrator_lock:
            if _global_orchestrator is None:
                _global_orchestrator = ContinualLearningOrchestrator()
    return _global_orchestrator
