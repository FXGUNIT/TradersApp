# ADR Decision Register

This register provides a business-level summary of all Architecture Decision Records for stakeholder reference.

## Summary Table

| ID | Title | Business Impact | Effort | Risk | Priority |
|----|-------|----------------|--------|------|----------|
| ADR-001 | DVC for Data Versioning | Reproducibility, Compliance | Medium | Low | High |
| ADR-002 | Redis Cache with In-Memory LRU Fallback | Performance, Reliability | Low | Low | High |
| ADR-003 | Circuit Breaker Pattern | System Resilience | Medium | Low | Critical |
| ADR-004 | MLflow Self-Hosted | MLOps Maturity | High | Medium | High |
| ADR-005 | Apache Kafka for Event Streaming | Scalability, Real-time | Very High | High | Medium |
| ADR-006 | k3s for Container Orchestration | Infrastructure Flexibility | Very High | Medium | High |
| ADR-007 | Feast Feature Store | ML Consistency | High | Medium | Medium |
| ADR-008 | Triton + vLLM for Inference | ML Performance | Very High | High | High |
| ADR-009 | Infisical for Secrets Management | Security, Compliance | Medium | Low | Critical |
| ADR-010 | BFF Pattern | Frontend Reliability | Medium | Low | High |
| ADR-011 | Physics-Based Regime Detection | ML Accuracy | High | Medium | High |
| ADR-012 | EWC + Replay Buffer | ML Adaptability | Very High | High | Medium |
| ADR-013 | Multi-Level Testing Strategy | Quality, Confidence | High | Medium | High |
| ADR-014 | Observability Stack | Operability, Debugging | High | Low | High |
| ADR-015 | Keycloak for Zero-Trust SSO | Security, Compliance | Very High | High | Critical |
| ADR-016 | Unified Drift Detection | ML Reliability | Medium | Low | High |
| ADR-017 | Trivy for Container Scanning | Security, Compliance | Medium | Low | Critical |
| ADR-018 | DDD Bounded Contexts with gRPC | Service Boundaries, Latency | High | Medium | High |

## Priority Matrix

| Priority | ADRs |
|----------|------|
| **Critical** | ADR-003, ADR-009, ADR-015, ADR-017 |
| **High** | ADR-001, ADR-002, ADR-004, ADR-006, ADR-010, ADR-011, ADR-013, ADR-014, ADR-016, ADR-018 |
| **Medium** | ADR-005, ADR-007, ADR-008, ADR-012 |

## Risk Assessment

| Risk Level | ADRs | Mitigation |
|------------|------|------------|
| **Very High Effort** | ADR-005, ADR-006, ADR-008, ADR-012, ADR-015 | Phase implementation, prioritize incrementally |
| **High Complexity** | ADR-005, ADR-008, ADR-012, ADR-015, ADR-017 | Use managed services where possible |
| **Compliance Related** | ADR-001, ADR-009, ADR-015, ADR-017 | Prioritize for regulatory requirements |

## Status Summary

- **Total ADRs:** 18
- **Accepted:** 18
- **Proposed:** 0
- **Deprecated:** 0
- **Superseded:** 0

## Next Review Dates

| ADR | Review Date | Reviewer |
|-----|-------------|----------|
| ADR-001 | 2027-04-02 | Claude |
| ADR-002 | 2027-04-02 | Claude |
| ADR-003 | 2027-04-02 | Claude |
| ADR-004 | 2027-04-03 | Claude |
| ADR-005 | 2027-04-06 | Claude |
| ADR-006 | 2027-04-06 | Claude |
| ADR-007 | 2027-04-06 | Claude |
| ADR-008 | 2027-04-06 | Claude |
| ADR-009 | 2027-04-02 | Claude |
| ADR-010 | 2027-04-02 | Claude |
| ADR-011 | 2027-04-02 | Claude |
| ADR-012 | 2027-04-06 | Claude |
| ADR-013 | 2027-04-06 | Claude |
| ADR-014 | 2027-04-06 | Claude |
| ADR-015 | 2027-04-06 | Claude |
| ADR-016 | 2027-04-03 | Claude |
| ADR-017 | 2027-04-06 | Claude |
| ADR-018 | 2027-04-06 | Claude |

## Implementation Status

| ADR | Implementation | Notes |
|-----|----------------|-------|
| ADR-001 | ✅ Complete | DVC configured for ml-engine/data |
| ADR-002 | ✅ Complete | Redis caching in BFF with LRU fallback |
| ADR-003 | ✅ Complete | Circuit breakers in BFF and ML Engine |
| ADR-004 | ✅ Complete | MLflow self-hosted via Docker Compose |
| ADR-005 | 🔄 In Progress | Kafka not yet deployed |
| ADR-006 | ✅ Complete | k3s cluster configured |
| ADR-007 | 🔄 In Progress | Feast not yet deployed |
| ADR-008 | ✅ Complete | Triton and vLLM Dockerfiles exist |
| ADR-009 | ✅ Complete | Infisical integrated in CI/CD |
| ADR-010 | ✅ Complete | BFF deployed and operational |
| ADR-011 | ✅ Complete | Physics models implemented |
| ADR-012 | 🔄 Partial | EWC implemented, replay buffer planned |
| ADR-013 | 🔄 Partial | Unit tests exist, chaos engineering partial |
| ADR-014 | ✅ Complete | Observability stack deployed |
| ADR-015 | 🔄 Partial | Keycloak deployed, not integrated with BFF |
| ADR-016 | ✅ Complete | Drift detection implemented |
| ADR-017 | 🔄 Partial | Trivy in CI/CD, runtime scanning planned |
| ADR-018 | ✅ Complete | DDD contexts defined, analysis-service gRPC seam live |

## Dependencies

Critical path for system functionality:

```
ADR-006 (k3s)
  ├── ADR-014 (Observability) ✅
  ├── ADR-015 (Keycloak) 🔄
  ├── ADR-017 (Trivy) 🔄
  └── ADR-018 (DDD + gRPC) ✅

ADR-004 (MLflow)
  ├── ADR-012 (Continual Learning) 🔄
  └── ADR-016 (Drift Detection) ✅

ADR-007 (Feast)
  └── ADR-008 (Triton/vLLM) ✅
```

## Notes for Stakeholders

1. **Security ADRs (ADR-009, ADR-015, ADR-017)** are critical for compliance and should be prioritized
2. **ML ADRs (ADR-011, ADR-012, ADR-016)** are core to the trading intelligence system
3. **Infrastructure ADRs (ADR-005, ADR-006, ADR-007)** enable scalability but require significant effort
4. All ADRs should be reviewed annually to ensure they remain current

---

*Last Updated: 2026-04-06 | ADR-018 added (DDD Bounded Contexts with gRPC)*
*Maintained by: Claude*
