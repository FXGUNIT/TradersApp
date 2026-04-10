param(
  [string]$Distro = "Ubuntu",
  [switch]$KeepNamespace
)

$ErrorActionPreference = "Stop"

Write-Host "== Longhorn Stage A validation on WSL distro '$Distro' =="

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$drive = $repoRoot.Substring(0, 1).ToLowerInvariant()
$tail = ($repoRoot.Substring(2) -replace "\\", "/")
$wslRepo = "/mnt/$drive$tail"
$keepArg = if ($KeepNamespace) { " --keep-namespace" } else { "" }

& wsl.exe -d $Distro -- bash -lc "bash '$wslRepo/scripts/admin/validate-longhorn-stage-a.sh'$keepArg"

if ($LASTEXITCODE -ne 0) {
  throw "Longhorn Stage A validation failed with exit code $LASTEXITCODE"
}
