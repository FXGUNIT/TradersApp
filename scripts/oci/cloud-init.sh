#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# TradersApp — Oracle Cloud Always Free VM Bootstrap
# ─────────────────────────────────────────────────────────────────────
# Use as cloud-init user data when launching the ARM instance, OR
# run manually via SSH after VM creation:
#   ssh ubuntu@<VM_IP> 'bash -s' < scripts/oci/cloud-init.sh
#
# What it does:
#   1. Installs Docker + Docker Compose v2
#   2. Opens firewall ports (80, 8788, 8001, 5000)
#   3. Creates tradersapp user + project dirs
#   4. Clones repo and starts the stack
#   5. Sets up auto-start on reboot (systemd)
#   6. Configures unattended security updates
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "============================================"
echo "  TradersApp OCI Bootstrap — ARM64"
echo "============================================"

# ── 1. System updates + essentials ───────────────────────────────────
echo "[1/7] System updates..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release git \
  fail2ban ufw unattended-upgrades

# ── 2. Install Docker CE (ARM64) ────────────────────────────────────
echo "[2/7] Installing Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker

# ── 3. Firewall (iptables + OCI security list) ─────────────────────
echo "[3/7] Configuring firewall..."
# OCI Ubuntu images use iptables, not ufw by default
# These rules allow traffic that OCI Security Lists already permit
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8788 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8001 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5000 -j ACCEPT
netfilter-persistent save 2>/dev/null || true

# ── 4. Create app user ──────────────────────────────────────────────
echo "[4/7] Creating app user..."
if ! id "tradersapp" &>/dev/null; then
  useradd -m -s /bin/bash -G docker tradersapp
fi

# ── 5. Clone repo ───────────────────────────────────────────────────
echo "[5/7] Cloning repository..."
APP_DIR="/home/tradersapp/TradersApp"
if [ ! -d "$APP_DIR" ]; then
  # REPLACE with your actual repo URL
  # For private repos: use deploy key or GitHub PAT
  sudo -u tradersapp git clone --depth 1 \
    https://github.com/YOUR_USERNAME/TradersApp.git "$APP_DIR"
fi

# Create data directories
sudo -u tradersapp mkdir -p "$APP_DIR/ml-engine/data"
sudo -u tradersapp mkdir -p "$APP_DIR/ml-engine/models/store"
sudo -u tradersapp mkdir -p "$APP_DIR/mlflow/artifacts"

# ── 6. Systemd service (auto-start on reboot) ──────────────────────
echo "[6/7] Creating systemd service..."
cat > /etc/systemd/system/tradersapp.service << 'EOF'
[Unit]
Description=TradersApp Docker Compose Stack
After=docker.service
Requires=docker.service

[Service]
User=tradersapp
Group=docker
WorkingDirectory=/home/tradersapp/TradersApp
Type=oneshot
RemainAfterExit=yes

ExecStart=/usr/bin/docker compose -f docker-compose.oci.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.oci.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.oci.yml up -d --build

TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable tradersapp.service

# ── 7. Security hardening ───────────────────────────────────────────
echo "[7/7] Security hardening..."

# Unattended security updates
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# fail2ban (SSH brute-force protection)
systemctl enable fail2ban
systemctl start fail2ban

# Disable password auth (SSH key only)
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd 2>/dev/null || true

echo ""
echo "============================================"
echo "  Bootstrap complete!"
echo "  Next: ssh tradersapp@<this-ip>"
echo "    cd TradersApp"
echo "    docker compose -f docker-compose.oci.yml up -d"
echo "============================================"
