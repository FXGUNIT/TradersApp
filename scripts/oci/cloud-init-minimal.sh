#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# TradersApp — Minimal cloud-init (step 1 of 2)
# This runs on first boot only. It does basic setup without heavy installs.
# Step 2: SSH in manually to install Redis from source.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail
exec 2>&1

echo "=== Step 1: Minimal bootstrap (no heavy installs) ==="
echo "Started at $(date)"

# ── 1. Create tradersapp user + dirs ──────────────────────────────
echo "[1/4] User setup..."
id tradersapp &>/dev/null || useradd -m -s /bin/bash tradersapp
mkdir -p /home/tradersapp/data
echo "User tradersapp ready."

# ── 2. Clone repo ───────────────────────────────────────────────
echo "[2/4] Clone repo..."
if [ ! -d /home/tradersapp/TradersApp ]; then
  sudo -u tradersapp git clone --depth 1 https://github.com/FXGUNIT/TradersApp.git /home/tradersapp/TradersApp
fi
echo "Repo cloned."

# ── 3. Set SSH key for tradersapp user ──────────────────────────
echo "[3/4] SSH key for tradersapp..."
mkdir -p /home/tradersapp/.ssh
chmod 700 /home/tradersapp/.ssh
# Copy opc's SSH authorized_keys to tradersapp
cp /home/opc/.ssh/authorized_keys /home/tradersapp/.ssh/authorized_keys 2>/dev/null || true
chown -R tradersapp:tradersapp /home/tradersapp/.ssh
chmod 600 /home/tradersapp/.ssh/authorized_keys
echo "SSH key configured."

# ── 4. Add Oracle EPEL for redis package ─────────────────────────
echo "[4/4] Enable EPEL..."
dnf install -y oracle-epel-ol8 -q 2>&1 | tail -2 || \
dnf install -y epel-release -q 2>&1 | tail -2 || true

echo ""
echo "=== Step 1 complete at $(date) ==="
echo "SSH in manually to run step 2 (Redis install)."
