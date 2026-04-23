"""
Expose TradersApp calendar seed modules without breaking stdlib ``calendar``.

This package mirrors the standard-library calendar API so existing imports keep
working even though Stage S5 reserves ``ml-engine/calendar/`` for seed data.
"""

from __future__ import annotations

import importlib.util
import sysconfig
from pathlib import Path

_STDLIB_CALENDAR_PATH = Path(sysconfig.get_paths()["stdlib"]) / "calendar.py"
_SPEC = importlib.util.spec_from_file_location("_stdlib_calendar", _STDLIB_CALENDAR_PATH)
if _SPEC is None or _SPEC.loader is None:
    raise RuntimeError(f"Unable to load stdlib calendar from {_STDLIB_CALENDAR_PATH}")

_STDLIB_CALENDAR = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_STDLIB_CALENDAR)

for _name in dir(_STDLIB_CALENDAR):
    if _name.startswith("__") and _name not in {"__all__", "__doc__"}:
        continue
    globals()[_name] = getattr(_STDLIB_CALENDAR, _name)

__all__ = list(getattr(_STDLIB_CALENDAR, "__all__", []))
