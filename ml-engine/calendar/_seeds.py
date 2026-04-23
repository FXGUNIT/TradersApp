"""Static seed data for holiday-aware expiry and session features."""

from __future__ import annotations

from typing import Final

NSE_HOLIDAY_SEEDS_2026: Final[tuple[dict[str, str], ...]] = (
    {"date": "2026-01-14", "name": "Maha Shivaratri"},
    {"date": "2026-01-26", "name": "Republic Day"},
    {"date": "2026-02-26", "name": "Mahashivratri"},
    {"date": "2026-03-10", "name": "Holi"},
    {"date": "2026-03-30", "name": "Id-E-Milad"},
    {"date": "2026-04-03", "name": "Good Friday"},
    {"date": "2026-04-06", "name": "Easter Monday"},
    {"date": "2026-04-14", "name": "Vaisakhi / Dr. B. R. Ambedkar Jayanti"},
    {"date": "2026-05-01", "name": "May Day"},
    {"date": "2026-08-15", "name": "Independence Day"},
    {"date": "2026-08-27", "name": "Ganesh Chaturthi"},
    {"date": "2026-10-13", "name": "Dussehra"},
    {"date": "2026-10-20", "name": "Diwali - Bhai Dooj"},
    {"date": "2026-11-03", "name": "Maharishi Valmiki Jayanti"},
    {"date": "2026-12-25", "name": "Christmas Day"},
)

INDEX_EXPIRY_RULE_SEEDS: Final[dict[str, dict[str, int | str]]] = {
    "NIFTY": {
        "label": "Nifty 50",
        "weekly_weekday": 4,
        "monthly_weekday": 4,
        "lot_size": 75,
        "strike_step": 50,
    },
    "BANKNIFTY": {
        "label": "Bank Nifty",
        "weekly_weekday": 3,
        "monthly_weekday": 3,
        "lot_size": 35,
        "strike_step": 100,
    },
    "FINNIFTY": {
        "label": "Fin Nifty",
        "weekly_weekday": 2,
        "monthly_weekday": 2,
        "lot_size": 40,
        "strike_step": 50,
    },
}

DEFAULT_INDEX_SYMBOL: Final[str] = "NIFTY"


def holiday_dates(year: int = 2026) -> tuple[str, ...]:
    """Return ISO holiday dates for the requested seed year."""
    if year != 2026:
        return ()
    return tuple(seed["date"] for seed in NSE_HOLIDAY_SEEDS_2026)


def expiry_rule(symbol: str = DEFAULT_INDEX_SYMBOL) -> dict[str, int | str]:
    """Return the static expiry rule for a supported index symbol."""
    normalized = str(symbol or DEFAULT_INDEX_SYMBOL).strip().upper()
    return dict(INDEX_EXPIRY_RULE_SEEDS.get(normalized, INDEX_EXPIRY_RULE_SEEDS[DEFAULT_INDEX_SYMBOL]))
