#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/k8s/check-oci-core-preflight.sh \
    --kubeconfig /path/to/kubeconfig \
    [--namespace tradersapp] \
    [--node-name tradersapp-oci] \
    [--host 144.24.112.249] \
    [--ssh-user opc] \
    [--ssh-key ~/.oci/tradersapp_ssh_key] \
    [--ssh-port 22] \
    [--min-mem-available-mib 350] \
    [--min-swap-free-mib 768] \
    [--max-root-usage-pct 90] \
    [--max-k3s-usage-pct 90] \
    [--max-kubelet-usage-pct 90]

Purpose:
  Read-only preflight for the staged core deploy on the 1 GB OCI node.

Checks:
    - Kubernetes API reachable
    - target node is Ready
    - no DiskPressure / MemoryPressure / PIDPressure
    - no disk-pressure taint
    - if SSH access is configured:
        * MemAvailable above threshold
        * SwapFree above threshold
        * root, /var/lib/rancher/k3s, and /var/lib/kubelet usage below thresholds

Notes:
  - The memory and swap thresholds are provisional defaults until P09-C01
    through P09-C16 produce measured final values. They are intentionally
    overrideable per run.
EOF
}

KUBECONFIG_PATH=""
NAMESPACE="tradersapp"
NODE_NAME="tradersapp-oci"
HOST=""
SSH_USER="opc"
SSH_KEY=""
SSH_PORT="22"
MIN_MEM_AVAILABLE_MIB="${MIN_NODE_MEM_AVAILABLE_MIB:-350}"
MIN_SWAP_FREE_MIB="${MIN_NODE_SWAP_FREE_MIB:-768}"
MAX_ROOT_USAGE_PCT="${MAX_ROOT_USAGE_PERCENT:-90}"
MAX_K3S_USAGE_PCT="${MAX_K3S_USAGE_PERCENT:-90}"
MAX_KUBELET_USAGE_PCT="${MAX_KUBELET_USAGE_PERCENT:-90}"

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
    --node-name)
      NODE_NAME="${2:-}"
      shift 2
      ;;
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --ssh-user)
      SSH_USER="${2:-}"
      shift 2
      ;;
    --ssh-key)
      SSH_KEY="${2:-}"
      shift 2
      ;;
    --ssh-port)
      SSH_PORT="${2:-}"
      shift 2
      ;;
    --min-mem-available-mib)
      MIN_MEM_AVAILABLE_MIB="${2:-}"
      shift 2
      ;;
    --min-swap-free-mib)
      MIN_SWAP_FREE_MIB="${2:-}"
      shift 2
      ;;
    --max-root-usage-pct)
      MAX_ROOT_USAGE_PCT="${2:-}"
      shift 2
      ;;
    --max-k3s-usage-pct)
      MAX_K3S_USAGE_PCT="${2:-}"
      shift 2
      ;;
    --max-kubelet-usage-pct)
      MAX_KUBELET_USAGE_PCT="${2:-}"
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
  usage >&2
  exit 1
fi

if [[ ! -f "${KUBECONFIG_PATH}" ]]; then
  echo "::error::Kubeconfig not found: ${KUBECONFIG_PATH}" >&2
  exit 1
fi

if [[ -n "${SSH_KEY}" && ! -f "${SSH_KEY}" ]]; then
  echo "::error::SSH key not found: ${SSH_KEY}" >&2
  exit 1
fi

PASS_COUNT=0
FAIL_COUNT=0
PYTHON_BIN=""
SSH_KEY_EFFECTIVE=""
SSH_TEMP_KEY=""

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

