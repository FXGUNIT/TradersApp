# Stage P Production Activation Proof

**Run date:** 2026-04-15 IST  
**Scope:** P01-P11 execution evidence (public reachability and deploy-readiness gates)

## Artifact Index

- Public DNS/TLS/endpoint probe: `docs/stage-p/public-readiness-20260415T161834Z.json`
- CI contract and CLI readiness probe: `docs/stage-p/ci-contract-20260415T162029Z.json`
- Topology freeze decision: `docs/P01_TOPOLOGY_FREEZE.md`

## Current Stage P Status (Evidence-Based)

| Task | Status | Evidence |
|---|---|---|
| P01 topology freeze | DONE | `docs/P01_TOPOLOGY_FREEZE.md` |
| P02 DNS records complete | BLOCKED | `bff.traders.app`, `api.traders.app`, `staging.traders.app` unresolved in probe artifact |
| P03 TLS/SSL integrity | BLOCKED | Only `traders.app` cert handshake succeeded; subdomains blocked by DNS absence |
| P04 frontend public deploy proof | BLOCKED | `https://traders.app/` redirects to `https://stocks.news/`; `https://traders.app/health` returns 404 |
| P05 BFF public deploy proof | BLOCKED | `https://bff.traders.app/health` cannot resolve (NXDOMAIN) |
| P06 ML public deploy proof | BLOCKED | `https://api.traders.app/health` cannot resolve (NXDOMAIN) |
| P07 end-to-end public flow | BLOCKED | P04-P06 all failing |
| P08 Infisical sync hardening | IN PROGRESS | Workflow exists; live production sync cannot be validated without repo access token context |
| P09 deploy prereq closure | BLOCKED | Required contract extracted, but local `gh` CLI missing so live secret/var verification cannot execute |
| P10 public uptime monitoring | IN PROGRESS | `.github/workflows/monitor.yml` has 5-minute checks + alert hooks; alert routing not yet validated live |
| P11 observability validation | BLOCKED | Dashboards/telemetry backend access not available in current local context |

## Key Findings

1. **Domain ownership is active but app binding is incorrect:** `traders.app` currently resolves and serves HTTPS, but the destination is not the app deployment target expected by Stage P.
2. **Critical subdomains are missing from DNS:** `bff`, `api`, and `staging` do not resolve, so backend public verification cannot begin.
3. **CI deployment contract is defined but not yet operationally validated:** workflows reference required secrets/variables, but local environment lacks `gh`, `vercel`, and `railway` CLIs for direct control-plane verification.

## Required Secret/Variable Contract (from workflows)

From `.github/workflows/ci.yml`, `.github/workflows/infisical-sync.yml`, `.github/workflows/monitor.yml`:

- Required GitHub secrets: `DISCORD_WEBHOOK_URL`, `GITHUB_TOKEN`, `INFISICAL_TOKEN`, `PAGERDUTY_ROUTING_KEY`, `RAILWAY_TOKEN`, `SLACK_WEBHOOK_URL`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`
- Required GitHub variables: `BFF_URL`, `FRONTEND_URL`, `K6_BASE_URL`, `MLFLOW_TRACKING_URI`, `ML_ENGINE_URL`, `MODEL_FRESHNESS_MAX_DAYS`, `PROMETHEUS_URL`, `RAILWAY_PROD_BFF_SERVICE_ID`, `RAILWAY_PROD_ENV_ID`, `RAILWAY_PROD_ML_SERVICE_ID`, `RAILWAY_STAGING_BFF_SERVICE_ID`, `RAILWAY_STAGING_ENV_ID`, `RAILWAY_STAGING_ML_SERVICE_ID`

## Precision Closure Plan (Next Execution Order)

1. Fix DNS records for `bff`, `api`, `staging` and verify from at least two resolvers.
2. Repoint `traders.app` to intended frontend deployment and add `/health` route contract.
3. Validate Railway service health routes publicly (`/health`) for BFF and ML.
4. Install/auth `gh`, `vercel`, `railway`; verify required GitHub secrets/variables live.
5. Trigger `deploy-production` and retain run evidence.
6. Re-run Stage P probes and close P02-P07/P09 with green artifacts.
