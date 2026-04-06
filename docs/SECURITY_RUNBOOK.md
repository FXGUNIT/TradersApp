# Security Incident Response Runbook

**Version:** 1.0.0
**Last Updated:** 2026-04-06
**Owner:** Claude

## Incident Classification

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P1 - Critical** | Active breach, data exfiltration | 15 minutes | Confirmed intrusion, ransomware |
| **P2 - High** | Vulnerability exploited, potential breach | 1 hour | Successful exploit, privilege escalation |
| **P3 - Medium** | Vulnerability detected, not exploited | 4 hours | Critical CVE in dependency |
| **P4 - Low** | Security anomaly, no immediate threat | 24 hours | Suspicious login, failed attempts |

## Incident Response Team

| Role | Responsibility | Contact |
|------|----------------|---------|
| Incident Commander | Overall coordination | Claude |
| Security Lead | Technical investigation | Claude |
| Engineering Lead | System remediation | Claude |
| Communications | Stakeholder updates | Claude |

## Response Procedures

### P1 - Critical Incident Response

#### 1. Immediate Actions (First 15 minutes)

```
IMMEDIATE ACTIONS:
□ Activate incident response channel (#security-incidents)
□ Isolate affected systems:
  - kubectl label namespace <affected> isolation=quarantine
  - kubectl scale deployment <affected> --replicas=0
□ Preserve evidence:
  - kubectl cp <pod>:/var/log /tmp/evidence/<pod>-logs
  - Export Falco alerts: kubectl logs -n falco --tail=1000
  - Export network logs: kubectl get events --all-namespaces
□ Notify stakeholders: PagerDuty, Slack #incidents
```

#### 2. Investigation (15-60 minutes)

```
INVESTIGATION STEPS:
□ Identify scope:
  - kubectl get events --all-namespaces | grep <timestamp>
  - Review Keycloak audit logs
  - Review application logs (Loki)
  - Review network traffic (Jaeger traces)

□ Determine entry point:
  - kubectl exec -it <compromised-pod> -- /bin/sh
  - Check for: unauthorized SSH keys, malicious processes
  - Review container image: trivy image <image>

□ Assess data exposure:
  - List PVCs: kubectl get pvc --all-namespaces
  - Check secrets: kubectl get secrets --all-namespaces
  - Review database access logs

□ Contain threat:
  - Scale to zero: kubectl scale deployment <app> --replicas=0
  - Block IP: kubectl get services, identify external IPs
  - Revoke tokens: Keycloak admin console → Sessions → Logout all
```

#### 3. Eradication (1-4 hours)

```
ERADICATION STEPS:
□ Remove malicious artifacts:
  - Delete compromised pods: kubectl delete pods --field-selector=status.phase!=Running
  - Remove malicious images: docker rmi <hash>

□ Patch vulnerabilities:
  - Update container image with security patches
  - Run Trivy scan: ./scripts/trivy-scan.sh --image <new-image>
  - Push patched images: docker push <registry>/<image>

□ Rotate credentials:
  - Rotate all service account tokens
  - Rotate database passwords (Keycloak, PostgreSQL)
  - Rotate API keys (Infisical dashboard)

□ Redeploy:
  - kubectl apply -f deployment.yaml
  - Monitor for re-infection
```

#### 4. Recovery (4-24 hours)

```
RECOVERY STEPS:
□ Restore services:
  - Scale up gradually: kubectl scale deployment <app> --replicas=1
  - Monitor error rates: Grafana dashboard
  - Verify functionality: smoke tests

□ Restore data (if needed):
  - Restore from backup: see backup runbook
  - Verify data integrity: checksum validation

□ Restore access:
  - Enable user logins: Keycloak admin
  - Notify users: password reset may be required

□ Monitoring:
  - Enable enhanced logging
  - Alert on any unusual activity
```

#### 5. Post-Incident (24-72 hours)

```
POST-INCIDENT STEPS:
□ Document incident:
  - Create incident report (see template)
  - Include timeline, root cause, impact
  - Document lessons learned

□ Implement fixes:
  - Update OPA policies if needed
  - Add new Falco rules
  - Update network policies
  - Update Trivy ignore file (with justification)

□ Notify stakeholders:
  - Security team summary
  - User notification (if data exposure)
  - Compliance notification (if required)

□ Review and improve:
  - Update runbook based on lessons
  - Schedule follow-up security review
```

---

## Specific Incident Playbooks

### INC-001: Container Vulnerability Detected

**Trigger:** Trivy scan finds CRITICAL vulnerability

**Response:**

```bash
# 1. Identify affected images
trivy image --severity CRITICAL --format json <image> > vuln-report.json

# 2. Check if vulnerability is exploitable
# Look for: RCE, privilege escalation, remote access

# 3. If exploitable:
kubectl scale deployment <affected-app> --replicas=0

# 4. Update base image
docker pull <new-base-image>
docker build -t <registry>/<image>:<new-tag> .

# 5. Scan updated image
./scripts/trivy-scan.sh --image <registry>/<image>:<new-tag>

# 6. If clean, deploy
kubectl set image deployment/<affected-app> <container>=<registry>/<image>:<new-tag>

# 7. Monitor
kubectl get pods -n <namespace> -w
```

**Prevention:** Enable Trivy runtime scanning with admission controller

---

### INC-002: Keycloak Compromise

**Trigger:** Unauthorized access to Keycloak, suspicious admin activity

**Response:**

