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
CERT_MANAGER_EMAIL="${CERT_MANAGER_EMAIL:-admin@example.com}"

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

CI_BEST_EFFORT="${CI_BEST_EFFORT:-${CI:-}}"
if [[ "${CI_BEST_EFFORT}" == "true" || "${CI_BEST_EFFORT}" == "1" ]]; then
  : "${API_WAIT_TRIES:=4}"
  : "${API_WAIT_SLEEP:=5}"
  : "${KUBECTL_RETRIES:=3}"
  : "${KUBECTL_WAIT_TRIES:=2}"
  : "${KUBECTL_WAIT_SLEEP:=3}"
  : "${KUBECTL_RETRY_SLEEP:=2}"
  : "${HELM_RETRIES:=2}"
  : "${HELM_RETRY_API_WAIT_TRIES:=4}"
  : "${HELM_RETRY_API_WAIT_SLEEP:=5}"
  : "${HELM_RETRY_COOLDOWN:=5}"
  : "${POST_INSTALL_API_WAIT_TRIES:=2}"
  : "${POST_INSTALL_API_WAIT_SLEEP:=3}"
  : "${ROLLOUT_TIMEOUT:=20s}"
  : "${CERT_ROLLOUT_TIMEOUT:=20s}"
else
  : "${API_WAIT_TRIES:=24}"
  : "${API_WAIT_SLEEP:=10}"
  : "${KUBECTL_RETRIES:=12}"
  : "${KUBECTL_WAIT_TRIES:=6}"
  : "${KUBECTL_WAIT_SLEEP:=5}"
  : "${KUBECTL_RETRY_SLEEP:=5}"
  : "${HELM_RETRIES:=3}"
  : "${HELM_RETRY_API_WAIT_TRIES:=12}"
  : "${HELM_RETRY_API_WAIT_SLEEP:=10}"
  : "${HELM_RETRY_COOLDOWN:=20}"
  : "${POST_INSTALL_API_WAIT_TRIES:=12}"
  : "${POST_INSTALL_API_WAIT_SLEEP:=5}"
  : "${ROLLOUT_TIMEOUT:=90s}"
  : "${CERT_ROLLOUT_TIMEOUT:=90s}"
fi

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

kubectl_retry() {
  local max_tries="${1:-${KUBECTL_RETRIES}}"
  shift
  local attempt=1
  while [[ "${attempt}" -le "${max_tries}" ]]; do
    if "$@"; then
      return 0
    fi
    echo "kubectl command failed (attempt ${attempt}/${max_tries}), retrying..."
    wait_for_kube_api "${KUBECTL_WAIT_TRIES}" "${KUBECTL_WAIT_SLEEP}" || true
    sleep "${KUBECTL_RETRY_SLEEP}"
    attempt=$((attempt + 1))
  done
  echo "::error::kubectl command failed after ${max_tries} attempts: $*" >&2
  return 1
}

cleanup_helm_release() {
  local release="$1"
  local namespace="$2"
  echo "Cleaning up stale Helm release state for ${release} in namespace ${namespace}..."
  helm uninstall "${release}" \
    --namespace "${namespace}" \
    --kubeconfig "${KUBECONFIG_PATH}" >/dev/null 2>&1 || true
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${namespace}" delete secret \
    -l owner=helm,name="${release}" --ignore-not-found=true >/dev/null 2>&1 || true
}

release_status() {
  local release="$1"
  local namespace="$2"
  helm status "${release}" \
    --namespace "${namespace}" \
    --kubeconfig "${KUBECONFIG_PATH}" 2>/dev/null | awk '/^STATUS:/{print $2}'
}

helm_retry() {
  local release="$1"
  local namespace="$2"
  shift 2
  local attempt=1
  local max_attempts="${HELM_RETRIES}"
  local output=""
  local rc=0

  while [[ "${attempt}" -le "${max_attempts}" ]]; do
    set +e
    output="$("$@" 2>&1)"
    rc=$?
    set -e
    printf '%s\n' "${output}"

    if [[ "${rc}" -eq 0 ]]; then
      return 0
    fi

    if printf '%s' "${output}" | grep -qiE "unexpected EOF|cluster unreachable|connection refused|i/o timeout|context deadline exceeded|another operation .* in progress|failed to create"; then
      if [[ "${attempt}" -lt "${max_attempts}" ]]; then
        echo "Transient Helm/bootstrap failure detected for ${release}; retrying (attempt $((attempt + 1))/${max_attempts})..."
        wait_for_kube_api "${HELM_RETRY_API_WAIT_TRIES}" "${HELM_RETRY_API_WAIT_SLEEP}" || true
        cleanup_helm_release "${release}" "${namespace}"
        sleep "${HELM_RETRY_COOLDOWN}"
        attempt=$((attempt + 1))
        continue
      fi
    fi

    return "${rc}"
  done

  return 1
}

warn_rollout_issue() {
  local message="$1"
  echo "::warning::${message}"
}

