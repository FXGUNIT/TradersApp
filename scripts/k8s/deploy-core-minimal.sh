#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/k8s/deploy-core-minimal.sh \
    --kubeconfig /path/to/kubeconfig \
    --namespace tradersapp \
    --image-repo ghcr.io/<owner> \
    --image-tag <sha> \
    [--services redis,ml-engine,bff,frontend] \
    [--run-label run-slug]

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
SELECTED_SERVICES=""
RUN_LABEL_ARG="${DEPLOY_RUN_LABEL:-}"
OCI_NODE_NAME="${OCI_NODE_NAME:-tradersapp-oci}"
OCI_NODE_SSH_HOST="${OCI_NODE_SSH_HOST:-}"
OCI_NODE_SSH_USER="${OCI_NODE_SSH_USER:-opc}"
OCI_NODE_SSH_KEY="${OCI_NODE_SSH_KEY:-}"
OCI_NODE_SSH_PORT="${OCI_NODE_SSH_PORT:-22}"
MIN_NODE_MEM_AVAILABLE_MIB="${MIN_NODE_MEM_AVAILABLE_MIB:-350}"
MIN_NODE_SWAP_FREE_MIB="${MIN_NODE_SWAP_FREE_MIB:-768}"
MAX_ROOT_USAGE_PERCENT="${MAX_ROOT_USAGE_PERCENT:-90}"
MAX_K3S_USAGE_PERCENT="${MAX_K3S_USAGE_PERCENT:-90}"
MAX_KUBELET_USAGE_PERCENT="${MAX_KUBELET_USAGE_PERCENT:-90}"
SSH_KEY_EFFECTIVE=""
SSH_TEMP_KEY=""

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
    --services)
      SELECTED_SERVICES="${2:-}"
      shift 2
      ;;
    --run-label)
      RUN_LABEL_ARG="${2:-}"
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

if [[ -n "${OCI_NODE_SSH_KEY}" && ! -f "${OCI_NODE_SSH_KEY}" ]]; then
  echo "::error::SSH key not found: ${OCI_NODE_SSH_KEY}" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RUN_TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DEPLOY_ARTIFACTS_ROOT="${DEPLOY_ARTIFACTS_ROOT:-${REPO_ROOT}/artifacts/k8s/deploy-core-minimal}"
sanitize_run_label() {
  local raw="${1:-full-core}"
  raw="${raw//,/--}"
  raw="${raw// /-}"
  raw="${raw//\//-}"
  raw="$(printf '%s' "${raw}" | sed 's/[^[:alnum:]_.-]/-/g')"
  if [[ -z "${raw}" ]]; then
    raw="full-core"
  fi
  printf '%s\n' "${raw}"
}

DEFAULT_RUN_LABEL="${RUN_LABEL_ARG:-${SELECTED_SERVICES:-full-core}}"
RUN_LABEL="$(sanitize_run_label "${DEFAULT_RUN_LABEL}")"
RUN_ARTIFACT_DIR="${DEPLOY_ARTIFACTS_ROOT}/${RUN_TIMESTAMP}-${RUN_LABEL}-$$"
MANIFEST_DIR="${RUN_ARTIFACT_DIR}/rendered"
STAGE_CAPTURE_DIR="${RUN_ARTIFACT_DIR}/stage-captures"
PREFLIGHT_CAPTURE_DIR="${RUN_ARTIFACT_DIR}/preflight"
RUN_METADATA_PATH="${RUN_ARTIFACT_DIR}/run-metadata.txt"
APPLY_ORDER_PATH="${MANIFEST_DIR}/00-apply-order.txt"
FULL_MANIFEST_PATH="${MANIFEST_DIR}/tradersapp-deployments.yaml"
NODE_RECOVERY_SCRIPT="${SCRIPT_DIR}/recover-node-pressure.sh"
RENDER_SCRIPT="${SCRIPT_DIR}/render-core-minimal-manifests.sh"
PREFLIGHT_SCRIPT="${SCRIPT_DIR}/check-oci-core-preflight.sh"

mkdir -p "${MANIFEST_DIR}" "${STAGE_CAPTURE_DIR}" "${PREFLIGHT_CAPTURE_DIR}"

cat > "${RUN_METADATA_PATH}" <<EOF
runTimestamp=${RUN_TIMESTAMP}
runLabel=${RUN_LABEL}
namespace=${NAMESPACE}
imageRepo=${IMAGE_REPO}
imageTag=${IMAGE_TAG}
selectedServices=${SELECTED_SERVICES:-all}
artifactDir=${RUN_ARTIFACT_DIR}
EOF

