# P26 - Contabo VPS Deployment Plan

**Status:** Active production path  
**Target:** `Contabo VPS` single host with `Docker Compose`  
**Pipeline:** `push main` -> `CI/CD Pipeline` -> `Deploy to Contabo VPS`

## Current Domain State

- The stable public developer root is `https://tradergunit.pages.dev`.
- Keep the trading application off Cloudflare Pages for now. Pages is the developer root only.
- The product runtime remains on the Contabo-backed host family until an owned custom domain is attached.
- The current public proof endpoints are still the Contabo fallback hosts:
  - `https://173.249.18.14.sslip.io`
  - `https://bff.173.249.18.14.sslip.io/health`
  - `https://api.173.249.18.14.sslip.io/health`
- The next domain move is a custom-domain cutover, not another `is-a.dev` submission.
- Target custom-domain mapping:
  - developer root: `<domain>` or `www.<domain>` on Cloudflare Pages
  - product frontend: `app.<domain>`
  - BFF: `bff.<domain>`
  - API: `api.<domain>`

## Latest Fallback-Host Evidence

- Latest off-box verification workflow:
  - `Verify Contabo Public Deploy` run `24775819624`
- Result:
  - all eight public readiness checks passed against the `sslip.io` host family
  - uploaded artifact download worked after the hidden-artifact fix
  - the generated markdown summary now shows the real `k6` envelope values after
    the parser fix on `main`
- Current fallback-host envelope from that run still breaches thresholds:
  - HTTP duration p95/p99 about `523.05 ms` / `747.03 ms`
  - overall HTTP fail rate about `24.36%`
  - `bff_ml_health` fail rate about `81.89%`
  - `ml_predict` latency p95/p99 about `746.20 ms` / `989.00 ms`
- Practical meaning:
  - reachability, DNS, TLS, and the basic health chain are green on the fallback
    hosts
  - the next remaining work before public cutover is owned-domain cutover plus
    later performance hardening against the `bff_ml_health` load threshold failures

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
- `CONTABO_DOMAIN=<product-frontend-domain>` such as `app.<domain>`; this is the fallback source of truth when `TRADERSAPP_DOMAIN` is unset
- `TRADERSAPP_DOMAIN=<product-frontend-domain>` recommended so Pages-root workflows, alerts, and verifier inputs all show the same public frontend host
- `BFF_PUBLIC_HOST=<public-bff-domain>` such as `bff.<domain>`
- `API_PUBLIC_HOST=<public-api-domain>` such as `api.<domain>`
- `CONTABO_APP_ROOT=/opt/tradersapp` (optional if unchanged)
- `CONTABO_COMPOSE_PROFILES=core` for first cutover; add `mlops` or `observability` later when needed

## Custom Domain Cutover Checklist

Use this exact sequence from now on:

1. Buy or attach the owned domain in Cloudflare DNS.
2. Attach the developer root hostname to the existing Cloudflare Pages project:
   - `<domain>` or `www.<domain>` -> `tradergunit`
3. Point the runtime hostnames to the current Contabo edge:
   - `app.<domain>`
   - `bff.<domain>`
   - `api.<domain>`
4. Update GitHub repository variables to the new host family:
   - `TRADERSAPP_DOMAIN=app.<domain>`
   - `CONTABO_DOMAIN=app.<domain>`
   - `BFF_PUBLIC_HOST=bff.<domain>`
   - `API_PUBLIC_HOST=api.<domain>`
5. Keep `PRODUCTION_DEPLOY_PLATFORM=contabo` and `CONTABO_COMPOSE_PROFILES=core` unchanged.
6. Run `Deploy to Contabo VPS`.
7. Run `Deploy Pages Root`.
8. Run `Verify Pages Root Runtime`.
9. Run `Verify Contabo Public Deploy` against:
   - `https://app.<domain>`
   - `https://bff.<domain>/health`
   - `https://api.<domain>/health`
10. Only after those checks pass, mark the DNS/public-health P26 items complete.

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
2. Attach the owned developer-root hostname to Cloudflare Pages.
3. Point `app`, `bff`, and `api` hosts to the VPS IP.
4. Add the required GitHub variables and secrets.
5. Run the bootstrap once on the VPS:

```bash
ssh root@<contabo-ip>
curl -fsSL https://raw.githubusercontent.com/fxgunit/TradersApp/main/scripts/contabo/setup-vps.sh | sudo bash
```

6. Push to `main` or run `Deploy to Contabo VPS` manually.
7. Run `Deploy Pages Root` so the developer landing picks up the new public host variables.
8. Confirm remote health:
   - `https://app.<domain>`
   - `https://bff.<domain>/health`
   - `https://api.<domain>/health`
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

- `https://app.<domain>/edge-health`
- `https://bff.<domain>/health`
- `https://bff.<domain>/ml/health`
- `https://api.<domain>/predict`

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
