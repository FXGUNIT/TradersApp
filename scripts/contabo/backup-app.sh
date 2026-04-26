#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/tradersapp"
LABEL=""
RETENTION="${CONTABO_BACKUP_RETENTION:-10}"

usage() {
  cat <<'EOF'
Usage: backup-app.sh --app-root /opt/tradersapp [--label commit-or-tag]

Creates a pre-deploy backup under APP_ROOT/backups containing:
- runtime env
- current deploy bundle
- latest source snapshot archive
- important Docker named volumes when present
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --app-root)
      APP_ROOT="$2"
      shift 2
      ;;
    --label)
      LABEL="$2"
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

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
safe_label="$(printf '%s' "${LABEL:-manual}" | tr -cs 'A-Za-z0-9_.-' '-')"
backup_dir="${APP_ROOT}/backups"
tmp_dir="$(mktemp -d)"
archive="${backup_dir}/tradersapp_${timestamp}_${safe_label}.tgz"

cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

install -d -m 0750 "${backup_dir}"
install -d "${tmp_dir}/runtime" "${tmp_dir}/deploy" "${tmp_dir}/source" "${tmp_dir}/volumes"

copy_if_exists() {
  local source="$1"
  local target="$2"
  if [ -e "${source}" ]; then
    cp -a "${source}" "${target}"
  fi
}

backup_volume() {
  local volume="$1"
  local target="${tmp_dir}/volumes/${volume}.tgz"
  local mountpoint=""
  mountpoint="$(docker volume inspect -f '{{.Mountpoint}}' "${volume}" 2>/dev/null || true)"
  if [ -n "${mountpoint}" ] && [ -d "${mountpoint}" ]; then
    tar -C "${mountpoint}" -czf "${target}" .
  fi
}

copy_if_exists "${APP_ROOT}/runtime/.env.contabo" "${tmp_dir}/runtime/.env.contabo"
copy_if_exists "${APP_ROOT}/deploy/contabo" "${tmp_dir}/deploy/contabo"
copy_if_exists "${APP_ROOT}/source/latest.tgz" "${tmp_dir}/source/latest.tgz"
copy_if_exists "/var/backups/tradersapp/source/source_latest.tgz" "${tmp_dir}/source/source_latest.tgz"

cat > "${tmp_dir}/manifest.txt" <<EOF
created_utc=${timestamp}
label=${LABEL}
app_root=${APP_ROOT}
host=$(hostname)
EOF

for volume in \
  tradersapp_board_room_data \
  tradersapp_admin_session_data \
  tradersapp_redis_data \
  tradersapp_ml_data \
  tradersapp_ml_models; do
  backup_volume "${volume}"
done

tar -C "${tmp_dir}" -czf "${archive}" .
chmod 0640 "${archive}"

if [ "${RETENTION}" -gt 0 ] 2>/dev/null; then
  find "${backup_dir}" -maxdepth 1 -name 'tradersapp_*.tgz' -type f \
    | sort \
    | head -n "-${RETENTION}" \
    | xargs -r rm -f
fi

echo "[backup] Wrote ${archive}"
