# Architecture Decision Records

Every non-trivial technical decision is documented as an ADR before implementation.

## ADR Format

Each ADR follows this structure:
- **Status:** Accepted | Deprecated | Superseded
- **Context:** Why this decision was necessary
- **Decision:** What was chosen and why
- **Consequences:** Both positive and negative

## Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001](ADR-001-dvc-data-versioning.md) | DVC for Data Versioning | Accepted | 2026-04-02 |
| [ADR-002](ADR-002-redis-caching.md) | Redis Cache with In-Memory LRU Fallback | Accepted | 2026-04-02 |
| [ADR-003](ADR-003-circuit-breakers.md) | Circuit Breaker Pattern for ML Engine | Accepted | 2026-04-02 |
| [ADR-004](ADR-004-mlflow-choice.md) | MLflow Self-Hosted for MLOps | Pending | — |
| [ADR-005](ADR-005-kafka-choice.md) | Apache Kafka for Event-Driven Communication | Pending | — |
| [ADR-006](ADR-006-k3s-choice.md) | k3s for Container Orchestration | Pending | — |
| [ADR-007](ADR-007-feast-choice.md) | Feast Feature Store with Redis Online Store | Pending | — |
| [ADR-008](ADR-008-inference-server-choice.md) | Triton/vLLM for Model Inference | Pending | — |
| [ADR-009](ADR-009-secrets-infisical.md) | Infisical for Secrets Management | Accepted | 2026-04-02 |
| [ADR-010](ADR-010-bff-pattern.md) | BFF Pattern for Frontend-Backend Integration | Accepted | 2026-04-02 |
| [ADR-011](ADR-011-physics-regime-models.md) | Physics-Based Regime Detection (FP-FK + Anomalous Diffusion) | Accepted | 2026-04-02 |
| [ADR-012](ADR-012-continual-learning.md) | EWC + Replay Buffer for Continual Learning | Accepted | 2026-04-02 |
| [ADR-013](ADR-013-testing-strategy.md) | Multi-Level Testing Strategy | Pending | — |
| [ADR-014](ADR-014-observability-stack.md) | Prometheus + Grafana + Loki + Jaeger | Pending | — |
| [ADR-015](ADR-015-keycloak-sso.md) | Keycloak for Zero-Trust SSO | Pending | — |

## Process

1. **Before implementing** any component in the 20-step plan, write the ADR first
2. **ADR review** is part of the self-code review process (Phase 1, Task 1.9)
3. **Deprecation:** If a decision is superseded, mark the ADR Deprecated and link to the replacement
4. **ADR ownership:** The author of the ADR is responsible for its maintenance

## Adding a New ADR

```bash
cp docs/adr/TEMPLATE.md docs/adr/ADR-XXX-title.md
```

See [TEMPLATE.md](TEMPLATE.md) for the standard format.
