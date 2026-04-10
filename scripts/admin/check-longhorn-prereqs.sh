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
  status "prereqs" "FAILED"
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
    temp_kubeconfig="$(mktemp /tmp/k3s-prereqs-kubeconfig-XXXX.yaml)"
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

echo "== Longhorn prerequisite check =="
wait_for_api
setup_kubectl

if command -v iscsiadm >/dev/null 2>&1; then
  iscsi_path="$(command -v iscsiadm)"
  status "open-iscsi binary" "OK (${iscsi_path})"
else
  status "open-iscsi binary" "MISSING"
fi

if command -v mount.nfs4 >/dev/null 2>&1; then
  nfs4_path="$(command -v mount.nfs4)"
  status "NFSv4 client binary" "OK (${nfs4_path})"
else
  status "NFSv4 client binary" "MISSING"
fi

if systemctl list-unit-files iscsid.service >/dev/null 2>&1; then
  status "iscsid service" "$(systemctl is-active iscsid 2>/dev/null || true)"
else
  status "iscsid service" "MISSING"
fi

status "hostname" "$(hostname)"
status "node count" "$(kctl get nodes --no-headers 2>/dev/null | wc -l || echo 0)"

if kctl get storageclass longhorn --no-headers >/dev/null 2>&1; then
  status "longhorn storageclass" "longhorn"
else
  status "longhorn storageclass" "MISSING"
fi
