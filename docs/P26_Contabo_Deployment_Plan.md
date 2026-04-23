# P26 - Contabo VPS Deployment Plan

**Status:** Active production path  
**Target:** `Contabo VPS` single host with `Docker Compose`  
**Pipeline:** `push main` -> `CI/CD Pipeline` -> `Deploy to Contabo VPS`

## Current Domain State

- Temporary developer-root proof is still available at
  `https://tradergunit.pages.dev`.
- The branded free-host target pending maintainer approval is:
  - `https://tradergunit.is-a.dev`
  - `https://traders.tradergunit.is-a.dev`
  - `https://bff.traders.tradergunit.is-a.dev/health`
  - `https://api.traders.tradergunit.is-a.dev/health`
- Keep the trading application runtime off Cloudflare Pages. Pages remains
  proof-only until the `is-a.dev` root and nested hosts are approved.
- Until `is-a.dev` approval plus DNS propagation lands, the product runtime
  remains on the free `sslip.io` Contabo-backed host family.
- The current public proof endpoints are still the Contabo fallback hosts:
  - `https://173.249.18.14.sslip.io`
  - `https://bff.173.249.18.14.sslip.io/health`
  - `https://api.173.249.18.14.sslip.io/health`
- Do not plan around buying a domain. The active free path is the approved
  `is-a.dev` host family, with `sslip.io` fallback proof until that approval
  lands.

## Latest Fallback-Host Evidence

- Clean redeploy evidence exists in `.artifacts/gh-run-24723298075/`:
  - `bootstrap-and-deploy.log` shows a successful VPS bootstrap plus deploy
  - `compose-ps.txt` shows `redis`, `ml-engine`, `analysis-service`, `bff`,
    `frontend`, and the Caddy edge healthy after the redeploy
- Latest public readiness evidence exists in:
  - `.artifacts/contabo/public-readiness-live-now.json`
  - `.artifacts/gh-run-24829111561/verification-24829111561.json`
- Result:
  - DNS and TLS are green for the fallback `sslip.io` host family
  - `frontend`, `bff`, and `api` health checks are green on the Contabo edge
  - deeper BFF and API routes are answering publicly from the fallback hosts
- Practical meaning:
  - the Contabo stack is stable enough to treat OCI as archived rollback context
  - the main remaining blocker is the branded `is-a.dev` cutover, not initial
    Contabo host bring-up

## Topology

- Public edge: Caddy on the VPS, terminating the approved root frontend host plus matching `bff` and `api` hosts
- Runtime: `frontend`, `bff`, `ml-engine`, `analysis-service`, `redis`
- Optional profiles:
  - `mlops`: `postgres`, `minio`, `mlflow`
  - `observability`: `prometheus`, `grafana`, `watchtower`
- Images: `ghcr.io/<owner>/{frontend,bff,ml-engine}:<sha>`

## Canonical Bundle

- Compose bundle:
  - [deploy/contabo/docker-compose.yml](/e:/TradersApp/deploy/contabo/docker-compose.yml:1)
  - [deploy/contabo/Caddyfile](/e:/TradersApp/deploy/contabo/Caddyfile:1)
  - [deploy/contabo/runtime.env.example](/e:/TradersApp/deploy/contabo/runtime.env.example:1)
  - [deploy/contabo/Dockerfile.frontend](/e:/TradersApp/deploy/contabo/Dockerfile.frontend:1)
- Server scripts:
  - [scripts/contabo/setup-vps.sh](/e:/TradersApp/scripts/contabo/setup-vps.sh:1)
  - [scripts/contabo/build-runtime-env.sh](/e:/TradersApp/scripts/contabo/build-runtime-env.sh:1)
  - [scripts/contabo/deploy.sh](/e:/TradersApp/scripts/contabo/deploy.sh:1)
- CI entrypoint:
  - [.github/workflows/deploy-contabo.yml](/e:/TradersApp/.github/workflows/deploy-contabo.yml:1)
  - [.github/workflows/verify-contabo-public.yml](/e:/TradersApp/.github/workflows/verify-contabo-public.yml:1)

## Required GitHub Variables

