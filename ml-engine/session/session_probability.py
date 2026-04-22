"""
Session Probability Engine.
Predicts: will PRE/MAIN/POST session close UP or DOWN?
Also predicts: probability of profitable trade at each 5-min bucket + best entry time.
"""
import numpy as np
import pandas as pd
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
from features.feature_pipeline import assign_session_ids
from training.cross_validator import TimeSeriesCrossValidator
from infrastructure.board_room_client import ensure_heartbeat_loop

from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
import lightgbm as lgb

# ── NSE India session support ──────────────────────────────────────────────
_LEGACY_US_TIMEZONES = {"America/New_York", "US/Eastern", "EST5EDT"}
try:
    from infrastructure.session_loader import SessionLoader
    _SESSION_LOADER = SessionLoader()
except Exception:
    _SESSION_LOADER = None


def _timezone_name(series: pd.Series) -> str | None:
    try:
        tz = series.dt.tz
    except (AttributeError, TypeError):
        return None
    if tz is None:
        return None
    return getattr(tz, "key", getattr(tz, "zone", str(tz)))


def _resolve_session_context(
    candles_df: pd.DataFrame | None = None,
    *,
    use_nse: bool = False,
) -> dict:
    if use_nse:
        return config.get_session_context()
    if candles_df is not None and "timestamp" in candles_df.columns:
        timestamps = candles_df["timestamp"]
        if not pd.api.types.is_datetime64_any_dtype(timestamps):
            timestamps = pd.to_datetime(timestamps)
        if _timezone_name(timestamps) in _LEGACY_US_TIMEZONES:
            return config.get_session_context(use_legacy_us=True)
    return config.get_session_context()


def _localize_to_session_timezone(timestamps: pd.Series, session_context: dict) -> pd.Series:
    if not pd.api.types.is_datetime64_any_dtype(timestamps):
        timestamps = pd.to_datetime(timestamps)
    timezone = session_context.get("default_timezone", config.DEFAULT_SESSION_TIMEZONE)
    tz_name = _timezone_name(timestamps)
    if tz_name is None:
        return timestamps.dt.tz_localize(timezone, nonexistent="shift_forward", ambiguous="infer")
    return timestamps.dt.tz_convert(timezone)


def _time_to_minutes(clock: str | None) -> int:
    if not clock:
        return 0
    hour_str, minute_str = clock.split(":")[:2]
    return int(hour_str) * 60 + int(minute_str)


