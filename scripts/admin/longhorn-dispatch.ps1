param(
  [string]$Distro = "Ubuntu",
  [switch]$KeepNamespace,
  [string[]]$Stages = @("all")
)

$ErrorActionPreference = "Stop"

Write-Host "== Longhorn dispatch on WSL distro '$Distro' =="
Write-Host "   Stages: $($Stages -join ', ')"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$drive = $repoRoot.Substring(0, 1).ToLowerInvariant()
$tail = ($repoRoot.Substring(2) -replace "\\", "/")
$wslRepo = "/mnt/$drive$tail"

$bashArgs = @()
foreach ($stage in $Stages) {
  $bashArgs += $stage
}
if ($KeepNamespace) {
  $bashArgs += "--keep-namespace"
}

$argString = ($bashArgs -join " ")

& wsl.exe -d $Distro -- bash -lc "bash '$wslRepo/scripts/admin/longhorn-dispatch.sh' $argString"

if ($LASTEXITCODE -ne 0) {
  throw "Longhorn dispatch failed with exit code $LASTEXITCODE"
}
