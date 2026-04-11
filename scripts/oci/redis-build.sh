#!/usr/bin/env bash
set -euo pipefail
exec 2>&1

log() { echo "[$(date +%H:%M:%S)] $*"; }
log "=== Redis Build (1GB RAM safe mode) ==="

log "[1/3] Stopping Oracle agents to free RAM..."
for pid in $(pgrep oracle-cloud-agent) $(pgrep gomon) $(pgrep oci-wlp) $(pgrep runcommand); do
  kill -STOP $pid 2>/dev/null && log "Stopped PID $pid"
done

log "[2/3] Building Redis (USE_JEMALLOC=no, MALLOC=libc, -j1)..."
cd /tmp/redis-7.2.4
make USE_JEMALLOC=no MALLOC=libc -j1 2>&1 | tail -8

log "[3/3] Installing..."
make install PREFIX=/usr/local
mkdir -p /var/lib/redis /var/log/redis /etc/redis
id redis &>/dev/null || useradd -r -s /sbin/nologin -d /var/lib/redis redis || true
chown redis:redis /var/lib/redis /var/log/redis

cat > /etc/redis/redis.conf << 'CONF'
bind 0.0.0.0
port 6379
protected-mode yes
requirepass tradersapp_redis_pass
maxmemory 768mb
maxmemory-policy allkeys-lru
save 60 1000
appendonly yes
logfile /var/log/redis/redis.log
CONF

cat > /etc/systemd/system/tradersapp-redis.service << 'EOF'
[Unit]
Description=Redis for TradersApp
After=network-online.target

[Service]
Type=simple
User=redis
Group=redis
ExecStart=/usr/local/bin/redis-server /etc/redis/redis.conf --supervised systemd
Restart=on-failure
LimitNOFILE=65536
EOF

systemctl daemon-reload
systemctl enable tradersapp-redis.service
systemctl stop tradersapp-redis.service 2>/dev/null || true
systemctl start tradersapp-redis.service
sleep 4

PING=$(/usr/local/bin/redis-cli -a tradersapp_redis_pass ping 2>/dev/null || echo "ERROR")
log "=== Result: $PING ==="
if [ "$PING" = "PONG" ]; then
  log "Redis: $PING | Version: $(/usr/local/bin/redis-cli -a tradersapp_redis_pass INFO server 2>/dev/null | grep redis_version | cut -d: -f2 | tr -d '\r')"
  log "Auto-start: enabled"
  log "Done!"
else
  log "FAILED"
  exit 1
fi