cleanup_ingress_admission_artifacts() {
  echo "Removing stale ingress-nginx admission artifacts for OCI free-tier mode..."
  kubectl --kubeconfig "${KUBECONFIG_PATH}" delete validatingwebhookconfiguration ingress-nginx-admission \
    --ignore-not-found=true >/dev/null 2>&1 || true
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n ingress-nginx delete service ingress-nginx-controller-admission \
    --ignore-not-found=true >/dev/null 2>&1 || true
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n ingress-nginx delete secret ingress-nginx-admission \
    --ignore-not-found=true >/dev/null 2>&1 || true
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n ingress-nginx delete job ingress-nginx-admission-create ingress-nginx-admission-patch \
    --ignore-not-found=true >/dev/null 2>&1 || true
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

if ! wait_for_kube_api "${API_WAIT_TRIES}" "${API_WAIT_SLEEP}"; then
  warn_rollout_issue "Kubernetes API is unstable before edge bootstrap; skipping ingress-nginx/cert-manager for this run"
  exit 0
fi

echo "Installing ingress-nginx 4.15.1 for bare-metal OCI access on ${NODE_IP}..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null 2>&1 || true
helm repo update >/dev/null
if ! helm_retry ingress-nginx ingress-nginx \
  helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --version 4.15.1 \
    --namespace ingress-nginx \
    --create-namespace \
    --kubeconfig "${KUBECONFIG_PATH}" \
    -f "${INGRESS_VALUES}" \
    --set controller.extraArgs.publish-status-address="${NODE_IP}"; then
  warn_rollout_issue "ingress-nginx install did not complete cleanly; continuing so app deployment can proceed"
fi

cleanup_ingress_admission_artifacts

wait_for_kube_api "${POST_INSTALL_API_WAIT_TRIES}" "${POST_INSTALL_API_WAIT_SLEEP}" || warn_rollout_issue "Kubernetes API is unstable after ingress-nginx bootstrap; continuing with app deployment"
if kubectl --kubeconfig "${KUBECONFIG_PATH}" -n ingress-nginx get daemonset ingress-nginx-controller >/dev/null 2>&1; then
  if ! kubectl --kubeconfig "${KUBECONFIG_PATH}" -n ingress-nginx rollout status daemonset/ingress-nginx-controller --timeout="${ROLLOUT_TIMEOUT}"; then
    warn_rollout_issue "ingress-nginx controller daemonset is not ready yet; continuing with app deployment"
    kubectl --kubeconfig "${KUBECONFIG_PATH}" -n ingress-nginx get daemonset,pod -o wide || true
  fi
else
  warn_rollout_issue "ingress-nginx controller daemonset not found after bootstrap; continuing with app deployment"
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n ingress-nginx get all || true
fi

echo "Installing cert-manager 1.20.2..."
if [[ "$(release_status cert-manager cert-manager || true)" != "deployed" ]]; then
  if ! helm_retry cert-manager cert-manager \
    helm upgrade --install cert-manager oci://quay.io/jetstack/charts/cert-manager \
      --version 1.20.2 \
      --namespace cert-manager \
      --create-namespace \
      --kubeconfig "${KUBECONFIG_PATH}" \
      -f "${CERT_VALUES}"; then
    warn_rollout_issue "cert-manager install did not complete cleanly; continuing so app deployment can proceed"
  fi
else
  echo "cert-manager release already deployed; skipping reinstall."
fi

wait_for_kube_api "${POST_INSTALL_API_WAIT_TRIES}" "${POST_INSTALL_API_WAIT_SLEEP}" || warn_rollout_issue "Kubernetes API is unstable after cert-manager bootstrap; continuing with app deployment"
if kubectl --kubeconfig "${KUBECONFIG_PATH}" get crd clusterissuers.cert-manager.io >/dev/null 2>&1; then
  kubectl --kubeconfig "${KUBECONFIG_PATH}" wait --for=condition=Established crd/clusterissuers.cert-manager.io --timeout="${CERT_ROLLOUT_TIMEOUT}" || \
    warn_rollout_issue "cert-manager CRD is not fully established yet; TLS issuance may lag behind app deployment"
else
  warn_rollout_issue "cert-manager CRD not found after bootstrap; skipping ClusterIssuer apply for now"
fi

for deploy_name in cert-manager cert-manager-webhook cert-manager-cainjector; do
  if kubectl --kubeconfig "${KUBECONFIG_PATH}" -n cert-manager get deployment "${deploy_name}" >/dev/null 2>&1; then
    kubectl --kubeconfig "${KUBECONFIG_PATH}" -n cert-manager rollout status deployment/"${deploy_name}" --timeout="${CERT_ROLLOUT_TIMEOUT}" || \
      warn_rollout_issue "${deploy_name} is not ready yet; continuing with app deployment"
  fi
done

echo "Rendering TradersApp ClusterIssuers with ACME email ${CERT_MANAGER_EMAIL}..."
python3 - "${CERT_MANAGER_EMAIL}" "${ISSUER_TEMPLATE}" > /tmp/tradersapp-cluster-issuers.yaml <<'PY'
import pathlib
import sys

email = sys.argv[1]
template_path = pathlib.Path(sys.argv[2])
template = template_path.read_text(encoding="utf-8")
sys.stdout.write(template.replace("$ALERT_EMAIL", email))
PY

if kubectl --kubeconfig "${KUBECONFIG_PATH}" get crd clusterissuers.cert-manager.io >/dev/null 2>&1; then
  kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f /tmp/tradersapp-cluster-issuers.yaml || \
    warn_rollout_issue "ClusterIssuer apply failed; TLS issuance will need a follow-up once cert-manager stabilizes"
  kubectl --kubeconfig "${KUBECONFIG_PATH}" get clusterissuer selfsigned-internal letsencrypt-staging letsencrypt-prod || true
else
  warn_rollout_issue "Skipping ClusterIssuer apply because cert-manager CRDs are not available yet"
fi

echo "OCI edge bootstrap complete."
