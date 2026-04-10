#!/usr/bin/env bash
set -euo pipefail

temp_kubeconfig=""
kctl_cmd=()

status() {
  local label="$1"
  local result="$2"
  printf '%-28s %s\n' "$label" "$result"
}

fail() {
  local message="$1"
  status "reconcile" "FAILED"
  echo "$message" >&2
  exit 1
}

kctl() {
  "${kctl_cmd[@]}" "$@"
}

wait_for_api() {
  local state=""
  local livez=""

  sudo -n systemctl start k3s >/dev/null 2>&1 || true

  for _ in $(seq 1 60); do
    state="$(sudo -n systemctl is-active k3s 2>/dev/null || true)"
    livez="$(curl -ksS -o /dev/null -w '%{http_code}' https://127.0.0.1:6443/livez 2>/dev/null || true)"
    if [[ "${state}" == "active" && ( "${livez}" == "200" || "${livez}" == "401" ) ]]; then
      status "k3s service" "${state}"
      status "API livez" "${livez}"
      return
    fi
    sleep 5
  done

  fail "k3s API did not become ready in time (state=${state:-unknown}, livez=${livez:-none})"
}

setup_kubectl() {
  local windows_kubectl="/mnt/c/Program Files/Docker/Docker/resources/bin/kubectl.exe"
  local win_cfg=""

  if sudo -n /usr/local/bin/k3s kubectl version --client >/dev/null 2>&1; then
    kctl_cmd=(sudo -n /usr/local/bin/k3s kubectl)
    status "kubectl mode" "k3s embedded"
    return
  fi

  if [[ -x "${windows_kubectl}" ]]; then
    temp_kubeconfig="$(mktemp /tmp/k3s-longhorn-kubeconfig-XXXX.yaml)"
    sudo -n cat /etc/rancher/k3s/k3s.yaml > "${temp_kubeconfig}"
    win_cfg="$(wslpath -w "${temp_kubeconfig}")"
    kctl_cmd=("${windows_kubectl}" --kubeconfig "${win_cfg}")
    status "kubectl mode" "Windows kubectl.exe fallback"
    return
  fi

  fail "Unable to find a working kubectl entrypoint for k3s"
}

cleanup() {
  if [[ -n "${temp_kubeconfig}" ]]; then
    rm -f "${temp_kubeconfig}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "== Longhorn control-plane reconcile =="
wait_for_api
setup_kubectl

echo
echo "Before reconcile:"
kctl -n longhorn-system get deploy,ds,pods

echo
echo "Restarting Longhorn control-plane workloads..."
kctl -n longhorn-system rollout restart deployment/longhorn-driver-deployer
kctl -n longhorn-system rollout restart deployment/csi-attacher
kctl -n longhorn-system rollout restart deployment/csi-provisioner
kctl -n longhorn-system rollout restart deployment/csi-resizer
kctl -n longhorn-system rollout restart deployment/csi-snapshotter
kctl -n longhorn-system rollout restart deployment/longhorn-ui
kctl -n longhorn-system rollout restart daemonset/longhorn-csi-plugin
kctl -n longhorn-system rollout restart daemonset/longhorn-manager

echo
echo "Waiting for rollouts..."
kctl -n longhorn-system rollout status deployment/longhorn-driver-deployer --timeout=300s || true
kctl -n longhorn-system rollout status deployment/csi-attacher --timeout=300s || true
kctl -n longhorn-system rollout status deployment/csi-provisioner --timeout=300s || true
kctl -n longhorn-system rollout status deployment/csi-resizer --timeout=300s || true
kctl -n longhorn-system rollout status deployment/csi-snapshotter --timeout=300s || true
kctl -n longhorn-system rollout status deployment/longhorn-ui --timeout=300s || true
kctl -n longhorn-system rollout status daemonset/longhorn-csi-plugin --timeout=300s || true
kctl -n longhorn-system rollout status daemonset/longhorn-manager --timeout=300s || true

echo
echo "After reconcile:"
kctl -n longhorn-system get deploy,ds,pods
status "reconcile" "COMPLETED"
