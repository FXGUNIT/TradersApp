#!/bin/bash
# k8s/scripts/deploy.sh — Deploy TradersApp to k3s (runs inside WSL Ubuntu)
#
# Usage:
#   ./deploy.sh                # Dev (images + all manifests)
#   ./deploy.sh --workloads     # Workloads only (no image build)
#   ./deploy.sh --workloads     # Workloads only
#   ./deploy.sh --destroy       # Tear down tradersapp namespace
#
# Prerequisites (must run inside WSL Ubuntu):
#   - k3s running: sudo k3s kubectl get nodes
#   - Docker installed in WSL (run bootstrap-docker.sh first if not)
#   - TradersApp repo at /mnt/e/TradersApp
#
# What it does:
#   1. Build and import ml-engine, bff, frontend Docker images into k3s containerd
#   2. Apply PVCs (with local-path storage class)
#   3. Apply ConfigMaps, PDBs, NetworkPolicies
#   4. Apply Deployment + Service for ml-engine, bff, frontend
#   5. Apply HPA for ml-engine and bff

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
NAMESPACE="${NAMESPACE:-tradersapp}"
IMAGES=("tradersapp/ml-engine:latest" "tradersapp/bff:latest" "tradersapp/frontend:latest")

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────

check_prereqs() {
    info "Pre-flight checks..."

    # k3s must be running
    if ! sudo k3s kubectl get nodes &>/dev/null; then
        error "k3s not responding. Run: sudo k3s kubectl get nodes"
    fi
    info "k3s is ready"

    # Docker must be installed in WSL
    if ! command -v docker &>/dev/null; then
        error "Docker not found in WSL. Run: ./k8s/scripts/bootstrap-docker.sh first"
    fi
    if ! docker info &>/dev/null; then
        error "Docker not running. Start with: sudo systemctl start docker"
    fi
    info "Docker is ready"

    # Repo must be accessible
    if [[ ! -d "$REPO_DIR" ]]; then
        error "TradersApp repo not found at $REPO_DIR"
    fi
    info "Repo found at $REPO_DIR"
}

# ── Build images ───────────────────────────────────────────────────────────────

build_images() {
    info "Building Docker images..."
    cd "$REPO_DIR"

    # ml-engine
    info "Building tradersapp/ml-engine:latest ..."
    docker build -t tradersapp/ml-engine:latest \
        -f Dockerfile.ml-engine . 2>&1 | tail -3

    # bff
    info "Building tradersapp/bff:latest ..."
    docker build -t tradersapp/bff:latest \
        -f Dockerfile.bff . 2>&1 | tail -3

    # frontend
    info "Building tradersapp/frontend:latest ..."
    docker build -t tradersapp/frontend:latest \
        -f Dockerfile.frontend . 2>&1 | tail -3

    info "All images built successfully"
}

# ── Import images into k3s containerd ────────────────────────────────────────

import_images() {
    info "Importing images into k3s containerd..."
    for img in "${IMAGES[@]}"; do
        info "  Importing $img ..."
        docker save "$img" | sudo k3s ctr images import - 2>&1 | tail -3
    done
    info "Images imported into k3s"
}

# ── Apply manifests ──────────────────────────────────────────────────────────

apply_base() {
    info "Applying base manifests..."
    cd "$REPO_DIR/k8s"

    # Namespace (already exists but idempotent)
    sudo k3s kubectl apply -f namespace.yaml 2>/dev/null || true

    # PVCs (storage class already fixed to local-path)
    sudo k3s kubectl apply -f base/storage.yaml
    info "PVCs applied"

    # ConfigMaps
    sudo k3s kubectl apply -f base/config.yaml
    info "ConfigMaps applied"

    # PDBs
    sudo k3s kubectl apply -f base/pdb.yaml
    info "PDBs applied"

    # NetworkPolicies
    sudo k3s kubectl apply -f base/network-policies.yaml
    info "NetworkPolicies applied"

    # Secrets (placeholders only — replace before prod)
    sudo k3s kubectl apply -f base/secrets.yaml 2>/dev/null || true
    info "Base manifests applied"
}

apply_workloads() {
    info "Applying workloads..."
    cd "$REPO_DIR/k8s"

    # Ensure external-secrets CRDs exist ( ESO not installed — skip gracefully)
    sudo k3s kubectl apply -f base/external-secrets.yaml 2>/dev/null || true

    # ML Engine
    sudo k3s kubectl apply -f ml-deployment.yaml
    info "ml-engine Deployment + Service applied"

    # BFF
    sudo k3s kubectl apply -f bff-deployment.yaml
    info "bff Deployment + Service applied"

    # Frontend
    sudo k3s kubectl apply -f frontend-deployment.yaml
    info "frontend Deployment + Service applied"

    # HPAs
    sudo k3s kubectl apply -f hpa-ml-engine.yaml
    sudo k3s kubectl apply -f hpa-bff.yaml
    info "HPAs applied"
}

# ── Verify deployment ────────────────────────────────────────────────────────

verify() {
    info "Verifying deployment..."
    echo ""

    echo "=== Nodes ==="
    sudo k3s kubectl get nodes
    echo ""

    echo "=== Pods ==="
    sudo k3s kubectl get pods -n "$NAMESPACE" -o wide
    echo ""

    echo "=== Services ==="
    sudo k3s kubectl get svc -n "$NAMESPACE"
    echo ""

    echo "=== PVCs ==="
    sudo k3s kubectl get pvc -n "$NAMESPACE"
    echo ""

    echo "=== HPAs ==="
    sudo k3s kubectl get hpa -n "$NAMESPACE" 2>/dev/null || true
    echo ""

    # Wait for pods to be ready
    echo "=== Waiting for ml-engine pod ==="
    sudo k3s kubectl wait --for=condition=Ready pod -l app=ml-engine -n "$NAMESPACE" --timeout=300s 2>/dev/null || \
        warn "ml-engine pod not ready yet — check status above"
}

# ── Destroy ───────────────────────────────────────────────────────────────────

destroy() {
    warn "Deleting tradersapp namespace and all resources..."
    sudo k3s kubectl delete namespace "$NAMESPACE" --ignore-not-found=true
    info "tradersapp namespace deleted"
}

# ── Main ──────────────────────────────────────────────────────────────────────

case "${1:-}" in
    --destroy)
        destroy
        ;;
    --workloads)
        check_prereqs
        apply_workloads
        verify
        ;;
    --help|-h)
        echo "Usage: $0 [--workloads|--destroy|--help]"
        echo ""
        echo "  (default)  Build images + import + apply everything"
        echo "  --workloads  Apply workloads only (no image build)"
        echo "  --destroy    Delete tradersapp namespace"
        echo ""
        echo "Examples:"
        echo "  $0                    # Full deploy (build + apply)"
        echo "  $0 --workloads        # Apply workloads only"
        echo "  $0 --destroy          # Tear down"
        ;;
    *)
        check_prereqs
        build_images
        import_images
        apply_base
        apply_workloads
        verify
        ;;
esac
