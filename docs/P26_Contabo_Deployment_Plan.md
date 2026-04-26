# P26 - Contabo VPS Deployment Plan

**Status:** Active production path  
**Target:** `Contabo VPS` single host with `Docker Compose`  
**Pipeline:** `push main` -> `CI/CD Pipeline` -> `Deploy to Contabo VPS`

## Current Domain State

- Canonical public frontend is `https://tradergunit.pages.dev`.
- Keep runtime services off Cloudflare Pages. Pages is the main public entry;
  Contabo remains the current runtime edge for BFF/API proof and backend
  hosting.
- The current public proof endpoints for the Contabo runtime edge are:
  - `https://173.249.18.14.sslip.io`
  - `https://bff.173.249.18.14.sslip.io/health`
  - `https://api.173.249.18.14.sslip.io/health`
- `is-a.dev` is retired for the active production path. Do not treat it as a
  blocker or pending cutover.
- Do not plan around buying or reviving another hostname family unless a future
  migration is explicitly reopened.

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
  - the remaining work is keeping the Pages frontend contract and Contabo
    runtime proof aligned in one runbook, not waiting on `is-a.dev`

## Topology

- Public edge: Caddy on the VPS, terminating the current runtime-edge host plus matching `bff` and `api` hosts
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
- `TRADERSAPP_DOMAIN=173.249.18.14.sslip.io` for the Contabo runtime edge bundle
- `BFF_PUBLIC_HOST=bff.173.249.18.14.sslip.io`
- `API_PUBLIC_HOST=api.173.249.18.14.sslip.io`
- `CONTABO_APP_ROOT=/opt/tradersapp` (optional if unchanged)
- `CONTABO_COMPOSE_PROFILES=core` for first cutover; add `mlops` or `observability` later when needed

The canonical public frontend `https://tradergunit.pages.dev/` is fixed by the
Pages workflows and should not be reinterpreted through the Contabo runtime
variables above.

## Free Topology Checklist

Use this exact sequence from now on:

1. Keep `tradergunit.pages.dev` as the canonical public frontend.
2. Keep the runtime host family on:
   - `173.249.18.14.sslip.io`
   - `bff.173.249.18.14.sslip.io`
   - `api.173.249.18.14.sslip.io`
3. Update GitHub repository variables only if the Contabo runtime hosts drift away from the current proof family:
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

## Optional Future Branded Host Migration

No branded-host migration is active right now.

If a future migration is intentionally reopened, write a fresh runbook from the
current `tradergunit.pages.dev` + Contabo runtime-edge contract instead of
reviving the retired `is-a.dev` plan.

## Required GitHub Secrets

- `CONTABO_VPS_HOST`
- `CONTABO_VPS_USER`
- `CONTABO_SSH_KEY`
- `CONTABO_SSH_KNOWN_HOSTS` recommended. Store the pinned output of `ssh-keyscan -H <contabo-host>` so deploys do not depend on live host-key discovery from GitHub Actions.
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
2. Keep `tradergunit.pages.dev` attached to Cloudflare Pages as the canonical public frontend.
3. Point `173.249.18.14.sslip.io`, `bff.173.249.18.14.sslip.io`, and `api.173.249.18.14.sslip.io` at the VPS IP.
4. Add the required GitHub variables and secrets.
   Include `CONTABO_SSH_KNOWN_HOSTS` with the pinned server host key so production deploys stay stable even if GitHub runners cannot reach the VPS with `ssh-keyscan`.
5. Run the bootstrap once on the VPS:

```bash
ssh root@<contabo-ip>
curl -fsSL https://raw.githubusercontent.com/fxgunit/TradersApp/main/scripts/contabo/setup-vps.sh | sudo bash
```

6. Push to `main` or run `Deploy to Contabo VPS` manually.
7. Run `Deploy Pages Root` so `tradergunit.pages.dev` stays aligned with the current runtime proof hosts.
8. Confirm remote health:
   - `https://tradergunit.pages.dev`
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
- Backup tools: `/opt/tradersapp/backup-tools`
- VPS backup root: `/var/backups/tradersapp`
- Deployed source snapshots: `/var/backups/tradersapp/source/source-<sha>.tgz`
- Latest deployed source snapshot: `/var/backups/tradersapp/source/source_latest.tgz`
- Systemd unit: `/etc/systemd/system/tradersapp.service`
- Release staging dir during deploy: `/tmp/tradersapp-contabo-release`

## Backup And Source Redundancy Contract

Every successful Contabo deploy must preserve three copies of the application state:

1. Local machine: the working tree at `E:\TradersApp`.
2. GitHub: the pushed commit and GHCR images for that commit.
3. Contabo VPS: running Docker images plus a source snapshot archive under `/var/backups/tradersapp/source`.

The deploy workflow now uploads:

- `contabo-bundle.tgz`: deploy scripts, Contabo compose files, and backup tools.
- `source-snapshot.tgz`: `git archive` of the exact deployed GitHub commit.

The remote deploy installs:

- `/etc/cron.d/tradersapp-backups`
- `/opt/tradersapp/backup-tools`
- `/var/backups/tradersapp/{redis,sqlite,postgres,source,logs}`

Scheduled backups:

| Time | Command | Output |
|---|---|---|
| 02:00 daily | `run-backups.sh all` | Redis, SQLite if DB exists, PostgreSQL if profile/container exists |
| 02:45 daily | `verify-backups.sh` | Verifies cron, source snapshot, and latest available backup files |

Manual VPS verification:

```bash
sudo APP_ROOT=/opt/tradersapp BACKUP_ROOT=/var/backups/tradersapp \
  /opt/tradersapp/backup-tools/scripts/contabo/verify-backups.sh
```

Manual VPS backup:

```bash
sudo APP_ROOT=/opt/tradersapp BACKUP_ROOT=/var/backups/tradersapp \
  /opt/tradersapp/backup-tools/scripts/contabo/run-backups.sh all
```

The source snapshot represents the latest deployed GitHub commit, not uncommitted local files. To make local changes exist on GitHub and Contabo, commit and push them to GitHub, then run the normal Contabo deploy.

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
