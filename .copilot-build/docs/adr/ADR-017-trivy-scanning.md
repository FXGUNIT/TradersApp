# ADR-017: Trivy for Container Vulnerability Scanning

**ADR ID:** ADR-017
**Title:** Trivy for Container Vulnerability Scanning
**Status:** Accepted
**Date:** 2026-04-06
**Author:** Claude

## Context

The TradersApp system runs multiple containers in production:
- **ML Engine** (Python) — TensorFlow, LightGBM, pandas, numpy, FastAPI
- **BFF** (Node.js) — Express, axios, Redis client
- **Frontend** (Node.js + nginx) — React, axios
- **Telegram Bridge** (Node.js) — Telegram Bot API, Express
- **Supporting services** — Redis, PostgreSQL, MLflow, MinIO, Kafka, Prometheus, Grafana

Container security is critical because:
- **Supply chain attacks** — Compromised base images or dependencies
- **Zero-day vulnerabilities** — New CVEs discovered in popular packages
- **Compliance requirements** — Vulnerability scanning required for regulated domains
- **Multi-tenant risk** — ML Engine processes sensitive trading data

Without vulnerability scanning:
- Vulnerable containers may run in production
- CVEs in Python/Node.js dependencies go undetected
- No automated alerts for critical vulnerabilities
- Compliance violations

## Decision

We will use **Trivy** (by Aqua Security) for container vulnerability scanning.

### Trivy Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Trivy Scanning Pipeline                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────┐ │
│  │    CI/CD      │────▶│    Trivy     │────▶│   Results  │ │
│  │   Pipeline    │     │    Scan      │     │  (JSON/SARIF)│ │
│  └──────────────┘     └──────────────┘     └──────┬─────┘ │
│         │                      │                    │       │
│         │                      ▼                    ▼       │
│         │              ┌──────────────┐     ┌────────────┐ │
│         │              │   Trivy DB   │     │   GitHub   │ │
│         │              │   (cached)   │     │   Checks   │ │
│         │              └──────────────┘     └────────────┘ │
│         │                                         │         │
│         └─────────────────────────────────────────┘         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Scan Configuration

#### CI/CD Integration (.github/workflows/ci.yml)

```yaml
name: Container Scan

on:
  push:
    branches: [main, staging]
    paths:
      - '**.Dockerfile'
      - '**/requirements.txt'
      - '**/package.json'

jobs:
  trivy-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build image
        run: |
          docker build -t ${{ env.IMAGE_NAME }}:${{ github.sha }} .

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'  # Fail on CRITICAL/HIGH
          cache-dir: '/tmp/trivy-cache'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Run Trivy filesystem scanner
        run: |
          trivy fs --severity CRITICAL,HIGH,MEDIUM .

      - name: Generate SBOM
        run: |
          trivy image --format spdx --output sbom.spdx.json \
            ${{ env.IMAGE_NAME }}:${{ github.sha }}
```

#### Trivy Configuration (.trivy.yaml)

```yaml
format: table
quiet: false
severity: UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL
security-checks:
  - vuln
  - config
  - secret
vuln-type:
  - os
  - library

# Ignore specific vulnerabilities with justification
ignorefile: .trivyignore

# Database settings
db:
  repository: public.ecr.aws/aquasecurity/trivy-db:latest
  cache-dir: /tmp/trivy-cache

# Scan settings
scan:
  scanners:
    - vuln
    - misconf
    - secret
  timeout: 10m

# Exit code settings
exit-code: 0
limit-cves: 100

# Cache settings
cache:
  backend: fs
  ttl: 24h
```

#### Trivy Ignore File (.trivyignore)

```
# Format: CVE-ID | Package | Justification
# Updated: 2026-04-06

# Python packages with known issues but no fix available
CVE-2024-xxxxx | urllib3 | Fixed in next release, upgrading breaks compatibility
CVE-2024-yyyyy | requests | Running behind authenticated proxy provides mitigation

# OS packages required for ML workload (no alternative)
CVE-2023-zzzzz | libssl1.1 | Required by TensorFlow binary wheels, upgrading breaks GPU support

# False positives
CVE-2024-falsepositive | busybox | Container doesn't run as root, no exploitation possible
```

