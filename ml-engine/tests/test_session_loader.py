from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from infrastructure.session_loader import SessionLoader


@pytest.mark.unit
class TestSessionLoader:
    def test_loads_default_config_and_exposes_session_aliases(self):
        loader = SessionLoader()

        regular = loader.get_session("main_trading")

        assert regular is not None
        assert regular["name"] == "Regular Session"
        assert regular["type"] == "regular"
        assert loader.get_session("closed") is None
        assert "regular" in loader.all_sessions()
        assert "2026-04-03" in loader.holiday_dates()

    @pytest.mark.parametrize(
        ("dt", "expected"),
        [
            (datetime(2026, 4, 22, 8, 59, 59), "closed"),
            (datetime(2026, 4, 22, 9, 0, 0), "pre_market"),
            (datetime(2026, 4, 22, 9, 14, 59), "pre_market"),
            (datetime(2026, 4, 22, 9, 15, 0), "main_trading"),
            (datetime(2026, 4, 22, 15, 29, 59), "main_trading"),
            (datetime(2026, 4, 22, 15, 30, 0), "post_market"),
            (datetime(2026, 4, 22, 15, 59, 59), "post_market"),
            (datetime(2026, 4, 22, 16, 0, 0), "closed"),
        ],
    )
    def test_get_session_for_time_uses_half_open_session_boundaries(self, dt, expected):
        loader = SessionLoader()

        assert loader.get_session_for_time(dt) == expected

    @pytest.mark.parametrize(
        ("dt", "expected"),
        [
            (datetime(2026, 4, 22, 3, 30, tzinfo=timezone.utc), "pre_market"),
            (datetime(2026, 4, 22, 3, 45, tzinfo=timezone.utc), "main_trading"),
            (datetime(2026, 4, 22, 10, 0, tzinfo=timezone.utc), "post_market"),
            (datetime(2026, 4, 22, 10, 30, tzinfo=timezone.utc), "closed"),
        ],
    )
    def test_get_session_for_time_converts_aware_datetimes_to_kolkata(self, dt, expected):
        loader = SessionLoader()

        assert loader.get_session_for_time(dt) == expected

    def test_non_trading_days_are_closed_even_during_session_hours(self):
        loader = SessionLoader()

        holiday_mid_session = datetime(2026, 4, 3, 10, 0, 0)
        saturday_mid_session = datetime(2026, 4, 25, 10, 0, 0)

        assert loader.is_holiday(date(2026, 4, 3)) is True
        assert loader.is_trading_day(date(2026, 4, 3)) is False
        assert loader.is_trading_day(date(2026, 4, 25)) is False
        assert loader.get_session_for_time(holiday_mid_session) == "closed"
        assert loader.get_session_for_time(saturday_mid_session) == "closed"

    def test_supports_explicit_config_path(self, tmp_path):
        config_path = tmp_path / "trading_sessions.yaml"
        config_path.write_text(
            "\n".join(
                [
                    "sessions:",
                    "  pre_market:",
                    '    name: "Pre"',
                    '    start: "07:00"',
                    '    end: "07:30"',
                    '    timezone: "Asia/Kolkata"',
                    '    type: "pre_market"',
                    "  regular:",
                    '    name: "Regular"',
                    '    start: "07:30"',
                    '    end: "08:30"',
                    '    timezone: "Asia/Kolkata"',
                    '    type: "regular"',
                    "  post_market:",
                    '    name: "Post"',
                    '    start: "08:30"',
                    '    end: "09:00"',
                    '    timezone: "Asia/Kolkata"',
                    '    type: "post_market"',
                    "holidays:",
                    '  - "2026-12-25"',
                ]
            ),
            encoding="utf-8",
        )

        loader = SessionLoader(str(config_path))

        assert loader.get_session_for_time(datetime(2026, 12, 24, 7, 45)) == "main_trading"
        assert loader.get_session("main_trading") == {
            "name": "Regular",
            "start": "07:30",
            "end": "08:30",
            "timezone": "Asia/Kolkata",
            "type": "regular",
        }
        assert loader.is_holiday(date(2026, 12, 25)) is True
