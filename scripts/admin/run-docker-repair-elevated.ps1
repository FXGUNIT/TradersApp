Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "repair-docker-desktop.ps1"

if (-not (Test-Path $scriptPath)) {
  throw "Repair script not found: $scriptPath"
}

Write-Host "[docker-repair] Launching elevated repair. Approve the UAC prompt."
Start-Process powershell.exe -Verb RunAs -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$scriptPath`""
)