```bash
# 1. Immediate isolation
kubectl scale deployment keycloak --replicas=0 -n keycloak

# 2. Disable all active sessions
# Keycloak Admin Console → Sessions → Logout all users

# 3. Rotate admin credentials
# Keycloak Admin Console → Users → Reset password

# 4. Check audit logs
kubectl exec -it keycloak-0 -n keycloak -- \
  cat /opt/keycloak/data/audit.log

# 5. Review authorized applications
# Keycloak Admin Console → Clients

# 6. Redeploy Keycloak with new configuration
kubectl apply -f keycloak-deployment.yaml

# 7. Force re-authentication
# Keycloak Admin Console → Realm Settings → Tokens
# Set "Access Token Lifespan" to 5 minutes
```

**Prevention:** Enable MFA, review login attempts regularly

---

### INC-003: Secret Exposed

**Trigger:** Secret committed to git, leaked API key, exposed credential

**Response:**

```bash
# 1. Identify the exposed secret
git log --all --full-history -S "<secret-pattern>"

# 2. Rotate the secret immediately
# For API keys: Rotate in provider dashboard
# For passwords: Update in Infisical

# 3. Update Kubernetes secrets
kubectl create secret generic <secret-name> \
  --from-literal=key=<new-value> \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Update services
kubectl rollout restart deployment/<affected-app> -n <namespace>

# 5. Remove from git history (if committed)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch <file>" \
  --prune-empty --tag-name-filter cat -- --all

# 6. Notify if secret is sensitive (API keys, tokens)
# Send security notice to affected parties
```

**Prevention:** Enable pre-commit secrets scanning, use .gitignore

---

### INC-004: Certificate Expiry

**Trigger:** Certificate expiration alert, TLS handshake failures

**Response:**

```bash
# 1. Check certificate status
echo | openssl s_client -connect <host>:<port> 2>/dev/null | \
  openssl x509 -noout -dates

# 2. For Kubernetes certificates (Istio/mTLS):
# Check expiry
kubectl get pods -n istio-system

# Rotate Istio certificates
kubectl get secret -n istio-system -o name | \
  grep istio | xargs kubectl delete -n istio-system

# Restart Istiod
kubectl rollout restart deployment/istiod -n istio-system

# 3. For application certificates:
# Update certificate in Kubernetes secret
kubectl create secret tls <secret-name> \
  --cert=<new-cert.pem> \
  --key=<new-key.pem> \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Verify
echo | openssl s_client -connect <host>:<port> 2>/dev/null | \
  openssl x509 -noout -dates
```

**Prevention:** Set up certificate expiry alerts (90, 30, 7 days)

---

### INC-005: Falco Alert Triggered

**Trigger:** Falco runtime alert (reverse shell, privilege escalation)

**Response:**

```bash
# 1. Get alert details
kubectl logs -n falco <falco-pod> | grep "<alert-type>"

# 2. Identify affected pod
kubectl get pods -o wide | grep <pod-name>

# 3. Capture evidence
kubectl exec -it <affected-pod> -- /bin/sh
# Run: ps aux, netstat -tlnp, cat /proc/*/cmdline

# 4. Isolate pod
kubectl label pod <affected-pod> isolation=quarantine --overwrite

# 5. Kill malicious processes (if identified)
kubectl exec <affected-pod> -- kill -9 <pid>

# 6. If container is compromised, delete and redeploy
kubectl delete pod <affected-pod> --grace-period=0
kubectl scale deployment <affected-app> --replicas=0

# 7. Rebuild from clean image
kubectl scale deployment <affected-app> --replicas=<original-count>
```

**Prevention:** Keep Falco rules updated, review alerts regularly

---

### INC-006: Network Policy Violation

**Trigger:** Unexpected network traffic, cross-namespace communication

**Response:**

```bash
# 1. Identify the traffic
kubectl logs -n kube-system <calico-pod>

# 2. Check current network policies
kubectl get networkpolicy --all-namespaces

# 3. Block communication immediately
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-<source>-<dest>
  namespace: <dest-namespace>
spec:
  podSelector:
    matchLabels:
      app: <dest-app>
  policyTypes:
  - Ingress
  - Egress
EOF

# 4. Investigate source
kubectl describe pod <source-pod>
kubectl logs <source-pod>

# 5. Update policy to legitimate only
# Allow specific ports and destinations
```

**Prevention:** Review network policies monthly, enable audit logging

---

## Incident Report Template

```markdown
# Security Incident Report

**Incident ID:** INC-XXXX
**Date:** YYYY-MM-DD
**Severity:** P1/P2/P3/P4
**Status:** Open/In Progress/Resolved

## Summary
[Brief description of incident]

## Timeline
| Time | Action |
|------|--------|
| HH:MM | [Event detected] |
| HH:MM | [Investigation started] |
| HH:MM | [Containment action] |
| HH:MM | [Eradication] |
| HH:MM | [Recovery] |
| HH:MM | [Resolved] |

## Impact
- Services affected: [List]
- Data exposed: [Yes/No, details]
- Duration: [X hours Y minutes]
- Users affected: [Number]

## Root Cause
[Detailed explanation of what caused the incident]

## Remediation
- [ ] [Action taken]
- [ ] [Action taken]

## Lessons Learned
[What could be done better]

## Follow-up Actions
- [ ] [Action] - Owner: [Name] - Due: [Date]
- [ ] [Action] - Owner: [Name] - Due: [Date]
```

## Emergency Contacts

| Service | Contact | Phone |
|---------|---------|-------|
| Cloudflare | Support | +1-650-319-8930 |
| AWS (if using) | Support | AWS Support Console |
| Keycloak | Docs | https://www.keycloak.org/ |
| Trivy | Aqua Security | https://github.com/aquasecurity/trivy |

## Related Documents

- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) - Security architecture
- [SECURITY_TRAINING.md](SECURITY_TRAINING.md) - Secure development
- [ADR-015 Keycloak](../adr/ADR-015-keycloak-sso.md) - Authentication
- [ADR-017 Trivy](../adr/ADR-017-trivy-scanning.md) - Vulnerability scanning
