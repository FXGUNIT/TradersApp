# OVH Production Runbook

**Status:** Active production path  
**Target:** `OVH VPS-3` single host with `Docker Compose`  
**Pipeline:** `push main` -> `CI/CD Pipeline` -> `Deploy OVH Production`

## Topology

- Public edge: Caddy on the VPS, terminating `traders.app`, `bff.traders.app`, and `api.traders.app`
- Runtime: `frontend`, `bff`, `ml-engine`, `analysis-service`, `redis`
- Optional profiles:
  - `mlops`: `postgres`, `minio`, `mlflow`
  - `observability`: `prometheus`, `grafana`, `watchtower`
- Images: `ghcr.io/<owner>/{frontend,bff,ml-engine}:<sha>`

## Required GitHub Variables

- `PRODUCTION_DEPLOY_PLATFORM=ovh`
- `TRADERSAPP_DOMAIN=traders.app` (optional if unchanged)
- `BFF_PUBLIC_HOST=bff.traders.app` (optional if unchanged)
- `API_PUBLIC_HOST=api.traders.app` (optional if unchanged)
- `OVH_APP_ROOT=/opt/tradersapp` (optional if unchanged)
- `OVH_COMPOSE_PROFILES=core` for first cutover; add `mlops` or `observability` later when needed

## Required GitHub Secrets

- `OVH_SSH_HOST`
- `OVH_SSH_USER`
- `OVH_SSH_PRIVATE_KEY`
- One of:
  - `OVH_APP_ENV`
  - `INFISICAL_TOKEN` + `INFISICAL_PROJECT_ID`

## Expected Runtime Env Contract

- Start from [deploy/ovh/runtime.env.example](/e:/TradersApp/deploy/ovh/runtime.env.example:1)
- Keep application secrets in `OVH_APP_ENV` or Infisical
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

1. Provision the OVH VPS and confirm SSH access.
2. Point DNS for `traders.app`, `bff.traders.app`, and `api.traders.app` to the VPS IP.
3. Add the required GitHub variables and secrets.
4. Push to `main` or run `Deploy OVH Production` manually.
5. Confirm remote health:
   - `https://traders.app`
   - `https://bff.traders.app/health`
   - `https://api.traders.app/health`

## Remote Layout

- App root: `/opt/tradersapp`
- Compose bundle: `/opt/tradersapp/deploy/ovh`
- Runtime env: `/opt/tradersapp/runtime/.env.ovh`
- Systemd unit: `/etc/systemd/system/tradersapp.service`
- Release staging dir during deploy: `/tmp/tradersapp-ovh-release`

## Manual Recovery

```bash
ssh <user>@<host>
sudo docker compose --project-name tradersapp \
  --env-file /opt/tradersapp/runtime/.env.ovh \
  -f /opt/tradersapp/deploy/ovh/docker-compose.yml ps
```

```bash
ssh <user>@<host>
sudo docker compose --project-name tradersapp \
  --env-file /opt/tradersapp/runtime/.env.ovh \
  -f /opt/tradersapp/deploy/ovh/docker-compose.yml logs --tail 200
```

```bash
ssh <user>@<host>
sudo systemctl restart tradersapp.service
```

## Rollback

- Re-run `Deploy OVH Production` with a known-good SHA in `workflow_dispatch`
- The workflow rebuilds, republishes, and redeploys using that image tag
- Keep `OVH_COMPOSE_PROFILES=core` until the first two clean redeploy cycles are stable