- `PRODUCTION_DEPLOY_PLATFORM=contabo` so successful `main` CI runs hand production deploys to the Contabo workflow instead of the legacy OCI job
- `CONTABO_DOMAIN=173.249.18.14.sslip.io`
- `TRADERSAPP_DOMAIN=173.249.18.14.sslip.io` recommended so Pages-root workflows, alerts, and verifier inputs all show the same public frontend host
- `BFF_PUBLIC_HOST=bff.173.249.18.14.sslip.io`
- `API_PUBLIC_HOST=api.173.249.18.14.sslip.io`
- `CONTABO_APP_ROOT=/opt/tradersapp` (optional if unchanged)
- `CONTABO_COMPOSE_PROFILES=core` for first cutover; add `mlops` or `observability` later when needed

## Free Topology Checklist

Use this exact sequence from now on:

1. Keep `tradergunit.pages.dev` as the stable developer root.
2. Keep the runtime host family on:
   - `173.249.18.14.sslip.io`
   - `bff.173.249.18.14.sslip.io`
   - `api.173.249.18.14.sslip.io`
3. Update GitHub repository variables only if they drift away from the free host family:
   - `TRADERSAPP_DOMAIN=173.249.18.14.sslip.io`
   - `CONTABO_DOMAIN=173.249.18.14.sslip.io`
   - `BFF_PUBLIC_HOST=bff.173.249.18.14.sslip.io`
   - `API_PUBLIC_HOST=api.173.249.18.14.sslip.io`
4. Keep `PRODUCTION_DEPLOY_PLATFORM=contabo` and `CONTABO_COMPOSE_PROFILES=core` unchanged.
5. Run `Deploy to Contabo VPS`.
6. Run `Deploy Pages Root`.
7. Run `Verify Pages Root Runtime`.
8. Run `Verify Contabo Public Deploy` against:
   - `https://173.249.18.14.sslip.io`
   - `https://bff.173.249.18.14.sslip.io/health`
   - `https://api.173.249.18.14.sslip.io/health`
9. Only after those checks pass, mark the public-health items complete.

## Branded Cutover Once Approved

Run this only after the `tradergunit.is-a.dev` root request is approved and the
nested-host follow-on requests are merged.

1. Merge the prepared repo cutover branch for the nested-host family.
2. Update repository variables to the branded host set:
   - `TRADERSAPP_DOMAIN=traders.tradergunit.is-a.dev`
   - `CONTABO_DOMAIN=traders.tradergunit.is-a.dev`
   - `BFF_PUBLIC_HOST=bff.traders.tradergunit.is-a.dev`
   - `API_PUBLIC_HOST=api.traders.tradergunit.is-a.dev`
3. Run `Deploy to Contabo VPS`.
4. Run `Verify Contabo Public Deploy` against:
   - `https://traders.tradergunit.is-a.dev`
   - `https://bff.traders.tradergunit.is-a.dev/health`
   - `https://api.traders.tradergunit.is-a.dev/health`
5. Only after those checks pass, close the remaining public-health TODO item.

## Required GitHub Secrets

- `CONTABO_VPS_HOST`
- `CONTABO_VPS_USER`
- `CONTABO_SSH_KEY`
- One of:
  - `CONTABO_APP_ENV`
  - `INFISICAL_TOKEN` + `INFISICAL_PROJECT_ID`
- Optional lightweight alert fan-out:
  - `SLACK_WEBHOOK_URL`
  - `DISCORD_WEBHOOK_URL`

## Expected Runtime Env Contract

- Start from [deploy/contabo/runtime.env.example](/e:/TradersApp/deploy/contabo/runtime.env.example:1)
- Keep application secrets in `CONTABO_APP_ENV` or Infisical
- The deploy workflow manages these keys automatically:
  - `GHCR_OWNER`
  - `IMAGE_TAG`
  - `TRADERSAPP_DOMAIN`
  - `BFF_PUBLIC_HOST`
  - `API_PUBLIC_HOST`
  - `COMPOSE_PROFILES`
  - `BFF_ALLOWED_ORIGINS`
  - `ML_ENGINE_URL`
  - `ML_ANALYSIS_GRPC_ADDR`

Optional BFF health hardening knobs for the public `/ml/health` route:

- `ML_HEALTH_TIMEOUT_MS` default `5000`
- `ML_HEALTH_CACHE_TTL_MS` default `5000`
- `ML_HEALTH_STALE_GRACE_MS` default `30000`

These keep short bursts of public health probes from stampeding the ML engine
while still surfacing a recent last-known-good payload when the upstream health
call flaps briefly.

