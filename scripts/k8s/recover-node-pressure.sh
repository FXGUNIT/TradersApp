#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/k8s/recover-node-pressure.sh \
    --kubeconfig /path/to/kubeconfig \
    [--namespace tradersapp] \
    [--cleanup-image redis:7-alpine] \
    [--wait-seconds 300]

Purpose:
  Recover a single-node OCI k3s cluster from rollout-time DiskPressure by:
    1. deleting failed / completed pods,
    2. inspecting node taints and conditions,
    3. running a small privileged host cleanup job when DiskPressure is active.
EOF
}

KUBECONFIG_PATH=""
NAMESPACE="tradersapp"
CLEANUP_IMAGE="redis:7-alpine"
WAIT_SECONDS=300

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
    --cleanup-image)
      CLEANUP_IMAGE="${2:-}"
      shift 2
      ;;
    --wait-seconds)
      WAIT_SECONDS="${2:-}"
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

log_node_state() {
  echo "===== node pressure state ====="
  kubectl --kubeconfig "${KUBECONFIG_PATH}" get nodes -o wide || true
  for node in $(kubectl --kubeconfig "${KUBECONFIG_PATH}" get nodes -o name 2>/dev/null); do
    echo "--- describe ${node}"
    kubectl --kubeconfig "${KUBECONFIG_PATH}" describe "${node}" | sed -n '/^Taints:/,/^Non-terminated Pods:/p' || true
  done
}

delete_terminal_pods() {
  local terminal_pods
  terminal_pods="$(
    {
      kubectl --kubeconfig "${KUBECONFIG_PATH}" get pods -A \
        --field-selector=status.phase=Failed \
        -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\n"}{end}' 2>/dev/null || true
      kubectl --kubeconfig "${KUBECONFIG_PATH}" get pods -A \
        --field-selector=status.phase=Succeeded \
        -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\n"}{end}' 2>/dev/null || true
    } | sort -u
  )"

  if [[ -z "${terminal_pods}" ]]; then
    echo "No failed or completed pods to delete."
    return 0
  fi

  echo "Deleting failed / completed pods before redeploy."
  while IFS=$'\t' read -r pod_namespace pod_name; do
    [[ -n "${pod_namespace}" && -n "${pod_name}" ]] || continue
    echo "  deleting ${pod_namespace}/${pod_name}"
    kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${pod_namespace}" delete pod "${pod_name}" \
      --ignore-not-found=true --grace-period=0 --force || true
  done <<< "${terminal_pods}"
}

node_has_disk_pressure() {
  local output
  output="$(kubectl --kubeconfig "${KUBECONFIG_PATH}" get nodes -o json 2>/dev/null | python3 -c '
import json
import sys

doc = json.load(sys.stdin)
matches = []
for item in doc.get("items", []):
    name = item.get("metadata", {}).get("name", "<unknown>")
    taints = item.get("spec", {}).get("taints", []) or []
    disk_taint = any(t.get("key") == "node.kubernetes.io/disk-pressure" for t in taints)
    disk_condition = False
    for condition in item.get("status", {}).get("conditions", []) or []:
        if condition.get("type") == "DiskPressure" and condition.get("status") == "True":
            disk_condition = True
            break
    if disk_taint or disk_condition:
        matches.append(name)

if matches:
    print("\\n".join(matches))
')" || true

  if [[ -n "${output}" ]]; then
    echo "${output}"
    return 0
  fi
  return 1
}

