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
PREVIOUS_RUNTIME_ENV="${APP_ROOT}/runtime/.env.ovh.previous"
DEPLOY_RECORD_ROOT="${APP_ROOT}/deploy-records"
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

read_env_value() {
  local file="$1"
  local key="$2"
  if [ ! -f "${file}" ]; then
    return 0
  fi
  grep -E "^${key}=" "${file}" | tail -1 | cut -d= -f2-
}

write_deploy_record() {
  local status="$1"
  local health="$2"
  local previous_bff="$3"
  local new_bff="$4"
  local path="${DEPLOY_RECORD_ROOT}/deploy-$(date -u +%Y%m%dT%H%M%SZ).json"
  install -d -m 0750 -o "${APP_USER}" -g "${APP_USER}" "${DEPLOY_RECORD_ROOT}"
  cat > "${path}" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "${status}",
  "health": "${health}",
  "previousBffImage": "${previous_bff}",
  "newBffImage": "${new_bff}"
}
EOF
  chown "${APP_USER}:${APP_USER}" "${path}"
  ln -sfn "$(basename "${path}")" "${DEPLOY_RECORD_ROOT}/last-${status}.json"
}

rollback_failed_deploy() {
  if [ -z "${COMPOSE_CMD:-}" ] || [ ! -f "${PREVIOUS_RUNTIME_ENV}" ]; then
    return 0
  fi
  local previous_bff
  local failed_bff
  previous_bff="$(read_env_value "${PREVIOUS_RUNTIME_ENV}" BFF_IMAGE)"
  failed_bff="$(read_env_value "${RUNTIME_ENV}" BFF_IMAGE)"
  if [ -z "${previous_bff}" ]; then
    return 0
  fi
  echo "[deploy] Rolling back to previous BFF image ${previous_bff}..." >&2
  install -m 0600 -o "${APP_USER}" -g "${APP_USER}" "${PREVIOUS_RUNTIME_ENV}" "${RUNTIME_ENV}"
  run_as_app "${COMPOSE_CMD} up -d --remove-orphans" >&2 || true
  wait_for_health traders-bff 24 >&2 || true
  wait_for_http "rollback localhost bff /health" "http://127.0.0.1:8788/health" >&2 || true
  write_deploy_record "rollback" "failed_deploy_rolled_back" "${previous_bff}" "${failed_bff}"
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
  rollback_failed_deploy || true
  exit "${exit_code}"
}

echo "[deploy] Installing bundle into ${DEPLOY_ROOT}..."
install -d -m 0755 -o "${APP_USER}" -g "${APP_USER}" "${APP_ROOT}" "${APP_ROOT}/deploy" "${DEPLOY_ROOT}" "${APP_ROOT}/runtime" "${APP_ROOT}/logs"
if [ -f "${RUNTIME_ENV}" ]; then
  install -m 0600 -o "${APP_USER}" -g "${APP_USER}" "${RUNTIME_ENV}" "${PREVIOUS_RUNTIME_ENV}"
fi
rsync -a --delete "${BUNDLE_ROOT}/deploy/ovh/" "${DEPLOY_ROOT}/"
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
write_deploy_record \
  "success" \
  "healthy" \
  "$(read_env_value "${PREVIOUS_RUNTIME_ENV}" BFF_IMAGE)" \
  "$(read_env_value "${RUNTIME_ENV}" BFF_IMAGE)"

echo "[deploy] Complete."