class SessionProbabilityModel:
    """
    Predicts directional probability for each session type.
    Trained on historical session data from trade_log.
    """

    name = "session_probability"
    model_type = "session"

    def __init__(self):
        ensure_heartbeat_loop(
            "ML.SessionProbability",
            focus="Training and scoring session probabilities.",
        )
        self.pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", CalibratedClassifierCV(
                lgb.LGBMClassifier(**config.LGBM_SESSION),
                method="isotonic",
                cv=5,
            )),
        ])
        self._is_trained = False

    def get_session_for_instrument(self, timestamp, use_nse=False):
        """
        Return session name for a given timestamp.

        Args:
            timestamp: datetime or pandas Timestamp
            use_nse: force the canonical NSE session context

        Returns:
            "pre_market", "main_trading", "post_market", or "closed"
        """
        ts = pd.Series([timestamp])
        session_context = _resolve_session_context(
            pd.DataFrame({"timestamp": ts}),
            use_nse=use_nse,
        )
        session_clock = _localize_to_session_timezone(ts, session_context)
        local_ts = session_clock.iloc[0]

        if _SESSION_LOADER is not None and session_context["default_timezone"] == config.DEFAULT_SESSION_TIMEZONE:
            if not _SESSION_LOADER.is_trading_day(local_ts.date()):
                return "closed"

        minute_of_day = local_ts.hour * 60 + local_ts.minute
        for session_id, session_cfg in sorted(
            session_context["by_id"].items(),
            key=lambda item: _time_to_minutes(item[1].get("start")),
        ):
            start_minute = _time_to_minutes(session_cfg.get("start"))
            end_minute = _time_to_minutes(session_cfg.get("end"))
            if start_minute <= minute_of_day < end_minute:
                return config.SESSION_ID_TO_NAME.get(int(session_id), session_cfg.get("name", "main_trading"))

        return "closed"

    def _prepare_session_features(self, candles_df: pd.DataFrame) -> pd.DataFrame:
        """
        Build session-level features from candle data.
        One row per session (date + session_id).
        """
        if candles_df.empty:
            return pd.DataFrame()

        df = candles_df.copy()
        if not pd.api.types.is_datetime64_any_dtype(df["timestamp"]):
            df["timestamp"] = pd.to_datetime(df["timestamp"])

        session_context = _resolve_session_context(df)
        df = assign_session_ids(df, session_context=session_context)
        session_clock = _localize_to_session_timezone(df["timestamp"], session_context)
        df["trade_date"] = session_clock.dt.date
        df["session_day_of_week"] = session_clock.dt.dayofweek

        results = []
        for (date, sess_id), grp in df.groupby(["trade_date", "session_id"]):
            if len(grp) < 5:
                continue
            grp = grp.sort_values("timestamp")

            # Compute ATR
            tr = pd.concat([
                grp["high"] - grp["low"],
                (grp["high"] - grp["close"].shift(1).fillna(grp["close"])).abs(),
                (grp["low"] - grp["close"].shift(1).fillna(grp["close"])).abs(),
            ], axis=1).max(axis=1)
            atr = tr.rolling(14, min_periods=1).mean().iloc[-1]

            # Gap from previous session
            prev_session = df[
                (df["trade_date"] == date) &
                (df["session_id"] < sess_id)
            ]
            prev_close = prev_session["close"].iloc[-1] if len(prev_session) > 0 else grp["open"].iloc[0]

            # Direction
            direction = 1 if grp["close"].iloc[-1] > grp["open"].iloc[0] else (-1 if grp["close"].iloc[-1] < grp["open"].iloc[0] else 0)
            gap_pct = (grp["open"].iloc[0] - prev_close) / prev_close if prev_close > 0 else 0.0

            row = {
                "trade_date": str(date),
                "session_id": int(sess_id),
                "session_name": config.SESSION_ID_TO_NAME.get(int(sess_id), "main_trading"),
                "session_range_pct": (grp["high"].max() - grp["low"].min()) / grp["low"].min() if grp["low"].min() > 0 else 0,
                "gap_pct": gap_pct,
                "volume_ratio": grp["volume"].iloc[-5:].mean() / grp["volume"].mean() if grp["volume"].mean() > 0 else 1.0,
                "atr": atr,
                "atr_pct": atr / grp["close"].iloc[-1] if grp["close"].iloc[-1] > 0 else 0,
                "range_vs_atr": (grp["high"].max() - grp["low"].min()) / atr if atr > 0 else 1,
                "direction": direction,
                "label": 1 if direction > 0 else 0,
                "candle_count": len(grp),
                "day_of_week": int(grp["session_day_of_week"].iloc[0]),
                "session_open": grp["open"].iloc[0],
                "session_close": grp["close"].iloc[-1],
                "prev_day_direction": 0,  # computed from trade log
            }
            results.append(row)

        return pd.DataFrame(results)

    def train(
        self,
        candles_df: pd.DataFrame,
        trade_log_df: pd.DataFrame | None = None,
        verbose: bool = True,
    ) -> dict:
        """Train the session probability model."""
        session_df = self._prepare_session_features(candles_df)

        if len(session_df) < 50:
            raise ValueError(f"Need at least 50 sessions, got {len(session_df)}")

        feature_cols = [
            "session_range_pct", "gap_pct", "volume_ratio",
            "atr_pct", "range_vs_atr", "day_of_week",
            "session_id",
        ]
        X = session_df[feature_cols].fillna(0)
        y = session_df["label"]

        # CV
        cv = TimeSeriesCrossValidator(n_splits=3, gap=5)
        scores = []
        for train_idx, val_idx in cv.split(X):
            self.pipeline.fit(X.iloc[train_idx], y.iloc[train_idx])
            proba = self.pipeline.predict_proba(X.iloc[val_idx])[:, 1]
            scores.append(roc_auc_score(y.iloc[val_idx], proba))

        self.pipeline.fit(X, y)
        self._is_trained = True

        result = {
            "model": self.name,
            "cv_roc_auc_mean": round(np.mean(scores), 4),
            "cv_roc_auc_std": round(np.std(scores), 4),
            "sessions_used": len(session_df),
            "feature_cols": feature_cols,
        }

        if verbose:
            print(f"  Session Probability CV ROC-AUC: {np.mean(scores):.4f} ± {np.std(scores):.4f}")

        return result

    def predict_session_probabilities(self, current_session: int = 1) -> dict:
        """
        Return P(close UP) for each session type.
        Falls back to historical base rates if not trained.
        """
        base_rates = {0: 0.52, 1: 0.55, 2: 0.50}
        session_ids = sorted(config.SESSION_CONFIG.keys())

        if not self._is_trained:
            return {
                sid: {
                    "session_name": config.SESSION_ID_TO_NAME.get(sid, "main_trading"),
                    "P_up": base_rates.get(sid, 0.5),
                    "confidence": 0.0,
                    "note": "Model not trained — using base rates",
                }
                for sid in session_ids
            }

        # Predict for each session type
        results = {}
        for sid in session_ids:
            X = pd.DataFrame([{
                "session_range_pct": 0.008,
                "gap_pct": 0.0,
                "volume_ratio": 1.0,
                "atr_pct": 0.005,
                "range_vs_atr": 1.0,
                "day_of_week": 2,
                "session_id": sid,
            }])
            p_up = self.pipeline.predict_proba(X)[0, 1]
            results[sid] = {
                "session_name": config.SESSION_ID_TO_NAME.get(sid, "main_trading"),
                "P_up": round(float(p_up), 4),
                "P_down": round(float(1 - p_up), 4),
                "confidence": round(float(max(p_up, 1 - p_up)), 4),
            }

        return results