## First Cutover

1. Provision the Contabo VPS and confirm SSH access.
2. Keep `tradergunit.pages.dev` attached to Cloudflare Pages.
3. Point `173.249.18.14.sslip.io`, `bff.173.249.18.14.sslip.io`, and `api.173.249.18.14.sslip.io` at the VPS IP.
4. Add the required GitHub variables and secrets.
5. Run the bootstrap once on the VPS:

```bash
ssh root@<contabo-ip>
curl -fsSL https://raw.githubusercontent.com/fxgunit/TradersApp/main/scripts/contabo/setup-vps.sh | sudo bash
```

6. Push to `main` or run `Deploy to Contabo VPS` manually.
7. Run `Deploy Pages Root` so the developer landing picks up the active free-host variables.
8. Confirm remote health:
   - `https://173.249.18.14.sslip.io`
   - `https://bff.173.249.18.14.sslip.io/health`
   - `https://api.173.249.18.14.sslip.io/health`
9. The deploy workflow now runs `scripts/contabo/verify_public_deploy.py` after the remote restart unless manual dispatch sets `skip_public_verify=true`.

## Public Verification

After the first live cutover, capture a reproducible public proof bundle:

```bash
python scripts/contabo/verify_public_deploy.py --print-json
```

Or run the manual GitHub Actions workflow `Verify Contabo Public Deploy` to
capture the same proof from an off-box runner and upload the artifacts for
review.

The production deploy workflow also captures public verification evidence by
default. Use `skip_public_verify=true` only for manual bootstrap or DNS/TLS
debug cases where public checks are expected to fail.

To record the first real public load envelope after DNS and base health are stable:

```bash
python scripts/contabo/verify_public_deploy.py --with-k6
python scripts/ci/parse_k6_results.py
```

Artifacts:

- `.artifacts/contabo/public-readiness-<timestamp>.json`
- `.artifacts/contabo/public-summary-<run_id>.md`
- `.artifacts/k6-slo-<timestamp>/summary-contabo-public-edge.json`
- `.artifacts/k6-slo-<timestamp>/k6-contabo-public-edge.log`
- `contabo-public-verification-<run_id>` GitHub Actions artifact when the workflow is used

The dedicated Contabo public-edge suite intentionally targets the active host
layout and low-blast-radius routes:

- `https://173.249.18.14.sslip.io/edge-health`
- `https://bff.173.249.18.14.sslip.io/health`
- `https://bff.173.249.18.14.sslip.io/ml/health`
- `https://api.173.249.18.14.sslip.io/predict`

## Remote Layout

- App root: `/opt/tradersapp`
- Compose bundle: `/opt/tradersapp/deploy/contabo`
- Runtime env: `/opt/tradersapp/runtime/.env.contabo`
- Systemd unit: `/etc/systemd/system/tradersapp.service`
- Release staging dir during deploy: `/tmp/tradersapp-contabo-release`

## Manual Recovery

```bash
ssh <user>@<host>
sudo docker compose --project-name tradersapp \
  --env-file /opt/tradersapp/runtime/.env.contabo \
  -f /opt/tradersapp/deploy/contabo/docker-compose.yml ps
```

```bash
ssh <user>@<host>
sudo docker compose --project-name tradersapp \
  --env-file /opt/tradersapp/runtime/.env.contabo \
  -f /opt/tradersapp/deploy/contabo/docker-compose.yml logs --tail 200
```

```bash
ssh <user>@<host>
sudo systemctl restart tradersapp.service
```

The deploy evidence bundle now captures:

- bootstrap/deploy transcript
- `docker compose ps`
- `docker compose logs --tail 200`
- `docker compose images`
- `systemctl status tradersapp.service`
- `journalctl -u tradersapp.service -n 200`
- public verification JSON and markdown summary when public verification runs

## Rollback

- Re-run `Deploy to Contabo VPS` with a known-good SHA in `workflow_dispatch`
- The workflow rebuilds, republishes, and redeploys using that image tag
- Keep `CONTABO_COMPOSE_PROFILES=core` until the first two clean redeploy cycles are stable
- When rollback is triggered after a failed deploy, review the uploaded `contabo-deploy-evidence-<run_id>` artifact before retrying so the next attempt starts from the last known failure mode instead of guessing
