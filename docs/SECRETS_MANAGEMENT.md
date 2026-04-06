# Secrets Management Architecture

**Version:** 1.0.0
**Last Updated:** 2026-04-06

## Overview

This document describes the secrets management architecture for the TradersApp platform, including mTLS certificate management, secret rotation, and integration with Infisical.

## Secrets Management Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SECRETS MANAGEMENT FLOW                           │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                │
│  │  Infisical   │───▶│   External   │───▶│ Kubernetes   │                │
│  │  Dashboard   │    │   Secrets    │    │   Secrets    │                │
│  │  (Source)    │    │   Operator   │    │   Store      │                │
│  └──────────────┘    └──────────────┘    └──────────────┘                │
│         │                   │                   │                           │
│         │                   │                   ▼                           │
│         │                   │           ┌──────────────┐                  │
│         │                   │           │   Services   │                  │
│         │                   │           │   Consume    │                  │
│         │                   │           └──────────────┘                  │
│         │                   │                                              │
│         ▼                   ▼                                              │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │  Auto-Rotation (90-day schedule)                      │                  │
│  └──────────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Secret Types

### 1. Application Secrets
| Secret | Source | Purpose | Rotation |
|--------|--------|---------|---------|
| Database passwords | Infisical | PostgreSQL auth | 90 days |
| API keys (OpenAI, Anthropic) | Infisical | ML Engine providers | 180 days |
| JWT secret | Infisical | Session tokens | 90 days |
| Support service key | Infisical | Telegram bridge | 90 days |

### 2. Keycloak Secrets
| Secret | Source | Purpose | Rotation |
|--------|--------|---------|---------|
| Admin password | Infisical | Keycloak admin console | 30 days |
| Client secrets | Infisical | Service-to-service auth | 90 days |
| Database password | Infisical | Keycloak PostgreSQL | 90 days |

### 3. mTLS Certificates
| Certificate | Source | Rotation | Storage |
|------------|--------|----------|---------|
| CA Certificate | Generated | 365 days | Kubernetes secret |
| BFF Client Certificate | Generated | 90 days | Kubernetes secret |
| ML Engine Certificate | Generated | 90 days | Kubernetes secret |
| Service mesh certificates | cert-manager | 90 days | cert-manager |

## Certificate Generation

### Step 1: Generate CA
```bash
# Create CA private key
openssl genrsa -out ca.key 4096

# Create CA certificate (valid for 1 year)
openssl req -x509 -new -nodes -key ca.key -sha256 -days 365 \
  -out ca.crt \
  -subj "/CN=TradersApp CA/O=TradersApp/L=London"

# Store in Infisical
infisical secrets set --key=certificates/ca/cert --value="$(cat ca.crt)"
infisical secrets set --key=certificates/ca/key --value="$(cat ca.key)"
```

### Step 2: Generate Service Certificates
```bash
# Generate BFF certificate
openssl genrsa -out bff.key 2048

# Create CSR
openssl req -new -key bff.key -out bff.csr \
  -subj "/CN=bff.tradersapp/O=TradersApp/OU=Services"

# Sign with CA
openssl x509 -req -in bff.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out bff.crt -days 90 -sha256

# Store in Infisical
infisical secrets set --key=certificates/bff/cert --value="$(cat bff.crt)"
infisical secrets set --key=certificates/bff/key --value="$(cat bff.key)"
```

### Step 3: Deploy Certificates
```bash
# Certificates are automatically synced via External Secrets Operator
kubectl get secrets -n tradersapp | grep -E "mtls|bff|ml-engine"
```

## mTLS Configuration

### BFF → ML Engine
```yaml
# BFF service (outgoing)
env:
  - name: MTLS_ENABLED
    value: "true"
  - name: MTLS_CA_CERT
    valueFrom:
      secretKeyRef:
        name: mtls-certificates
        key: CA_CERT
  - name: MTLS_CLIENT_CERT
    valueFrom:
      secretKeyRef:
        name: mtls-certificates
        key: BFF_CERT
  - name: MTLS_CLIENT_KEY
    valueFrom:
      secretKeyRef:
        name: mtls-certificates
        key: BFF_KEY
```

### ML Engine (incoming)
```yaml
# ML Engine service (incoming)
tls:
  enabled: true
  certSecret:
    name: mtls-certificates
    certKey: ML_ENGINE_CERT
  keySecret:
    name: mtls-certificates
    keyKey: ML_ENGINE_KEY
  caSecret:
    name: mtls-certificates
    caKey: CA_CERT
```

## Secret Rotation

### Manual Rotation
```bash
# Rotate a secret in Infisical
infisical secrets set --key=ml-engine/api-keys/openai --value="sk-new-key-value"

# Restart affected services
kubectl rollout restart deployment/ml-engine -n tradersapp
```

### Automatic Rotation (cert-manager)
```yaml
# cert-manager ClusterIssuer for mTLS
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: tradersapp-ca
spec:
  ca:
    secretName: mtls-certificates
---
# Certificate with auto-renewal
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: bff-mtls
  namespace: tradersapp
spec:
  secretName: bff-mtls-cert
  issuerRef:
    name: tradersapp-ca
    kind: ClusterIssuer
  commonName: bff.tradersapp
  secretTemplate:
    annotations:
      cert-manager.io/keystore-creator: "tradersapp"
  renewBefore: 15d
  duration: 90d
```

## Emergency Procedures

### Secret Exposure
If a secret is exposed:
1. Immediately rotate in Infisical
2. Force restart of affected services
3. Check logs for unauthorized usage
4. Notify security team if credentials were used

### Keycloak Compromise
If Keycloak is compromised:
1. Disable all Keycloak clients immediately
2. Rotate all Keycloak secrets
3. Regenerate all client credentials
4. Review Keycloak audit logs
5. Consider full Keycloak reset

### Certificate Expiry
Monitor certificate expiry with alerts:
```
Alert: Certificate expires in 30 days
Alert: Certificate expires in 7 days
Alert: Certificate expired
```

## Integration Scripts

### secrets-rotate.sh
```bash
#!/bin/bash
# Rotate secrets and restart affected services

SECRET_KEY="$1"
NEW_VALUE="$2"
NAMESPACE="${3:-tradersapp}"

if [ -z "$SECRET_KEY" ] || [ -z "$NEW_VALUE" ]; then
    echo "Usage: $0 <secret-key> <new-value> [namespace]"
    exit 1
fi

# Update in Infisical
infisical secrets set --key="$SECRET_KEY" --value="$NEW_VALUE"

# Update Kubernetes secret
kubectl create secret generic temp-secret \
    --from-literal=value="$NEW_VALUE" \
    --dry-run=client -o yaml | \
    kubectl apply -f -

# Restart deployments using this secret
kubectl rollout restart deployment/ml-engine -n "$NAMESPACE"

echo "Secret rotated and services restarted"
```

## Related Documents

- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) - Security architecture
- [SECURITY_RUNBOOK.md](SECURITY_RUNBOOK.md) - Incident response
- [ADR-009 Infisical](../adr/ADR-009-secrets-infisical.md) - Secrets management ADR
