# TradersApp self-hosted CI/CD with Gitea + Woodpecker

This stack replaces the old GitHub Actions plus Railway/Vercel deployment path with a self-hosted Git, CI, image registry, and k3s deployment flow.

Infisical remains the source of truth for secrets. The CI/CD stack does not introduce a second hand-maintained secret store.

## What this setup does

- Gitea hosts the Git repository and OCI image registry.
- Woodpecker runs lint, syntax checks, pytest, Helm validation, Docker builds, and k3s deploys.
- Helm upgrades the `tradersapp` release in k3s using commit-SHA image tags.
- Every push to `main` verifies, publishes, and deploys without manual promotion steps.

## Files involved

- `.woodpecker.yml`
- `docker-compose.gitea.yml`
- `.env.cicd.example`
- `scripts/ci/verify-k8s.sh`
- `scripts/ci/deploy-k3s.sh`
- `scripts/ci/render-cicd-env.ps1`
- `k8s/helm/tradersapp/templates/*.yaml`

## Prerequisites

- A Linux host or VM for Gitea and Woodpecker.
- Docker Engine and Docker Compose on that host.
- A DNS name and TLS termination for Gitea and Woodpecker.
- A reachable k3s cluster with Helm and kubectl access.
- A private Gitea token or service account for registry pushes and cluster pulls.
- The TradersApp Infisical workspace already configured in this repo.

If Gitea is exposed without TLS, Docker and k3s will treat it as an insecure registry. Use TLS in production. Only fall back to insecure-registry configuration for isolated lab environments.

## 1. Put CI/CD bootstrap keys into Infisical

Store these keys in the `production` environment in Infisical, in the shared root path `/`:

- `GITEA_DB_PASSWORD`
- `GITEA_ADMIN_USERNAME`
- `GITEA_ADMIN_PASSWORD`
- `GITEA_DOMAIN`
- `GITEA_ROOT_URL`
- `GITEA_SSH_DOMAIN`
- `GITEA_WEBHOOK_ALLOWED_HOST_LIST`
- `WOODPECKER_HOST`
- `WOODPECKER_ADMIN`
- `WOODPECKER_REPO_OWNERS`
- `WOODPECKER_GITEA_CLIENT`
- `WOODPECKER_GITEA_SECRET`
- `WOODPECKER_GRPC_SECRET`
- `WOODPECKER_AGENT_SECRET`
- `CI_REGISTRY_HOST`
- `CI_REGISTRY_USERNAME`
- `CI_REGISTRY_PASSWORD`
- `CI_VITE_BFF_URL`
- `CI_VITE_API_URL`
- `CI_K3S_KUBECONFIG_B64`
- `CI_K8S_NAMESPACE`
- `CI_K8S_REGISTRY_SECRET`

The `GITEA_*` and `WOODPECKER_*` keys are used to render `.env.cicd` for the self-hosted stack.
Use a non-reserved Gitea bootstrap username such as `gitadmin`; `admin` is rejected by Gitea's default username blacklist.

The `CI_*` keys remain in Infisical as the authoritative values for pipeline execution.

## 2. Render `.env.cicd` from Infisical and start Gitea/Woodpecker

1. Export the Docker Compose env file from Infisical:
   ```powershell
   $env:INFISICAL_TOKEN = "your-infisical-service-or-machine-token"
   powershell -ExecutionPolicy Bypass -File scripts/ci/render-cicd-env.ps1
   ```
2. Start the stack:
   ```bash
   docker compose --env-file .env.cicd -f docker-compose.gitea.yml up -d
   ```
3. Create an admin user in Gitea if this is the first boot:
   ```bash
   set -a
   . ./.env.cicd
   set +a
   docker compose --env-file .env.cicd -f docker-compose.gitea.yml exec -T --user git gitea \
     gitea admin user create \
     --username "${GITEA_ADMIN_USERNAME}" \
     --password "${GITEA_ADMIN_PASSWORD}" \
     --email admin@example.com \
     --admin
   ```

