#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/oci/install-k3s-single-node-free.sh" >&2
  exit 1
fi

PUBLIC_IP="${PUBLIC_IP:-}"
SWAP_GB="${SWAP_GB:-2}"
K3S_VERSION="${K3S_VERSION:-v1.34.6+k3s1}"

usage() {
  cat <<'EOF'
Usage:
  sudo PUBLIC_IP=<oci_public_ip> bash scripts/oci/install-k3s-single-node-free.sh

What it does:
  - Ensures a swap file exists for the OCI free node
  - Installs or repairs the k3s systemd service
  - Writes a single-node config intended for OCI Always Free

Important:
  - This script intentionally does NOT use --cluster-init on a single node.
  - It also keeps kube-proxy enabled. Disabling kube-proxy on a cluster without
    a replacement breaks Service routing.
  - If /var/lib/rancher/k3s/server/db/etcd already exists, k3s will continue
    using embedded etcd until you rebuild or migrate the datastore explicitly.
EOF
}

if [[ -z "${PUBLIC_IP}" ]]; then
  usage >&2
  echo "PUBLIC_IP is required." >&2
  exit 1
fi

ensure_swap() {
  if swapon --show | grep -q '/swapfile'; then
    echo "Swapfile already active."
    return 0
  fi

  if [[ ! -f /swapfile ]]; then
    echo "Creating ${SWAP_GB}G swapfile..."
    fallocate -l "${SWAP_GB}G" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=$((SWAP_GB * 1024))
    chmod 600 /swapfile
    mkswap /swapfile
  fi

  swapon /swapfile
  if ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
}

install_or_repair_k3s_service() {
  echo "Installing or repairing the k3s ${K3S_VERSION} systemd service..."
  curl -sfL https://get.k3s.io | \
    INSTALL_K3S_VERSION="${K3S_VERSION}" \
    INSTALL_K3S_SKIP_START=true \
    sh -
}

write_k3s_config() {
  mkdir -p /etc/rancher/k3s
  cat > /etc/rancher/k3s/config.yaml <<EOF
write-kubeconfig-mode: "0644"
tls-san:
  - "${PUBLIC_IP}"
disable:
  - traefik
  - servicelb
  - helm-controller
  - cloud-controller
  - metrics-server
EOF
}

show_datastore_warning() {
  if [[ -d /var/lib/rancher/k3s/server/db/etcd ]]; then
    cat <<'EOF'
WARNING:
  Embedded etcd data already exists at /var/lib/rancher/k3s/server/db/etcd.
  k3s will keep using that datastore even though this single-node config no
  longer requests --cluster-init.
  If you want the lighter default SQLite datastore, plan a controlled rebuild.
EOF
  fi
}

enable_and_restart_k3s() {
  systemctl daemon-reload
  systemctl enable k3s
  systemctl restart k3s
  systemctl --no-pager --full status k3s | sed -n '1,20p'
}

ensure_swap
write_k3s_config
install_or_repair_k3s_service
show_datastore_warning
enable_and_restart_k3s

echo ""
echo "k3s single-node repair/install complete."
echo "Next checks:"
echo "  sudo systemctl is-active k3s"
echo "  sudo k3s kubectl get nodes -o wide"
echo "  sudo cat /etc/rancher/k3s/k3s.yaml"
