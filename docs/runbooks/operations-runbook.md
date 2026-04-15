# Operations Runbook

**System:** TradersApp  
**Owner:** Platform Engineering  
**Last Updated:** 2026-04-15

## Severity Model

| Severity | Definition | Response Target |
|---|---|---|
| P0 | Total outage, data-loss risk, security breach | Immediate, all-hands |
| P1 | Major feature unavailable, degraded trading outcomes | 15 minutes |
| P2 | Partial degradation, workaround exists | 1 hour |
| P3 | Minor issue, no material customer impact | Next business day |

## Incident Command

1. Incident Commander: owns timeline and decision log.
2. Communications Lead: updates stakeholders every 30 minutes for P0/P1.
3. Technical Lead: runs diagnosis and mitigation.

## Standard Incident Workflow

1. Detect and classify severity.
2. Open incident room and assign roles.
3. Stabilize service first (rollback/failover/restart).
4. Validate recovery with health checks and SLO metrics.
5. Document impact, root cause, and permanent fix ticket.

## Mandatory Checks Before Close

- `GET /health` and `GET /ready` are healthy for BFF and ML Engine.
- Error-rate and latency dashboards are within SLO.
- Data integrity checks pass for impacted storage.
- Runbook and postmortem are updated with exact timestamps.

## Escalation Rules

- Escalate to security on suspicious auth events or secret exposure.
- Escalate to database owner on any restore, schema drift, or corruption.
- Escalate to release owner if production rollback is required.
