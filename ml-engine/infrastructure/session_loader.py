"""Loads and provides access to trading session configuration."""
import yaml
from pathlib import Path
from datetime import date, datetime, time
from typing import Literal

_TZ_KOLKATA = "Asia/Kolkata"
_SessionName = Literal["pre_market", "main_trading", "post_market", "closed"]

# Map canonical names used by callers to the YAML key names in trading_sessions.yaml.
_CALLER_TO_YAML_SESSION_KEY_MAP = {
    "main_trading": "regular",
}

_YAML_TO_CALLER_SESSION_KEY_MAP = {
    "regular": "main_trading",
}


class SessionLoader:
    """
    Loads trading_sessions.yaml and resolves the active session for any datetime.

    All times are interpreted in Asia/Kolkata (IST, UTC+5:30, no DST).
    """

    def __init__(self, config_path: str | None = None):
        if config_path is None:
            config_path = Path(__file__).parent.parent / "config" / "trading_sessions.yaml"
        with open(config_path) as f:
            self._cfg = yaml.safe_load(f)

    # ── public helpers ─────────────────────────────────────────────────────────

    def is_holiday(self, d: date) -> bool:
        """Return True when the given calendar date is a market holiday."""
        return str(d) in self._cfg.get("holidays", [])

    def is_trading_day(self, d: date) -> bool:
        """
        True on weekdays that are not NSE market holidays.
        Does NOT check whether the market is *open* — only whether it is a scheduled day.
        """
        return d.weekday() < 5 and not self.is_holiday(d)

    def get_session_for_time(self, dt: datetime) -> _SessionName:
        """
        Return the session name that a given UTC or local datetime falls inside.

        Args:
            dt: Any datetime. If tzaware it is converted to Asia/Kolkata first;
                if naive it is assumed to already be Asia/Kolkata.

        Returns:
            "pre_market" | "main_trading" | "post_market" | "closed"
        """
        if dt.tzinfo is None:
            # Naive datetime is treated as Asia/Kolkata
            kolkata = dt
        else:
            from zoneinfo import ZoneInfo
            kolkata = dt.astimezone(ZoneInfo(_TZ_KOLKATA))

        if not self.is_trading_day(kolkata.date()):
            return "closed"

        t = kolkata.time()
        for key, sess in self._cfg["sessions"].items():
            start = time.fromisoformat(sess["start"])
            end   = time.fromisoformat(sess["end"])
            if start <= t < end:
                canonical = _YAML_TO_CALLER_SESSION_KEY_MAP.get(key, key)
                return canonical  # type: ignore[return-value]

        return "closed"

    def get_current_session(self, dt: datetime | None = None) -> _SessionName:
        """
        Return the current session type.

        Args:
            dt: Optional datetime (defaults to now in Asia/Kolkata).
        """
        if dt is None:
            from zoneinfo import ZoneInfo
            dt = datetime.now(ZoneInfo(_TZ_KOLKATA))
        return self.get_session_for_time(dt)

    def all_sessions(self) -> dict:
        """Return the raw sessions dict from the YAML for cases that need metadata."""
        return self._cfg["sessions"]

    def get_session(self, name: _SessionName) -> dict | None:
        """
        Return the raw config dict for a named session.

        Args:
            name: "pre_market" | "main_trading" | "post_market" | "closed"

        Returns:
            The session config dict (with name, start, end, timezone, type),
            or None if the session name is not defined in the YAML.
        """
        yaml_key = _CALLER_TO_YAML_SESSION_KEY_MAP.get(name, name)
        return self._cfg["sessions"].get(yaml_key)

    def holiday_dates(self) -> list[str]:
        """Return the list of ISO-format holiday strings."""
        return self._cfg.get("holidays", [])
