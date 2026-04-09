param(
  [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

function Invoke-WslBash {
  param([string]$Command)

  & wsl.exe -d $Distro -- bash -lc $Command
  if ($LASTEXITCODE -ne 0) {
    throw "WSL command failed: $Command"
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$repoRootForWsl = ($repoRoot -replace "\\", "/")
$wslRepo = (& wsl.exe -d $Distro -- bash -lc "wslpath -a '$repoRootForWsl'" | Out-String).Trim()

if (-not $wslRepo) {
  throw "Unable to resolve WSL path for $repoRoot"
}

$umountConf = "$wslRepo/scripts/admin/k3s-docker-host-umount.conf"
$manifest = "$wslRepo/scripts/admin/k3s-local-storage-shared-rwx.yaml"
$smoke = "$wslRepo/scripts/admin/k3s-rwx-smoke.yaml"
Invoke-WslBash "set -euo pipefail; sudo -n install -d -m 0755 /etc/systemd/system/k3s.service.d; sudo -n cp '$umountConf' /etc/systemd/system/k3s.service.d/docker-host-umount.conf; sudo -n cp '$manifest' /var/lib/rancher/k3s/server/manifests/zz-local-storage-override.yaml; sudo -n mkdir -p /var/lib/rancher/k3s/shared-rwx; sudo -n systemctl daemon-reload; sudo -n systemctl restart k3s; sleep 12; sudo -n systemctl is-active k3s; sudo -n k3s kubectl apply -f /var/lib/rancher/k3s/server/manifests/zz-local-storage-override.yaml >/dev/null; sudo -n k3s kubectl -n kube-system rollout restart deployment/local-path-provisioner >/dev/null; sudo -n k3s kubectl -n kube-system rollout status deployment/local-path-provisioner --timeout=120s; sudo -n k3s kubectl get storageclass shared-rwx >/dev/null"

Invoke-WslBash "set -euo pipefail; sudo -n k3s kubectl apply -f '$smoke' >/dev/null; sudo -n k3s kubectl -n rwx-smoke wait --for=condition=Ready pod/rwx-writer --timeout=180s; sudo -n k3s kubectl -n rwx-smoke wait --for=condition=Ready pod/rwx-reader --timeout=180s; sudo -n k3s kubectl -n rwx-smoke exec rwx-reader -- cat /data/probe.txt; sudo -n k3s kubectl delete namespace rwx-smoke --wait=true >/dev/null"

Write-Host "k3s startup guard and shared-rwx storage class are active."
