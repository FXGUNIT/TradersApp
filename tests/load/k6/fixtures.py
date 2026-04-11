"""
Realistic MNQ futures candle data for k6 load testing.
5-minute candles covering trending, ranging, and volatile market conditions.
"""
from datetime import datetime, timezone

def make_trending_candle(i: int) -> dict:
    """Trend-following candle: consistent directional movement."""
    base = 45000
    offset = i * 15
    return {
        "symbol": "MNQ",
        "timeframe": "5min",
        "open": round(base + offset, 2),
        "high": round(base + offset + 30, 2),
        "low": round(base + offset - 10, 2),
        "close": round(base + offset + 25, 2),
        "volume": 1200 + (i % 10) * 50,
        "timestamp": f"2026-04-12T{(i % 24):02d}:{(i * 5) % 60:02d}:00Z"
    }

def make_ranging_candle(i: int) -> dict:
    """Ranging candle: oscillation within a tight range."""
    base = 45000
    amplitude = 20
    offset = amplitude * (i % 2) * 2
    return {
        "symbol": "MNQ",
        "timeframe": "5min",
        "open": round(base + offset, 2),
        "high": round(base + offset + 15, 2),
        "low": round(base + offset - 15, 2),
        "close": round(base + offset + 5, 2),
        "volume": 800 + (i % 5) * 100,
        "timestamp": f"2026-04-12T{(i % 24):02d}:{(i * 5) % 60:02d}:00Z"
    }

def make_volatile_candle(i: int) -> dict:
    """Volatile candle: large range, high volume (earnings-like)."""
    base = 45000
    return {
        "symbol": "MNQ",
        "timeframe": "5min",
        "open": round(base + 50, 2),
        "high": round(base + 150, 2),
        "low": round(base - 100, 2),
        "close": round(base - 50, 2),
        "volume": 5000 + (i % 10) * 200,
        "timestamp": f"2026-04-12T{(i % 24):02d}:{(i * 5) % 60:02d}:00Z"
    }

TRENDING_CANDLES = [make_trending_candle(i) for i in range(1, 51)]  # 50 candles
RANGING_CANDLES = [make_ranging_candle(i) for i in range(1, 51)]
VOLATILE_CANDLES = [make_volatile_candle(i) for i in range(1, 51)]

def get_sample_candles(n: int = 50) -> list[dict]:
    """Return n trending candles for /predict calls."""
    return TRENDING_CANDLES[:n]

def get_mamba_candles(n: int = 100) -> list[dict]:
    """Return n candles for /mamba/predict calls."""
    return TRENDING_CANDLES[:min(n, 50)] + RANGING_CANDLES[:max(0, n-50)]
