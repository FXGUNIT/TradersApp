#!/bin/bash
# k8s/scripts/bootstrap.sh — Bootstrap TradersApp on k3s
#
# Usage:
#   ./bootstrap.sh --install       # Install k3s if not present
#   ./bootstrap.sh --deploy       # Deploy TradersApp to k3s
#   ./bootstrap.sh --full         # Install k3s + deploy full stack
#   ./bootstrap.sh --destroy      # Tear down everything
#
# Prerequisites:
#   - Docker installed and running
#   - kubectl installed (for --deploy)
#   - Helm installed (for --deploy --use-helm)
#
# Note: k3s must be installed and running before deployment.

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$SCRIPT_DIR")"
NAMESPACE="tradersapp"

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Check if running on Windows (Git Bash / MSYS)
is_windows() {
    [[ "$(uname -s)" == MINGW* ]] || [[ "$(uname -s)" == CYGWIN* ]]
}

# Check if command exists
has_cmd() {
    command -v "$1" >/dev/null 2>&1
}

namespace_for_env() {
    local env="${1:-dev}"
    case "$env" in
        dev)
            echo "tradersapp-dev"
            ;;
        staging)
            echo "tradersapp-staging"
            ;;
        prod|production)
            echo "tradersapp"
            ;;
        *)
            echo "tradersapp-$env"
            ;;
    esac
}

wait_for_docker() {
    if ! has_cmd docker; then
        error "docker not found. Install Docker first."
    fi

    info "Waiting for Docker to be ready..."
    local max_attempts=30
    local attempt=1
    while ! docker version >/dev/null 2>&1; do
        if [[ $attempt -ge $max_attempts ]]; then
            error "Docker did not become ready within ${max_attempts}0 seconds"
        fi
        info "  Waiting for Docker... (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    info "Docker is ready"
}

import_image_to_cluster() {
    local image="$1"
    local archive=""

    if ! has_cmd kubectl; then
        warn "kubectl not found; skipping cluster image import for $image"
        return 0
    fi

    local context=""
    context="$(kubectl config current-context 2>/dev/null || true)"

    if has_cmd kind && [[ "$context" == kind-* ]]; then
        info "Importing $image into kind..."
        kind load docker-image "$image"
        return 0
    fi

    if has_cmd k3d && [[ "$context" == k3d-* ]]; then
        info "Importing $image into k3d..."
        k3d image import "$image"
        return 0
    fi

    archive="$(mktemp "${TMPDIR:-/tmp}/tradersapp-image-XXXXXX.tar")"
    docker save -o "$archive" "$image"

    if has_cmd k3s; then
        info "Importing $image into k3s containerd..."
        if ! k3s ctr images import "$archive" >/dev/null 2>&1; then
            if has_cmd sudo; then
                sudo k3s ctr images import "$archive"
            else
                error "k3s ctr import requires elevated access, but sudo is not available"
            fi
        fi
    elif has_cmd ctr; then
        info "Importing $image into containerd..."
        if ! ctr -n k8s.io images import "$archive" >/dev/null 2>&1; then
            if has_cmd sudo; then
                sudo ctr -n k8s.io images import "$archive"
            else
                error "ctr import requires elevated access, but sudo is not available"
            fi
        fi
    else
        warn "No supported cluster image importer found; skipping import for $image"
    fi

    rm -f "$archive"
}

sync_dev_images_to_cluster() {
    local images=(
        "tradersapp/ml-engine:dev-latest"
        "tradersapp/bff:dev-latest"
        "tradersapp/frontend:dev-latest"
    )

    for image in "${images[@]}"; do
        if docker image inspect "$image" >/dev/null 2>&1; then
            import_image_to_cluster "$image"
        else
            warn "Local image not found, skipping import: $image"
        fi
    done
}

