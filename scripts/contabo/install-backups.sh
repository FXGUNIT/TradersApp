#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/tradersapp"
BACKUP_ROOT="/var/backups/tradersapp"
IMAGE_TAG=""
RUN_ONCE="0"

usage() {
  cat <<'EOF'
Usage: install-backups.sh [--app-root /opt/tradersapp] [--backup-root /var/backups/tradersapp] [--image-tag SHA] [--run-once]

Installs Contabo VPS backup scheduling for TradersApp:
  - data backups under /var/backups/tradersapp
  - source snapshot latest symlink verification
  - root cron entry with flock to avoid overlapping runs
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --app-root)
      APP_ROOT="$2"
      shift 2
      ;;
    --backup-root)
      BACKUP_ROOT="$2"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --run-once)
      RUN_ONCE="1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "install-backups.sh must run as root." >&2
  exit 1
fi

BACKUP_TOOLS="${APP_ROOT}/backup-tools"
CRON_FILE="/etc/cron.d/tradersapp-backups"
LOG_DIR="${BACKUP_ROOT}/logs"

if [ ! -x "${BACKUP_TOOLS}/scripts/contabo/run-backups.sh" ]; then
  echo "Backup tools are missing under ${BACKUP_TOOLS}." >&2
  exit 1
fi

install -d -m 0750 "${BACKUP_ROOT}" \
  "${BACKUP_ROOT}/redis" \
  "${BACKUP_ROOT}/sqlite" \
  "${BACKUP_ROOT}/postgres" \
  "${BACKUP_ROOT}/source" \
  "${LOG_DIR}"

chmod +x \
  "${BACKUP_TOOLS}/scripts/contabo/run-backups.sh" \
  "${BACKUP_TOOLS}/scripts/contabo/verify-backups.sh" \
  "${BACKUP_TOOLS}/scripts/cron/"*.sh 2>/dev/null || true

cat > "${CRON_FILE}" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# TradersApp Contabo backups. Installed by scripts/contabo/install-backups.sh.
# Data backups run daily. Verification runs after the backup window.
0 2 * * * root flock -n /var/lock/tradersapp-backups.lock env APP_ROOT=${APP_ROOT} BACKUP_ROOT=${BACKUP_ROOT} ${BACKUP_TOOLS}/scripts/contabo/run-backups.sh all >> ${LOG_DIR}/backup.log 2>&1
45 2 * * * root env APP_ROOT=${APP_ROOT} BACKUP_ROOT=${BACKUP_ROOT} ${BACKUP_TOOLS}/scripts/contabo/verify-backups.sh >> ${LOG_DIR}/verify.log 2>&1
EOF

chmod 0644 "${CRON_FILE}"

if command -v systemctl >/dev/null 2>&1; then
  systemctl reload cron >/dev/null 2>&1 || systemctl reload crond >/dev/null 2>&1 || true
fi

echo "[contabo-backup] Installed cron file: ${CRON_FILE}"
echo "[contabo-backup] Backup root: ${BACKUP_ROOT}"
[ -n "${IMAGE_TAG}" ] && echo "[contabo-backup] Deployed image/source tag: ${IMAGE_TAG}"

if [ "${RUN_ONCE}" = "1" ]; then
  echo "[contabo-backup] Running immediate best-effort backup..."
  APP_ROOT="${APP_ROOT}" BACKUP_ROOT="${BACKUP_ROOT}" \
    "${BACKUP_TOOLS}/scripts/contabo/run-backups.sh" all || {
      echo "[contabo-backup] Immediate backup had warnings/failures; scheduled backup remains installed." >&2
    }
  APP_ROOT="${APP_ROOT}" BACKUP_ROOT="${BACKUP_ROOT}" \
    "${BACKUP_TOOLS}/scripts/contabo/verify-backups.sh" || {
      echo "[contabo-backup] Verification reported pending/missing backup artifacts; scheduled backup remains installed." >&2
    }
fi
