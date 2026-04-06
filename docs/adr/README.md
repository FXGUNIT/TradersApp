# Architecture Decision Records

Every non-trivial technical decision is documented as an ADR before implementation.

## ADR Format

Each ADR follows this structure:
- **Status:** Proposed | Accepted | Deprecated | Superseded
- **Context:** Why this decision was necessary
- **Decision:** What was chosen and why
- **Consequences:** Both positive and negative
- **Alternatives Considered:** Why other options were rejected
- **References:** Links to related documentation

## ADR Lifecycle

```
Proposed → Accepted → Deprecated → Superseded
    ↓
  Rejected (rare)
```

| Status | Meaning |
|--------|---------|
| **Proposed** | Under review, not yet implemented |
| **Accepted** | Approved and implemented |
| **Deprecated** | No longer preferred, but still in use |
| **Superseded** | Replaced by a newer ADR |
| **Rejected** | Considered but not adopted |

## Index

| ID | Title | Status | Date | Owner | Review Date |
|----|-------|--------|------|-------|-------------|
| [ADR-001](ADR-001-dvc-data-versioning.md) | DVC for Data Versioning | Accepted | 2026-04-02 | FXGUNIT | 2027-04-02 |
| [ADR-002](ADR-002-redis-caching.md) | Redis Cache with In-Memory LRU Fallback | Accepted | 2026-04-02 | FXGUNIT | 2027-04-02 |
| [ADR-003](ADR-003-circuit-breakers.md) | Circuit Breaker Pattern for ML Engine | Accepted | 2026-04-02 | FXGUNIT | 2027-04-02 |
| [ADR-004](ADR-004-mlflow-choice.md) | MLflow Self-Hosted for MLOps | Accepted | 2026-04-03 | FXGUNIT | 2027-04-03 |
| [ADR-005](ADR-005-kafka-choice.md) | Apache Kafka for Event-Driven Communication | Accepted | 2026-04-06 | Claude | 2027-04-06 |
| [ADR-006](ADR-006-k3s-choice.md) | k3s for Container Orchestration | Accepted | 2026-04-06 | Claude | 2027-04-06 |
| [ADR-007](ADR-007-feast-choice.md) | Feast Feature Store with Redis Online Store | Accepted | 2026-04-06 | Claude | 2027-04-06 |
| [ADR-008](ADR-008-inference-server-choice.md) | Triton/vLLM for Model Inference | Accepted | 2026-04-06 | Claude | 2027-04-06 |
| [ADR-009](ADR-009-secrets-infisical.md) | Infisical for Secrets Management | Accepted | 2026-04-02 | FXGUNIT | 2027-04-02 |
| [ADR-010](ADR-010-bff-pattern.md) | BFF Pattern for Frontend-Backend Integration | Accepted | 2026-04-02 | FXGUNIT | 2027-04-02 |
| [ADR-011](ADR-011-physics-regime-models.md) | Physics-Based Regime Detection (FP-FK + Anomalous Diffusion) | Accepted | 2026-04-02 | FXGUNIT | 2027-04-02 |
| [ADR-012](ADR-012-continual-learning.md) | EWC + Replay Buffer for Continual Learning | Accepted | 2026-04-06 | Claude | 2027-04-06 |
| [ADR-013](ADR-013-testing-strategy.md) | Multi-Level Testing Strategy | Accepted | 2026-04-06 | Claude | 2027-04-06 |
| [ADR-014](ADR-014-observability-stack.md) | Prometheus + Grafana + Loki + Jaeger | Accepted | 2026-04-06 | Claude | 2027-04-06 |
| [ADR-015](ADR-015-keycloak-sso.md) | Keycloak for Zero-Trust SSO | Accepted | 2026-04-06 | Claude | 2027-04-06 |
| [ADR-016](ADR-016-drift-detection.md) | Unified Drift Detection (PSI + Win Rate + HMM) | Accepted | 2026-04-03 | FXGUNIT | 2027-04-03 |
| [ADR-017](ADR-017-trivy-scanning.md) | Trivy for Container Vulnerability Scanning | Accepted | 2026-04-06 | Claude | 2027-04-06 |
| [ADR-018](ADR-018-ddd-microservices-grpc.md) | DDD Bounded Contexts with gRPC | Accepted | 2026-04-04 | FXGUNIT | 2027-04-06 |

## ADR Relationships

```
ADR-001 (DVC) ──▶ ADR-007 (Feast)
ADR-004 (MLflow) ──▶ ADR-012 (Continual Learning)
ADR-005 (Kafka) ──▶ ADR-006 (k3s)
ADR-006 (k3s) ──▶ ADR-015 (Keycloak)
ADR-006 (k3s) ──▶ ADR-017 (Trivy)
ADR-015 (Keycloak) ──▶ ADR-006 (k3s)
ADR-016 (Drift Detection) ──▶ ADR-012 (Continual Learning)
ADR-003 (Circuit Breakers) ──▶ ADR-013 (Testing)
ADR-007 (Feast) ──▶ ADR-008 (Inference)
ADR-008 (Inference) ──▶ ADR-012 (Continual Learning)
ADR-002 (Redis) ──▶ ADR-015 (Keycloak)
ADR-018 (DDD + gRPC) ──▶ ADR-004 (MLflow)
```

## Process

### When to Write an ADR

Write an ADR when:
- Implementing a new feature that affects architecture
- Changing an existing architectural decision
- Adopting a new technology or library
- Modifying a service boundary or API contract
- Adding a new service to the system
- Changing a security or compliance approach

### ADR Creation Steps

1. **Draft** the ADR using the template
2. **Propose** by creating a PR with the ADR
3. **Review** by team members (async or sync)
4. **Accept** or **Reject** based on feedback
5. **Merge** the accepted ADR
6. **Implement** the decision

### ADR Review Guidelines

Reviewers should evaluate:
- **Clarity:** Is the context and decision clearly explained?
- **Completeness:** Are all consequences considered?
- **Alternatives:** Are alternatives properly evaluated?
- **Consistency:** Does this conflict with existing ADRs?
- **Feasibility:** Can this be implemented as described?

### Deprecation Process

When an ADR is superseded:
1. Update the status to "Superseded"
2. Add a "Superseded by" section with link to new ADR
3. Update the "Superseded date" field
4. Implement the new ADR

### Annual Review Schedule

| Quarter | ADRs to Review |
|---------|----------------|
| Q1 (Jan) | ADRs 001-004 |
| Q2 (Apr) | ADRs 005-008 |
| Q3 (Jul) | ADRs 009-012 |
| Q4 (Oct) | ADRs 013-018 |

## Adding a New ADR

### Manual Method
```bash
cp docs/adr/TEMPLATE.md docs/adr/ADR-XXX-title.md
# Edit the file with your decision
```

### Automated Method (Recommended)
```bash
# Create new ADR with next available number
./scripts/create-adr.sh "Your Decision Title"

# Create ADR with specific number
./scripts/create-adr.sh "Your Decision Title" --id 018
```

See [TEMPLATE.md](TEMPLATE.md) for the standard format.

## CI/CD Integration

ADRs are validated in CI/CD:
- Format validation (required sections present)
- No conflicts with existing accepted ADRs
- Required metadata (status, date, author)

See `.github/workflows/ci.yml` for ADR validation rules.
