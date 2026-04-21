#!/usr/bin/env bash
set -euo pipefail

BUNDLE_ROOT=""
ENV_FILE=""
APP_ROOT="/opt/tradersapp"
GHCR_USERNAME=""
GHCR_TOKEN_STDIN="0"

usage() {
  cat <<'EOF'
Usage: deploy.sh --bundle-root /tmp/release --env-file /tmp/.env.ovh [options]

Options:
  --bundle-root DIR        Directory containing deploy/ovh and scripts/ovh
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

if [ -z "${BUNDLE_ROOT}" ] || [ ! -d "${BUNDLE_ROOT}/deploy/ovh" ]; then
  echo "A bundle root with deploy/ovh is required." >&2
  exit 1
fi

if [ -z "${ENV_FILE}" ] || [ ! -f "${ENV_FILE}" ]; then
  echo "A rendered runtime env file is required." >&2
  exit 1
fi

APP_USER="tradersapp"
DEPLOY_ROOT="${APP_ROOT}/deploy/ovh"
RUNTIME_ENV="${APP_ROOT}/runtime/.env.ovh"
GHCR_TOKEN=""

if [ "${GHCR_TOKEN_STDIN}" = "1" ]; then
  GHCR_TOKEN="$(cat)"
fi

run_as_app() {
  sudo -H -u "${APP_USER}" bash -lc "$*"
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

  if ! curl --silent --show-error --fail --output /dev/null --connect-timeout 5 "$url"; then
    echo "HTTP check ${label} did not become ready: ${url}" >&2
    return 1
  fi
}

wait_for_https_host() {
  local label="$1"
  local host="$2"
  local path="$3"

  if ! curl --silent --show-error --fail --output /dev/null --connect-timeout 5 \
    --insecure \
    --resolve "${host}:443:127.0.0.1" \
    "https://${host}${path}"; then
    echo "HTTP check ${label} did not become ready: https://${host}${path}" >&2
    return 1
  fi
}

echo "[deploy] Installing bundle into ${DEPLOY_ROOT}..."
install -d -m 0755 -o "${APP_USER}" -g "${APP_USER}" "${APP_ROOT}" "${APP_ROOT}/deploy" "${DEPLOY_ROOT}" "${APP_ROOT}/runtime" "${APP_ROOT}/logs"
rsync -a --delete "${BUNDLE_ROOT}/deploy/ovh/" "${DEPLOY_ROOT}/"
install -m 0600 -o "${APP_USER}" -g "${APP_USER}" "${ENV_FILE}" "${RUNTIME_ENV}"

if [ -n "${GHCR_USERNAME}" ] && [ -n "${GHCR_TOKEN}" ]; then
  echo "[deploy] Logging in to ghcr.io..."
  printf '%s' "${GHCR_TOKEN}" | run_as_app "docker login ghcr.io -u '${GHCR_USERNAME}' --password-stdin"
fi

COMPOSE_CMD="docker compose --project-name tradersapp --project-directory '${DEPLOY_ROOT}' --env-file '${RUNTIME_ENV}' -f '${DEPLOY_ROOT}/docker-compose.yml'"

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

echo "[deploy] Running smoke checks..."
set -a
. "${RUNTIME_ENV}"
set +a

wait_for_http "localhost bff /health" "http://127.0.0.1:8788/health"
wait_for_http "localhost ml-engine /health" "http://127.0.0.1:8001/health"
wait_for_http "localhost frontend /health" "http://127.0.0.1:8080/health"
docker exec traders-redis redis-cli ping | grep -q PONG
wait_for_https_host "edge route ${TRADERSAPP_DOMAIN}" "${TRADERSAPP_DOMAIN}" "/edge-health"
wait_for_https_host "edge route ${BFF_PUBLIC_HOST}" "${BFF_PUBLIC_HOST}" "/health"
wait_for_https_host "edge route ${API_PUBLIC_HOST}" "${API_PUBLIC_HOST}" "/health"

echo "[deploy] Capturing compose status..."
run_as_app "${COMPOSE_CMD} ps" | tee "${APP_ROOT}/logs/compose-ps.log"

echo "[deploy] Complete."