restart_dev_deployments() {
    local namespace="$1"
    local deployments=(ml-engine bff frontend)

    for deployment in "${deployments[@]}"; do
        if kubectl get deployment "$deployment" -n "$namespace" >/dev/null 2>&1; then
            info "Restarting deployment/$deployment in namespace $namespace..."
            kubectl rollout restart "deployment/$deployment" -n "$namespace"
            kubectl rollout status "deployment/$deployment" -n "$namespace" --timeout=180s || true
        fi
    done
}

# Install k3s (single-node)
install_k3s() {
    info "Installing k3s..."
    if is_windows; then
        # Windows: requires WSL2 or manual k3s install
        warn "Windows detected. k3s requires WSL2 on Windows."
        error "Please install k3s manually in WSL2, then run: ./bootstrap.sh --deploy"
    fi

    if has_cmd k3s; then
        info "k3s already installed ($(k3s --version 2>/dev/null | head -1))"
    else
        info "Installing k3s (single-command install)..."
        curl -sfL https://get.k3s.io | sh -
        # Wait for k3s to be ready
        sleep 10
        info "k3s installed successfully"
    fi

    # Setup kubeconfig
    if [[ -f /etc/rancher/k3s/k3s.yaml ]]; then
        export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
        info "Kubeconfig at /etc/rancher/k3s/k3s.yaml"
    fi
}

# Wait for k3s to be ready
wait_for_k3s() {
    info "Waiting for k3s to be ready..."
    local max_attempts=30
    local attempt=1
    while ! kubectl get nodes 2>/dev/null | grep -q "Ready"; do
        if [[ $attempt -ge $max_attempts ]]; then
            error "k3s did not become ready within ${max_attempts}0 seconds"
        fi
        info "  Waiting... (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    info "k3s is ready"
}

# Deploy TradersApp via Kustomize
deploy_kustomize() {
    local env="${1:-dev}"
    local namespace
    namespace="$(namespace_for_env "$env")"
    info "Deploying TradersApp (env=$env) via Kustomize..."

    if ! has_cmd kubectl; then
        error "kubectl not found. Install kubectl first."
    fi

    wait_for_k3s

    local overlay_dir="$K8S_DIR/overlay/$env"
    if [[ ! -d "$overlay_dir" ]]; then
        error "Overlay not found: $overlay_dir (available: dev, staging, prod)"
    fi

    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    info "Namespace '$namespace' ready"

    if [[ "$env" == "dev" ]]; then
        wait_for_docker
        sync_dev_images_to_cluster
    fi

    info "Building with Kustomize..."
    kubectl kustomize "$overlay_dir" > /tmp/tradersapp-$env.yaml || {
        error "Kustomize build failed. Check your overlays."
    }

    info "Applying manifests..."
    kubectl apply -f /tmp/tradersapp-$env.yaml

    # Apply secrets separately (secrets.yaml may have placeholders)
    if [[ -f "$K8S_DIR/base/secrets.yaml" ]]; then
        warn "Applying secrets — ensure CHANGEME values are replaced!"
        kubectl apply -f "$K8S_DIR/base/secrets.yaml"
    fi

    if [[ "$env" == "dev" ]]; then
        restart_dev_deployments "$namespace"
    fi

    info "Verifying deployment..."
    kubectl get deployments -n "$namespace" -o name | while read -r deployment; do
        kubectl rollout status "$deployment" -n "$namespace" --timeout=180s || true
    done

    kubectl get pods -n "$namespace"
    kubectl get svc -n "$namespace"
    kubectl get hpa -n "$namespace" || true

    info "Deployment complete!"
    info "Services:"
    info "  ML Engine:  http://ml-engine.$namespace.svc:8001"
    info "  BFF:        http://bff.$namespace.svc:8788"
    info "  Frontend:   http://frontend.$namespace.svc:80 (via Ingress)"
    info "  Triton:     http://triton.$namespace.svc:8000 (GPU only)"
}

