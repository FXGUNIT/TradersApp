# Security Architecture Documentation

**Version:** 1.0.0
**Last Updated:** 2026-04-06
**Owner:** Claude

## Overview

This document describes the zero-trust security architecture for the TradersApp platform.

## Security Principles

1. **Zero Trust Architecture**
   - Never trust, always verify
   - Every request must be authenticated and authorized
   - Network segmentation with explicit allow-listing

2. **Defense in Depth**
   - Multiple layers of security controls
   - Each layer can operate independently
   - Single point of failure does not compromise security

3. **Least Privilege**
   - Minimum permissions for all services
   - Service accounts with specific, limited access
   - Regular access reviews

4. **Secure by Default**
   - Secure configurations out of the box
   - No security features to opt-out
   - Automated security enforcement

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            INTERNET / EXTERNAL                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EDGE SECURITY LAYER                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Cloudflare WAF                                                       │   │
│  │  - Rate limiting                                                      │   │
│  │  - DDoS protection                                                    │   │
│  │  - Bot management                                                     │   │
│  │  - Custom rules for trading endpoints                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Cloudflare SSL/TLS                                                   │   │
│  │  - TLS 1.3 only                                                      │   │
│  │  - Certificate validation                                             │   │
│  │  - HSTS enabled (12 months)                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DMZ / PUBLIC SERVICES                              │
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐                      │
│  │   Frontend (nginx)   │    │   BFF (Node.js)     │                      │
│  │   Port 5173          │    │   Port 8788          │                      │
│  │                      │    │                      │                      │
│  │  Security Headers:   │    │  Keycloak OIDC       │                      │
│  │  - CSP              │    │  - Token validation  │                      │
│  │  - HSTS             │    │  - RBAC enforcement   │                      │
│  │  - X-Frame-Options  │    │  - Rate limiting     │                      │
│  │                      │    │  - Circuit breaker   │                      │
│  └──────────────────────┘    └──────────┬───────────┘                      │
│                                         │                                   │
└─────────────────────────────────────────┼───────────────────────────────────┘
                                          │ mTLS
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INTERNAL SERVICES (Zero Trust)                        │
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌────────────────┐│
│  │  ML Engine (Python) │    │  Redis (Cache)       │    │  PostgreSQL   ││
│  │  Port 8001          │    │  Port 6379           │    │  Port 5432    ││
│  │                      │    │                      │    │               ││
│  │  - Keycloak client  │    │  - mTLS              │    │  - mTLS       ││
│  │  - Feature validation│    │  - No external access│    │  - No external││
│  │  - Circuit breaker   │    │  - AUTH enabled      │    │  - AUTH on   ││
│  └──────────────────────┘    └──────────────────────┘    └────────────────┘│
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌────────────────┐│
│  │  MLflow (Python)     │    │  MinIO (S3)          │    │  Kafka        ││
│  │  Port 5000           │    │  Port 9000           │    │  Port 9092    ││
│  │                      │    │                      │    │               ││
│  │  - Keycloak auth    │    │  - mTLS              │    │  - SASL auth  ││
│  │  - Internal only    │    │  - Internal only     │    │  - ACLs enabled││
│  └──────────────────────┘    └──────────────────────┘    └────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IDENTITY & ACCESS LAYER                              │
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐                      │
│  │  Keycloak (SSO)      │    │  External Secrets    │                      │
│  │  Port 8080           │    │  Operator            │                      │
│  │                      │    │                      │                      │
│  │  - OIDC provider     │    │  - Infisical backend│                      │
│  │  - MFA for admins    │    │  - K8s secrets      │                      │
│  │  - LDAP federation   │    │  - Auto rotation    │                      │
│  │  - Session mgmt      │    │                      │                      │
│  └──────────────────────┘    └──────────────────────┘                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OBSERVABILITY & SECURITY                            │
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌────────────────┐│
│  │  Prometheus          │    │  Grafana             │    │  Falco        ││
│  │  (Metrics)           │    │  (Dashboards)       │    │  (Runtime)    ││
│  └──────────────────────┘    └──────────────────────┘    └────────────────┘│
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌────────────────┐│
│  │  Loki                │    │  Jaeger              │    │  Trivy        ││
│  │  (Logs)              │    │  (Traces)            │    │  (Vuln Scan)  ││
│  └──────────────────────┘    └──────────────────────┘    └────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Trust Boundaries

### Boundary 1: Internet to DMZ
- **Traffic:** HTTPS only (TLS 1.3)
- **Security:** WAF, DDoS protection, rate limiting
- **Authentication:** None at edge (handled by BFF)

### Boundary 2: DMZ to Internal Services
- **Traffic:** mTLS required
- **Security:** Network policies, service mesh
- **Authentication:** Keycloak client credentials

### Boundary 3: Internal Services to Data Stores
- **Traffic:** mTLS + AUTH
- **Security:** Network policies, Redis AUTH, PostgreSQL AUTH
- **Authentication:** Service credentials via Secrets Operator

