#!/usr/bin/env bash
set -euo pipefail

BUNDLE_ROOT=""
ENV_FILE=""
APP_ROOT="/opt/tradersapp"
GHCR_USERNAME=""
GHCR_TOKEN_STDIN="0"
IMAGE_TAG=""

usage() {
  cat <<'EOF'
Usage: deploy.sh --bundle-root /tmp/release --env-file /tmp/.env.contabo [options]

Options:
  --bundle-root DIR        Directory containing deploy/contabo and scripts/contabo
  --env-file FILE          Rendered runtime env file
  --app-root DIR           Installation root on the server (default: /opt/tradersapp)
  --ghcr-username USER     GHCR username for docker login
  --ghcr-token-stdin       Read GHCR token from stdin
  --image-tag TAG          Docker image tag for this deploy (e.g. commit SHA)
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --bundle-root)
      BUNDLE_ROOT="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --app-root)
      APP_ROOT="$2"
      shift 2
      ;;
    --ghcr-username)
      GHCR_USERNAME="$2"
      shift 2
      ;;
    --ghcr-token-stdin)
      GHCR_TOKEN_STDIN="1"
      shift
      ;;
    --image-tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "deploy.sh must run as root." >&2
  exit 1
fi

if [ -z "${BUNDLE_ROOT}" ] || [ ! -d "${BUNDLE_ROOT}/deploy/contabo" ]; then
  echo "A bundle root with deploy/contabo is required." >&2
  exit 1
fi

if [ -z "${ENV_FILE}" ] || [ ! -f "${ENV_FILE}" ]; then
  echo "A rendered runtime env file is required." >&2
  exit 1
fi

APP_USER="tradersapp"
DEPLOY_ROOT="${APP_ROOT}/deploy/contabo"
RUNTIME_ENV="${APP_ROOT}/runtime/.env.contabo"
BACKUP_TOOLS="${APP_ROOT}/backup-tools"
BACKUP_ROOT="/var/backups/tradersapp"
GHCR_TOKEN=""

if [ "${GHCR_TOKEN_STDIN}" = "1" ]; then
  GHCR_TOKEN="$(cat)"
fi

run_as_app() {
  local command="$*"
  sudo -H -u "${APP_USER}" bash -lc "cd '${DEPLOY_ROOT}' && ${command}"
}

check_available_kb() {
  df --output=avail / | tail -1 | tr -d ' '
}

prune_unused_docker_artifacts() {
  echo "[deploy] Low disk detected on /. Attempting one-time Docker cleanup..." >&2
  docker system df || true
  docker builder prune -af || true
  docker image prune -a -f || true
  docker container prune -f || true
  docker network prune -f || true
  echo "[deploy] Disk after cleanup: $(df -h / | tail -1 | awk '{print $4}') free on /." >&2
}

wait_for_health() {
  local name="$1"
  local max_tries="${2:-90}"
  local attempt=1
  local state=""

  while [ "${attempt}" -le "${max_tries}" ]; do
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${name}" 2>/dev/null || true)"
    if [ "${state}" = "healthy" ] || [ "${state}" = "running" ]; then
      return 0
    fi
    sleep 5
    attempt=$((attempt + 1))
  done

  echo "Container ${name} did not become healthy. Last state: ${state}" >&2
  return 1
}

wait_for_http() {
  local label="$1"
  local url="$2"
  local max_tries="${3:-24}"
  local attempt=1
  shift 3

  while [ "${attempt}" -le "${max_tries}" ]; do
    if curl --silent --show-error --fail --output /dev/null --connect-timeout 5 "$@" "${url}"; then
      return 0
    fi
    sleep 5
    attempt=$((attempt + 1))
  done

  echo "HTTP check ${label} did not become ready: ${url}" >&2
  return 1
}

wait_for_https_host() {
  local label="$1"
  local host="$2"
  local path="$3"
  local max_tries="${4:-24}"

  wait_for_http "${label}" "https://${host}${path}" "${max_tries}" \
    --insecure \
    --resolve "${host}:443:127.0.0.1"
}

