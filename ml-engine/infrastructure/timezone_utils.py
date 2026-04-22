"""DST-safe timezone utilities — uses zoneinfo throughout, never pytz."""
from zoneinfo import ZoneInfo
from datetime import datetime, timedelta

TZ_KOLKATA = ZoneInfo("Asia/Kolkata")   # UTC+5:30, never observes DST


def now_kolkata() -> datetime:
    """Return the current wall-clock time in Asia/Kolkata."""
    return datetime.now(TZ_KOLKATA)


def to_kolkata(dt: datetime) -> datetime:
    """
    Convert any datetime to Asia/Kolkata.

    - If tzaware: converts via astimezone().
    - If naive: assumes it is already Kolkata (caller's responsibility).
    """
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(TZ_KOLKATA)


def from_kolkata(dt: datetime) -> datetime:
    """
    Convert a Kolkata datetime to UTC.

    If the datetime is naive it is first treated as Asia/Kolkata before conversion.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ_KOLKATA)
    return dt.astimezone(ZoneInfo("UTC"))


def is_dst_active(tz: str | ZoneInfo) -> bool:
    """
    Return whether DST is currently active in the named IANA timezone.

    zoneinfo handles DST transitions internally — we compare the current
    UTC offset against the standard (non-DST) UTC offset at the same UTC
    instant. If they differ, DST is in effect.
    """
    if isinstance(tz, ZoneInfo):
        zi = tz
    else:
        zi = ZoneInfo(tz)
    now_utc = datetime.now(ZoneInfo("UTC"))
    # Current offset including any DST shift
    offset_now = now_utc.astimezone(zi).utcoffset()
    # Standard (non-DST) offset — use January (always standard in northern hemisp.)
    jan = datetime(now_utc.year, 1, 15, 12, tzinfo=ZoneInfo("UTC"))
    offset_std = jan.astimezone(zi).utcoffset()
    return offset_now != offset_std


def trading_day_start(d: datetime) -> datetime:
    """Return the open of the regular session (09:15 IST) for the given date."""
    from datetime import time as T
    return datetime.combine(d.date(), T(9, 15), tzinfo=TZ_KOLKATA)


def trading_day_end(d: datetime) -> datetime:
    """Return the close of the post-market session (16:00 IST) for the given date."""
    from datetime import time as T
    return datetime.combine(d.date(), T(16, 0), tzinfo=TZ_KOLKATA)


def is_within_trading_hours(dt: datetime) -> bool:
    """
    Return True when the given datetime falls inside the full NSE trading window
    (09:00 IST pre-market through 16:00 IST post-market), exclusive of endpoints.

    Naive datetimes are assumed to be Kolkata; tzaware ones are converted first.
    """
    k = to_kolkata(dt)
    from datetime import time as T
    START = T(9, 0)
    END   = T(16, 0)
    return START <= k.time() <= END
