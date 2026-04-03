"""
Retrain Pipeline — orchestrates the closed-loop retraining workflow.

Trigger conditions:
  1. DriftMonitor.check_all() returns should_retrain = True
  2. Manual trigger via API endpoint
  3. Scheduled (weekly Airflow DAG)

Workflow:
  1. Process closed trades → update concept drift detector
  2. Run DriftMonitor.check_all() → get full drift assessment
  3. If should_retrain:
     a. Run Trainer.train_direction_models(mode="incremental")
     b. Update drift baselines (auto via Trainer)
  4. Return retrain report with before/after metrics
"""

import time
import traceback
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RetrainConfig:
    """Configuration for the retrain pipeline."""

    # Auto-retrain triggers
    auto_retrain_on_drift: bool = True       # Retrain automatically when drift detected
    auto_retrain_on_weekly_schedule: bool = True  # Weekly scheduled retrain
    min_trades_before_retrain: int = 20     # Minimum new trades before retraining

    # Model selection
    retrain_direction_models: bool = True   # Retrain direction ensemble
    training_mode: str = "incremental"       # "full" or "incremental"

    # Safety
    require_drift_confirmation: bool = True  # Require drift to be confirmed before auto-retrain
    max_retrains_per_day: int = 2           # Prevent runaway retraining loops

    # Thresholds for auto-retrain decision
    min_win_rate_drop_pct: float = 0.05     # >5% win rate drop → retrain
    min_psi_alert: float = 0.2              # PSI > 0.2 → retrain

    # Symbol
    symbol: str = "MNQ"


