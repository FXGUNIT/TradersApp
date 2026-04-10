#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Apply k3s WSL RWX storage class fix — standalone bash version
# called by longhorn-dispatch.sh as the "rwx-fix" stage.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

umount_conf="${script_dir}/k3s-docker-host-umount.conf"
manifest="${script_dir}/k3s-local-storage-shared-rwx.yaml"
smoke="${script_dir}/k3s-rwx-smoke.yaml"
manifest_apply_path="${manifest}"
smoke_apply_path="${smoke}"
temp_kubeconfig=""
kctl_cmd=()

status() {
  local label="$1"
  local result="$2"
  printf '%-28s %s\n' "$label" "$result"
}

fail() {
  local message="$1"
  status "rwx-fix" "FAILED"
  echo "$message" >&2
  exit 1
}

kctl() {
  "${kctl_cmd[@]}" "$@"
}

wait_for_api() {
  local state=""
  local livez=""

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
    temp_kubeconfig="$(mktemp /tmp/k3s-rwx-fix-kubeconfig-XXXX.yaml)"
    sudo -n cat /etc/rancher/k3s/k3s.yaml > "${temp_kubeconfig}"
    win_cfg="$(wslpath -w "${temp_kubeconfig}")"
    manifest_apply_path="$(wslpath -w "${manifest}")"
    smoke_apply_path="$(wslpath -w "${smoke}")"
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

echo "== k3s WSL RWX storage fix =="

sudo -n install -d -m 0755 /etc/systemd/system/k3s.service.d
sudo -n cp "${umount_conf}" /etc/systemd/system/k3s.service.d/docker-host-umount.conf
sudo -n cp "${manifest}" /var/lib/rancher/k3s/server/manifests/zz-local-storage-override.yaml
sudo -n mkdir -p /var/lib/rancher/k3s/shared-rwx
sudo -n systemctl daemon-reload
sudo -n systemctl restart k3s
status "k3s restart" "initiated"

wait_for_api
setup_kubectl

kctl apply -f "${manifest_apply_path}" >/dev/null
kctl -n kube-system rollout restart deployment/local-path-provisioner >/dev/null
kctl -n kube-system rollout status deployment/local-path-provisioner --timeout=120s
kctl get storageclass shared-rwx >/dev/null
status "shared-rwx class" "created"

# Smoke test
kctl apply -f "${smoke_apply_path}" >/dev/null
kctl -n rwx-smoke wait --for=condition=Ready pod/rwx-writer --timeout=180s
kctl -n rwx-smoke wait --for=condition=Ready pod/rwx-reader --timeout=180s
result="$(kctl -n rwx-smoke exec rwx-reader -- cat /data/probe.txt | tr -d '\r')"
kctl delete namespace rwx-smoke --wait=true >/dev/null
status "RWX smoke test" "${result}"
status "rwx-fix" "COMPLETED"
