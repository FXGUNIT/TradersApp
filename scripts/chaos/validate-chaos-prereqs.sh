#!/usr/bin/env bash
# validate-chaos-prereqs.sh — Check that Chaos Mesh is installed in the target cluster
#
# Exit codes:
#   0 — Chaos Mesh is installed and reachable
#   1 — Chaos Mesh CRD not found (not installed or wrong context/namespace)

set -euo pipefail

NAMESPACE="${NAMESPACE:-chaos-testing}"
KUBE_CONTEXT="${KUBE_CONTEXT:-}"

log() { echo "[$(date +%H:%M:%S)] $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

# Allow context override
KUBECTL_ARGS=()
if [[ -n "$KUBE_CONTEXT" ]]; then
  KUBECTL_ARGS+=("--context=$KUBE_CONTEXT")
fi

log "========================================"
log "Chaos Mesh Prerequisites Check"
log "========================================"
log "Namespace  : $NAMESPACE"
log "========================================"

for cmd in kubectl; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

# Chaos Mesh installs several CRDs; check the primary PodChaos CRD
log "Checking for Chaos Mesh CRDs in cluster..."
CRD_CHECK=$(kubectl "${KUBECTL_ARGS[@]}" get crd podchaos.chaos-mesh.org \
  -o jsonpath='{.metadata.name}' 2>/dev/null || echo "")

if [[ "$CRD_CHECK" == "podchaos.chaos-mesh.org" ]]; then
  log "Chaos Mesh PodChaos CRD: FOUND"
  log "Chaos Mesh: INSTALLED"
  echo ""
  echo "Chaos Mesh is installed. To inject chaos:"
  echo "  kubectl apply -f k8s/chaos/bff-network-delay-chaos.yaml"
  echo "  kubectl apply -f k8s/chaos/redis-failover.yaml"
  echo "  kubectl apply -f k8s/chaos/kafka-broker-chaos.yaml"
  echo ""
  echo "Or use the orchestration scripts:"
  echo "  bash scripts/chaos/run-network-partition.sh"
  echo "  bash scripts/chaos/run-redis-failover.sh"
  echo "  bash scripts/chaos/run-kafka-broker-failure.sh"
  exit 0
else
  fail "Chaos Mesh PodChaos CRD not found.
Install Chaos Mesh via Helm:
  helm repo add chaos-mesh https://charts.chaos-mesh.org
  helm repo update
  helm install chaos-mesh chaos-mesh/chaos-mesh \\
    -n chaos-testing --create-namespace \\
    --set chaosDaemon.runtime=containerd \\
    --set chaosDaemon.socketPath=/run/containerd/containerd.sock

Or via the official manifest:
  kubectl apply -f https://raw.githubusercontent.com/chaos-mesh/charts/gh-pages/chaos-mesh-2.0.4.tgz

Then re-run this script to verify."
fi
