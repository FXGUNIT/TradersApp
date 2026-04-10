param(
  [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$drive = $repoRoot.Substring(0, 1).ToLowerInvariant()
$tail = ($repoRoot.Substring(2) -replace "\\", "/")
$wslRepo = "/mnt/$drive$tail"

& wsl.exe -d $Distro -- bash -lc "bash '$wslRepo/scripts/admin/apply-k3s-wsl-rwx-fix.sh'"

if ($LASTEXITCODE -ne 0) {
  throw "k3s WSL RWX fix failed with exit code $LASTEXITCODE"
}

Write-Host "k3s startup guard and shared-rwx storage class are active."
