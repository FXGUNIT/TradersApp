#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/k8s/deploy-core-minimal.sh \
    --kubeconfig /path/to/kubeconfig \
    --namespace tradersapp \
    --image-repo ghcr.io/<owner> \
    --image-tag <sha>

Purpose:
  Render the TradersApp minimal chart and apply only the core runtime
  services on a single-node OCI free-tier cluster without Helm release
  state tracking.
EOF
}

KUBECONFIG_PATH=""
NAMESPACE="tradersapp"
IMAGE_REPO=""
IMAGE_TAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kubeconfig)
      KUBECONFIG_PATH="${2:-}"
      shift 2
      ;;
    --namespace)
      NAMESPACE="${2:-}"
      shift 2
      ;;
    --image-repo)
      IMAGE_REPO="${2:-}"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="${2:-}"
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

if [[ -z "${KUBECONFIG_PATH}" || -z "${IMAGE_REPO}" || -z "${IMAGE_TAG}" ]]; then
  echo "::error::--kubeconfig, --image-repo, and --image-tag are required" >&2
  usage >&2
  exit 1
fi

if [[ ! -f "${KUBECONFIG_PATH}" ]]; then
  echo "::error::Kubeconfig not found: ${KUBECONFIG_PATH}" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MANIFEST_DIR="$(mktemp -d)"
APPLY_ORDER_PATH="${MANIFEST_DIR}/00-apply-order.txt"
FULL_MANIFEST_PATH="${MANIFEST_DIR}/tradersapp-deployments.yaml"
NODE_RECOVERY_SCRIPT="${SCRIPT_DIR}/recover-node-pressure.sh"
RENDER_SCRIPT="${SCRIPT_DIR}/render-core-minimal-manifests.sh"

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
  local max_tries="${1:-6}"
  shift
  local attempt=1
  while [[ "${attempt}" -le "${max_tries}" ]]; do
    if "$@"; then
      return 0
    fi
    echo "kubectl command failed (attempt ${attempt}/${max_tries}), retrying..."
    wait_for_kube_api 4 5 || true
    sleep 5
    attempt=$((attempt + 1))
  done
  echo "::error::kubectl command failed after ${max_tries} attempts: $*" >&2
  return 1
}

force_purge_helm_metadata() {
  kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" delete secret \
    -l owner=helm,name=tradersapp --ignore-not-found=true || true
  kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" delete configmap \
    -l OWNER=TILLER,NAME=tradersapp --ignore-not-found=true || true
}

cleanup_disabled_stack() {
  kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" delete \
    deployment,statefulset,daemonset,replicaset,pod,job,cronjob,service,persistentvolumeclaim,poddisruptionbudget \
    -l 'app in (analysis-service,mlflow,mlflow-postgres,minio,feast,triton)' --ignore-not-found=true || true
  kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" delete job minio-setup \
    --ignore-not-found=true || true
  kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" delete persistentvolumeclaim \
    redis-pvc ml-models-pvc ml-state-pvc mlflow-postgres-pvc minio-pvc tradersapp-feast-features tradersapp-tradersapp-feast-features tradersapp-tradersapp-triton-models data-kafka-0 \
    --ignore-not-found=true || true
}

cleanup_core_runtime() {
  echo "Deleting stale core runtime objects so the 1GB node does not try to run two generations at once."
  kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" delete ingress frontend-ingress bff-ingress \
    --ignore-not-found=true || true
  kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" delete networkpolicy \
    ml-engine-netpol bff-netpol analysis-service-netpol frontend-netpol --ignore-not-found=true || true
  kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" delete poddisruptionbudget \
    ml-engine-pdb bff-pdb --ignore-not-found=true || true
  kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" delete deployment \
    bff frontend ml-engine redis --ignore-not-found=true --wait=true || true
  kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" delete replicaset,pod \
    -l 'app in (bff,frontend,ml-engine,redis)' --ignore-not-found=true || true
}

render_manifests() {
  if [[ ! -f "${RENDER_SCRIPT}" ]]; then
    echo "::error::Render script is missing: ${RENDER_SCRIPT}" >&2
    exit 1
  fi

  bash "${RENDER_SCRIPT}" \
    --namespace "${NAMESPACE}" \
    --image-repo "${IMAGE_REPO}" \
    --image-tag "${IMAGE_TAG}" \
    --output-dir "${MANIFEST_DIR}" \
    --kubeconfig "${KUBECONFIG_PATH}" \
    --validate-client
}

apply_staged_manifests() {
  if [[ ! -s "${APPLY_ORDER_PATH}" ]]; then
    echo "::error::Apply order file is missing or empty: ${APPLY_ORDER_PATH}" >&2
    exit 1
  fi

  local manifest_name=""
  local manifest_path=""
  while IFS= read -r manifest_name; do
    [[ -n "${manifest_name}" ]] || continue
    manifest_path="${MANIFEST_DIR}/${manifest_name}"
    if [[ ! -s "${manifest_path}" ]]; then
      echo "::error::Expected staged manifest is missing: ${manifest_path}" >&2
      exit 1
    fi

    echo "Applying staged manifest ${manifest_name}"
    kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f "${manifest_path}"
  done < "${APPLY_ORDER_PATH}"
}

wait_for_rollout() {
  local deployment="$1"
  local timeout="${2:-180s}"
  echo "Waiting for rollout of deployment/${deployment} (timeout ${timeout})..."
  if kubectl --kubeconfig "${KUBECONFIG_PATH}" --request-timeout=15s -n "${NAMESPACE}" rollout status "deployment/${deployment}" --timeout="${timeout}"; then
    return 0
  fi

  echo "::error::Rollout failed for deployment/${deployment}."
  wait_for_kube_api 6 5 || true
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" get deployment,replicaset,pod -l "app=${deployment}" -o wide || true
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" describe "deployment/${deployment}" || true
  for pod in $(kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" get pods -l "app=${deployment}" -o name 2>/dev/null); do
    pod_name="${pod#pod/}"
    echo "--- logs ${pod}"
    kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" logs "${pod_name}" --all-containers=true --tail=200 || true
    echo "--- previous logs ${pod}"
    kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" logs "${pod_name}" --all-containers=true --tail=200 --previous || true
    echo "--- describe ${pod}"
    kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" describe "${pod}" || true
  done
  return 1
}

cleanup() {
  rm -rf "${MANIFEST_DIR}"
}
trap cleanup EXIT

wait_for_kube_api 24 10
kubectl --kubeconfig "${KUBECONFIG_PATH}" create namespace "${NAMESPACE}" --dry-run=client -o yaml | \
  kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f -

render_manifests
echo "Rendered staged manifests under ${MANIFEST_DIR}"
echo "Full manifest snapshot: ${FULL_MANIFEST_PATH}"
force_purge_helm_metadata
cleanup_disabled_stack
cleanup_core_runtime

if [[ -f "${NODE_RECOVERY_SCRIPT}" ]]; then
  echo "Running node pressure recovery before applying the core manifest."
  bash "${NODE_RECOVERY_SCRIPT}" \
    --kubeconfig "${KUBECONFIG_PATH}" \
    --namespace "${NAMESPACE}" \
    --wait-seconds 300
else
  echo "::warning::Node recovery script is missing or not executable: ${NODE_RECOVERY_SCRIPT}"
fi

apply_staged_manifests
wait_for_rollout redis 180s
wait_for_rollout ml-engine 240s
wait_for_rollout bff 180s
wait_for_rollout frontend 180s

echo "Minimal core deploy complete."
