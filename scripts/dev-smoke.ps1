param(
  [int]$TimeoutSec = 5
)

$ErrorActionPreference = "Stop"

$targets = @(
  @{ Name = "Frontend"; Url = "http://localhost/health" },
  @{ Name = "BFF"; Url = "http://localhost:8788/health" },
  @{ Name = "ML Engine"; Url = "http://localhost:8001/health" }
)

$failed = $false

Write-Host "TradersApp dev smoke check" -ForegroundColor Cyan
Write-Host "Timeout per check: $TimeoutSec sec" -ForegroundColor DarkGray
Write-Host ""

foreach ($target in $targets) {
  $name = $target.Name
  $url = $target.Url
  try {
    $resp = Invoke-WebRequest -Uri $url -TimeoutSec $TimeoutSec -UseBasicParsing
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
      Write-Host ("[OK]   {0} {1} ({2})" -f $name, $url, $resp.StatusCode) -ForegroundColor Green
    } else {
      Write-Host ("[FAIL] {0} {1} ({2})" -f $name, $url, $resp.StatusCode) -ForegroundColor Red
      $failed = $true
    }
  } catch {
    Write-Host ("[FAIL] {0} {1} ({2})" -f $name, $url, $_.Exception.Message) -ForegroundColor Red
    $failed = $true
  }
}

if ($failed) {
  Write-Host ""
  Write-Host "One or more checks failed." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "All checks passed." -ForegroundColor Green
exit 0
