# Deploy Runbook — TradersApp → Contabo VPS

## Quick Deploy (Normal Path)

Every backend change follows this chain:

```
Push to main
  → CI runs on Contabo VPS self-hosted runner (~2 min build)
  → BFF image pushed to GHCR (ghcr.io/FXGUNIT/bff:<sha>)
  → Watchtower on VPS detects new image, pulls and restarts container
  → Live in ~3-5 min total, $0 GitHub Actions minutes
```

```bash
# Normal workflow — just push code, watchtower handles the rest
git add <files> && git commit -m "fix: ..." && git push origin main

# Verify live
curl -sf https://bff.173.249.18.14.sslip.io/health
```

## Watchtower

Watchtower polls GHCR every 5 minutes. It's already in `deploy/contabo/docker-compose.yml` under the `core` profile (not observability). To ensure it's running:

```bash
ssh contabo@173.249.18.14 "docker compose -f /opt/tradersapp/docker-compose.yml up -d watchtower"
docker exec traders-watchtower logs --tail 20
```

To check if watchtower has pulled a new image:
```bash
ssh contabo@173.249.18.14 "docker images ghcr.io/FXGUNIT/bff --format '{{.Tag}} {{.CreatedAt}}'"
```

## Emergency Deploy (when CI is broken)

Only use when CI is failing for non-BFF reasons (e.g. ML Engine tests broken but BFF code unchanged):

```bash
gh workflow run deploy-contabo.yml \
  --repo FXGUNIT/TRADERS-REGIMENT \
  --field skip_build=true \
  --field image_tag=<last-known-good-sha> \
  --field skip_bootstrap=true

# Verify
sleep 30 && curl -sf https://bff.173.249.18.14.sslip.io/health
```

## Rollback to Previous SHA

```bash
# Find the last good SHA from GitHub Actions
# Then:
gh workflow run deploy-contabo.yml \
  --repo FXGUNIT/TRADERS-REGIMENT \
  --field skip_build=true \
  --field image_tag=<good-sha> \
  --field skip_bootstrap=true
```

## Manually Restart BFF (without redeploy)

```bash
ssh contabo@173.249.18.14 "docker exec traders-bff sh -c 'kill -HUP 1'"
# Or full restart:
ssh contabo@173.249.18.14 "docker restart traders-bff"
```

## Adding a New Service to Deploy

1. Add the service to `deploy/contabo/docker-compose.yml`
2. Add image build + push to `.github/workflows/ci.yml` with `cache-from: type=gha,scope=<service>`
3. Add a healthcheck to the service
4. Update this runbook

## Secrets — Adding or Updating

```bash
# Add new secret to GitHub Secrets
gh secret set SECRET_NAME --body "value" --repo FXGUNIT/TRADERS-REGIMENT

# If the secret needs to reach the BFF container:
# 1. Add it to the allowlist in scripts/contabo/build-runtime-env.sh
# 2. Add to CONTABO_APP_ENV base64 secret if using that path
# 3. Commit and push → watchtower auto-restarts BFF

# Verify on VPS
ssh contabo@173.249.18.14 "docker exec traders-bff env | grep SECRET_NAME"
```

## CI Status

https://github.com/FXGUNIT/TRADERS-REGIMENT/actions

CI runs on the self-hosted Contabo runner. Docker layer cache + npm cache persist across builds — first build ~8 min, subsequent builds ~90 sec.

## VPS SSH Access

```bash
ssh contabo@173.249.18.14
# App root: /opt/tradersapp
# Compose file: /opt/tradersapp/docker-compose.yml
# Logs: docker logs traders-bff --tail 100 -f
# All containers: docker ps -a
```

## Self-Hosted Runner Setup

The VPS runs a GitHub Actions self-hosted runner. To re-register after runner token expiry:

```bash
# Get new token from:
# https://github.com/FXGUNIT/TRADERS-REGIMENT/settings/actions/runners/new

# On VPS:
cd /opt/actions-runner
./run.sh   # ephemeral mode

# Or full setup:
RUNNER_TOKEN="gho_xxxxx" bash /opt/tradersapp/scripts/setup-self-hosted-runner.sh
```

## Architecture

```
GitHub Actions (cloud)
  └─ Job dispatched to: self-hosted runner (Contabo VPS)
       ├─ npm ci (cached, ~30 sec)
       ├─ docker build BFF (cached layers, ~60 sec)
       ├─ docker push ghcr.io/FXGUNIT/bff:<sha>
       └─ (tests run concurrently on cloud runners)

Watchtower (on VPS, polls every 5 min)
  └─ docker pull ghcr.io/FXGUNIT/bff:<sha>
       └─ docker compose up -d --no-deps bff
            └─ BFF restarts with new image
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| BFF not responding after deploy | `docker restart traders-bff` on VPS |
| Watchtower not auto-updating | Check: `docker logs traders-watchtower` |
| CI build slow | Normal on first run; next runs use cache |
| Image not on GHCR | CI still running or job failed |
| SSH deploy fails | Check `CONTABO_SSH_KEY` secret in GitHub |