run_node_cleanup_job() {
  local job_name="node-disk-recovery"

  echo "Running privileged host cleanup job using ${CLEANUP_IMAGE}."
  kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" delete job "${job_name}" \
    --ignore-not-found=true --wait=true || true

  cat <<EOF | kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" apply --validate=false -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: ${job_name}
  namespace: ${NAMESPACE}
spec:
  ttlSecondsAfterFinished: 300
  backoffLimit: 0
  template:
    metadata:
      labels:
        app: node-disk-recovery
    spec:
      restartPolicy: Never
      automountServiceAccountToken: false
      enableServiceLinks: false
      hostPID: true
      priorityClassName: system-node-critical
      tolerations:
        - operator: Exists
          effect: NoSchedule
        - operator: Exists
          effect: NoExecute
      containers:
        - name: cleaner
          image: ${CLEANUP_IMAGE}
          imagePullPolicy: IfNotPresent
          securityContext:
            privileged: true
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
            limits:
              cpu: 100m
              memory: 64Mi
          command:
            - /bin/sh
            - -ceu
            - |
              chroot /host /bin/sh -ceu '
                ACTIVE_UID_FILE=/tmp/tradersapp-active-pods.txt

                cleanup_tmp() {
                  rm -f "\${ACTIVE_UID_FILE}" 2>/dev/null || true
                }

                summarize_host_disk() {
                  local stage="\$1"
                  echo "=== host disk \${stage} ==="
                  df -h / /var/log /var/lib/rancher /var/lib/kubelet 2>/dev/null || true
                  df -ih / /var/log /var/lib/rancher /var/lib/kubelet 2>/dev/null || true
                  du -xhd1 /var/lib/rancher /var/lib/kubelet /var/log 2>/dev/null | sort -h || true
                  echo "--- large files (>100M)"
                  find /var/lib/rancher /var/lib/kubelet /var/log -xdev -type f -size +100M -printf "%s %p\n" 2>/dev/null | sort -nr | head -n 20 || true
                }

                collect_active_uids() {
                  : > "\${ACTIVE_UID_FILE}"
                  k3s kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.uid}{\"\n\"}{end}" 2>/dev/null | sort -u > "\${ACTIVE_UID_FILE}" || true
                }

                pod_uid_is_active() {
                  local pod_uid="\$1"
                  [[ -n "\${pod_uid}" ]] || return 1
                  grep -Fxq "\${pod_uid}" "\${ACTIVE_UID_FILE}" 2>/dev/null
                }

                cleanup_stale_uid_dirs() {
                  local base_dir="\$1"
                  local dir_name=""
                  local pod_uid=""
                  [ -d "\${base_dir}" ] || return 0
                  for dir_path in "\${base_dir}"/*; do
                    [ -e "\${dir_path}" ] || continue
                    [ -d "\${dir_path}" ] || continue
                    dir_name="\${dir_path##*/}"
                    pod_uid="\${dir_name##*_}"
                    if [[ "\${base_dir}" == "/var/lib/kubelet/pods" ]]; then
                      pod_uid="\${dir_name}"
                    fi
                    if ! pod_uid_is_active "\${pod_uid}"; then
                      echo "Removing stale pod directory: \${dir_path}"
                      rm -rf "\${dir_path}" 2>/dev/null || true
                    fi
                  done
                }

                trap cleanup_tmp EXIT
                summarize_host_disk before
                collect_active_uids

                k3s crictl pods --state Exited -q | xargs -r k3s crictl rmp -f || true
                k3s crictl ps -a --state Exited -q | xargs -r k3s crictl rm -f || true
                k3s crictl rmi --prune || true

                cleanup_stale_uid_dirs /var/log/pods
                cleanup_stale_uid_dirs /var/lib/kubelet/pods
                find /var/log/containers -xtype l -delete 2>/dev/null || true
                find /var/log/pods -xdev -type f -name "*.log" -size +20M -exec sh -c ": > \"\$1\"" _ {} \; 2>/dev/null || true

                journalctl --vacuum-size=64M || true
                journalctl --vacuum-time=1d || true
                rm -rf /var/lib/systemd/coredump/* 2>/dev/null || true
                rm -rf /var/cache/dnf/* 2>/dev/null || true
                find /tmp /var/tmp -xdev -mindepth 1 -mtime +1 -exec rm -rf {} + 2>/dev/null || true

                sync
                summarize_host_disk after
              '
          volumeMounts:
            - name: host-root
              mountPath: /host
      volumes:
        - name: host-root
          hostPath:
            path: /
            type: Directory
EOF

  if ! kubectl_retry 6 kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" wait \
    --for=condition=complete "job/${job_name}" --timeout=360s; then
    echo "::warning::Node cleanup job did not report completion."
    kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" get pods -l app=node-disk-recovery -o wide || true
    kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" describe job "${job_name}" || true
    for pod in $(kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" get pods -l app=node-disk-recovery -o name 2>/dev/null); do
      kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" logs "${pod#pod/}" --tail=200 || true
      kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" describe "${pod}" || true
    done
    return 1
  fi

  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n "${NAMESPACE}" logs "job/${job_name}" --tail=300 || true
}

wait_for_disk_pressure_clear() {
  local timeout_seconds="${1:-300}"
  local elapsed=0

  while [[ "${elapsed}" -lt "${timeout_seconds}" ]]; do
    if ! node_has_disk_pressure >/dev/null; then
      echo "DiskPressure is clear."
      return 0
    fi
    echo "DiskPressure still present after cleanup; waiting 10s..."
    sleep 10
    elapsed=$((elapsed + 10))
  done

  echo "::error::DiskPressure remained active after waiting ${timeout_seconds}s." >&2
  return 1
}

wait_for_kube_api 24 10
kubectl --kubeconfig "${KUBECONFIG_PATH}" create namespace "${NAMESPACE}" --dry-run=client -o yaml | \
  kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f - >/dev/null

delete_terminal_pods
log_node_state

if node_has_disk_pressure >/dev/null; then
  echo "DiskPressure detected; starting host cleanup."
  run_node_cleanup_job
  wait_for_disk_pressure_clear "${WAIT_SECONDS}"
  log_node_state
else
  echo "No DiskPressure detected."
fi