### Scan Triggers

| Trigger | Scan Type | Block on Failure |
|---------|-----------|------------------|
| Push to main/staging | Full image scan | CRITICAL, HIGH |
| Dockerfile changed | Full image scan | CRITICAL, HIGH |
| requirements.txt changed | Dependency scan | CRITICAL |
| package.json changed | Dependency scan | CRITICAL |
| Daily at 2 AM | Runtime scan (K8s) | CRITICAL |
| Manual trigger | Full + SBOM | CRITICAL |

### Vulnerability Severity Thresholds

| Severity | Action | CI/CD Behavior |
|----------|--------|---------------|
| CRITICAL | Immediate block | Fail build |
| HIGH | Immediate block | Fail build |
| MEDIUM | Warning | Warn, allow |
| LOW | Informational | Log only |
| UNKNOWN | Investigate | Warn |

### SBOM Generation

```yaml
# Generate SPDX SBOM for every image
trivy image \
  --format spdx-json \
  --output image.spdx.json \
  tradersapp-ml-engine:latest

# Verify SBOM against image
syft packages ghcr.io/tradersapp/ml-engine:latest -o spdx-json > packages.spdx.json
```

### Kubernetes Runtime Scanning

```yaml
# Trivy Operator deployment
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: trivy-operator
  namespace: trivy-system
spec:
  source:
    repoURL: https://aquasecurity.github.io/trivy-operator
    targetRevision: 0.15.0
  destination:
    server: https://kubernetes.default.svc
    namespace: trivy-system
```

```yaml
# VulnerabilityReport for ML Engine
apiVersion: aquasecurity.github.io/v1alpha1
kind: VulnerabilityReport
metadata:
  name: ml-engine
  namespace: tradersapp
spec:
  report:
    scanner:
      name: Trivy
      vendor: Aqua Security
    summary:
      criticalCount: 0
      highCount: 2
      mediumCount: 5
      lowCount: 12
    scanCompletedAt: "2026-04-06T10:00:00Z"
    vulnerabilities:
      - vulnID: CVE-2024-1234
        severity: HIGH
        package: requests
        fixedVersion: "2.31.1"
        title: Remote code execution in requests
```

## Consequences

### Positive
- **Comprehensive scanning:** OS packages and language dependencies
- **CI/CD integration:** Automated blocking of vulnerable images
- **SBOM generation:** Software bill of materials for compliance
- **Low resource usage:** Efficient scanning, ~2 min per image
- **Free and open source:** No licensing costs
- **Regular updates:** Trivy DB updated hourly with new CVEs

### Negative
- **False positives:** Some CVEs may not apply to our use case
- **Database size:** Trivy DB grows, requires caching
- **Scan time:** Full image scan adds ~2 min to CI/CD
- **Maintenance:** .trivyignore requires ongoing curation

### Neutral
- Scan results require interpretation (not all CVEs are exploitable)
- Database requires network access (or self-hosted mirror)
- Works best with fresh base images

## Alternatives Considered

### Clair (Red Hat)
- Pros: CNCF project, integrated with Quay
- Cons: Slower scans, less accurate for language packages
- **Rejected** because Trivy is faster and more accurate for our stack

### Anchore Grype
- Pros: Similar to Trivy, good accuracy
- Cons: Less mature ecosystem, fewer integrations
- **Rejected** because Trivy has better GitHub Actions integration

### Snyk Container
- Pros: Excellent UI, strong enterprise features
- Cons: Expensive, requires Snyk account
- **Rejected** because of cost and vendor dependency

### No scanning
- Pros: Simpler pipeline
- Cons: Vulnerabilities go undetected, compliance risk
- **Rejected** because container security is critical for production

## References

- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [Trivy GitHub Action](https://github.com/aquasecurity/trivy-action)
- [SBOM with Trivy](https://aquasecurity.github.io/trivy/latest/docs/supply-chain/sbom/)
- Related ADRs: [ADR-015 Keycloak](ADR-015-keycloak-sso.md) (scans Keycloak images), [ADR-006 k3s](ADR-006-k3s-choice.md) (K8s runtime scanning)