### Boundary 4: User to BFF
- **Traffic:** HTTPS + OIDC JWT
- **Security:** CSP headers, X-Frame-Options
- **Authentication:** Keycloak OIDC with PKCE

## Authentication Flows

### User Authentication (Frontend → BFF)
```
1. User navigates to /login
2. Frontend redirects to Keycloak
3. Keycloak authenticates user (password + MFA for admins)
4. Keycloak returns authorization code
5. Frontend exchanges code for tokens (PKCE)
6. Frontend stores access token and refresh token
7. Frontend includes Bearer token in API requests
8. BFF validates token with Keycloak userinfo endpoint
9. BFF enforces RBAC based on token claims
```

### Service-to-Service Authentication (BFF → ML Engine)
```
1. BFF requests token from Keycloak using client credentials
2. Keycloak validates client_id and client_secret
3. Keycloak returns access token
4. BFF caches token (with TTL less than expiry)
5. BFF includes Bearer token in ML Engine requests
6. ML Engine validates token with Keycloak introspection
7. ML Engine enforces service-level permissions
```

### ML Engine to Database Authentication
```
1. ML Engine retrieves credentials from Kubernetes secrets
2. PostgreSQL validates certificate + password
3. mTLS provides mutual authentication
4. Connection encrypted with TLS
```

## Network Policies

### Default Deny All
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

### Service-Specific Policies

| Service | Ingress From | Egress To | Ports |
|---------|--------------|-----------|-------|
| Frontend | External | BFF | 443 |
| BFF | Frontend | ML Engine, Redis | 8001, 6379 |
| ML Engine | BFF | PostgreSQL, MinIO, Redis | 5432, 9000, 6379 |
| Keycloak | BFF, Admin VPN | PostgreSQL | 5432 |
| Redis | BFF, ML Engine | — | 6379 |
| PostgreSQL | ML Engine, Keycloak | — | 5432 |

## Security Controls Matrix

| Layer | Control | Implementation | Verification |
|-------|---------|----------------|--------------|
| Edge | WAF | Cloudflare | OWASP Top 10 blocked |
| Edge | DDoS | Cloudflare | Rate limit tested |
| Edge | TLS | TLS 1.3 | SSL Labs A+ |
| App | Auth | Keycloak OIDC | Token validation |
| App | AuthZ | RBAC | Permission tests |
| App | Rate Limit | BFF | Load test |
| App | Circuit Breaker | BFF/ML Engine | Chaos test |
| Container | Scanning | Trivy | CI/CD gate |
| Container | Signing | Cosign | Admission control |
| Container | Non-Root | Security context | PSP audit |
| Runtime | Detection | Falco | Threat simulation |
| Network | Segmentation | NetworkPolicy | Isolation test |
| Network | mTLS | Service mesh | Certificate validation |
| Data | Encryption | TLS + AUTH | Pen test |
| Secrets | Management | External Secrets | Rotation test |

## Compliance Mapping

| Requirement | Control | Evidence |
|-------------|---------|----------|
| Data encryption in transit | TLS 1.3, mTLS | NetworkPolicy, TLS config |
| Data encryption at rest | PostgreSQL, MinIO encryption | Storage config |
| Authentication | Keycloak OIDC | IdP logs, token validation |
| Authorization | RBAC, Service accounts | Permission matrix |
| Audit logging | Loki, Keycloak events | Log retention |
| Vulnerability scanning | Trivy CI/CD | Scan reports |
| Incident response | Falco, runbooks | Security runbook |
| Access control | NetworkPolicy, RBAC | Policy review |
| Secret management | External Secrets, Infisical | Secrets audit |

## Security Review Schedule

| Review | Frequency | Owner | Scope |
|--------|-----------|-------|-------|
| Access review | Quarterly | Claude | User accounts, service accounts |
| Policy review | Quarterly | Claude | NetworkPolicy, RBAC, OPA |
| Vulnerability scan | Weekly | CI/CD | Container images, dependencies |
| Penetration test | Annually | External | Full application |
| Compliance audit | Annually | External | All controls |
| Incident response drill | Semi-annual | Claude | Response procedures |

## Related Documents

- [SECURITY_RUNBOOK.md](SECURITY_RUNBOOK.md) - Incident response procedures
- [SECURITY_TRAINING.md](SECURITY_TRAINING.md) - Secure development training
- [ADR-015 Keycloak SSO](../adr/ADR-015-keycloak-sso.md) - Authentication architecture
- [ADR-017 Trivy Scanning](../adr/ADR-017-trivy-scanning.md) - Vulnerability scanning
- [k8s/base/network-policies.yaml](../k8s/base/network-policies.yaml) - Network segmentation
- [k8s/base/opa-policies.yaml](../k8s/base/opa-policies.yaml) - OPA policies
- [k8s/observability/falco/rules.yaml](../k8s/observability/falco/rules.yaml) - Runtime detection
