#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/tradersapp}"
COMMAND_NAME="${1:-ps}"

run_privileged() {
  if [ "$(id -u)" -ne 0 ]; then
    sudo "$@"
  else
    "$@"
  fi
}

case "${COMMAND_NAME}" in
  ps)
    run_privileged docker compose \
      --project-name tradersapp \
      --project-directory "${APP_ROOT}/deploy/contabo" \
      --env-file "${APP_ROOT}/runtime/.env.contabo" \
      -f "${APP_ROOT}/deploy/contabo/docker-compose.yml" \
      ps
    ;;
  logs)
    run_privileged docker compose \
      --project-name tradersapp \
      --project-directory "${APP_ROOT}/deploy/contabo" \
      --env-file "${APP_ROOT}/runtime/.env.contabo" \
      -f "${APP_ROOT}/deploy/contabo/docker-compose.yml" \
      logs --tail 200
    ;;
  *)
    echo "Unknown command: ${COMMAND_NAME}" >&2
    exit 1
    ;;
esac