@dataclass
class RetrainReport:
    """Result of a retrain pipeline run."""

    triggered: bool
    reason: str
    drift_status: dict
    training_result: Optional[dict] = None
    error: Optional[str] = None
    duration_sec: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RetrainPipeline:
    """
    Orchestrates the closed-loop model retraining pipeline.

    Use cases:
      - Auto-retrain on drift detection (triggered by drift monitor)
      - Scheduled weekly retrain (triggered by Airflow DAG)
      - Manual retrain (triggered by API endpoint)

    Safety guards:
      - Max 2 retrains per day to prevent runaway loops
      - Min 20 new trades before retraining (avoid overfitting)
      - Drift must be confirmed (not just warning) for auto-retrain
    """

    def __init__(
        self,
        db,
        trainer,
        drift_monitor,
        trade_processor,
        config: RetrainConfig | None = None,
    ):
        self.db = db
        self.trainer = trainer
        self.drift_monitor = drift_monitor
        self.processor = trade_processor
        self.config = config or RetrainConfig()
        self._retrains_today: list[str] = []

    def _check_retrain_rate_limit(self) -> bool:
        """Return True if we're within the daily retrain limit."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        recent = [d for d in self._retrains_today if d == today]
        return len(recent) < self.config.max_retrains_per_day

    def _check_min_trades(self) -> bool:
        """Return True if enough new trades have accumulated since last train."""
        last_train = self.db.get_last_training("direction_ensemble")
        if not last_train:
            return True  # Never trained, allow retrain

        last_time = last_train.get("completed_at", "")
        if not last_time:
            return True

        with self.db.conn() as c:
            row = c.execute(
                """
                SELECT COUNT(*) FROM trade_log
                WHERE exit_time IS NOT NULL
                  AND entry_time > ?
                """,
                (last_time,),
            ).fetchone()
            count = row[0] if row else 0

        return count >= self.config.min_trades_before_retrain

    def run(
        self,
        trigger: str = "manual",  # "manual" | "drift" | "scheduled"
        features_df=None,
        trades_df=None,
        verbose: bool = True,
    ) -> RetrainReport:
        """
        Run the full retrain pipeline.

        Steps:
          1. Process closed trades (update concept drift)
          2. Check drift status
          3. Evaluate retrain conditions
          4. Execute retrain if warranted
          5. Return comprehensive report
        """
        started = time.time()

        if verbose:
            print(f"\n{'='*60}")
            print(f"RETRAIN PIPELINE — trigger: {trigger}")
            print(f"{'='*60}")

        # Step 1: Process closed trades → update concept drift
        if verbose:
            print("\n[1/4] Processing closed trades...")

        try:
            process_result = self.processor.process_all(
                drift_monitor=self.drift_monitor,
                symbol=self.config.symbol,
            )
            if verbose:
                print(f"  Processed: {process_result.get('recorded', 0)} outcomes recorded, "
                      f"{process_result.get('skipped', 0)} skipped")
        except Exception as e:
            if verbose:
                print(f"  Trade processing failed: {e} — continuing without it")
            process_result = {"status": "error", "error": str(e)}

        # Step 2: Check drift status
        if verbose:
            print("\n[2/4] Checking drift status...")

        try:
            if features_df is not None and trades_df is not None:
                drift_status = self.drift_monitor.check_all(
                    features_df=features_df,
                    trades_df=trades_df,
                )
            else:
                # Get fresh data for drift check
                trade_log = self.db.get_trade_log(limit=500, symbol=self.config.symbol)
                if len(trade_log) < 50:
                    return RetrainReport(
                        triggered=False,
                        reason="Not enough trade data for drift check",
                        drift_status={},
                        duration_sec=time.time() - started,
                    )
                start_date = trade_log["entry_time"].min()
                end_date = trade_log["entry_time"].max()
                candles = self.db.get_candles(start_date, end_date, symbol=self.config.symbol, limit=5000)
                from features.feature_pipeline import engineer_features
                feat_df = engineer_features(candles, trade_log, None, None, None)
                drift_status = self.drift_monitor.check_all(feat_df, trade_log)
        except Exception as e:
            if verbose:
                print(f"  Drift check failed: {e}")
            drift_status = {"overall_status": "error", "should_retrain": False, "error": str(e)}

        if verbose:
            print(f"  Overall drift status: {drift_status.get('overall_status', 'unknown')}")
            print(f"  Should retrain: {drift_status.get('should_retrain', False)}")

        # Step 3: Evaluate retrain conditions
        if verbose:
            print("\n[3/4] Evaluating retrain conditions...")

        should_retrain_decision = self._evaluate_retrain(
            drift_status=drift_status,
            trigger=trigger,
        )

        if verbose:
            print(f"  Decision: {should_retrain_decision}")

        if not should_retrain_decision["should_run"]:
            duration = time.time() - started
            if verbose:
                print(f"\n  → Skipped: {should_retrain_decision['reason']}")
                print(f"\n{'='*60}")
                print(f"RETRAIN PIPELINE COMPLETE (skipped) — {duration:.1f}s")
                print(f"{'='*60}")
            return RetrainReport(
                triggered=False,
                reason=should_retrain_decision["reason"],
                drift_status=drift_status,
                duration_sec=duration,
            )

        # Step 4: Execute retrain
        if verbose:
            print(f"\n[4/4] Executing retrain...")
            print(f"  Mode: {self.config.training_mode}")
            print(f"  Symbol: {self.config.symbol}")

        training_result = None
        error = None

        try:
            training_result = self.trainer.train_direction_models(
                mode=self.config.training_mode,
                symbol=self.config.symbol,
                verbose=verbose,
            )
            # Record this retrain
            self._retrains_today.append(datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        except Exception as e:
            error = f"{type(e).__name__}: {e}"
            if verbose:
                print(f"  ✗ Retrain failed: {error}")
                traceback.print_exc()

        duration = time.time() - started
        if verbose:
            status = "SUCCESS" if training_result else "FAILED"
            print(f"\n{'='*60}")
            print(f"RETRAIN PIPELINE COMPLETE ({status}) — {duration:.1f}s")
            print(f"{'='*60}")

        return RetrainReport(
            triggered=True,
            reason=should_retrain_decision["reason"],
            drift_status=drift_status,
            training_result=training_result,
            error=error,
            duration_sec=duration,
        )

    def _evaluate_retrain(
        self,
        drift_status: dict,
        trigger: str,
    ) -> dict:
        """
        Decide whether to run retraining based on drift status and config.

        Returns {should_run: bool, reason: str}
        """
        # Manual trigger always runs (if rate limit allows)
        if trigger == "manual":
            if not self._check_retrain_rate_limit():
                return {
                    "should_run": False,
                    "reason": f"Rate limit: max {self.config.max_retrains_per_day} retrains/day",
                }
            if not self._check_min_trades():
                return {
                    "should_run": False,
                    "reason": f"Not enough new trades since last training "
                              f"(need {self.config.min_trades_before_retrain})",
                }
            return {"should_run": True, "reason": "Manual trigger"}

        # Scheduled trigger: always run if rate limit allows
        if trigger == "scheduled":
            if not self._check_retrain_rate_limit():
                return {
                    "should_run": False,
                    "reason": f"Weekly scheduled retrain skipped: rate limit reached "
                              f"({self.config.max_retrains_per_day}/day)",
                }
            if not self._check_min_trades():
                return {
                    "should_run": False,
                    "reason": f"Not enough new trades since last training "
                              f"(have {self._retrains_today.count(datetime.now(timezone.utc).strftime('%Y-%m-%d'))} today, "
                              f"need {self.config.min_trades_before_retrain} minimum)",
                }
            return {"should_run": True, "reason": "Weekly scheduled retrain"}

        # Drift-triggered: require confirmed drift
        if trigger == "drift":
            if not self._check_retrain_rate_limit():
                return {
                    "should_run": False,
                    "reason": "Drift retrain skipped: daily rate limit reached",
                }
            if not self.config.auto_retrain_on_drift:
                return {"should_run": False, "reason": "Auto-retrain disabled in config"}

            if not drift_status.get("should_retrain", False):
                return {
                    "should_run": False,
                    "reason": f"No retrain warranted: drift status={drift_status.get('overall_status')}",
                }

            if self.config.require_drift_confirmation:
                # Require alert/critical, not just warning
                overall = drift_status.get("overall_status", "ok")
                if overall in ("warning", "ok"):
                    return {
                        "should_run": False,
                        "reason": f"Drift not confirmed: status={overall} "
                                  f"(requires alert/critical for auto-retrain)",
                    }

            if not self._check_min_trades():
                return {
                    "should_run": False,
                    "reason": f"Not enough new trades: minimum {self.config.min_trades_before_retrain} required",
                }

            reason_parts = []
            fd = drift_status.get("feature_drift", {})
            cd = drift_status.get("concept_drift", {})
            rd = drift_status.get("regime_drift", {})

            if fd.get("status") in ("alert", "critical"):
                drifted = fd.get("drifted_features", [])
                reason_parts.append(f"feature drift (PSI alert, {len(drifted)} features)")
            if cd.get("status") == "alert":
                reason_parts.append(f"concept drift (win rate drop: {cd.get('win_rate_drop_pct', 0):.1%})")
            if rd.get("status") == "alert":
                reason_parts.append(f"regime drift ({rd.get('previous_regime')}→{rd.get('current_regime')})")

            return {
                "should_run": True,
                "reason": f"Drift auto-retrain: {', '.join(reason_parts)}",
            }

        return {"should_run": False, "reason": f"Unknown trigger: {trigger}"}
