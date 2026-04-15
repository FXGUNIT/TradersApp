# TradersApp Runbooks

Operational playbooks for diagnosing and resolving TradersApp incidents.

**Authors:** DevOps / SRE team
**Last Updated:** 2026-04-15
**Owner:** FXGUNIT

---

## Incident Response Protocol

1. **Detect** — alert fires or user reports
2. **Assess** — check health endpoints, dashboards, logs
3. **Diagnose** — use the relevant runbook below
4. **Mitigate** — apply fix steps
5. **Resolve** — confirm recovery
6. **Post-mortem** — file issue if root cause not yet tracked in Stage R

---

## Runbook Index

| Runbook | Trigger |
|---------|---------|
| [Operations Runbook](operations-runbook.md) | Any P0-P3 production incident lifecycle |
| [Backup and Restore](backup-and-restore-runbook.md) | Scheduled backups, restore drills, data recovery validation |
| [ML Engine Down](ml-engine-down.md) | ML Engine `/health` returns non-200 or k6 SLO breach |
| [BFF Down](bff-down.md) | Railway health check fails, `/ready` returns non-200 |
| [Redis Unavailable](redis-unavailable.md) | Redis ping fails, circuit breaker OPEN |
| [High ML Latency](ml-latency-spike.md) | `/sla` P95 > 500ms, user reports slow consensus |
| [Auth Failures](auth-failures.md) | Login errors, token expiry, 401 flood |
| [Board Room Agents Silent](boardroom-agents-silent.md) | Agent heartbeat missing, cron not processing |
| [Deployment Failure](deployment-failure.md) | Docker build fails, Railway deploy error |
| [Model Rollback](model-rollback.md) | Model degraded, need to restore previous version |
| [Data Recovery](data-recovery.md) | Redis/PostgreSQL/SQLite data loss |
