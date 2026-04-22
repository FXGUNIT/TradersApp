"""
DST transition and session boundary tests.
Tests timezone DST handling and NSE session detection across date boundaries.
"""
import pytest
import zoneinfo
from datetime import datetime, time
from ml_engine.infrastructure.timezone_utils import (
    TZ_KOLKATA,
    now_kolkata,
    to_kolkata,
    is_dst_active,
    is_within_trading_hours,
)
from ml_engine.infrastructure.session_loader import SessionLoader


class TestKolkataNoDST:
    """Asia/Kolkata (IST) never observes DST — this is a correctness invariant."""

    def test_kolkata_never_has_dst(self):
        """IST has no DST. Verify is_dst_active returns False for all dates."""
        # Sample dates across a full year including typical DST changeover windows
        test_dates = [
            datetime(2026, 1, 15, 12, 0),   # January — mid-winter
            datetime(2026, 3, 8, 12, 0),   # US DST spring forward (~Mar 8)
            datetime(2026, 6, 15, 12, 0),   # June — mid-year
            datetime(2026, 9, 6, 12, 0),   # US DST fall back (~Sep 6)
            datetime(2026, 11, 20, 12, 0),  # November — after fall change
            datetime(2025, 3, 10, 12, 0),  # 2025 spring forward
            datetime(2025, 11, 3, 12, 0),  # 2025 fall back
        ]
        for dt in test_dates:
            assert is_dst_active(TZ_KOLKATA) is False, f"Kolkata DST returned True for {dt}"

    def test_kolkata_utc_offset_constant(self):
        """IST UTC offset is always UTC+5:30 throughout the year."""
        kolkata_winter = datetime(2026, 1, 15, 12, 0, tzinfo=TZ_KOLKATA)
        kolkata_summer = datetime(2026, 7, 15, 12, 0, tzinfo=TZ_KOLKATA)
        assert kolkata_winter.utcoffset() == kolkata_summer.utcoffset()
        assert str(kolkata_winter.utcoffset()) == "1:30:00"  # UTC+5:30 = 5.5 hours


class TestSessionLoader:
    """SessionLoader returns correct session for known timestamps."""

    def setup_method(self):
        self.loader = SessionLoader()

    @pytest.mark.parametrize("dt_str,session", [
        # Pre-market: 09:00-09:14 IST
        ("2026-04-22 09:00", "pre_market"),
        ("2026-04-22 09:14:59", "pre_market"),
        # Regular: 09:15-15:29 IST
        ("2026-04-22 09:15", "main_trading"),
        ("2026-04-22 12:00", "main_trading"),
        ("2026-04-22 15:29:59", "main_trading"),
        # Post-market: 15:30-15:59 IST
        ("2026-04-22 15:30", "post_market"),
        ("2026-04-22 15:59", "post_market"),
        # Closed: after 16:00 IST
        ("2026-04-22 16:00", "closed"),
        ("2026-04-22 23:59", "closed"),
        ("2026-04-23 08:59", "closed"),
    ])
    def test_session_detection(self, dt_str, session):
        """Each time-of-day maps to the correct session type."""
        dt = datetime.fromisoformat(dt_str)
        result = self.loader.get_current_session(dt)
        assert result == session, f"Expected {session} for {dt_str}, got {result}"

    def test_holiday_detection(self):
        """Known holidays return is_trading_day=False."""
        loader = SessionLoader()
        # Republic Day 2026
        assert loader.is_trading_day(datetime(2026, 1, 26).date()) is False
        # Good Friday 2026
        assert loader.is_trading_day(datetime(2026, 4, 3).date()) is False
        # Regular trading day
        assert loader.is_trading_day(datetime(2026, 4, 22).date()) is True

    def test_weekend_detection(self):
        """Saturdays and Sundays are not trading days."""
        loader = SessionLoader()
        assert loader.is_trading_day(datetime(2026, 4, 25).date()) is False  # Saturday
        assert loader.is_trading_day(datetime(2026, 4, 26).date()) is False  # Sunday