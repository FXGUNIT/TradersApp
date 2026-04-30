# TradersApp Production Setup Script
<<<<<<< HEAD
# Run this AFTER completing browser setup in docs/SETUP.md.
# This script configures GitHub Actions secrets/variables for production deploy jobs.
=======
# Run this AFTER completing the browser steps in docs/SETUP.md
# This script sets GitHub Variables and Railway tokens so CI/CD auto-deploys.
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
#
# Prerequisites:
#   - Railway account created + services deployed
#   - Vercel project imported
<<<<<<< HEAD
#   - GitHub CLI installed and authenticated (`gh auth login`)
#
# Usage:
#   .\scripts\setup-production.ps1 -RailwayToken "railway_..." -VercelToken "..." -VercelOrgId "team_..." -VercelProjectId "prj_..."
#   .\scripts\setup-production.ps1 -Repo "FXGUNIT/TradersApp" -RailwayToken "..." -VercelToken "..." -VercelOrgId "..." -VercelProjectId "..." \
#       -RailwayProdEnvId "..." -RailwayProdMlServiceId "..." -RailwayProdBffServiceId "..." -InfisicalToken "..."

param(
    [Parameter(Mandatory = $true)]
    [string]$RailwayToken,

    [Parameter(Mandatory = $true)]
    [string]$VercelToken,

    [Parameter(Mandatory = $true)]
    [string]$VercelOrgId,

    [Parameter(Mandatory = $true)]
    [string]$VercelProjectId,

    [Parameter(Mandatory = $false)]
    [string]$SlackWebhook = "",

    [Parameter(Mandatory = $false)]
    [string]$DiscordWebhook = "",

    [Parameter(Mandatory = $false)]
    [string]$PagerDutyRoutingKey = "",

    [Parameter(Mandatory = $false)]
    [string]$InfisicalToken = "",

    [Parameter(Mandatory = $false)]
    [string]$Repo = "",

    [Parameter(Mandatory = $false)]
    [string]$RailwayProdEnvId = "",

    [Parameter(Mandatory = $false)]
    [string]$RailwayProdMlServiceId = "",

    [Parameter(Mandatory = $false)]
    [string]$RailwayProdBffServiceId = "",

    [Parameter(Mandatory = $false)]
    [string]$RailwayStagingEnvId = "",

    [Parameter(Mandatory = $false)]
    [string]$RailwayStagingMlServiceId = "",

    [Parameter(Mandatory = $false)]
    [string]$RailwayStagingBffServiceId = ""
)

$ErrorActionPreference = "Stop"

function Ensure-Command {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' not found. Install first. $InstallHint"
    }
}

function Resolve-GitHubRepo {
    param(
        [Parameter(Mandatory = $false)]
        [string]$ExplicitRepo = ""
    )

    if ($ExplicitRepo) {
        return $ExplicitRepo
    }

    $originUrl = git config --get remote.origin.url 2>$null
    if (-not $originUrl) {
        throw "Could not detect remote.origin.url. Pass -Repo <owner/name> explicitly."
    }

    if ($originUrl -match 'github\.com[:/](?<owner>[^/]+)/(?<name>[^/.]+)(\.git)?$') {
        return "$($Matches.owner)/$($Matches.name)"
    }

    throw "remote.origin.url is not a parseable GitHub URL: $originUrl. Pass -Repo <owner/name>."
}

Ensure-Command -Name "gh" -InstallHint "Install GitHub CLI: https://cli.github.com/"
$Repo = Resolve-GitHubRepo -ExplicitRepo $Repo

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "TradersApp Production Setup" -ForegroundColor Cyan
Write-Host "Repository: $Repo" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Write-Host "`n[1/8] Checking GitHub CLI authentication..." -ForegroundColor Yellow
$ghStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not authenticated with GitHub. Running: gh auth login" -ForegroundColor Red
=======
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
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
    gh auth login --hostname github.com
} else {
    Write-Host "Already authenticated with GitHub" -ForegroundColor Green
}

<<<<<<< HEAD
Write-Host "`n[2/8] Setting Railway token in GitHub Secrets..." -ForegroundColor Yellow
gh secret set RAILWAY_TOKEN --body $RailwayToken --repo $Repo
Write-Host "RAILWAY_TOKEN set in GitHub Secrets" -ForegroundColor Green

Write-Host "`n[3/8] Setting Railway production IDs in GitHub Variables..." -ForegroundColor Yellow
Write-Host "  Go to Railway Dashboard -> Project Settings and copy:" -ForegroundColor White
Write-Host "  - Environment ID" -ForegroundColor White
Write-Host "  - ML Engine Service ID" -ForegroundColor White
Write-Host "  - BFF Service ID" -ForegroundColor White

$envId = $RailwayProdEnvId
if (-not $envId) {
    $envId = Read-Host "Railway Production Environment ID"
}
$mlSvcId = $RailwayProdMlServiceId
if (-not $mlSvcId) {
    $mlSvcId = Read-Host "Railway ML Engine Service ID"
}
$bffSvcId = $RailwayProdBffServiceId
if (-not $bffSvcId) {
    $bffSvcId = Read-Host "Railway BFF Service ID"
}
=======
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
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

gh variable set RAILWAY_PROD_ENV_ID --body $envId --repo $Repo
gh variable set RAILWAY_PROD_ML_SERVICE_ID --body $mlSvcId --repo $Repo
gh variable set RAILWAY_PROD_BFF_SERVICE_ID --body $bffSvcId --repo $Repo
<<<<<<< HEAD
Write-Host "Railway production variables set" -ForegroundColor Green

