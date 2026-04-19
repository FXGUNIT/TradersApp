#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/k8s/collect-oci-node-baseline.sh \
    --output-dir artifacts/k8s/oci-node-baseline \
    [--host 144.24.112.249] \
    [--ssh-user opc] \
    [--ssh-key ~/.oci/tradersapp_ssh_key] \
    [--ssh-port 22] \
    [--kubeconfig /path/to/kubeconfig] \
    [--namespace tradersapp]

Purpose:
  Collect a read-only evidence bundle for P09-C01 through P09-C08:
    - host memory, swap, process, k3s journal, and disk state over SSH
    - node, pod, and event state through kubectl when kubeconfig is available

Notes:
  - The script does not modify the node or cluster.
  - SSH collection is optional; kubectl collection is optional.
  - Provide at least one of --host or --kubeconfig.
EOF
}

OUTPUT_DIR=""
HOST=""
SSH_USER="opc"
SSH_KEY=""
SSH_PORT="22"
KUBECONFIG_PATH=""
NAMESPACE="tradersapp"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir)
      OUTPUT_DIR="${2:-}"
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
    --kubeconfig)
      KUBECONFIG_PATH="${2:-}"
      shift 2
      ;;
    --namespace)
      NAMESPACE="${2:-}"
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

if [[ -z "${OUTPUT_DIR}" ]]; then
  echo "::error::--output-dir is required" >&2
  usage >&2
  exit 1
fi

if [[ -z "${HOST}" && -z "${KUBECONFIG_PATH}" ]]; then
  echo "::error::Provide at least one of --host or --kubeconfig" >&2
  usage >&2
  exit 1
fi

if [[ -n "${KUBECONFIG_PATH}" && ! -f "${KUBECONFIG_PATH}" ]]; then
  echo "::error::Kubeconfig not found: ${KUBECONFIG_PATH}" >&2
  exit 1
fi

if [[ -n "${SSH_KEY}" && ! -f "${SSH_KEY}" ]]; then
  echo "::error::SSH key not found: ${SSH_KEY}" >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}/host" "${OUTPUT_DIR}/cluster"

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

run_remote_capture() {
  local label="$1"
  local command="$2"
  local output_path="${OUTPUT_DIR}/host/${label}.txt"

  local ssh_cmd=(ssh -p "${SSH_PORT}" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
  if [[ -n "${SSH_KEY}" ]]; then
    ssh_cmd+=(-i "${SSH_KEY}")
  fi
  ssh_cmd+=("${SSH_USER}@${HOST}" "${command}")

  log "Capturing host/${label}.txt"
  "${ssh_cmd[@]}" > "${output_path}" 2>&1
}

run_kubectl_capture() {
  local label="$1"
  shift
  local output_path="${OUTPUT_DIR}/cluster/${label}.txt"
  local kubectl_cmd=(kubectl)
  if [[ -n "${KUBECONFIG_PATH}" ]]; then
    kubectl_cmd+=(--kubeconfig "${KUBECONFIG_PATH}")
  fi

  log "Capturing cluster/${label}.txt"
  "${kubectl_cmd[@]}" "$@" > "${output_path}" 2>&1
}

write_manifest() {
  cat > "${OUTPUT_DIR}/README.txt" <<EOF
TradersApp OCI node baseline bundle
Generated: $(date -Is)
Namespace: ${NAMESPACE}
Host: ${HOST:-not-collected}
Kubeconfig: ${KUBECONFIG_PATH:-not-collected}

Host captures:
  host/identity.txt
  host/memory.txt
  host/processes.txt
  host/k3s-status.txt
  host/k3s-journal.txt
  host/storage.txt

Cluster captures:
  cluster/nodes.txt
  cluster/node-describe.txt
  cluster/pods-wide.txt
  cluster/events.txt
  cluster/deployments.txt
EOF
}

if [[ -n "${HOST}" ]]; then
  run_remote_capture "identity" "hostnamectl 2>/dev/null || uname -a; echo; date -Is; echo; uptime"
  run_remote_capture "memory" "free -m; echo; vmstat 1 5; echo; cat /proc/meminfo; echo; swapon --show --bytes; echo; sysctl vm.swappiness vm.overcommit_memory 2>/dev/null || true"
  run_remote_capture "processes" "ps aux --sort=-%mem | head -20; echo; pgrep -af 'k3s|etcd|containerd|kubelet' || true"
  run_remote_capture "k3s-status" "sudo systemctl status k3s --no-pager --full || systemctl status k3s --no-pager --full"
  run_remote_capture "k3s-journal" "sudo journalctl -u k3s -n 300 --no-pager || journalctl -u k3s -n 300 --no-pager"
  run_remote_capture "storage" "df -h; echo; df -i; echo; du -sh /var/lib/rancher/k3s/* 2>/dev/null || true; echo; du -sh /var/lib/kubelet/* 2>/dev/null || true"
fi

if [[ -n "${KUBECONFIG_PATH}" ]]; then
  run_kubectl_capture "nodes" get nodes -o wide
  run_kubectl_capture "node-describe" describe node tradersapp-oci
  run_kubectl_capture "pods-wide" get pods -A -o wide
  run_kubectl_capture "events" get events -A --sort-by=.lastTimestamp
  run_kubectl_capture "deployments" -n "${NAMESPACE}" get deployment,replicaset,pod,service -o wide
fi

write_manifest
log "Baseline bundle written to ${OUTPUT_DIR}"
