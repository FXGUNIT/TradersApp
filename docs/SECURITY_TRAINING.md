# Security Training Documentation

**Version:** 1.0.0
**Last Updated:** 2026-04-06
**Owner:** Claude

## Overview

This document provides security training for all developers and operators working on the TradersApp platform.

## Module 1: Secure Coding Practices

### 1.1 Input Validation

**Principle:** All external input must be validated before use.

```javascript
// BAD - No validation
const userId = req.params.userId;
const user = db.query(`SELECT * FROM users WHERE id = ${userId}`);

// GOOD - Parameterized query + validation
import { z } from 'zod';

const UserIdSchema = z.string().regex(/^[0-9]+$/);
const validated = UserIdSchema.parse(req.params.userId);
const user = db.query('SELECT * FROM users WHERE id = ?', [validated]);
```

**Rules:**
- Validate all user input with strict schemas
- Use allow-lists, not block-lists
- Sanitize HTML to prevent XSS
- Validate file paths to prevent traversal
- Type validation for API payloads (Zod/Pydantic)

### 1.2 Secrets Management

**Principle:** Never hardcode secrets in source code.

```bash
# BAD - Secrets in code
const API_KEY = "sk-1234567890abcdef";

// GOOD - Environment variables
const API_KEY = process.env.API_KEY;

// BEST - Secrets from vault
const { API_KEY } = await secretsManager.getSecret('api-key');
```

**Rules:**
- All secrets stored in Infisical
- Access via External Secrets Operator in Kubernetes
- Local development uses `infisical run`
- Never commit `.env` files
- Rotate secrets regularly (90 days)

### 1.3 SQL Injection Prevention

**Principle:** Never concatenate user input into SQL queries.

```python
# BAD - SQL injection vulnerability
query = f"SELECT * FROM trades WHERE symbol = '{symbol}'"
cursor.execute(query)

# GOOD - Parameterized query
query = "SELECT * FROM trades WHERE symbol = %s"
cursor.execute(query, (symbol,))
```

**Rules:**
- Use parameterized queries exclusively
- Use ORM when possible (SQLAlchemy, Prisma)
- Validate input types before query construction
- Implement least-privilege database users

### 1.4 Authentication & Authorization

**Principle:** Implement defense-in-depth for auth.

```javascript
// Authentication flow
async function authenticate(req, res, next) {
  // 1. Extract token
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  // 2. Validate with Keycloak
  try {
    const userInfo = await keycloak.grantManager.userInfo(token);
    req.user = {
      id: userInfo.sub,
      roles: userInfo.realm_access?.roles || [],
    };
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // 3. Check permissions
  if (!hasPermission(req.user, req.method, req.path)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}
```

**Rules:**
- Use Keycloak for all authentication
- Enforce RBAC at every endpoint
- Implement MFA for privileged accounts
- Session timeout: 30 minutes idle
- Token validation on every request

### 1.5 Cryptographic Practices

**Principle:** Use modern, tested cryptographic methods.

```javascript
// BAD - Weak cryptography
const hash = crypto.createHash('md5').update(password).digest('hex');

// GOOD - Strong password hashing
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash(password, 12);

// BAD - Weak random
const token = Math.random().toString(36);

// GOOD - Cryptographically secure
const token = crypto.randomBytes(32).toString('hex');
```

**Rules:**
- Use bcrypt (cost factor 12+) for password hashing
- Use crypto.randomBytes() for tokens
- TLS 1.3 for all external communication
- mTLS for service-to-service
- Rotate certificates before expiry

### 1.6 Error Handling

**Principle:** Don't expose internal details in errors.

```javascript
// BAD - Information disclosure
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message,
    stack: err.stack,  // Exposes internals!
    query: req.query,
  });
});

// GOOD - Safe error handling
app.use((err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    requestId: req.id,
  });

  res.status(err.status || 500).json({
    error: 'Internal server error',
    requestId: req.id,
  });
});
```

**Rules:**
- Never expose stack traces to users
- Log errors with correlation ID
- Return generic error messages
- Implement circuit breakers

## Module 2: Container Security

### 2.1 Image Security

**Principle:** Use minimal, secure base images.

```dockerfile
# BAD - Large base image
FROM python:3.11
RUN apt-get update && apt-get install -y git curl vim

# GOOD - Minimal, hardened image
FROM python:3.11-slim-bookworm
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*
```

**Rules:**
- Use `-slim` or `-alpine` variants
- Pin image versions (not `latest`)
- Scan images with Trivy before deployment
- Sign images with Cosign
- Remove unnecessary tools

### 2.2 Non-Root Containers

**Principle:** Never run containers as root.

```dockerfile
# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Switch to non-root
USER appuser

# Ensure application files are owned by non-root
COPY --chown=appuser:appgroup ./app /app
```

**Kubernetes security context:**
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
```

### 2.3 Secrets in Containers

**Principle:** Don't bake secrets into images.

```dockerfile
# BAD - Secret in image
ENV DATABASE_PASSWORD="supersecret"

# GOOD - Secrets from runtime
# Use Kubernetes secrets or vault
```

**Rules:**
- Use Kubernetes secrets, not ENV
- Mount secrets as files, not env vars
- Use read-only filesystem where possible
- Never commit secrets to git

### 2.4 Image Scanning

**Principle:** Scan every image before deployment.

```bash
# Scan with Trivy
trivy image --severity HIGH,CRITICAL ghcr.io/tradersapp/ml-engine:latest

