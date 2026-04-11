<#
.SYNOPSIS
  Deploy TradersApp to Oracle Cloud Always Free ARM VM.
.DESCRIPTION
  Connects via SSH, pulls latest code, rebuilds, and restarts.
  Run from your local machine after pushing code to GitHub.
.EXAMPLE
  .\scripts\oci\deploy.ps1 -IP 129.151.xxx.xxx
  .\scripts\oci\deploy.ps1 -IP 129.151.xxx.xxx -Build
  .\scripts\oci\deploy.ps1 -IP 129.151.xxx.xxx -Logs ml-engine
  .\scripts\oci\deploy.ps1 -IP 129.151.xxx.xxx -Status
#>
param(
  [Parameter(Mandatory)]
  [string]$IP,
  [string]$User = "tradersapp",
  [string]$KeyFile = "$HOME\.ssh\oci_tradersapp",
  [switch]$Build,
  [switch]$Status,
  [string]$Logs,
  [switch]$Restart,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"
$sshBase = @("ssh", "-i", $KeyFile, "-o", "StrictHostKeyChecking=accept-new", "$User@$IP")
$compose = "docker compose -f docker-compose.oci.yml"

function Invoke-Remote([string]$cmd) {
  $full = $sshBase + @($cmd)
  & $full[0] $full[1..($full.Length - 1)]
  if ($LASTEXITCODE -ne 0) { throw "Remote command failed: $cmd" }
}

# ── Status check ─────────────────────────────────────────────────────
if ($Status) {
  Write-Host "Checking service status..." -ForegroundColor Cyan
  Invoke-Remote "cd TradersApp && $compose ps && echo '---' && free -h && echo '---' && df -h /"
  exit 0
}

# ── View logs ────────────────────────────────────────────────────────
if ($Logs) {
  Write-Host "Tailing logs for: $Logs" -ForegroundColor Cyan
  Invoke-Remote "cd TradersApp && $compose logs -f --tail 100 $Logs"
  exit 0
}

# ── Stop ─────────────────────────────────────────────────────────────
if ($Stop) {
  Write-Host "Stopping stack..." -ForegroundColor Yellow
  Invoke-Remote "cd TradersApp && $compose down"
  exit 0
}

# ── Deploy (pull + rebuild + restart) ────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Deploying TradersApp to OCI ARM VM" -ForegroundColor Cyan
Write-Host "  Target: $User@$IP" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Pull latest code
Write-Host "[1/3] Pulling latest code..." -ForegroundColor White
Invoke-Remote "cd TradersApp && git pull --ff-only"

# Rebuild if requested
if ($Build -or $Restart) {
  Write-Host "[2/3] Rebuilding containers..." -ForegroundColor White
  Invoke-Remote "cd TradersApp && $compose build --pull"
} else {
  Write-Host "[2/3] Skipping rebuild (use -Build to force)" -ForegroundColor DarkGray
}

# Restart stack
Write-Host "[3/3] Restarting stack..." -ForegroundColor White
if ($Build) {
  Invoke-Remote "cd TradersApp && $compose up -d --build"
} else {
  Invoke-Remote "cd TradersApp && $compose up -d"
}

# Quick health check
Write-Host ""
Write-Host "Waiting 30s for health checks..." -ForegroundColor DarkGray
Start-Sleep -Seconds 30
Invoke-Remote "cd TradersApp && $compose ps"

Write-Host ""
Write-Host "Deploy complete." -ForegroundColor Green
Write-Host "  Frontend:  http://${IP}:80" -ForegroundColor White
Write-Host "  BFF:       http://${IP}:8788/health" -ForegroundColor White
Write-Host "  ML Engine: http://${IP}:8001/health" -ForegroundColor White
Write-Host "  MLflow:    http://${IP}:5000" -ForegroundColor White
