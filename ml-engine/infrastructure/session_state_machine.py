"""Session-state utilities built on top of the YAML-backed session loader."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from infrastructure.session_loader import SessionLoader
from infrastructure.timezone_utils import TZ_KOLKATA, to_kolkata

_CANONICAL_NAME_MAP = {"regular": "main_trading"}


@dataclass(frozen=True)
class SessionTransition:
    session_name: str
    transition_at: datetime
    transition_type: str


@dataclass(frozen=True)
class SessionSnapshot:
    session_name: str
    is_open: bool
    is_trading_day: bool
    opens_at: datetime | None
    closes_at: datetime | None
    timezone: str


class SessionStateMachine:
    """Resolve the current session and the next transition in Kolkata time."""

    def __init__(self, session_loader: SessionLoader | None = None):
        self._loader = session_loader or SessionLoader()
        self._timezone = ZoneInfo("Asia/Kolkata")
        self._sessions = self._load_sessions()

    def current_state(self, dt: datetime | None = None) -> SessionSnapshot:
        current = self._normalize(dt or datetime.now(TZ_KOLKATA))
        trading_day = self._loader.is_trading_day(current.date())
        session_name = self._loader.get_session_for_time(current) if trading_day else "closed"

        if session_name == "closed":
            return SessionSnapshot(
                session_name="closed",
                is_open=False,
                is_trading_day=trading_day,
                opens_at=None,
                closes_at=None,
                timezone=str(self._timezone),
            )

        start_dt, end_dt = self.session_window(session_name, current.date())
        return SessionSnapshot(
            session_name=session_name,
            is_open=True,
            is_trading_day=True,
            opens_at=start_dt,
            closes_at=end_dt,
            timezone=str(self._timezone),
        )

    def next_transition(self, dt: datetime | None = None) -> SessionTransition:
        current = self._normalize(dt or datetime.now(TZ_KOLKATA))
        if not self._loader.is_trading_day(current.date()):
            next_open_day = self._next_trading_day(current.date() + timedelta(days=1))
            open_dt, _ = self.session_window("pre_market", next_open_day)
            return SessionTransition(
                session_name="pre_market",
                transition_at=open_dt,
                transition_type="open",
            )

        for session_name, start_at, end_at in self._sessions_for_date(current.date()):
            if current < start_at:
                return SessionTransition(
                    session_name=session_name,
                    transition_at=start_at,
                    transition_type="open",
                )
            if start_at <= current < end_at:
                return SessionTransition(
                    session_name=session_name,
                    transition_at=end_at,
                    transition_type="close",
                )

        next_open_day = self._next_trading_day(current.date() + timedelta(days=1))
        open_dt, _ = self.session_window("pre_market", next_open_day)
        return SessionTransition(
            session_name="pre_market",
            transition_at=open_dt,
            transition_type="open",
        )

    def session_window(self, session_name: str, for_date: date) -> tuple[datetime, datetime]:
        normalized_name = _CANONICAL_NAME_MAP.get(session_name, session_name)
        session = self._sessions[normalized_name]
        start_dt = datetime.combine(for_date, session["start"], tzinfo=self._timezone)
        end_dt = datetime.combine(for_date, session["end"], tzinfo=self._timezone)
        return start_dt, end_dt

    def _load_sessions(self) -> dict[str, dict[str, time]]:
        sessions: dict[str, dict[str, time]] = {}
        for raw_name, raw_session in self._loader.all_sessions().items():
            session_name = _CANONICAL_NAME_MAP.get(raw_name, raw_name)
            sessions[session_name] = {
                "start": time.fromisoformat(raw_session["start"]),
                "end": time.fromisoformat(raw_session["end"]),
            }
        return dict(sorted(sessions.items(), key=lambda item: item[1]["start"]))

    def _sessions_for_date(self, for_date: date) -> list[tuple[str, datetime, datetime]]:
        return [
            (session_name, *self.session_window(session_name, for_date))
            for session_name in self._sessions
        ]

    def _normalize(self, dt: datetime) -> datetime:
        localized = to_kolkata(dt)
        if localized.tzinfo is None:
            return localized.replace(tzinfo=TZ_KOLKATA)
        return localized

    def _next_trading_day(self, start_date: date) -> date:
        candidate = start_date
        while not self._loader.is_trading_day(candidate):
            candidate += timedelta(days=1)
        return candidate
