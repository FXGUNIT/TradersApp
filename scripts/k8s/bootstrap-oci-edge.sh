#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/k8s/bootstrap-oci-edge.sh --kubeconfig /path/to/kubeconfig [--node-ip X.X.X.X] [--cert-email you@example.com]

Purpose:
  Installs the minimum public edge stack for the OCI free-tier cluster:
  - ingress-nginx on host networking
  - cert-manager with lightweight resource limits
  - TradersApp ClusterIssuers rendered with the provided ACME email
EOF
}

KUBECONFIG_PATH=""
NODE_IP=""
CERT_MANAGER_EMAIL="${CERT_MANAGER_EMAIL:-admin@traders.app}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kubeconfig)
      KUBECONFIG_PATH="${2:-}"
      shift 2
      ;;
    --node-ip)
      NODE_IP="${2:-}"
      shift 2
      ;;
    --cert-email)
      CERT_MANAGER_EMAIL="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${KUBECONFIG_PATH}" ]]; then
  echo "::error::--kubeconfig is required" >&2
  exit 1
fi

if [[ ! -f "${KUBECONFIG_PATH}" ]]; then
  echo "::error::Kubeconfig not found: ${KUBECONFIG_PATH}" >&2
  exit 1
fi

if [[ ! "${CERT_MANAGER_EMAIL}" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
  echo "::error::cert-manager requires a syntactically valid email address. Got: ${CERT_MANAGER_EMAIL}" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
INGRESS_VALUES="${REPO_ROOT}/k8s/ingress-nginx/values.oci-free.yaml"
CERT_VALUES="${REPO_ROOT}/k8s/cert-manager/values.oci-free.yaml"
ISSUER_TEMPLATE="${REPO_ROOT}/k8s/cert-manager/cluster-issuers.yaml"

wait_for_kube_api() {
  local max_tries="${1:-24}"
  local sleep_seconds="${2:-10}"
  local attempt=1
  while [[ "${attempt}" -le "${max_tries}" ]]; do
    if kubectl --kubeconfig "${KUBECONFIG_PATH}" --request-timeout=10s get --raw='/version' >/dev/null 2>&1; then
      return 0
    fi
    echo "Waiting for Kubernetes API (attempt ${attempt}/${max_tries})..."
    sleep "${sleep_seconds}"
    attempt=$((attempt + 1))
  done
  echo "::error::Kubernetes API remained unreachable after ${max_tries} attempts." >&2
  return 1
}

if [[ -z "${NODE_IP}" ]]; then
  NODE_IP="$(
    kubectl --kubeconfig "${KUBECONFIG_PATH}" config view --minify -o jsonpath='{.clusters[0].cluster.server}' \
      | sed -E 's#https?://([^:/]+).*#\1#'
  )"
fi

if [[ -z "${NODE_IP}" ]]; then
  echo "::error::Unable to derive OCI node IP from kubeconfig. Pass --node-ip explicitly." >&2
  exit 1
fi

wait_for_kube_api 24 10

echo "Installing ingress-nginx 4.15.1 for bare-metal OCI access on ${NODE_IP}..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null 2>&1 || true
helm repo update >/dev/null
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --version 4.15.1 \
  --namespace ingress-nginx \
  --create-namespace \
  --kubeconfig "${KUBECONFIG_PATH}" \
  -f "${INGRESS_VALUES}" \
  --set controller.extraArgs.publish-status-address="${NODE_IP}"

wait_for_kube_api 12 5
kubectl --kubeconfig "${KUBECONFIG_PATH}" -n ingress-nginx rollout status daemonset/ingress-nginx-controller --timeout=300s

echo "Installing cert-manager 1.20.2..."
helm upgrade --install cert-manager oci://quay.io/jetstack/charts/cert-manager \
  --version 1.20.2 \
  --namespace cert-manager \
  --create-namespace \
  --kubeconfig "${KUBECONFIG_PATH}" \
  -f "${CERT_VALUES}"

wait_for_kube_api 12 5
kubectl --kubeconfig "${KUBECONFIG_PATH}" wait --for=condition=Established crd/clusterissuers.cert-manager.io --timeout=180s
kubectl --kubeconfig "${KUBECONFIG_PATH}" -n cert-manager rollout status deployment/cert-manager --timeout=300s
kubectl --kubeconfig "${KUBECONFIG_PATH}" -n cert-manager rollout status deployment/cert-manager-webhook --timeout=300s
kubectl --kubeconfig "${KUBECONFIG_PATH}" -n cert-manager rollout status deployment/cert-manager-cainjector --timeout=300s

echo "Rendering TradersApp ClusterIssuers with ACME email ${CERT_MANAGER_EMAIL}..."
python3 - "${CERT_MANAGER_EMAIL}" "${ISSUER_TEMPLATE}" > /tmp/tradersapp-cluster-issuers.yaml <<'PY'
import pathlib
import sys

email = sys.argv[1]
template_path = pathlib.Path(sys.argv[2])
template = template_path.read_text(encoding="utf-8")
sys.stdout.write(template.replace("$ALERT_EMAIL", email))
PY

kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f /tmp/tradersapp-cluster-issuers.yaml
kubectl --kubeconfig "${KUBECONFIG_PATH}" get clusterissuer selfsigned-internal letsencrypt-staging letsencrypt-prod

echo "OCI edge bootstrap complete."
