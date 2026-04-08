#!/bin/bash
# k8s/scripts/bootstrap-docker.sh — Install Docker inside WSL Ubuntu
#
# Usage:
#   ./bootstrap-docker.sh         # Install Docker CE in WSL Ubuntu
#   ./bootstrap-docker.sh --verify  # Just verify it's working
#
# This is needed so we can `docker build` inside WSL instead of
# fighting with Docker Desktop on Windows.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Install Docker CE inside WSL Ubuntu ───────────────────────────────────────

install_docker() {
    if command -v docker &>/dev/null; then
        info "Docker already installed: $(docker --version)"
        return 0
    fi

    info "Installing Docker CE inside WSL Ubuntu..."

    sudo apt-get update -qq
    sudo apt-get install -y -qq apt-transport-https ca-certificates \
        curl gnupg lsb-release

    # Add Docker GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

    # Add Docker repo
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin

    # Enable and start Docker
    sudo systemctl enable docker
    sudo systemctl start docker

    # Add current user to docker group
    sudo usermod -aG docker "$USER"

    info "Docker CE installed: $(docker --version)"
    info "IMPORTANT: Docker daemon started. You may need to re-login for docker group to take effect."
    info "Or run: newgrp docker"
}

# ── Verify ───────────────────────────────────────────────────────────────────

verify() {
    info "Verifying Docker installation..."
    if ! command -v docker &>/dev/null; then
        error "Docker not found in PATH"
    fi

    if ! sudo docker info &>/dev/null; then
        error "Docker daemon not running. Try: sudo systemctl start docker"
    fi

    info "Docker CE: $(docker --version)"
    info "Docker daemon: running"
    info "Docker images: $(sudo docker images -q | wc -l) locally cached"
}

case "${1:-}" in
    --verify)
        verify
        ;;
    *)
        install_docker
        verify
        ;;
esac