# Generate SBOM
trivy image --format spdx-json ghcr.io/tradersapp/ml-engine:latest > sbom.json

# Sign image
cosign sign --key cosign.key ghcr.io/tradersapp/ml-engine:latest
```

**Rules:**
- Block CRITICAL vulnerabilities in CI/CD
- Review and approve HIGH vulnerabilities
- Maintain .trivyignore with justifications
- Generate SBOM for compliance

## Module 3: Kubernetes Security

### 3.1 Network Policies

**Principle:** Deny all, allow explicit.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-bff-to-ml-engine
spec:
  podSelector:
    matchLabels:
      app: ml-engine
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: bff
      ports:
        - port: 8001
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - port: 6379
```

**Rules:**
- Default deny all traffic
- Whitelist specific connections
- Block external access to databases
- Enable egress filtering

### 3.2 RBAC Configuration

**Principle:** Least privilege for service accounts.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ml-engine-role
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ml-engine-rolebinding
subjects:
  - kind: ServiceAccount
    name: ml-engine
roleRef:
  kind: Role
  name: ml-engine-role
```

**Rules:**
- Use RBAC for all access
- Audit RBAC configurations quarterly
- Remove unused service accounts
- Use role, not clusterrole, where possible

### 3.3 Pod Security

**Principle:** Run with minimal privileges.

```yaml
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containers:
    - name: app
      image: app:latest
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
          add:
            - NET_BIND_SERVICE
      resources:
        limits:
          memory: "256Mi"
          cpu: "500m"
```

**Rules:**
- Enable Pod Security Standards
- Use OPA Gatekeeper policies
- Define resource limits
- Enable read-only root filesystem

## Module 4: Dependency Management

### 4.1 Python Dependencies

**Principle:** Keep dependencies up-to-date and minimal.

```python
# requirements.txt - Pin all versions
flask==2.3.3
requests==2.31.0
numpy==1.24.3
pandas==2.0.3

# Use pip-tools for dependency resolution
pip-compile requirements.in
```

**Rules:**
- Pin all dependency versions
- Review dependencies before adding
- Use pip-audit for vulnerability scanning
- Remove unused dependencies
- Update dependencies monthly

### 4.2 Node.js Dependencies

**Principle:** Audit and minimize npm packages.

```json
{
  "dependencies": {
    "express": "4.18.2",
    "axios": "1.6.0"
  },
  "scripts": {
    "audit": "npm audit --audit-level=high",
    "outdated": "npm outdated"
  }
}
```

**Rules:**
- Run `npm audit` in CI/CD
- Use `npm ci` for reproducible installs
- Review package permissions
- Remove unused packages

## Module 5: Security Incident Recognition

### 5.1 Common Attack Vectors

| Attack | Signs | Response |
|--------|-------|----------|
| SQL Injection | Unusual SQL in logs, error messages | Block IP, patch input validation |
| XSS | Unexpected JS in forms | CSP headers, sanitize input |
| CSRF | Suspicious POST requests | CSRF tokens |
| DDoS | High traffic from single source | Rate limiting, WAF |
| Credential stuffing | Many failed logins | MFA, IP blocking |
| Supply chain | Malicious package | Pin versions, scan images |

### 5.2 What to Report

**Immediately report:**
- Suspicious login attempts
- Unknown processes in containers
- Unexpected network traffic
- File modifications outside deployment
- Error messages revealing internal paths
- Unfamiliar accounts or SSH keys

### 5.3 How to Report

```bash
# Slack: #security-incidents
# Email: security@tradersapp.com
# Emergency: Use PagerDuty

# Include:
# - What you observed
# - When you observed it
# - Which system/container
# - Any logs or screenshots
```

## Module 6: Compliance Requirements

### 6.1 Data Protection

| Requirement | Implementation |
|-------------|----------------|
| Encryption at rest | PostgreSQL encryption, MinIO encryption |
| Encryption in transit | TLS 1.3, mTLS |
| Access logging | Loki + Keycloak audit |
| Data retention | Defined in data retention policy |
| Data deletion | Secure wipe procedures |

### 6.2 Access Control

| Requirement | Implementation |
|-------------|----------------|
| Unique accounts | Keycloak user accounts |
| MFA for privileged | Keycloak OTP for admins |
| Session timeout | 30 min idle, 8 hr max |
| Access review | Quarterly RBAC audit |
| Least privilege | RBAC + network policies |

### 6.3 Vulnerability Management

| Requirement | Implementation |
|-------------|----------------|
| Regular scanning | Trivy CI/CD, weekly runtime |
| Patch management | Critical: 48 hrs, High: 7 days |
| Risk acceptance | .trivyignore with justification |
| SBOM | Generated for all images |

## Certification

All team members must:
1. Complete this training annually
2. Pass the security quiz (80%+)
3. Sign the security acknowledgment
4. Report any security incidents

## Related Documents

- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) - Architecture details
- [SECURITY_RUNBOOK.md](SECURITY_RUNBOOK.md) - Incident response
- [ADR-015 Keycloak](../adr/ADR-015-keycloak-sso.md) - Authentication
- [ADR-017 Trivy](../adr/ADR-017-trivy-scanning.md) - Vulnerability scanning
- [k8s/base/opa-policies.yaml](../k8s/base/opa-policies.yaml) - Policy enforcement
