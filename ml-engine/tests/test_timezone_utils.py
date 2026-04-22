from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest

from infrastructure import timezone_utils


def _freeze_now(monkeypatch, frozen_utc: datetime) -> None:
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            if tz is None:
                return frozen_utc.replace(tzinfo=None)
            return frozen_utc.astimezone(tz)

    monkeypatch.setattr(timezone_utils, "datetime", FrozenDateTime)


@pytest.mark.unit
def test_now_kolkata_returns_timezone_aware_kolkata_clock(monkeypatch):
    _freeze_now(monkeypatch, datetime(2026, 4, 22, 6, 0, tzinfo=timezone.utc))

    current = timezone_utils.now_kolkata()

    assert current.tzinfo == timezone_utils.TZ_KOLKATA
    assert (current.hour, current.minute) == (11, 30)


@pytest.mark.unit
def test_to_kolkata_converts_aware_datetimes_and_preserves_naive_inputs():
    aware_utc = datetime(2026, 3, 8, 7, 1, tzinfo=timezone.utc)
    naive_kolkata = datetime(2026, 4, 22, 9, 15)

    converted = timezone_utils.to_kolkata(aware_utc)

    assert converted.tzinfo == timezone_utils.TZ_KOLKATA
    assert (converted.hour, converted.minute) == (12, 31)
    assert timezone_utils.to_kolkata(naive_kolkata) == naive_kolkata


@pytest.mark.unit
def test_from_kolkata_converts_naive_and_aware_datetimes_to_utc():
    naive_kolkata = datetime(2026, 4, 22, 9, 15)
    aware_kolkata = datetime(2026, 4, 22, 15, 30, tzinfo=timezone_utils.TZ_KOLKATA)

    converted_naive = timezone_utils.from_kolkata(naive_kolkata)
    converted_aware = timezone_utils.from_kolkata(aware_kolkata)

    assert converted_naive == datetime(2026, 4, 22, 3, 45, tzinfo=ZoneInfo("UTC"))
    assert converted_aware == datetime(2026, 4, 22, 10, 0, tzinfo=ZoneInfo("UTC"))


@pytest.mark.unit
@pytest.mark.parametrize(
    ("frozen_utc", "expected"),
    [
        (datetime(2026, 3, 8, 6, 59, tzinfo=timezone.utc), False),
        (datetime(2026, 3, 8, 7, 1, tzinfo=timezone.utc), True),
    ],
)
def test_is_dst_active_across_us_spring_forward(monkeypatch, frozen_utc, expected):
    _freeze_now(monkeypatch, frozen_utc)

    assert timezone_utils.is_dst_active("America/New_York") is expected


@pytest.mark.unit
@pytest.mark.parametrize(
    ("frozen_utc", "expected"),
    [
        (datetime(2026, 11, 1, 5, 59, tzinfo=timezone.utc), True),
        (datetime(2026, 11, 1, 6, 1, tzinfo=timezone.utc), False),
    ],
)
def test_is_dst_active_across_us_fall_back(monkeypatch, frozen_utc, expected):
    _freeze_now(monkeypatch, frozen_utc)

    assert timezone_utils.is_dst_active(ZoneInfo("America/New_York")) is expected


@pytest.mark.unit
def test_kolkata_never_reports_dst_even_during_us_transition(monkeypatch):
    _freeze_now(monkeypatch, datetime(2026, 3, 8, 7, 1, tzinfo=timezone.utc))

    assert timezone_utils.is_dst_active("Asia/Kolkata") is False


@pytest.mark.unit
def test_trading_day_helpers_return_expected_session_bounds():
    sample_day = datetime(2026, 4, 22, 12, 0, tzinfo=timezone_utils.TZ_KOLKATA)

    start = timezone_utils.trading_day_start(sample_day)
    end = timezone_utils.trading_day_end(sample_day)

    assert start == datetime(2026, 4, 22, 9, 15, tzinfo=timezone_utils.TZ_KOLKATA)
    assert end == datetime(2026, 4, 22, 16, 0, tzinfo=timezone_utils.TZ_KOLKATA)


@pytest.mark.unit
def test_is_within_trading_hours_handles_kolkata_and_utc_inputs():
    assert timezone_utils.is_within_trading_hours(
        datetime(2026, 4, 22, 10, 0, tzinfo=timezone_utils.TZ_KOLKATA)
    ) is True
    assert timezone_utils.is_within_trading_hours(
        datetime(2026, 4, 22, 8, 59, tzinfo=timezone_utils.TZ_KOLKATA)
    ) is False
    assert timezone_utils.is_within_trading_hours(
        datetime(2026, 4, 22, 4, 30, tzinfo=timezone.utc)
    ) is True
    assert timezone_utils.is_within_trading_hours(
        datetime(2026, 4, 22, 10, 31, tzinfo=timezone.utc)
    ) is False
