#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# TradersApp — Redis 7.2.4 via pre-compiled static binary
# E2.1.Micro (1 GB RAM) safe — NO gcc, NO make, NO dnf
# Just wget + tar + configure + start.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail
exec 2>&1

REDIS_VERSION="7.2.4"
REDIS_PASS="tradersapp_redis_pass"
MAXMEM="768mb"
INSTALL_DIR="/opt/redis"
REDIS_USER="redis"

log() { echo "[$(date +%H:%M:%S)] $*"; }

log "=== Redis ${REDIS_VERSION} Static Binary Install ==="

# ── 1. Download Redis source from redis.io (confirmed accessible) ─
log "[1/4] Downloading Redis ${REDIS_VERSION} from redis.io..."
mkdir -p "${INSTALL_DIR}"
cd /tmp

wget -q --timeout=300 \
  "https://download.redis.io/releases/redis-${REDIS_VERSION}.tar.gz" \
  -O "redis-${REDIS_VERSION}.tar.gz"
tar xzf "redis-${REDIS_VERSION}.tar.gz"

cp "/tmp/redis-${REDIS_VERSION}/src/redis-server" "${INSTALL_DIR}/"
cp "/tmp/redis-${REDIS_VERSION}/src/redis-cli" "${INSTALL_DIR}/"
cp "/tmp/redis-${REDIS_VERSION}/src/redis-benchmark" "${INSTALL_DIR}/"
cp "/tmp/redis-${REDIS_VERSION}/src/redis-check-aof" "${INSTALL_DIR}/"
cp "/tmp/redis-${REDIS_VERSION}/src/redis-check-rdb" "${INSTALL_DIR}/"

chmod +x "${INSTALL_DIR}/redis-server" "${INSTALL_DIR}/redis-cli"
log "Binary installed."

# ── 2. Configure ─────────────────────────────────────────────────
log "[2/4] Configuring..."
mkdir -p /var/lib/redis /var/log/redis /etc/redis

id "${REDIS_USER}" &>/dev/null || useradd -r -s /sbin/nologin -d /var/lib/redis "${REDIS_USER}" || true
chown "${REDIS_USER}:${REDIS_USER}" /var/lib/redis /var/log/redis

cat > /etc/redis/redis.conf << CONF
bind 0.0.0.0
port 6379
protected-mode yes
requirepass ${REDIS_PASS}
maxmemory ${MAXMEM}
maxmemory-policy allkeys-lru
save 60 1000
appendonly yes
appendfilename "appendonly.aof"
logfile /var/log/redis/redis.log
loglevel notice
daemonize no
CONF

# ── 3. Systemd service ──────────────────────────────────────────
log "[3/4] Systemd service..."
cat > /etc/systemd/system/tradersapp-redis.service << 'EOF'
[Unit]
Description=Redis for TradersApp (static binary)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=redis
Group=redis
ExecStart=/opt/redis/redis-server /etc/redis/redis.conf --supervised systemd
ExecStop=/opt/redis/redis-cli -a tradersapp_redis_pass shutdown nosave 2>/dev/null || true
Restart=on-failure
RestartSec=5
TimeoutStartSec=60
TimeoutStopSec=30
LimitNOFILE=65536
EOF

systemctl daemon-reload
systemctl enable tradersapp-redis.service
systemctl stop tradersapp-redis.service 2>/dev/null || true
systemctl start tradersapp-redis.service

# ── 4. Verify ────────────────────────────────────────────────────
sleep 4
PING=$(/opt/redis/redis-cli -a "${REDIS_PASS}" ping 2>/dev/null || echo "ERROR")
log "=== Result ==="
if [ "$PING" = "PONG" ]; then
  VER=$(/opt/redis/redis-cli -a ${REDIS_PASS} INFO server 2>/dev/null | grep redis_version | cut -d: -f2 | tr -d '\r')
  log "Redis: ${PING} | Version: ${VER}"
  log "Max Memory: ${MAXMEM}"
  log "Auto-start: enabled"
  log "Done!"
else
  log "FAILED — ping: $PING"
  log "Check: journalctl -u tradersapp-redis -n 20"
  exit 1
fi