dump_failure_context() {
  local exit_code="$?"
  trap - ERR
  set +e

  echo "[deploy] Failure detected. Capturing container diagnostics..." >&2
  docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' >&2 || true

  if [ -n "${COMPOSE_CMD:-}" ]; then
    run_as_app "${COMPOSE_CMD} ps" >&2 || true
    run_as_app "${COMPOSE_CMD} logs --tail 120" >&2 || true
  fi

  exit "${exit_code}"
}

echo "[deploy] Installing bundle into ${DEPLOY_ROOT}..."
install -d -m 0755 -o "${APP_USER}" -g "${APP_USER}" "${APP_ROOT}" "${APP_ROOT}/deploy" "${DEPLOY_ROOT}" "${APP_ROOT}/runtime" "${APP_ROOT}/logs"
rsync -a --delete "${BUNDLE_ROOT}/deploy/contabo/" "${DEPLOY_ROOT}/"
chown -R "${APP_USER}:${APP_USER}" "${DEPLOY_ROOT}"
install -m 0600 -o "${APP_USER}" -g "${APP_USER}" "${ENV_FILE}" "${RUNTIME_ENV}"

echo "[deploy] Installing backup tools..."
install -d -m 0755 "${BACKUP_TOOLS}" "${BACKUP_TOOLS}/scripts" "${BACKUP_TOOLS}/ml-engine"
if [ -d "${BUNDLE_ROOT}/scripts" ]; then
  rsync -a --delete "${BUNDLE_ROOT}/scripts/" "${BACKUP_TOOLS}/scripts/"
fi
if [ -d "${BUNDLE_ROOT}/ml-engine/scripts" ]; then
  install -d -m 0755 "${BACKUP_TOOLS}/ml-engine/scripts"
  rsync -a --delete "${BUNDLE_ROOT}/ml-engine/scripts/" "${BACKUP_TOOLS}/ml-engine/scripts/"
fi
find "${BACKUP_TOOLS}" -type f -name "*.sh" -exec chmod 0755 {} \; 2>/dev/null || true

if [ -f "${BUNDLE_ROOT}/source-snapshot.tgz" ]; then
  echo "[deploy] Saving deployed source snapshot on VPS..."
  install -d -m 0750 "${BACKUP_ROOT}/source"
  SNAPSHOT_TAG="${IMAGE_TAG:-$(date -u +%Y%m%d%H%M%S)}"
  SNAPSHOT_PATH="${BACKUP_ROOT}/source/source-${SNAPSHOT_TAG}.tgz"
  install -m 0640 "${BUNDLE_ROOT}/source-snapshot.tgz" "${SNAPSHOT_PATH}"
  ln -sfn "$(basename "${SNAPSHOT_PATH}")" "${BACKUP_ROOT}/source/source_latest.tgz"
  ls -lh "${SNAPSHOT_PATH}" >&2
fi

if [ -n "${GHCR_USERNAME}" ] && [ -n "${GHCR_TOKEN}" ]; then
  echo "[deploy] Logging in to ghcr.io..."
  printf '%s' "${GHCR_TOKEN}" | run_as_app "docker login ghcr.io -u '${GHCR_USERNAME}' --password-stdin"
fi

COMPOSE_CMD="docker compose --project-name tradersapp --project-directory '${DEPLOY_ROOT}' --env-file '${RUNTIME_ENV}' -f '${DEPLOY_ROOT}/docker-compose.yml'"
trap 'dump_failure_context' ERR

AVAILABLE_KB="$(check_available_kb)"
if [ "${AVAILABLE_KB}" -lt 20000000 ]; then
  echo "[deploy] Only $(df -h / | tail -1 | awk '{print $4}') free on / before image pulls." >&2
  prune_unused_docker_artifacts
  AVAILABLE_KB="$(check_available_kb)"
fi

# Guard: refuse to deploy if less than 20GB free on root filesystem
AVAILABLE_KB="${AVAILABLE_KB:-$(check_available_kb)}"
if [ "${AVAILABLE_KB}" -lt 20000000 ]; then
  echo "[deploy] ERROR: Only $(df -h / | tail -1 | awk '{print $4}') free on / — refusing to pull images." >&2
  echo "[deploy] Run 'docker image prune -a -f' to reclaim space." >&2
  exit 1
