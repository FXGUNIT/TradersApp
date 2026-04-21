#!/usr/bin/env bash
set -euo pipefail

BUNDLE_ROOT=""
ENV_FILE=""
APP_ROOT="/opt/tradersapp"
GHCR_USERNAME=""
GHCR_TOKEN_STDIN="0"

usage() {
  cat <<'EOF'
Usage: deploy.sh --bundle-root /tmp/release --env-file /tmp/.env.contabo [options]

Options:
  --bundle-root DIR        Directory containing deploy/contabo and scripts/contabo
  --env-file FILE          Rendered runtime env file
  --app-root DIR           Installation root on the server (default: /opt/tradersapp)
  --ghcr-username USER     GHCR username for docker login
  --ghcr-token-stdin       Read GHCR token from stdin
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
GHCR_TOKEN=""

if [ "${GHCR_TOKEN_STDIN}" = "1" ]; then
  GHCR_TOKEN="$(cat)"
fi

run_as_app() {
  local command="$*"
  sudo -H -u "${APP_USER}" bash -lc "cd '${DEPLOY_ROOT}' && ${command}"
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

if [ -n "${GHCR_USERNAME}" ] && [ -n "${GHCR_TOKEN}" ]; then
  echo "[deploy] Logging in to ghcr.io..."
  printf '%s' "${GHCR_TOKEN}" | run_as_app "docker login ghcr.io -u '${GHCR_USERNAME}' --password-stdin"
fi

COMPOSE_CMD="docker compose --project-name tradersapp --project-directory '${DEPLOY_ROOT}' --env-file '${RUNTIME_ENV}' -f '${DEPLOY_ROOT}/docker-compose.yml'"
trap 'dump_failure_context' ERR

echo "[deploy] Pulling images..."
run_as_app "${COMPOSE_CMD} pull"

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
wait_for_health traders-edge 24

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
echo "  - local edge route for ${TRADERSAPP_DOMAIN}"
wait_for_http "edge route ${TRADERSAPP_DOMAIN}" "http://127.0.0.1/edge-health" 24 -H "Host: ${TRADERSAPP_DOMAIN}"
echo "  - local edge route for ${BFF_PUBLIC_HOST}"
wait_for_http "edge route ${BFF_PUBLIC_HOST}" "http://127.0.0.1/health" 24 -H "Host: ${BFF_PUBLIC_HOST}"
echo "  - local edge route for ${API_PUBLIC_HOST}"
wait_for_http "edge route ${API_PUBLIC_HOST}" "http://127.0.0.1/health" 24 -H "Host: ${API_PUBLIC_HOST}"

echo "[deploy] Capturing compose status..."
run_as_app "${COMPOSE_CMD} ps" | tee "${APP_ROOT}/logs/compose-ps.log"

echo "[deploy] Complete."
