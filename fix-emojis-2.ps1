# PowerShell script to fix corrupted emojis in App.jsx
$file = "src/App.jsx"
$content = Get-Content $file -Raw -Encoding UTF8

# Fix corrupted emojis
$content = $content -replace "👥š¨", "🚨"
$content = $content -replace "âš ï¸ MALICIOUS", "🚨 MALICIOUS"
$content = $content -replace "âšï¸", "⚠️"
$content = $content -replace "👥›¡ï¸", "✅"
$content = $content -replace "👥"", "✅"
$content = $content -replace "âš ", "⚠️"
$content = $content -replace "ï¸", ""

# Write back with UTF8 BOM
[System.IO.File]::WriteAllText((Join-Path $PWD $file), $content, [System.Text.UTF8Encoding]::new($true))

Write-Host "Fixed corrupted emojis in $file"