prepare_ssh_key() {
  if [[ -z "${OCI_NODE_SSH_KEY}" ]]; then
    SSH_KEY_EFFECTIVE=""
    return 0
  fi

  SSH_TEMP_KEY="$(mktemp "${TMPDIR:-/tmp}/tradersapp-ssh-key-XXXXXX")"
  cp "${OCI_NODE_SSH_KEY}" "${SSH_TEMP_KEY}"
  chmod 600 "${SSH_TEMP_KEY}"
  SSH_KEY_EFFECTIVE="${SSH_TEMP_KEY}"
}

cleanup() {
  if [[ -n "${SSH_TEMP_KEY}" ]]; then
    rm -f "${SSH_TEMP_KEY}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

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

capture_common_cluster_snapshot() {
  local output_dir="$1"
  mkdir -p "${output_dir}"

  kubectl --kubeconfig "${KUBECONFIG_PATH}" get nodes -o wide > "${output_dir}/nodes.txt" 2>&1 || true
  kubectl --kubeconfig "${KUBECONFIG_PATH}" describe node "${OCI_NODE_NAME}" > "${output_dir}/node-describe.txt" 2>&1 || true
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" get deployment,replicaset,pod,service -o wide > "${output_dir}/namespace-workloads.txt" 2>&1 || true
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" get events --sort-by=.metadata.creationTimestamp > "${output_dir}/events-full.txt" 2>&1 || true
  tail -n 200 "${output_dir}/events-full.txt" > "${output_dir}/events-tail-200.txt" 2>/dev/null || true
}

capture_remote_memory_snapshot() {
  local output_dir="$1"
  mkdir -p "${output_dir}"

  if [[ -z "${OCI_NODE_SSH_HOST}" ]]; then
    printf 'Remote node host not configured; skipped SSH memory snapshot.\n' > "${output_dir}/remote-memory.txt"
    return 0
  fi

  if ! command -v ssh >/dev/null 2>&1; then
    printf 'ssh command not found on runner; skipped SSH memory snapshot.\n' > "${output_dir}/remote-memory.txt"
    return 0
  fi

  local ssh_cmd=(ssh -p "${OCI_NODE_SSH_PORT}" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
  if [[ -n "${SSH_KEY_EFFECTIVE}" ]]; then
    ssh_cmd+=(-i "${SSH_KEY_EFFECTIVE}")
  fi
  ssh_cmd+=("${OCI_NODE_SSH_USER}@${OCI_NODE_SSH_HOST}")

  "${ssh_cmd[@]}" "set -euo pipefail; \
    echo '=== free -m ==='; free -m; \
    echo; echo '=== vmstat 1 5 ==='; vmstat 1 5; \
    echo; echo '=== /proc/meminfo (selected) ==='; \
    awk '/MemTotal:|MemFree:|MemAvailable:|SwapTotal:|SwapFree:/ {print}' /proc/meminfo; \
    echo; echo '=== df -h ==='; df -h; \
    echo; echo '=== df -i ==='; df -i; \
    echo; echo '=== top memory processes ==='; ps aux --sort=-%mem | head -20" \
    > "${output_dir}/remote-memory.txt" 2>&1 || true
}

capture_stage_snapshot() {
  local stage_name="$1"
  local deployment="$2"
  local outcome="$3"
  local output_dir="${STAGE_CAPTURE_DIR}/${stage_name%.yaml}-${deployment}-${outcome}"
  mkdir -p "${output_dir}"

  printf '%s\n' "${stage_name}" > "${output_dir}/stage-manifest-name.txt"
  capture_common_cluster_snapshot "${output_dir}"
  capture_remote_memory_snapshot "${output_dir}"

  if [[ -n "${deployment}" ]]; then
    kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" get deployment,replicaset,pod -l "app=${deployment}" -o wide > "${output_dir}/app-workloads.txt" 2>&1 || true
    kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" describe "deployment/${deployment}" > "${output_dir}/deployment-describe.txt" 2>&1 || true
    for pod in $(kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" get pods -l "app=${deployment}" -o name 2>/dev/null); do
      local pod_name="${pod#pod/}"
      local safe_pod_name="${pod_name//\//_}"
      kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" logs "${pod_name}" --all-containers=true --tail=200 > "${output_dir}/${safe_pod_name}-logs.txt" 2>&1 || true
      kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" logs "${pod_name}" --all-containers=true --tail=200 --previous > "${output_dir}/${safe_pod_name}-previous-logs.txt" 2>&1 || true
      kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" describe "${pod}" > "${output_dir}/${safe_pod_name}-describe.txt" 2>&1 || true
    done
  fi
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

  local render_cmd=(
    bash "${RENDER_SCRIPT}"
    --namespace "${NAMESPACE}" \
    --image-repo "${IMAGE_REPO}" \
    --image-tag "${IMAGE_TAG}" \
    --output-dir "${MANIFEST_DIR}" \
    --kubeconfig "${KUBECONFIG_PATH}" \
    --validate-client
  )
  if [[ -n "${SELECTED_SERVICES}" ]]; then
    render_cmd+=(--services "${SELECTED_SERVICES}")
  fi

  "${render_cmd[@]}"
}

apply_staged_manifests() {
  if [[ ! -s "${APPLY_ORDER_PATH}" ]]; then
    echo "::error::Apply order file is missing or empty: ${APPLY_ORDER_PATH}" >&2
    exit 1
  fi

  local manifest_name=""
  local manifest_path=""
  local deployment_name=""
  local rollout_timeout=""
  exec 3< "${APPLY_ORDER_PATH}"
  while IFS= read -r manifest_name <&3 || [[ -n "${manifest_name}" ]]; do
    [[ -n "${manifest_name}" ]] || continue
    manifest_path="${MANIFEST_DIR}/${manifest_name}"
    if [[ ! -s "${manifest_path}" ]]; then
      echo "::error::Expected staged manifest is missing: ${manifest_path}" >&2
      exit 1
    fi

    echo "Applying staged manifest ${manifest_name}"
    kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f "${manifest_path}"

    deployment_name=""
    rollout_timeout="180s"
    case "${manifest_name}" in
      01-redis.yaml)
        deployment_name="redis"
        rollout_timeout="180s"
        ;;
      02-ml-engine.yaml)
        deployment_name="ml-engine"
        rollout_timeout="240s"
        ;;
      03-bff.yaml)
        deployment_name="bff"
        rollout_timeout="180s"
        ;;
      04-frontend.yaml)
        deployment_name="frontend"
        rollout_timeout="180s"
        ;;
    esac

    if [[ -n "${deployment_name}" ]]; then
      wait_for_rollout "${deployment_name}" "${rollout_timeout}" "${manifest_name}"
      capture_stage_snapshot "${manifest_name}" "${deployment_name}" "ready"
    fi
  done
  exec 3<&-
}

