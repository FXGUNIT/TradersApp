#!/usr/bin/env bash
set -euo pipefail

BASE_ENV=""
OUTPUT=""
GHCR_OWNER="${GHCR_OWNER:-}"
IMAGE_TAG="${IMAGE_TAG:-}"
TRADERSAPP_DOMAIN="${TRADERSAPP_DOMAIN:-}"
BFF_PUBLIC_HOST="${BFF_PUBLIC_HOST:-}"
API_PUBLIC_HOST="${API_PUBLIC_HOST:-}"
COMPOSE_PROFILES="${COMPOSE_PROFILES:-core}"
BFF_TELEGRAM_BOT_TOKEN="${BFF_TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_AGENT_CHAT_ID="${TELEGRAM_AGENT_CHAT_ID:-}"
CANONICAL_PUBLIC_FRONTEND="https://tradergunit.pages.dev"

usage() {
  cat <<'EOF'
Usage: build-runtime-env.sh --output /path/to/.env [options]

Options:
  --base-env FILE          Base env file from CONTABO_APP_ENV or Infisical output
  --output FILE            Destination .env file
  --ghcr-owner OWNER       GHCR owner/org (required if absent from base env)
  --image-tag TAG          Image tag to deploy (default: latest)
  --domain HOST            Contabo runtime-edge frontend hostname (default: 173.249.18.14.sslip.io)
  --bff-host HOST          Contabo runtime-edge BFF hostname
  --api-host HOST          Contabo runtime-edge API hostname
  --compose-profiles LIST  Optional compose profiles, comma-separated
  --telegram-token TOKEN  BFF_TELEGRAM_BOT_TOKEN (overrides env var)
  --telegram-chat-id ID    TELEGRAM_AGENT_CHAT_ID
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-env)
      BASE_ENV="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    --ghcr-owner)
      GHCR_OWNER="$2"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --domain)
      TRADERSAPP_DOMAIN="$2"
      shift 2
      ;;
    --bff-host)
      BFF_PUBLIC_HOST="$2"
      shift 2
      ;;
    --api-host)
      API_PUBLIC_HOST="$2"
      shift 2
      ;;
    --compose-profiles)
      COMPOSE_PROFILES="$2"
      shift 2
      ;;
    --telegram-token)
      BFF_TELEGRAM_BOT_TOKEN="$2"
      shift 2
      ;;
    --telegram-chat-id)
      TELEGRAM_AGENT_CHAT_ID="$2"
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

if [ -z "${OUTPUT}" ]; then
  echo "--output is required." >&2
  exit 1
fi

if [ -z "${GHCR_OWNER}" ]; then
  echo "GHCR owner is required." >&2
  exit 1
fi

if [ -z "${IMAGE_TAG}" ]; then
  IMAGE_TAG="latest"
fi

if [ -z "${TRADERSAPP_DOMAIN}" ]; then
  TRADERSAPP_DOMAIN="173.249.18.14.sslip.io"
fi

if [ -z "${BFF_PUBLIC_HOST}" ]; then
  BFF_PUBLIC_HOST="bff.${TRADERSAPP_DOMAIN}"
fi

if [ -z "${API_PUBLIC_HOST}" ]; then
  API_PUBLIC_HOST="api.${TRADERSAPP_DOMAIN}"
fi

install -d "$(dirname "${OUTPUT}")"
tmp_file="$(mktemp)"

