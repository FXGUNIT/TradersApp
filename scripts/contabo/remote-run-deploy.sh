#!/usr/bin/env bash
set -euo pipefail

RELEASE_DIR="${RELEASE_DIR:-/tmp/tradersapp-contabo-release}"
APP_ROOT="${APP_ROOT:-/opt/tradersapp}"
SKIP_BOOTSTRAP="${SKIP_BOOTSTRAP:-true}"
GHCR_USERNAME="${GHCR_USERNAME:-}"
GHCR_TOKEN_B64_FILE="${GHCR_TOKEN_B64_FILE:-}"

run_privileged() {
  if [ "$(id -u)" -ne 0 ]; then
    sudo "$@"
  else
    "$@"
  fi
}

if [ ! -d "${RELEASE_DIR}/deploy/contabo" ]; then
  echo "Remote release bundle is not extracted under ${RELEASE_DIR}." >&2
  exit 1
fi

if [ "${SKIP_BOOTSTRAP}" != "true" ]; then
  run_privileged bash "${RELEASE_DIR}/scripts/contabo/setup-vps.sh" --app-root "${APP_ROOT}"
fi

if [ -z "${GHCR_TOKEN_B64_FILE}" ] || [ ! -f "${GHCR_TOKEN_B64_FILE}" ]; then
  echo "GHCR token file is required at ${GHCR_TOKEN_B64_FILE}." >&2
  exit 1
fi

base64 -d "${GHCR_TOKEN_B64_FILE}" | run_privileged bash "${RELEASE_DIR}/scripts/contabo/deploy.sh" \
  --bundle-root "${RELEASE_DIR}" \
  --env-file "${RELEASE_DIR}/.env.contabo" \
  --app-root "${APP_ROOT}" \
  --ghcr-username "${GHCR_USERNAME}" \
  --ghcr-token-stdin
