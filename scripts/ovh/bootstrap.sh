#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/tradersapp"
APP_USER="tradersapp"
SKIP_FIREWALL="0"

usage() {
  cat <<'EOF'
Usage: bootstrap.sh [--app-root /opt/tradersapp] [--user tradersapp] [--skip-firewall]

Idempotent OVH VPS bootstrap for TradersApp:
  - installs Docker Engine + compose plugin
  - installs curl, git, rsync, jq, fail2ban, ufw
  - creates the tradersapp runtime directories
  - installs the tradersapp systemd unit
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --app-root)
      APP_ROOT="$2"
      shift 2
      ;;
    --user)
      APP_USER="$2"
      shift 2
      ;;
    --skip-firewall)
      SKIP_FIREWALL="1"
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
  echo "bootstrap.sh must run as root." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This bootstrap currently supports Debian/Ubuntu only." >&2
  exit 1
fi

install_docker_repo() {
  install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.asc ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi

  local codename arch
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
  arch="$(dpkg --print-architecture)"
  local distro
  distro="$(. /etc/os-release && echo "${ID}")"
  if [ "${distro}" != "ubuntu" ] && [ "${distro}" != "debian" ]; then
    echo "Unsupported Linux distribution for Docker repo: ${distro}" >&2
    exit 1
  fi

  cat > /etc/apt/sources.list.d/docker.list <<EOF
deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${distro} ${codename} stable
EOF
}

ensure_user() {
  if ! id "${APP_USER}" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash "${APP_USER}"
  fi
  usermod -aG docker "${APP_USER}"
}

configure_firewall() {
  if [ "${SKIP_FIREWALL}" = "1" ]; then
    return 0
  fi

  if command -v ufw >/dev/null 2>&1; then
    ufw allow OpenSSH >/dev/null 2>&1 || true
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    ufw --force enable >/dev/null 2>&1 || true
  fi
}

install_systemd_unit() {
  cat > /etc/systemd/system/tradersapp.service <<EOF
[Unit]
Description=TradersApp OVH Docker Compose stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target
ConditionPathExists=${APP_ROOT}/deploy/ovh/docker-compose.yml
ConditionPathExists=${APP_ROOT}/runtime/.env.ovh

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_ROOT}/deploy/ovh
User=${APP_USER}
Group=docker
ExecStart=/usr/bin/docker compose --project-name tradersapp --project-directory ${APP_ROOT}/deploy/ovh --env-file ${APP_ROOT}/runtime/.env.ovh -f ${APP_ROOT}/deploy/ovh/docker-compose.yml up -d --remove-orphans
ExecStop=/usr/bin/docker compose --project-name tradersapp --project-directory ${APP_ROOT}/deploy/ovh --env-file ${APP_ROOT}/runtime/.env.ovh -f ${APP_ROOT}/deploy/ovh/docker-compose.yml down
ExecReload=/usr/bin/docker compose --project-name tradersapp --project-directory ${APP_ROOT}/deploy/ovh --env-file ${APP_ROOT}/runtime/.env.ovh -f ${APP_ROOT}/deploy/ovh/docker-compose.yml up -d --remove-orphans
TimeoutStartSec=900

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable tradersapp.service >/dev/null 2>&1 || true
}

echo "[bootstrap] Installing OS packages..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg lsb-release git jq rsync fail2ban ufw sudo

echo "[bootstrap] Installing Docker..."
install_docker_repo
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker >/dev/null 2>&1 || true
systemctl restart docker

echo "[bootstrap] Creating application user and directories..."
ensure_user
install -d -m 0755 -o "${APP_USER}" -g "${APP_USER}" "${APP_ROOT}" "${APP_ROOT}/deploy" "${APP_ROOT}/deploy/ovh" "${APP_ROOT}/runtime" "${APP_ROOT}/logs"

echo "[bootstrap] Enabling baseline host protection..."
configure_firewall
systemctl enable fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban >/dev/null 2>&1 || true

echo "[bootstrap] Installing systemd service..."
install_systemd_unit

echo "[bootstrap] Complete. App root: ${APP_ROOT}"
