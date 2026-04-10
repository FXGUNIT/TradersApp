param(
  [string]$Distro = "Ubuntu",
  [switch]$KeepNamespace,
  [string[]]$Stages = @("all")
)

$ErrorActionPreference = "Stop"

Write-Host "== Longhorn dispatch on WSL distro '$Distro' =="
Write-Host "   Stages: $($Stages -join ', ')"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$repoRootForWsl = ($repoRoot -replace "\\", "/")

$bashArgs = @()
foreach ($stage in $Stages) {
  $bashArgs += $stage
}
if ($KeepNamespace) {
  $bashArgs += "--keep-namespace"
}

$argString = ($bashArgs -join " ")
$inlineScript = @"
set -euo pipefail
REPO="`$(wslpath -a '$repoRootForWsl')"
bash "`$REPO/scripts/admin/longhorn-dispatch.sh" $argString
"@

& wsl.exe -d $Distro -- bash -lc $inlineScript

if ($LASTEXITCODE -ne 0) {
  throw "Longhorn dispatch failed with exit code $LASTEXITCODE"
}
