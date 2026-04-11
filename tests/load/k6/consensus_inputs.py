"""Consensus request fixtures for k6 load testing."""

SYMBOLS = ["MNQ", "ES", "NQ", "RTY"]

def get_consensus_request(symbol: str = "MNQ") -> str:
    """Return query string for /consensus endpoint."""
    return f"symbol={symbol}"

def get_predict_request(candles: list) -> dict:
    """Return JSON body for /predict endpoint."""
    return {"candles": candles}