def get_best_entry_time(session_id: int = 1, session_context: dict | None = None) -> dict:
    """
    Returns best entry window for each session based on historical analysis.
    These are known optimal windows from the plan — in production,
    the time_probability model replaces these with ML-predicted values.
    """
    session_context = session_context or config.get_session_context()
    session_cfg = session_context["by_id"].get(session_id, session_context["by_id"][1])
    timezone = session_cfg.get("timezone", session_context.get("default_timezone", config.DEFAULT_SESSION_TIMEZONE))
    timezone_label = "IST" if timezone == "Asia/Kolkata" else "ET"

    start_minute = _time_to_minutes(session_cfg.get("start"))
    end_minute = _time_to_minutes(session_cfg.get("end"))

    def _format_window(start_total_minutes: int, end_total_minutes: int) -> str:
        return (
            f"{start_total_minutes // 60:02d}:{start_total_minutes % 60:02d}"
            f"-{end_total_minutes // 60:02d}:{end_total_minutes % 60:02d} {timezone_label}"
        )

    best_end = min(end_minute, start_minute + 90)
    window = {
        "session_name": session_cfg.get("name", config.SESSION_ID_TO_NAME.get(session_id, "main_trading")),
        "best_window": _format_window(start_minute, best_end),
        "P_win_known": {0: 0.52, 1: 0.58, 2: 0.50}.get(session_id, 0.55),
    }

    if session_id == config.SESSION_NAME_TO_ID.get("pre_market", 0):
        window["edge_type"] = "trade only after the opening auction stabilizes"
        return window

    if session_id == config.SESSION_NAME_TO_ID.get("post_market", 2):
        window["edge_type"] = "fade late-session extensions only"
        return window

    midpoint = int((start_minute + end_minute) / 2)
    window["edge_type"] = "follow session bias after the opening range"
    window["worst_window"] = _format_window(max(start_minute, midpoint - 30), min(end_minute, midpoint + 30))
    window["worst_P_win"] = 0.51
    return window