# Deploy TradersApp via Helm
deploy_helm() {
    local env="${1:-dev}"
    info "Deploying TradersApp (env=$env) via Helm..."

    if ! has_cmd helm; then
        error "helm not found. Install helm first: brew install helm"
    fi

    wait_for_k3s

    # Create namespace
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Use values override for environment
    local values_file="$K8S_DIR/helm/tradersapp/values.yaml"
    local env_values="$K8S_DIR/helm/tradersapp/values.$env.yaml"

    if [[ -f "$env_values" ]]; then
        info "Using environment values: $env_values"
        helm upgrade --install tradersapp "$K8S_DIR/helm/tradersapp" \
            --namespace "$NAMESPACE" \
            --values "$values_file" \
            --values "$env_values" \
            --wait --timeout 5m \
            --timeout 300s
    else
        helm upgrade --install tradersapp "$K8S_DIR/helm/tradersapp" \
            --namespace "$NAMESPACE" \
            --values "$values_file" \
            --wait --timeout 5m
    fi

    kubectl get pods -n "$NAMESPACE"
    info "Helm deployment complete!"
}

# Build Docker images
build_images() {
    info "Building Docker images..."
    cd "$K8S_DIR/.."

    info "Building ML Engine image..."
    docker build -t tradersapp/ml-engine:latest -f Dockerfile.ml-engine .
    info "Building BFF image..."
    docker build -t tradersapp/bff:latest -f Dockerfile.bff .
    info "Building Frontend image..."
    docker build -t tradersapp/frontend:latest -f Dockerfile.frontend .
    info "Building Triton image..."
    docker build -t tradersapp/triton:latest -f Dockerfile.triton . || true

    # Tag for dev overlay
    docker tag tradersapp/ml-engine:latest tradersapp/ml-engine:dev-latest
    docker tag tradersapp/bff:latest tradersapp/bff:dev-latest
    docker tag tradersapp/frontend:latest tradersapp/frontend:dev-latest

    info "Images built successfully"
}

# Tear down
destroy() {
    info "Destroying TradersApp deployment..."
    kubectl delete namespace "$NAMESPACE" --ignore-not-found=true
    info "Namespace '$NAMESPACE' deleted"
}

# Show status
status() {
    info "TradersApp status on k3s:"
    echo ""
    kubectl get all -n "$NAMESPACE" 2>/dev/null || echo "Namespace not found"
    echo ""
    echo "Pods:"
    kubectl get pods -n "$NAMESPACE" -o wide 2>/dev/null || true
    echo ""
    echo "HPA:"
    kubectl get hpa -n "$NAMESPACE" 2>/dev/null || true
    echo ""
    echo "PVCs:"
    kubectl get pvc -n "$NAMESPACE" 2>/dev/null || true
}

# Main
case "${1:-}" in
    --install)
        install_k3s
        ;;
    --deploy)
        DEPLOY_METHOD="${2:-kustomize}"
        ENV="${3:-dev}"
        if [[ "$DEPLOY_METHOD" == "--helm" ]] || [[ "$DEPLOY_METHOD" == "helm" ]]; then
            deploy_helm "${ENV:-dev}"
        else
            deploy_kustomize "${ENV:-dev}"
        fi
        ;;
    --full)
        install_k3s
        build_images
        deploy_kustomize dev
        ;;
    --build)
        build_images
        ;;
    --destroy)
        destroy
        ;;
    --status)
        status
        ;;
    --help|-h)
        echo "Usage: bootstrap.sh [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --install           Install k3s (single-node)"
        echo "  --deploy [method] [env]  Deploy TradersApp"
        echo "                          method: kustomize (default) or helm"
        echo "                          env: dev (default), staging, prod"
        echo "  --full              Install k3s + build images + deploy (dev)"
        echo "  --build             Build Docker images only"
        echo "  --destroy           Tear down entire deployment"
        echo "  --status            Show current deployment status"
        echo ""
        echo "Examples:"
        echo "  ./bootstrap.sh --install"
        echo "  ./bootstrap.sh --deploy kustomize dev"
        echo "  ./bootstrap.sh --deploy helm prod"
        echo "  ./bootstrap.sh --full"
        ;;
    *)
        error "Unknown option: $1. Run --help for usage."
        ;;
esac
