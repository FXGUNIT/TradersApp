# P26 - Contabo VPS Deployment Plan

**Status:** Active production path  
**Target:** `Contabo VPS` single host with `Docker Compose`  
**Pipeline:** `push main` -> `CI/CD Pipeline` -> `Deploy to Contabo VPS`

## Topology

- Public edge: Caddy on the VPS, terminating `traders.app`, `bff.traders.app`, and `api.traders.app`
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
- `CONTABO_DOMAIN=traders.app` (optional if unchanged)
- `BFF_PUBLIC_HOST=bff.traders.app` (optional if unchanged)
- `API_PUBLIC_HOST=api.traders.app` (optional if unchanged)
- `CONTABO_APP_ROOT=/opt/tradersapp` (optional if unchanged)
- `CONTABO_COMPOSE_PROFILES=core` for first cutover; add `mlops` or `observability` later when needed

## Domain Cutover Checklist - `tradergunit.is-a.dev`

Use this exact sequence once the root `is-a.dev` request is merged:

1. Confirm `tradergunit.is-a.dev` resolves publicly.
2. Open and merge the prepared follow-on `is-a.dev` requests for:
   - `api.tradergunit.is-a.dev`
   - `bff.tradergunit.is-a.dev`
3. Update GitHub repository variables to the new host family:
   - `TRADERSAPP_DOMAIN=tradergunit.is-a.dev`
   - `CONTABO_DOMAIN=tradergunit.is-a.dev`
   - `BFF_PUBLIC_HOST=bff.tradergunit.is-a.dev`
   - `API_PUBLIC_HOST=api.tradergunit.is-a.dev`
4. Keep `PRODUCTION_DEPLOY_PLATFORM=contabo` and `CONTABO_COMPOSE_PROFILES=core` unchanged.
5. Merge or cherry-pick the prepared cutover branch:
   - `prep/tradergunit-domain-cutover`
6. Run `Deploy to Contabo VPS`.
7. Run `Verify Contabo Public Deploy` against:
   - `https://tradergunit.is-a.dev`
   - `https://bff.tradergunit.is-a.dev/health`
   - `https://api.tradergunit.is-a.dev/health`
8. Only after those checks pass, mark the DNS/public-health P26 items complete.

Prepared artifacts already staged for this cutover:

- `is-a.dev` root PR:
  `https://github.com/is-a-dev/register/pull/36802`
- Follow-on fork branches:
  - `FXGUNIT/register:fxgunit/api-tradergunit-domain`
  - `FXGUNIT/register:fxgunit/bff-tradergunit-domain`
- Repo cutover branch:
  - `origin/prep/tradergunit-domain-cutover`

## Required GitHub Secrets

- `CONTABO_VPS_HOST`
- `CONTABO_VPS_USER`
- `CONTABO_SSH_KEY`
- One of:
  - `CONTABO_APP_ENV`
  - `INFISICAL_TOKEN` + `INFISICAL_PROJECT_ID`

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

## First Cutover

1. Provision the Contabo VPS and confirm SSH access.
2. Point DNS for `traders.app`, `bff.traders.app`, and `api.traders.app` to the VPS IP.
3. Add the required GitHub variables and secrets.
4. Run the bootstrap once on the VPS:

```bash
ssh root@<contabo-ip>
curl -fsSL https://raw.githubusercontent.com/fxgunit/TradersApp/main/scripts/contabo/setup-vps.sh | sudo bash
```

5. Push to `main` or run `Deploy to Contabo VPS` manually.
6. Confirm remote health:
   - `https://traders.app`
   - `https://bff.traders.app/health`
   - `https://api.traders.app/health`
7. The deploy workflow now runs `scripts/contabo/verify_public_deploy.py` after the remote restart unless manual dispatch sets `skip_public_verify=true`.

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
- `.artifacts/k6-slo-<timestamp>/summary-contabo-public-edge.json`
- `.artifacts/k6-slo-<timestamp>/k6-contabo-public-edge.log`
- `contabo-public-verification-<run_id>` GitHub Actions artifact when the workflow is used

The dedicated Contabo public-edge suite intentionally targets the active host
layout and low-blast-radius routes:

- `https://traders.app/edge-health`
- `https://bff.traders.app/health`
- `https://bff.traders.app/ml/health`
- `https://api.traders.app/predict`

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

## Rollback

- Re-run `Deploy to Contabo VPS` with a known-good SHA in `workflow_dispatch`
- The workflow rebuilds, republishes, and redeploys using that image tag
- Keep `CONTABO_COMPOSE_PROFILES=core` until the first two clean redeploy cycles are stable
