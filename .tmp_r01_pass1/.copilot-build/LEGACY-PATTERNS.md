# TradersApp — Legacy & Integration Patterns

**Last Updated:** 2026-04-02
**Purpose:** Document every existing pattern from external systems. Claude/OpenClaw MUST copy these styles exactly.

---

## 1. NINJATRADER CSV FORMAT

### Standard Export Columns (IN USE — do not change)
```
Date,Time,Open,High,Low,Close,Volume,TickAgg,VPR,DPR,WPVP,AVP,CloseAgg,NumTicks,Exch,VWAP,HighE,LowE,OpenE,PrcCnd,VtyCnd
```

### Data Loading Rules
- Date format: `yyyy-MM-dd` or `MM/dd/yyyy` (auto-detect)
- Time format: `HH:mm:ss` or `HH:mm` (infer seconds)
- Volume: integer, may be 0 for synthetic candles
- Skip rows where Open=High=Low=Close=0
- VWAP may be null for illiquid bars — handle gracefully

### Session Tagging
```
GLOBEX hours (20:00-14:30): ETH/pre-market
RTH hours (09:30-16:00 ET): Regular trading hours
```

---

## 2. BROKER / DATA FEED PATTERNS (Future)

### Expected incoming data shape
```javascript
{
  timestamp: Date,      // ISO 8601
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
  symbol: string       // e.g., "ES", "NQ", "CL"
}
```

### Subscription pattern
```javascript
// Subscribe to real-time candles
subscribe(symbol, timeframe, (candle) => {
  // Process new candle immediately
  // Do NOT use unclosed candle for prediction
})
```

---

## 3. ML MODEL PATTERNS

### Training Data Shape
```python
# Features: OHLCV + computed features
X: np.ndarray of shape (n_samples, n_features)
y: np.ndarray of shape (n_samples,)  # 0=SHORT, 1=NEUTRAL, 2=LONG

# DO NOT include future data in X
# DO NOT use current candle close in prediction (look-ahead)
```

### Model Loading Pattern
```python
class BaseModel:
    def __init__(self, model_path: str):
        self.model = self._load(model_path)  # Must handle FileNotFoundError

    def predict(self, X: np.ndarray) -> dict:
        if self.model is None:
            return {"signal": "NEUTRAL", "confidence": 0.0, "error": "model_not_loaded"}
        # Must wrap in try/except for all prediction paths
```

### Feature Engineering Rules
- All features must be derived from CLOSED candles only
- No future-looking indicators (use shifted data)
- Handle NaN with forward-fill or explicit skip
- Log feature ranges for every prediction (for drift detection)

---

## 4. PYTHON MODULE PATTERNS

### File header (copy this exactly)
```python
"""Module name — one-line description."""
from __future__ import annotations
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Literal

# Import guard for optional deps
try:
    import lightgbm as lgb
except ImportError:
    lgb = None  # type: ignore
```

### Error handling pattern
```python
# NEVER: except Exception
# ALWAYS: specific exceptions
try:
    result = model.predict(X)
except ValueError as e:
    return {"signal": "NEUTRAL", "confidence": 0.0, "error": str(e)}
except FileNotFoundError:
    return {"signal": "NEUTRAL", "confidence": 0.0, "error": "model_file_missing"}
```

### Logging pattern
```python
import logging
logger = logging.getLogger(__name__)

# Log level rules:
# ERROR: prediction failed (user sees fallback)
# WARN:  degraded state (user sees warning)
# INFO:  normal operation milestones
# DEBUG: detailed flow (hidden unless enabled)
```

---

## 5. JAVASCRIPT / NODE.JS PATTERNS

### API response shape (BFF → Frontend)
```javascript
// Success
{ ok: true, data: {...}, latency_ms: 123, timestamp: "ISO8601" }

// Error fallback
{ ok: false, error: "ML_ENGINE_UNAVAILABLE", data: null, stale: true, data_age_seconds: 300, latency_ms: 5 }
```

### Circuit breaker pattern
```javascript
class CircuitBreaker {
  constructor(failureThreshold = 5, windowMs = 30000) {
    this.failures = 0
    this.lastFailure = 0
    this.state = 'CLOSED'  // CLOSED | OPEN | HALF_OPEN
  }
  // ...
}
```

---

## 6. REACT COMPONENT PATTERNS

### State ownership
```
Feature Container (fetches data, owns state)
  └─ Sub-components (pure: props → UI, no API calls)
```

### Error boundary pattern
```javascript
// Every feature container MUST have:
// - isLoading state (show loader)
// - error state (show "Service Unavailable" with retry)
// - data state (show content)
// NEVER crash the whole app on a single feature failure
```

---

## 7. GIT COMMIT PATTERN

```
feat: Add new feature
fix: Fix existing bug
docs: Update documentation
refactor: Code restructure (no behavior change)
perf: Performance improvement
test: Add or update tests
chore: Maintenance, dependencies
```

---

## 8. CONFIGURATION PATTERNS

### Python config
```python
# ml-engine/config.py
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "ml-engine" / "data"
MODEL_DIR = REPO_ROOT / "ml-engine" / "models"
CACHE_DIR = REPO_ROOT / "ml-engine" / ".cache"

# Feature flags (bool, not string)
ENABLE_MAMBA = True
ENABLE_CIRCUIT_BREAKER = True
```

### JavaScript config
```javascript
// Always use env vars with defaults
const TIMEOUT_MS = parseInt(import.meta.env.VITE_ML_TIMEOUT ?? '5000', 10)
```
