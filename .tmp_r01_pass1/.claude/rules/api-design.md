# API Design Rules

## BFF → ML Engine Contract
All ML Engine endpoints return:
```python
class BaseResponse(BaseModel):
    ok: bool
    error: str | None = None
    latency_ms: float
    timestamp: str  # ISO8601
```

## Every Endpoint Has:
- Input validation (Pydantic/Zod)
- Timeout (5s default)
- Circuit breaker
- Error response shape (never crash)
- Health check at `GET /health`
