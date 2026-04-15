#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/tradersapp}"
BACKUP_DIR="${BACKUP_ROOT}/redis"

mkdir -p "${BACKUP_DIR}"

export REDIS_CONTAINER="${REDIS_CONTAINER:-traders-redis}"
export BACKUP_DIR

python3 "${ROOT_DIR}/scripts/backup_redis.py" --backup-dir "${BACKUP_DIR}"
