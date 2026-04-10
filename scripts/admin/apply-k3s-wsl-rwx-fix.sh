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

status() {
  local label="$1"
  local result="$2"
  printf '%-28s %s\n' "$label" "$result"
}

echo "== k3s WSL RWX storage fix =="

sudo -n install -d -m 0755 /etc/systemd/system/k3s.service.d
sudo -n cp "${umount_conf}" /etc/systemd/system/k3s.service.d/docker-host-umount.conf
sudo -n cp "${manifest}" /var/lib/rancher/k3s/server/manifests/zz-local-storage-override.yaml
sudo -n mkdir -p /var/lib/rancher/k3s/shared-rwx
sudo -n systemctl daemon-reload
sudo -n systemctl restart k3s
status "k3s restart" "initiated"

sleep 12
sudo -n systemctl is-active k3s
status "k3s service" "active"

sudo -n k3s kubectl apply -f /var/lib/rancher/k3s/server/manifests/zz-local-storage-override.yaml >/dev/null
sudo -n k3s kubectl -n kube-system rollout restart deployment/local-path-provisioner >/dev/null
sudo -n k3s kubectl -n kube-system rollout status deployment/local-path-provisioner --timeout=120s
sudo -n k3s kubectl get storageclass shared-rwx >/dev/null
status "shared-rwx class" "created"

# Smoke test
sudo -n k3s kubectl apply -f "${smoke}" >/dev/null
sudo -n k3s kubectl -n rwx-smoke wait --for=condition=Ready pod/rwx-writer --timeout=180s
sudo -n k3s kubectl -n rwx-smoke wait --for=condition=Ready pod/rwx-reader --timeout=180s
result="$(sudo -n k3s kubectl -n rwx-smoke exec rwx-reader -- cat /data/probe.txt | tr -d '\r')"
sudo -n k3s kubectl delete namespace rwx-smoke --wait=true >/dev/null
status "RWX smoke test" "${result}"
status "rwx-fix" "COMPLETED"
