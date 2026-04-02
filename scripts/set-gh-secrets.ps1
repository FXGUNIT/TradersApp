$ErrorActionPreference = "Stop"
$Gh = "$env:TEMP\gh\bin\gh.exe"
$Repo = "FXGUNIT/TRADERS-REGIMENT"
# IMPORTANT: These scripts set secrets to GITHUB SECRETS (not Infisical).
# For Infisical, use: infisical secrets set KEY=VALUE --project=TRADERS-REGIMENT
# This file contains PLACEHOLDERS only. Replace values before running.
$secrets = @{
    "VITE_FIREBASE_API_KEY" = "YOUR_FIREBASE_KEY"
    "VITE_FIREBASE_AUTH_DOMAIN" = "YOUR_FIREBASE_AUTH_DOMAIN"
    "VITE_FIREBASE_PROJECT_ID" = "YOUR_PROJECT_ID"
    "VITE_FIREBASE_STORAGE_BUCKET" = "YOUR_STORAGE_BUCKET"
    "VITE_FIREBASE_MESSAGING_SENDER_ID" = "YOUR_SENDER_ID"
    "VITE_FIREBASE_APP_ID" = "YOUR_APP_ID"
    "VITE_FIREBASE_DATABASE_URL" = "YOUR_DATABASE_URL"
    "BFF_ADMIN_PASS_HASH" = "YOUR_BFF_PASS_HASH"
    "MASTER_SALT" = "YOUR_MASTER_SALT"
    "AI_GEMINI_PRO_KEY" = "YOUR_GEMINI_KEY"
    "AI_GROQ_TURBO_KEY" = "YOUR_GROQ_KEY"
    "AI_OPENROUTER_MIND_ALPHA" = "YOUR_OPENROUTER_KEY"
    "AI_OPENROUTER_MIND_BETA" = "YOUR_OPENROUTER_KEY_BETA"
    "AI_CEREBRAS_KEY" = "YOUR_CEREBRAS_KEY"
    "AI_DEEPSEEK_KEY" = "YOUR_DEEPSEEK_KEY"
    "AI_SAMBANOVA_KEY" = "YOUR_SAMBANOVA_KEY"
    "FINNHUB_API_KEY" = "YOUR_FINNHUB_KEY"
    "NEWS_API_KEY" = "YOUR_NEWS_API_KEY"
    "INFISICAL_TOKEN" = "YOUR_INFISICAL_TOKEN"
}

$count = 0
foreach ($entry in $secrets.GetEnumerator()) {
    Write-Host "[$($count+1)/$($secrets.Count)] $($entry.Key)..." -NoNewline
    & $Gh secret set $entry.Key --body $entry.Value --repo $Repo 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
    $count++
}

Write-Host ""
Write-Host "Done! Set $($secrets.Count) secrets." -ForegroundColor Cyan
Write-Host "NOTE: For production, use Infisical instead of GitHub Secrets." -ForegroundColor Yellow