run_deploy_preflight() {
  if [[ ! -f "${PREFLIGHT_SCRIPT}" ]]; then
    echo "::error::Preflight script is missing: ${PREFLIGHT_SCRIPT}" >&2
    exit 1
  fi

  local preflight_cmd=(
    bash "${PREFLIGHT_SCRIPT}"
    --kubeconfig "${KUBECONFIG_PATH}"
    --namespace "${NAMESPACE}"
    --node-name "${OCI_NODE_NAME}"
    --min-mem-available-mib "${MIN_NODE_MEM_AVAILABLE_MIB}"
    --min-swap-free-mib "${MIN_NODE_SWAP_FREE_MIB}"
    --max-root-usage-pct "${MAX_ROOT_USAGE_PERCENT}"
    --max-k3s-usage-pct "${MAX_K3S_USAGE_PERCENT}"
    --max-kubelet-usage-pct "${MAX_KUBELET_USAGE_PERCENT}"
  )

  if [[ -n "${OCI_NODE_SSH_HOST}" ]]; then
    preflight_cmd+=(
      --host "${OCI_NODE_SSH_HOST}"
      --ssh-user "${OCI_NODE_SSH_USER}"
      --ssh-port "${OCI_NODE_SSH_PORT}"
    )
    if [[ -n "${OCI_NODE_SSH_KEY}" ]]; then
      preflight_cmd+=(--ssh-key "${OCI_NODE_SSH_KEY}")
    fi
  fi

  if ! "${preflight_cmd[@]}" > "${PREFLIGHT_CAPTURE_DIR}/preflight.txt" 2>&1; then
    cat "${PREFLIGHT_CAPTURE_DIR}/preflight.txt"
    return 1
  fi
  cat "${PREFLIGHT_CAPTURE_DIR}/preflight.txt"
}

wait_for_rollout() {
  local deployment="$1"
  local timeout="${2:-180s}"
  local stage_name="${3:-${deployment}}"
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
  capture_stage_snapshot "${stage_name}" "${deployment}" "failed"
  return 1
}

wait_for_kube_api 24 10
kubectl --kubeconfig "${KUBECONFIG_PATH}" create namespace "${NAMESPACE}" --dry-run=client -o yaml | \
  kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f -

prepare_ssh_key
render_manifests
echo "Rendered staged manifests under ${MANIFEST_DIR}"
echo "Full manifest snapshot: ${FULL_MANIFEST_PATH}"
echo "Selected service profile: ${SELECTED_SERVICES:-all}"
echo "Deployment evidence directory: ${RUN_ARTIFACT_DIR}"
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

echo "Running OCI core deploy preflight gate."
run_deploy_preflight
apply_staged_manifests

echo "Minimal core deploy complete."
echo "Deployment evidence saved under ${RUN_ARTIFACT_DIR}"
