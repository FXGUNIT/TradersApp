$ErrorActionPreference = "Stop"
$Infisical = "C:\Users\Asus\AppData\Roaming\npm\node_modules\@infisical\cli\bin\infisical.exe"
$Env = "dev"
$ProjectId = "0e4f9b8b-846e-4e66-a4aa-97c8fa9863ab"
$count = 0

$requiredKeys = @(
    "BFF_TELEGRAM_BOT_TOKEN",
    "BFF_TELEGRAM_CHAT_ID",
    "FINNHUB_API_KEY",
    "NEWS_API_KEY"
)

$secrets = @{}
foreach ($key in $requiredKeys) {
    $value = [Environment]::GetEnvironmentVariable($key)
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "Missing required environment variable: $key" -ForegroundColor Red
        exit 1
    }
    $secrets[$key] = $value
}

foreach ($entry in $secrets.GetEnumerator()) {
    Write-Host "[$($count + 1)/$($secrets.Count)] $($entry.Key)..." -NoNewline
    & $Infisical secrets set "$($entry.Key)=$($entry.Value)" --env $Env --projectId $ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
    $count++
}

Write-Host ""
Write-Host "Done! Set $($secrets.Count) secrets in Infisical dev env." -ForegroundColor Cyan
