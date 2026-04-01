# TradersApp Production Setup Script
# Run this AFTER completing the browser steps in docs/SETUP.md
# This script sets GitHub Variables and Railway tokens so CI/CD auto-deploys.
#
# Prerequisites:
#   - Railway account created + services deployed
#   - Vercel project imported
#   - GitHub CLI authenticated: gh auth login
#
# Usage:
#   .\scripts\setup-production.ps1 -RailwayToken "railway_..." -VercelToken "..." -VercelOrgId "team_..." -VercelProjectId "prj_..."

param(
    [Parameter(Mandatory=$true)]
    [string]$RailwayToken,

    [Parameter(Mandatory=$true)]
    [string]$VercelToken,

    [Parameter(Mandatory=$true)]
    [string]$VercelOrgId,

    [Parameter(Mandatory=$true)]
    [string]$VercelProjectId,

    [Parameter(Mandatory=$false)]
    [string]$SlackWebhook = "",

    [Parameter(Mandatory=$false)]
    [string]$DiscordWebhook = ""
)

$ErrorActionPreference = "Stop"
$Repo = "gunitsingh1994/TradersApp"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "TradersApp Production Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# ── Step 1: Check gh auth ─────────────────────────────────────────────────
Write-Host "`n[1/5] Checking GitHub CLI authentication..." -ForegroundColor Yellow
$ghStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "NOT authenticated with GitHub. Running: gh auth login" -ForegroundColor Red
    gh auth login --hostname github.com
} else {
    Write-Host "Already authenticated with GitHub" -ForegroundColor Green
}

# ── Step 2: Railway Token → GitHub Secret ──────────────────────────────────
Write-Host "`n[2/5] Setting Railway token in GitHub Secrets..." -ForegroundColor Yellow
gh secret set RAILWAY_TOKEN --body $RailwayToken --repo $Repo
Write-Host "RAILWAY_TOKEN set in GitHub Secrets" -ForegroundColor Green

# ── Step 3: Railway Service IDs → GitHub Variables ─────────────────────────
Write-Host "`n[3/5] Railway Service IDs (from Railway Dashboard):" -ForegroundColor Yellow
Write-Host "  Go to Railway Dashboard → Project Settings → Copy:" -ForegroundColor White
Write-Host "  - Environment ID (Project Settings)" -ForegroundColor White
Write-Host "  - ML Engine Service ID (ML Engine service)" -ForegroundColor White
Write-Host "  - BFF Service ID (BFF service)" -ForegroundColor White

$envId = Read-Host "Railway Production Environment ID"
$mlSvcId = Read-Host "Railway ML Engine Service ID"
$bffSvcId = Read-Host "Railway BFF Service ID"

gh variable set RAILWAY_PROD_ENV_ID --body $envId --repo $Repo
gh variable set RAILWAY_PROD_ML_SERVICE_ID --body $mlSvcId --repo $Repo
gh variable set RAILWAY_PROD_BFF_SERVICE_ID --body $bffSvcId --repo $Repo
Write-Host "Railway variables set" -ForegroundColor Green

# ── Step 4: Vercel → GitHub Secrets + Variables ───────────────────────────
Write-Host "`n[4/5] Setting Vercel credentials in GitHub..." -ForegroundColor Yellow
gh secret set VERCEL_TOKEN --body $VercelToken --repo $Repo
gh variable set VERCEL_ORG_ID --body $VercelOrgId --repo $Repo
gh variable set VERCEL_PROJECT_ID --body $VercelProjectId --repo $Repo
Write-Host "Vercel variables set" -ForegroundColor Green

# ── Step 5: Alert Webhooks ──────────────────────────────────────────────────
if ($SlackWebhook) {
    Write-Host "`n[5/5] Setting Slack webhook..." -ForegroundColor Yellow
    gh secret set SLACK_WEBHOOK_URL --body $SlackWebhook --repo $Repo
    Write-Host "SLACK_WEBHOOK_URL set" -ForegroundColor Green
}

if ($DiscordWebhook) {
    Write-Host "`n[5/5] Setting Discord webhook..." -ForegroundColor Yellow
    gh secret set DISCORD_WEBHOOK_URL --body $DiscordWebhook --repo $Repo
    gh secret set ROLLBACK_WEBHOOK_URL --body $DiscordWebhook --repo $Repo
    Write-Host "DISCORD_WEBHOOK_URL + ROLLBACK_WEBHOOK_URL set" -ForegroundColor Green
}

# ── Step 6: Verify all ──────────────────────────────────────────────────────
Write-Host "`n[6/5] Verifying GitHub Variables..." -ForegroundColor Yellow
$vars = gh variable list --repo $Repo
Write-Host $vars

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "SETUP COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Push to main: git push origin main" -ForegroundColor White
Write-Host "  2. Watch: https://github.com/$Repo/actions" -ForegroundColor White
Write-Host "  3. Verify: curl https://api.traders.app/health" -ForegroundColor White
Write-Host ""
Write-Host "To trigger first deploy manually:" -ForegroundColor White
Write-Host "  gh workflow run ci.yml --field ref=main" -ForegroundColor White