If your Infisical instance is not the default US Cloud, also set `INFISICAL_API_URL` before running the export command.

## 3. Create the Gitea OAuth application for Woodpecker

In Gitea, open `Site Administration -> Applications -> Create OAuth2 Application` and use:

- Name: `woodpecker`
- Redirect URI: `https://ci.example.com/authorize`

Write the client ID and client secret back into Infisical as `WOODPECKER_GITEA_CLIENT` and `WOODPECKER_GITEA_SECRET`, rerun `scripts/ci/render-cicd-env.ps1`, and restart the Woodpecker server.

## 4. Push the repo into Gitea

1. Create the repository in Gitea.
2. Add the Gitea remote locally.
3. Push the current branches.
4. Sign in to Woodpecker with the same Gitea account and activate the repository.

## 5. Mark the repository as trusted

The publish steps use privileged Docker builds. In Woodpecker, open the repository settings and enable `Trusted` before the first pipeline run.

Without trusted mode, the image-build steps will not be allowed to run.

## 6. Seed Woodpecker execution secrets from Infisical

Woodpecker still needs a small execution-time bootstrap because `from_secret` is resolved by Woodpecker before the build plugins run. In other words: Infisical is the source of truth, but Woodpecker needs a synced runtime copy of the exact values used by the pipeline plugins.

Create these repository secrets in Woodpecker, using the matching values from Infisical:

- `registry_host` <- `CI_REGISTRY_HOST`
- `registry_username` <- `CI_REGISTRY_USERNAME`
- `registry_password` <- `CI_REGISTRY_PASSWORD`
- `vite_bff_url` <- `CI_VITE_BFF_URL`
- `vite_api_url` <- `CI_VITE_API_URL`
- `k3s_kubeconfig_b64` <- `CI_K3S_KUBECONFIG_B64`
- `k8s_namespace` <- `CI_K8S_NAMESPACE`
- `k8s_registry_secret` <- `CI_K8S_REGISTRY_SECRET`

Example kubeconfig encoding:

```bash
base64 -w0 ~/.kube/config
```

If you rotate any of these values, rotate them in Infisical first and then resync the corresponding Woodpecker secrets. Do not edit them independently in Woodpecker.

## 7. What the pipeline does

On pull requests and manual runs:

- installs frontend dependencies, lints, and builds the Vite app
- checks every `bff/*.mjs` file with `node --check`
- runs `pytest` for `ml-engine/tests`
- runs Helm lint and Helm template validation

On pushes to `main`:

- builds and pushes `frontend`, `bff`, and `ml-engine` images into Gitea
- tags each image with `${CI_COMMIT_SHA}` and `latest`
- creates or updates the Kubernetes pull secret
- runs `helm upgrade --install tradersapp ...`
- waits for the `frontend`, `bff`, and `ml-engine` deployments to roll out

## 8. Deployment contract

The deployment script assumes:

- the Helm chart lives at `k8s/helm/tradersapp`
- the target release is named `tradersapp`
- the base chart values come from `values.yaml`
- the environment overlay comes from `values.prod.yaml`
- the chart will receive the image repositories and image tag from the CI pipeline

If you need a separate staging branch or different values file, add a second deploy step with a different branch filter and namespace secret.

## 9. Smoke checks after first deployment

Run these after the first successful `main` pipeline:

```bash
kubectl get pods -n tradersapp
kubectl get ingress -n tradersapp
kubectl describe secret gitea-regcred -n tradersapp
curl -f https://your-frontend.example.com/
curl -f https://your-bff.example.com/health
curl -f https://your-ml.example.com/health
```

## 10. Rollback

Use Helm for rollbacks:

```bash
helm history tradersapp -n tradersapp
helm rollback tradersapp <revision> -n tradersapp
```

Because each image is deployed by commit SHA, rollback is deterministic.
