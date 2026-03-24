$content = [System.IO.File]::ReadAllText("$PSScriptRoot\src\App.jsx", [System.Text.Encoding]::UTF8)
$content = $content -replace 'dYOT', 'N'
$content = $content -replace 'dYS"', 'AMD"'
$content = $content -replace 'dY"', ''
$content = $content -replace 'dYO', ''
$content = $content -replace 'dY>', ''
$content = $content -replace 'dY`', ''
$content = $content -replace '~?,?', ''
$content = $content -replace 's~,', ''
$content = $content -replace '~~,?', ''
$content = $content -replace 'O~', ''
$content = $content -replace 's"', ''
$content = $content -replace 'sZ', ''
$content = $content -replace 'O"', ''
$content = $content -replace '~~,?', 'N'
$content | Out-File "$PSScriptRoot\src\App.jsx" -Encoding UTF8
Write-Host "Fixed encoding issues"
