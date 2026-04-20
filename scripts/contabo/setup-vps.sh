#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# TradersApp — Contabo VPS One-Time Setup
# Run once on a fresh Contabo VPS to prepare it for TradersApp deployment.
# ─────────────────────────────────────────────────────────────────────────────
# Usage: curl -fsSL https://raw.githubusercontent.com/fxgunit/TradersApp/main/scripts/contabo/setup-vps.sh | bash
# Or:    bash setup-vps.sh <your-public-ssh-key>
# ─────────────────────────────────────────────────────────────────────────────

set -e

SSH_KEY="${1:-}"
DEPLOY_PATH="/opt/tradersapp"

echo "=== TradersApp Contabo VPS Setup ==="

# ── 1. Update system ──────────────────────────────────────────────────────────
echo "[1/8] Updating system packages..."
apt-get update -qq
apt-get install -y -qq curl git ufw fail2ban > /dev/null 2>&1

# ── 2. Firewall (SSH + HTTP + HTTPS only) ──────────────────────────────────
echo "[2/8] Configuring firewall (SSH, HTTP, HTTPS)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# ── 3. Create deploy user ───────────────────────────────────────────────────
echo "[3/8] Creating deploy user..."
id -u tradersapp > /dev/null 2>&1 || useradd -m -s /bin/bash tradersapp
echo "tradersapp ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers
mkdir -p /home/tradersapp/.ssh
chmod 700 /home/tradersapp/.ssh

# Add SSH key if provided
if [ -n "$SSH_KEY" ]; then
    echo "$SSH_KEY" >> /home/tradersapp/.ssh/authorized_keys
    chown tradersapp:tradersapp /home/tradersapp/.ssh/authorized_keys
    chmod 600 /home/tradersapp/.ssh/authorized_keys
fi

# ── 4. Ensure Docker is installed ─────────────────────────────────────────
echo "[4/8] Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "Docker not found — installing..."
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker tradersapp
    systemctl enable docker
else
    echo "Docker already installed: $(docker --version)"
fi

# ── 5. Ensure Docker Compose is installed ───────────────────────────────────
echo "[5/8] Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi
echo "Docker Compose: $(docker compose version)"

# ── 6. Create app directories ───────────────────────────────────────────────
echo "[6/8] Creating app directories..."
mkdir -p "$DEPLOY_PATH/deploy/ovh"
mkdir -p "$DEPLOY_PATH/runtime"
mkdir -p "$DEPLOY_PATH/logs"
chown -R tradersapp:tradersapp "$DEPLOY_PATH"

# ── 7. Clone TradersApp repo (as tradersapp user) ───────────────────────────
echo "[7/8] Cloning TradersApp repo..."
if [ -d "$DEPLOY_PATH/deploy/ovh/.git" ]; then
    echo "Repo already cloned — updating..."
    cd "$DEPLOY_PATH/deploy/ovh"
    sudo -u tradersapp git pull origin main || true
else
    sudo -u tradersapp git clone --depth=1 https://github.com/fxgunit/TradersApp.git "$DEPLOY_PATH/deploy/ovh"
fi

# ── 8. Create runtime .env from example ─────────────────────────────────────
echo "[8/8] Creating runtime .env..."
if [ ! -f "$DEPLOY_PATH/runtime/.env.ovh" ]; then
    if [ -f "$DEPLOY_PATH/deploy/ovh/deploy/ovh/runtime.env.example" ]; then
        cp "$DEPLOY_PATH/deploy/ovh/deploy/ovh/runtime.env.example" "$DEPLOY_PATH/runtime/.env.ovh"
    fi
fi

echo ""
echo "=== Setup Complete ==="
echo "VPS is ready for TradersApp deployment."
echo ""
echo "Next step:"
echo "  1. Add CONTABO_SSH_KEY, CONTABO_VPS_HOST, CONTABO_VPS_USER to GitHub Secrets"
echo "  2. Trigger deploy-contabo.yml from GitHub Actions tab"
echo "  3. Or run manually on VPS:"
echo "     cd $DEPLOY_PATH/deploy/ovh"
echo "     docker compose --env-file $DEPLOY_PATH/runtime/.env.ovh up -d"