Write-Host "`n[4/8] Setting Railway staging IDs in GitHub Variables (optional but recommended)..." -ForegroundColor Yellow
$stagingEnvId = $RailwayStagingEnvId
if (-not $stagingEnvId) {
    $stagingEnvId = Read-Host "Railway Staging Environment ID (optional, press Enter to skip)"
}
$stagingMlSvcId = $RailwayStagingMlServiceId
if (-not $stagingMlSvcId -and $stagingEnvId) {
    $stagingMlSvcId = Read-Host "Railway Staging ML Engine Service ID"
}
$stagingBffSvcId = $RailwayStagingBffServiceId
if (-not $stagingBffSvcId -and $stagingEnvId) {
    $stagingBffSvcId = Read-Host "Railway Staging BFF Service ID"
}
if ($stagingEnvId -and $stagingMlSvcId -and $stagingBffSvcId) {
    gh variable set RAILWAY_STAGING_ENV_ID --body $stagingEnvId --repo $Repo
    gh variable set RAILWAY_STAGING_ML_SERVICE_ID --body $stagingMlSvcId --repo $Repo
    gh variable set RAILWAY_STAGING_BFF_SERVICE_ID --body $stagingBffSvcId --repo $Repo
    Write-Host "Railway staging variables set" -ForegroundColor Green
} else {
    Write-Host "Railway staging variables skipped (incomplete input)." -ForegroundColor DarkYellow
}

Write-Host "`n[5/8] Setting Vercel credentials in GitHub Secrets..." -ForegroundColor Yellow
gh secret set VERCEL_TOKEN --body $VercelToken --repo $Repo
gh secret set VERCEL_ORG_ID --body $VercelOrgId --repo $Repo
gh secret set VERCEL_PROJECT_ID --body $VercelProjectId --repo $Repo
Write-Host "Vercel credentials set" -ForegroundColor Green

Write-Host "`n[6/8] Optional core secret contract setup..." -ForegroundColor Yellow
if ($InfisicalToken) {
    gh secret set INFISICAL_TOKEN --body $InfisicalToken --repo $Repo
    Write-Host "INFISICAL_TOKEN set" -ForegroundColor Green
} else {
    Write-Host "INFISICAL_TOKEN not provided (skipped)" -ForegroundColor DarkYellow
}

if ($PagerDutyRoutingKey) {
    gh secret set PAGERDUTY_ROUTING_KEY --body $PagerDutyRoutingKey --repo $Repo
    Write-Host "PAGERDUTY_ROUTING_KEY set" -ForegroundColor Green
} else {
    Write-Host "PAGERDUTY_ROUTING_KEY not provided (skipped)" -ForegroundColor DarkYellow
}

Write-Host "`n[7/8] Optional webhook setup..." -ForegroundColor Yellow
if ($SlackWebhook) {
    gh secret set SLACK_WEBHOOK_URL --body $SlackWebhook --repo $Repo
    Write-Host "SLACK_WEBHOOK_URL set" -ForegroundColor Green
} else {
    Write-Host "Slack webhook not provided (skipped)" -ForegroundColor DarkYellow
}

if ($DiscordWebhook) {
    gh secret set DISCORD_WEBHOOK_URL --body $DiscordWebhook --repo $Repo
    gh secret set ROLLBACK_WEBHOOK_URL --body $DiscordWebhook --repo $Repo
    Write-Host "DISCORD_WEBHOOK_URL + ROLLBACK_WEBHOOK_URL set" -ForegroundColor Green
} else {
    Write-Host "Discord webhook not provided (skipped)" -ForegroundColor DarkYellow
}

Write-Host "`n[8/8] Verifying configured GitHub Actions contract..." -ForegroundColor Yellow
Write-Host "Secrets (names only):" -ForegroundColor White
gh secret list --repo $Repo
Write-Host ""
Write-Host "Variables:" -ForegroundColor White
gh variable list --repo $Repo

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "SETUP COMPLETE" -ForegroundColor Green
=======
Write-Host "Railway variables set" -ForegroundColor Green

# ── Step 4: Vercel → GitHub Secrets + Variables ───────────────────────────
Write-Host "`n[4/5] Setting Vercel credentials in GitHub..." -ForegroundColor Yellow
gh secret set VERCEL_TOKEN --body $VercelToken --repo $Repo
gh secret set VERCEL_ORG_ID --body $VercelOrgId --repo $Repo
gh secret set VERCEL_PROJECT_ID --body $VercelProjectId --repo $Repo
Write-Host "Vercel variables set (as secrets for CI)" -ForegroundColor Green

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
Write-Host "`n[6/6] Verifying GitHub Variables..." -ForegroundColor Yellow
$vars = gh variable list --repo $Repo
Write-Host $vars

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "SETUP COMPLETE!" -ForegroundColor Green
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Push to main: git push origin main" -ForegroundColor White
Write-Host "  2. Watch: https://github.com/$Repo/actions" -ForegroundColor White
<<<<<<< HEAD
Write-Host "  3. Verify: curl https://api.173.249.18.14.sslip.io/health" -ForegroundColor White
Write-Host "  4. Verify contract: python scripts/stage_p_ci_contract_probe.py --output .artifacts/stage-p/ci-contract-live-latest.json" -ForegroundColor White
=======
Write-Host "  3. Verify: curl https://api.traders.app/health" -ForegroundColor White
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
Write-Host ""
Write-Host "To trigger first deploy manually:" -ForegroundColor White
Write-Host "  gh workflow run ci.yml --field ref=main" -ForegroundColor White
