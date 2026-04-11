# ADR-014: Observability Stack (Prometheus + Grafana + Loki + Jaeger)

**ADR ID:** ADR-014
**Title:** Observability Stack (Prometheus + Grafana + Loki + Jaeger)
**Status:** Accepted
**Date:** 2026-04-06
**Author:** Claude

## Context

The TradersApp system requires comprehensive observability to:
- **Monitor** ML model performance, latency, and health
- **Debug** distributed requests across BFF → ML Engine → Redis
- **Alert** on SLA violations, model drift, and system failures
- **Audit** trading decisions and system behavior
- **Correlate** events across services (logs, metrics, traces)

Without observability:
- ML model degradation goes undetected
- Latency issues are hard to pinpoint
- Incidents take longer to diagnose
- SLA compliance is unmeasurable

## Decision

We will use a unified observability stack:

| Component | Purpose | Port | Retention |
|-----------|---------|------|-----------|
| **Prometheus** | Metrics collection & alerting | 9090 | 30 days |
| **Grafana** | Visualization & dashboards | 3000 | 90 days |
| **Loki** | Log aggregation | 3100 | 30 days |
| **Jaeger** | Distributed tracing | 16686 | 7 days |
| **Alertmanager** | Alert routing | 9093 | — |
| **Promtail** | Log shipping (agent) | — | — |
| **Tempo** | Trace storage (optional) | 3200 | 7 days |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Observability Stack                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────┐ │
│  │  Prometheus  │────▶│   Grafana    │     │ Alertmanager│ │
│  │  (scrape)    │     │  (visualize) │     │  (route)   │ │
│  └──────┬───────┘     └──────────────┘     └─────┬──────┘ │
│         │                                         │         │
│  ┌──────┴───────┐     ┌──────────────┐           │         │
│  │ Loki/Promtail│◀───▶│   Grafana    │           │         │
│  │  (logs)      │     │  (logs tab)  │           │         │
│  └──────┬───────┘     └──────────────┘           │         │
│         │                                         │         │
│  ┌──────┴───────┐     ┌──────────────┐           │         │
│  │   Jaeger     │◀───▶│   Grafana    │           │         │
│  │  (traces)    │     │  (traces)    │           │         │
│  └──────────────┘     └──────────────┘           │         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application Services                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ BFF      │  │ML Engine │  │ Frontend │  │ Telegram │   │
│  │ :8788    │  │  :8001   │  │  :5173   │  │  Bridge  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       ▼             ▼             ▼             ▼          │
│   metrics       metrics       metrics       metrics        │
│   logs          logs          logs          logs           │
│   traces        traces        traces        traces          │
└─────────────────────────────────────────────────────────────┘
```

### Metrics Standard (OpenTelemetry)

All services expose metrics following OpenTelemetry conventions:

```python
# ml-engine/metrics.py
from prometheus_client import Counter, Histogram, Gauge, Info

# Request metrics
REQUEST_COUNT = Counter(
    'ml_engine_requests_total',
    'Total number of ML Engine requests',
    ['endpoint', 'status', 'model']
)

REQUEST_LATENCY = Histogram(
    'ml_engine_request_duration_seconds',
    'Request latency in seconds',
    ['endpoint', 'model'],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0]
)

# Model metrics
MODEL_PREDICTIONS = Counter(
    'ml_model_predictions_total',
    'Total model predictions',
    ['model', 'signal']
)

MODEL_CONFIDENCE = Histogram(
    'ml_model_confidence_distribution',
    'Distribution of prediction confidence',
    ['model'],
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

# Cache metrics
CACHE_HITS = Counter('ml_cache_hits_total', 'Cache hit count', ['cache'])
CACHE_MISSES = Counter('ml_cache_misses_total', 'Cache miss count', ['cache'])

# Circuit breaker metrics
CIRCUIT_BREAKER_STATE = Gauge(
    'circuit_breaker_state',
    'Circuit breaker state (0=closed, 1=half_open, 2=open)',
    ['service']
)

# Drift metrics
DRIFT_PSI = Gauge('drift_psi_score', 'PSI drift score', ['feature'])
DRIFT_ALERT = Gauge('drift_alert_active', 'Drift alert active (0/1)', ['model'])
```

### Log Format (Structured JSON)

```python
# All services use structured JSON logging
import structlog

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)
```

**Example log entry:**
```json
{
  "timestamp": "2026-04-06T10:30:00.000Z",
  "level": "info",
  "logger": "ml-engine",
  "message": "Prediction completed",
  "request_id": "abc-123-def",
  "model": "direction_lgb",
  "signal": "LONG",
  "confidence": 0.847,
  "latency_ms": 45,
  "cache_hit": true,
  "service": "ml-engine",
  "trace_id": "789xyz"
}
```

### Distributed Tracing

```python
# All services initialize OpenTelemetry tracing
from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

trace.set_tracer_provider(TracerProvider())
jaeger_exporter = JaegerExporter(
    agent_host_name="jaeger",
    agent_port=6831,
)
trace.get_tracer_provider().add_span_processor(
    BatchSpanProcessor(jaeger_exporter)
)

# Instrument all HTTP calls
from opentelemetry.instrumentation.requests import RequestsInstrumentor
RequestsInstrumentor().instrument()
```

### SLO Definitions

| SLO | Target | Window | Alert |
|-----|--------|--------|-------|
| ML Consensus Latency P99 | < 200ms | Rolling 1h | > 250ms for 5 min |
| ML Consensus Availability | 99.9% | Rolling 24h | < 99.5% |
| BFF → ML Engine Latency | < 100ms P95 | Rolling 1h | > 150ms for 5 min |
| Cache Hit Rate | > 80% | Rolling 1h | < 60% |
| Drift Alert Resolution | < 1h | Rolling 24h | > 1h |
| Model Freshness | < 1 week | Rolling | > 1 week |

### Grafana Dashboards

1. **ML Model Health Dashboard** — P50/P95/P99 latency, prediction distribution, confidence trends
2. **System Overview Dashboard** — Request rate, error rate, saturation
3. **Drift Detection Dashboard** — PSI scores, win rate trends, regime distribution
4. **Training Pipeline Dashboard** — Training job status, feature importance, hyperparameter changes
5. **Alerting Dashboard** — Active alerts, MTTD, MTTR

## Consequences

### Positive
- **Unified observability:** Metrics, logs, and traces in one place
- **Open standards:** OpenTelemetry, Prometheus, Loki are vendor-neutral
- **Correlated debugging:** Link logs to traces to metrics
- **SLO visibility:** Clear targets and measurements
- **Alerting:** Automated alerting on violations
- **Cost-effective:** Self-hosted, no per-metric pricing

### Negative
- **Operational overhead:** Running 5+ observability services
- **Resource usage:** Prometheus + Grafana + Loki require significant RAM
- **Learning curve:** Team must learn Prometheus queries, Grafana dashboards
- **Retention limits:** Long-term storage requires additional configuration

### Neutral
- Some metrics may be too granular, causing cardinality explosion
- Log volume can be high, requiring filtering
- Traces add slight overhead to requests

## References

- [OpenTelemetry Specification](https://opentelemetry.io/docs/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Dashboard Design](https://grafana.com/docs/grafana/latest/best-practices/)
- [Loki Configuration](https://grafana.com/docs/loki/latest/configuration/)
- Related ADRs: [ADR-003 Circuit Breakers](ADR-003-circuit-breakers.md) (metrics exposed), [ADR-016 Drift Detection](ADR-016-drift-detection.md) (drift metrics)