if [ -n "${BASE_ENV}" ] && [ -f "${BASE_ENV}" ]; then
  while IFS= read -r line; do
    line="$(printf '%s' "${line}" | tr -d '\r' | sed -E 's/^export[[:space:]]+//')"
    case "${line}" in
      ""|\#*)
        continue
        ;;
    esac

    key="${line%%=*}"
    case "${key}" in
      COMPOSE_PROJECT_NAME|TRADERSAPP_ROOT|GHCR_OWNER|IMAGE_TAG|TRADERSAPP_DOMAIN|BFF_PUBLIC_HOST|API_PUBLIC_HOST|COMPOSE_PROFILES|NODE_ENV|BFF_HOST|BFF_PORT|BFF_ALLOWED_ORIGINS|REDIS_HOST|REDIS_PORT|ML_ENGINE_URL|ML_ANALYSIS_TRANSPORT|ML_ANALYSIS_GRPC_ADDR|ML_ANALYSIS_GRPC_STRICT|ANALYSIS_SERVICE_GRPC_PORT|ANALYSIS_SERVICE_HEALTH_PORT)
        continue
        ;;
      BFF_TELEGRAM_BOT_TOKEN|TELEGRAM_AGENT_ENABLED|TELEGRAM_AGENT_CHAT_ID|TELEGRAM_BOT_TOKEN)
        printf '%s\n' "${line}" >> "${tmp_file}"
        continue
        ;;
      EMAILJS_SERVICE_ID|EMAILJS_TEMPLATE_ID|EMAILJS_PUBLIC_KEY|EMAILJS_PRIVATE_KEY|ADMIN_EMAILJS_SERVICE_ID|ADMIN_EMAILJS_TEMPLATE_ID|ADMIN_EMAILJS_PUBLIC_KEY|ADMIN_EMAILJS_PRIVATE_KEY|ADMIN_MFA_EMAILS)
        printf '%s\n' "${line}" >> "${tmp_file}"
        continue
        ;;
    ADMIN_TOTP_SECRET|ADMIN_MASTER_EMAIL)
        printf '%s\n' "${line}" >> "${tmp_file}"
        continue
        ;;
    esac

    printf '%s\n' "${line}" >> "${tmp_file}"
  done < "${BASE_ENV}"
else
  : > "${tmp_file}"
fi

cat >> "${tmp_file}" <<EOF
COMPOSE_PROJECT_NAME=tradersapp
TRADERSAPP_ROOT=/opt/tradersapp
GHCR_OWNER=${GHCR_OWNER}
IMAGE_TAG=${IMAGE_TAG}
TRADERSAPP_DOMAIN=${TRADERSAPP_DOMAIN}
BFF_PUBLIC_HOST=${BFF_PUBLIC_HOST}
API_PUBLIC_HOST=${API_PUBLIC_HOST}
COMPOSE_PROFILES=${COMPOSE_PROFILES}
NODE_ENV=production
BFF_HOST=0.0.0.0
BFF_PORT=8788
BFF_ALLOWED_ORIGINS=${CANONICAL_PUBLIC_FRONTEND},https://${TRADERSAPP_DOMAIN},https://${BFF_PUBLIC_HOST},https://${API_PUBLIC_HOST}
REDIS_HOST=redis
REDIS_PORT=6379
BOARD_ROOM_STORAGE_MODE=file
BOARD_ROOM_FALLBACK_STORE=/app/board-room/fallback-store.json
SESSION_STORAGE_MODE=file
SESSION_FALLBACK_STORE=/app/runtime/session-store.json
ADMIN_PASSWORD_LOGIN_ENABLED=false
ML_ENGINE_URL=http://ml-engine:8001
ML_ANALYSIS_TRANSPORT=grpc
ML_ANALYSIS_GRPC_ADDR=analysis-service:50051
ML_ANALYSIS_GRPC_STRICT=false
ANALYSIS_SERVICE_GRPC_PORT=50051
ANALYSIS_SERVICE_HEALTH_PORT=8082
BFF_TELEGRAM_BOT_TOKEN=${BFF_TELEGRAM_BOT_TOKEN}
TELEGRAM_AGENT_ENABLED=true
TELEGRAM_AGENT_CHAT_ID=${TELEGRAM_AGENT_CHAT_ID}
EOF

mv "${tmp_file}" "${OUTPUT}"
chmod 600 "${OUTPUT}"

echo "Wrote ${OUTPUT}"
