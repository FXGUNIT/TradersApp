param(
  [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

Write-Host "== Longhorn control-plane reconcile on WSL distro '$Distro' =="

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$drive = $repoRoot.Substring(0, 1).ToLowerInvariant()
$tail = ($repoRoot.Substring(2) -replace "\\", "/")
$wslRepo = "/mnt/$drive$tail"

& wsl.exe -d $Distro -- bash -lc "bash '$wslRepo/scripts/admin/reconcile-longhorn-control-plane.sh'"

if ($LASTEXITCODE -ne 0) {
  throw "Longhorn control-plane reconcile failed with exit code $LASTEXITCODE"
}