fi

echo "[deploy] Pulling only images needed for this deployment..."
OWNER="fxgunit"
if [ -n "${IMAGE_TAG}" ]; then
  run_as_app "docker pull ghcr.io/${OWNER}/bff:${IMAGE_TAG}"
  run_as_app "docker pull ghcr.io/${OWNER}/ml-engine:${IMAGE_TAG}"
  run_as_app "docker pull ghcr.io/${OWNER}/frontend:${IMAGE_TAG}"
fi
run_as_app "docker pull caddy:2.9.1-alpine"
run_as_app "docker pull redis:7-alpine"

echo "[deploy] Setting vm.overcommit_memory=1 (host kernel sysctl)..."
sysctl -w vm.overcommit_memory=1 2>/dev/null || true

echo "[deploy] Clearing stale Caddy volumes (autosave.json carries old TLS config)..."
run_as_app "docker volume rm tradersapp_caddy_data tradersapp_caddy_config 2>/dev/null || true"
run_as_app "docker volume rm caddy_data caddy_config 2>/dev/null || true"

echo "[deploy] Starting stack..."
run_as_app "${COMPOSE_CMD} up -d --remove-orphans"

echo "[deploy] Enabling service for reboot persistence..."
systemctl daemon-reload
systemctl enable tradersapp.service >/dev/null 2>&1 || true

echo "[deploy] Waiting for core services..."
wait_for_health traders-redis
wait_for_health traders-ml-engine
wait_for_health traders-analysis-service
wait_for_health traders-bff
wait_for_health traders-frontend

echo "[deploy] Running smoke checks..."
set -a
. "${RUNTIME_ENV}"
set +a

echo "  - localhost bff /health"
wait_for_http "localhost bff /health" "http://127.0.0.1:8788/health" 12
echo "  - localhost ml-engine /health"
wait_for_http "localhost ml-engine /health" "http://127.0.0.1:8001/health" 12
echo "  - localhost analysis-service /health"
wait_for_http "localhost analysis-service /health" "http://127.0.0.1:8082/health" 12
echo "  - localhost frontend /health"
wait_for_http "localhost frontend /health" "http://127.0.0.1:8080/health" 12
echo "  - localhost redis PING"
docker exec traders-redis redis-cli ping | grep -q PONG
# Resolve runtime hosts back to the local Caddy listener so edge smoke checks
# do not depend on public DNS cutover. These routed HTTPS probes are the
# authoritative readiness signal for Caddy; container health may stay in
# "starting" while automatic TLS finishes warming.
echo "  - local edge route for ${TRADERSAPP_DOMAIN}"
wait_for_https_host "edge route ${TRADERSAPP_DOMAIN}" "${TRADERSAPP_DOMAIN}" "/edge-health" 36
echo "  - local edge route for ${BFF_PUBLIC_HOST}"
wait_for_https_host "edge route ${BFF_PUBLIC_HOST}" "${BFF_PUBLIC_HOST}" "/health" 36
echo "  - local edge route for ${API_PUBLIC_HOST}"
wait_for_https_host "edge route ${API_PUBLIC_HOST}" "${API_PUBLIC_HOST}" "/health" 36

echo "[deploy] Capturing compose status..."
run_as_app "${COMPOSE_CMD} ps" | tee "${APP_ROOT}/logs/compose-ps.log"

if [ -x "${BACKUP_TOOLS}/scripts/contabo/install-backups.sh" ]; then
  echo "[deploy] Enabling Contabo backup schedule..."
  bash "${BACKUP_TOOLS}/scripts/contabo/install-backups.sh" \
    --app-root "${APP_ROOT}" \
    --backup-root "${BACKUP_ROOT}" \
    --image-tag "${IMAGE_TAG:-}" \
    --run-once || {
      echo "[deploy] WARNING: backup schedule install or first backup reported warnings." >&2
    }
else
  echo "[deploy] WARNING: backup installer not found; scheduled backups were not changed." >&2
fi

echo "[deploy] Complete."