pass() {
  printf '[%s] PASS: %s\n' "$(date +%H:%M:%S)" "$*"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  printf '[%s] FAIL: %s\n' "$(date +%H:%M:%S)" "$*" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

kubectl_cmd() {
  kubectl --kubeconfig "${KUBECONFIG_PATH}" "$@"
}

ssh_cmd() {
  local cmd=(ssh -p "${SSH_PORT}" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
  if [[ -n "${SSH_KEY_EFFECTIVE}" ]]; then
    cmd+=(-i "${SSH_KEY_EFFECTIVE}")
  fi
  cmd+=("${SSH_USER}@${HOST}" "$@")
  "${cmd[@]}"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "::error::Required command not found: $1" >&2
    exit 1
  fi
}

check_kube_api() {
  if kubectl_cmd --request-timeout=10s get --raw='/version' >/dev/null 2>&1; then
    pass "Kubernetes API is reachable"
  else
    fail "Kubernetes API is not reachable"
  fi
}

check_node_conditions() {
  local node_json
  node_json="$(kubectl_cmd get node "${NODE_NAME}" -o json 2>/dev/null)" || {
    fail "Unable to fetch node ${NODE_NAME}"
    return
  }

  if NODE_JSON_PAYLOAD="${node_json}" "${PYTHON_BIN}" - "${NODE_NAME}" <<'PY'
import json
import os
import sys

doc = json.loads(os.environ["NODE_JSON_PAYLOAD"])
conditions = {item.get("type"): item.get("status") for item in doc.get("status", {}).get("conditions", [])}
taints = doc.get("spec", {}).get("taints", []) or []

errors = []
if conditions.get("Ready") != "True":
    errors.append("Ready is not True")
if conditions.get("DiskPressure") == "True":
    errors.append("DiskPressure is True")
if conditions.get("MemoryPressure") == "True":
    errors.append("MemoryPressure is True")
if conditions.get("PIDPressure") == "True":
    errors.append("PIDPressure is True")
if any(t.get("key") == "node.kubernetes.io/disk-pressure" for t in taints):
    errors.append("node.kubernetes.io/disk-pressure taint present")

if errors:
    print("; ".join(errors))
    sys.exit(1)
PY
  then
    pass "Node ${NODE_NAME} is Ready with no pressure taints/conditions"
  else
    fail "Node ${NODE_NAME} is not safe for rollout"
  fi
}

prepare_ssh_key() {
  if [[ -z "${SSH_KEY}" ]]; then
    SSH_KEY_EFFECTIVE=""
    return 0
  fi

  SSH_TEMP_KEY="$(mktemp "${TMPDIR:-/tmp}/tradersapp-ssh-key-XXXXXX")"
  cp "${SSH_KEY}" "${SSH_TEMP_KEY}"
  chmod 600 "${SSH_TEMP_KEY}"
  SSH_KEY_EFFECTIVE="${SSH_TEMP_KEY}"
}

cleanup() {
  if [[ -n "${SSH_TEMP_KEY}" ]]; then
    rm -f "${SSH_TEMP_KEY}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

check_remote_thresholds() {
  if [[ -z "${HOST}" ]]; then
    log "Remote host not configured; skipping MemAvailable, SwapFree, and filesystem threshold checks."
    return
  fi

  local remote_payload
  if ! remote_payload="$(ssh_cmd "set -euo pipefail; \
    awk '/MemAvailable:/ {print \$2}' /proc/meminfo; \
    awk '/SwapFree:/ {print \$2}' /proc/meminfo; \
    df -P / | awk 'NR==2 {print \$5}' ; \
    df -P /var/lib/rancher/k3s 2>/dev/null | awk 'NR==2 {print \$5}' || echo n/a; \
    df -P /var/lib/kubelet 2>/dev/null | awk 'NR==2 {print \$5}' || echo n/a" 2>/dev/null)"; then
    fail "Unable to read remote host metrics from ${HOST}"
    return
  fi

  local mem_available_kib=""
  local swap_free_kib=""
  local root_used_pct=""
  local k3s_used_pct=""
  local kubelet_used_pct=""

  mem_available_kib="$(printf '%s\n' "${remote_payload}" | sed -n '1p')"
  swap_free_kib="$(printf '%s\n' "${remote_payload}" | sed -n '2p')"
  root_used_pct="$(printf '%s\n' "${remote_payload}" | sed -n '3p' | tr -d '%')"
  k3s_used_pct="$(printf '%s\n' "${remote_payload}" | sed -n '4p' | tr -d '%')"
  kubelet_used_pct="$(printf '%s\n' "${remote_payload}" | sed -n '5p' | tr -d '%')"

  local mem_available_mib=$(( mem_available_kib / 1024 ))
  local swap_free_mib=$(( swap_free_kib / 1024 ))

  if (( mem_available_mib >= MIN_MEM_AVAILABLE_MIB )); then
    pass "Remote MemAvailable ${mem_available_mib} MiB >= ${MIN_MEM_AVAILABLE_MIB} MiB"
  else
    fail "Remote MemAvailable ${mem_available_mib} MiB is below ${MIN_MEM_AVAILABLE_MIB} MiB"
  fi

  if (( swap_free_mib >= MIN_SWAP_FREE_MIB )); then
    pass "Remote SwapFree ${swap_free_mib} MiB >= ${MIN_SWAP_FREE_MIB} MiB"
  else
    fail "Remote SwapFree ${swap_free_mib} MiB is below ${MIN_SWAP_FREE_MIB} MiB"
  fi

  if [[ "${root_used_pct}" =~ ^[0-9]+$ ]] && (( root_used_pct < MAX_ROOT_USAGE_PCT )); then
    pass "Root filesystem usage ${root_used_pct}% < ${MAX_ROOT_USAGE_PCT}%"
  else
    fail "Root filesystem usage ${root_used_pct:-unknown}% is not below ${MAX_ROOT_USAGE_PCT}%"
  fi

  if [[ "${k3s_used_pct}" == "n/a" ]]; then
    log "/var/lib/rancher/k3s usage not available on remote host"
  elif [[ "${k3s_used_pct}" =~ ^[0-9]+$ ]] && (( k3s_used_pct < MAX_K3S_USAGE_PCT )); then
    pass "/var/lib/rancher/k3s usage ${k3s_used_pct}% < ${MAX_K3S_USAGE_PCT}%"
  else
    fail "/var/lib/rancher/k3s usage ${k3s_used_pct}% is not below ${MAX_K3S_USAGE_PCT}%"
  fi

  if [[ "${kubelet_used_pct}" == "n/a" ]]; then
    log "/var/lib/kubelet usage not available on remote host"
  elif [[ "${kubelet_used_pct}" =~ ^[0-9]+$ ]] && (( kubelet_used_pct < MAX_KUBELET_USAGE_PCT )); then
    pass "/var/lib/kubelet usage ${kubelet_used_pct}% < ${MAX_KUBELET_USAGE_PCT}%"
  else
    fail "/var/lib/kubelet usage ${kubelet_used_pct}% is not below ${MAX_KUBELET_USAGE_PCT}%"
  fi
}

require_cmd kubectl
if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python)"
else
  echo "::error::python3 or python is required" >&2
  exit 1
fi
if [[ -n "${HOST}" ]]; then
  require_cmd ssh
  require_cmd cp
  require_cmd chmod
  require_cmd mktemp
  prepare_ssh_key
fi
check_kube_api
check_node_conditions
check_remote_thresholds

log "Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
if (( FAIL_COUNT > 0 )); then
  log "Result: FAIL"
  exit 1
fi

log "Result: PASS"
