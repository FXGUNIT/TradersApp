<#
.SYNOPSIS
  Start TradersApp dev stack — lightweight, 4 GB RAM / CPU-only.
.DESCRIPTION
  Uses docker-compose.dev.yml with tiered profiles:
    -Tier core   -> ML Engine + BFF + Redis + Frontend (~1 GB)
    -Tier mlops  -> + MLflow (SQLite, no MinIO/Postgres) (~1.2 GB)
    -Tier full   -> + Prometheus + Grafana (~1.5 GB)
.EXAMPLE
  .\scripts\dev-up.ps1                  # core only
  .\scripts\dev-up.ps1 -Tier mlops      # core + MLflow
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
$observabilityFile = Join-Path $PSScriptRoot "..\docker-compose.observability.yml"

if (-not (Test-Path $composeFile)) {
  Write-Error "docker-compose.dev.yml not found at $composeFile"
  exit 1
}

$frontendDist = Join-Path $PSScriptRoot "..\dist\index.html"

$baseArgs = @("-f", $composeFile)
$includeObservability = $Tier -eq "full"

# Stop / Reset
if ($Down -or $Reset) {
  $downArgs = $baseArgs + @("--profile", "mlops", "down")
  if ($Reset) { $downArgs += "-v" }
  Write-Host "Stopping dev stack$(if($Reset){' and removing volumes'})..." -ForegroundColor Yellow
  & docker compose @downArgs
  $exitCode = $LASTEXITCODE

  if (Test-Path $observabilityFile) {
    $obsDownArgs = @("-f", $observabilityFile, "down")
    if ($Reset) { $obsDownArgs += "-v" }
    & docker compose @obsDownArgs
    if ($LASTEXITCODE -ne 0 -and $exitCode -eq 0) {
      $exitCode = $LASTEXITCODE
    }
  }

  exit $exitCode
}

# Build profiles list
$profiles = @()
switch ($Tier) {
  "full"  { $profiles = @("--profile", "mlops") }
  "mlops" { $profiles = @("--profile", "mlops") }
  "core"  { $profiles = @() }
}

Write-Host "Building frontend bundle for local nginx container..." -ForegroundColor Yellow
Push-Location (Join-Path $PSScriptRoot "..")
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  if (-not (Test-Path $frontendDist)) {
    Write-Error "Frontend build finished without dist/index.html"
    exit 1
  }
} finally {
  Pop-Location
}

$upArgs = $baseArgs + $profiles + @("up", "-d", "--build")

# RAM estimate
$ramEstimate = switch ($Tier) {
  "core"  { "~1 GB" }
  "mlops" { "~1.2 GB" }
  "full"  { "~1.5 GB" }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TradersApp Dev Stack  -  $Tier tier" -ForegroundColor Cyan
Write-Host "  Estimated RAM: $ramEstimate" -ForegroundColor Cyan
Write-Host "  No k3s. No Longhorn. No GPU required." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

& docker compose @upArgs
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0 -and $includeObservability) {
  if (-not (Test-Path $observabilityFile)) {
    Write-Warning "docker-compose.observability.yml not found at $observabilityFile; skipping observability tier."
  }
  else {
    $obsUpArgs = @("-f", $observabilityFile, "up", "-d", "prometheus", "alertmanager", "grafana", "loki", "promtail", "jaeger")
    & docker compose @obsUpArgs
    $exitCode = $LASTEXITCODE
  }
}

if ($exitCode -eq 0) {
  Write-Host ""
  Write-Host "Dev stack is up." -ForegroundColor Green
  Write-Host ""
  Write-Host "  Frontend:   http://localhost:80" -ForegroundColor White
  Write-Host "  BFF:        http://localhost:8788" -ForegroundColor White
  Write-Host "  ML Engine:  http://localhost:8001" -ForegroundColor White
  Write-Host "  Analysis:   localhost:50051 (gRPC)" -ForegroundColor White
  if ($Tier -in @("mlops", "full")) {
    Write-Host "  MLflow:     http://localhost:5000" -ForegroundColor White
  }
  if ($Tier -eq "full") {
    Write-Host "  Prometheus: http://localhost:9090" -ForegroundColor White
    Write-Host "  Grafana:    http://localhost:3001" -ForegroundColor White
  }
  Write-Host ""
  if ($Tier -eq "full") {
    Write-Host "Logs:  docker compose -f docker-compose.dev.yml logs -f [service]" -ForegroundColor DarkGray
    Write-Host "       docker compose -f docker-compose.observability.yml logs -f [service]" -ForegroundColor DarkGray
  }
  else {
    Write-Host "Logs:  docker compose -f docker-compose.dev.yml logs -f [service]" -ForegroundColor DarkGray
  }
  Write-Host "Stop:  .\scripts\dev-up.ps1 -Down" -ForegroundColor DarkGray
  Write-Host "Reset: .\scripts\dev-up.ps1 -Reset" -ForegroundColor DarkGray
}

exit $exitCode
