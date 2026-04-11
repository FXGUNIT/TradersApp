#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TradersApp — OCI Redis Cloud VM Status Checker
# Run to verify Redis is up and accessible.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REDIS_HOST="${REDIS_HOST:-80.225.216.5}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASS="${REDIS_PASS:-tradersapp_redis_pass}"
REDIS_USER="${REDIS_USER:-opc}"
SSH_KEY="${SSH_KEY:-C:/Users/Asus/.oci/tradersapp_ssh_key}"

echo "=== TradersApp Redis Cloud VM Status ==="
echo ""

echo "[1/4] SSH connectivity..."
if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes \
    -i "${SSH_KEY}" "${REDIS_USER}@${REDIS_HOST}" "uptime" > /dev/null 2>&1; then
    echo "  SSH: OK"
else
    echo "  SSH: FAILED"
    exit 1
fi

echo "[2/4] Redis process..."
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes \
    -i "${SSH_KEY}" "${REDIS_USER}@${REDIS_HOST}" \
    "systemctl is-active tradersapp-redis && redis-cli -a ${REDIS_PASS} PING" 2>/dev/null \
    | grep -E "active|PONG" && echo "  Redis process: OK" || echo "  Redis process: FAILED"

echo "[3/4] Redis external access..."
# From laptop's perspective
E_REDIS=$(python - << 'PYEOF'
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(5)
try:
    s.connect(("%s", %d))
    s.send(b"*1\r\n$4\r\nPING\r\n")
    resp = s.recv(1024)
    print("PONG")
finally:
    s.close()
PYEOF
) 2>/dev/null || true

if [ "${E_REDIS}" = "PONG" ]; then
    echo "  External Redis: OK (accessible from your network)"
elif [ -n "${E_REDIS}" ]; then
    echo "  External Redis: ${E_REDIS}"
else
    echo "  External Redis: TIMEOUT/UNREACHABLE"
    echo "  Note: Redis is running internally but port may be blocked by local firewall/network."
    echo "  Fix: Add firewall rule on your laptop for port ${REDIS_PORT}."
fi

echo "[4/4] System status on VM..."
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes \
    -i "${SSH_KEY}" "${REDIS_USER}@${REDIS_HOST}" \
    "free -h; uptime; redis-cli -a ${REDIS_PASS} INFO server 2>/dev/null | grep -E 'redis_version|maxmemory|tcp_port'" 2>/dev/null

echo ""
echo "=== Connection Info ==="
echo "  Host:     ${REDIS_HOST}"
echo "  Redis:   ${REDIS_HOST}:${REDIS_PORT} (auth required)"
echo "  SSH:     ${REDIS_USER}@${REDIS_HOST}"
echo "  Password: ${REDIS_PASS}"
echo ""
echo "=== Connect via SSH tunnel ==="
echo "  ssh -L 16379:127.0.0.1:6379 -i ${SSH_KEY} ${REDIS_USER}@${REDIS_HOST}"
echo "  redis-cli -p 16379 -a ${REDIS_PASS}"
