<#
.SYNOPSIS
  Start TradersApp dev stack without k3s/Longhorn.
.DESCRIPTION
  Uses docker-compose.dev.yml with tiered profiles:
    -Tier core    → ML Engine + BFF + Redis + Frontend (~2 GB)
    -Tier mlops   → + MLflow + Postgres + MinIO (~3 GB)
    -Tier full    → + Prometheus + Grafana (~3.5 GB)
.EXAMPLE
  .\scripts\dev-up.ps1                  # core only
  .\scripts\dev-up.ps1 -Tier mlops      # core + MLflow stack
  .\scripts\dev-up.ps1 -Tier full       # everything
  .\scripts\dev-up.ps1 -Down            # stop all
  .\scripts\dev-up.ps1 -Reset           # stop + delete volumes
#>
param(
  [ValidateSet("core", "mlops", "full")]
  [string]$Tier = "core",
  [switch]$Down,
  [switch]$Reset,
  [switch]$Build
)

$ErrorActionPreference = "Stop"
$composeFile = Join-Path $PSScriptRoot "..\docker-compose.dev.yml"

if (-not (Test-Path $composeFile)) {
  Write-Error "docker-compose.dev.yml not found at $composeFile"
  exit 1
}

$baseArgs = @("-f", $composeFile)

# ── Stop / Reset ─────────────────────────────────────────────────────────
if ($Down -or $Reset) {
  $downArgs = $baseArgs + @("--profile", "mlops", "--profile", "observability", "down")
  if ($Reset) { $downArgs += "-v" }
  Write-Host "Stopping dev stack$(if($Reset){' and removing volumes'})..." -ForegroundColor Yellow
  & docker compose @downArgs
  exit $LASTEXITCODE
}

# ── Build profiles list ─────────────────────────────────────────────────
$profiles = @()
switch ($Tier) {
  "full"  { $profiles = @("--profile", "mlops", "--profile", "observability") }
  "mlops" { $profiles = @("--profile", "mlops") }
  "core"  { $profiles = @() }
}

$upArgs = $baseArgs + $profiles + @("up", "-d")
if ($Build) { $upArgs += "--build" }

# ── RAM estimate ─────────────────────────────────────────────────────────
$ramEstimate = switch ($Tier) {
  "core"  { "~2 GB" }
  "mlops" { "~3 GB" }
  "full"  { "~3.5 GB" }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TradersApp Dev Stack — $Tier tier" -ForegroundColor Cyan
Write-Host "  Estimated RAM: $ramEstimate" -ForegroundColor Cyan
Write-Host "  No k3s. No Longhorn. No restart headaches." -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

& docker compose @upArgs

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "Dev stack is up." -ForegroundColor Green
  Write-Host ""
  Write-Host "  Frontend:   http://localhost:80" -ForegroundColor White
  Write-Host "  BFF:        http://localhost:8788" -ForegroundColor White
  Write-Host "  ML Engine:  http://localhost:8001" -ForegroundColor White
  Write-Host "  Analysis:   localhost:50051 (gRPC)" -ForegroundColor White
  if ($Tier -in @("mlops", "full")) {
    Write-Host "  MLflow:     http://localhost:5000" -ForegroundColor White
    Write-Host "  MinIO:      http://localhost:9001" -ForegroundColor White
  }
  if ($Tier -eq "full") {
    Write-Host "  Prometheus: http://localhost:9090" -ForegroundColor White
    Write-Host "  Grafana:    http://localhost:3001" -ForegroundColor White
  }
  Write-Host ""
  Write-Host "Logs:  docker compose -f docker-compose.dev.yml logs -f [service]" -ForegroundColor DarkGray
  Write-Host "Stop:  .\scripts\dev-up.ps1 -Down" -ForegroundColor DarkGray
  Write-Host "Reset: .\scripts\dev-up.ps1 -Reset" -ForegroundColor DarkGray
}
