$lines = Get-Content "$PSScriptRoot\src\App.jsx"
$corruptedPatterns = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match 'dY[OT">`~]' -or $line -match '[~][^a-zA-Z0-9]' -or $line -match 's[,?]' -or $line -match '[,?]s') {
        $corruptedPatterns += "Line $($i+1): $($line.Substring(0, [Math]::Min(100, $line.Length)))"
    }
}
Write-Host "Found $($corruptedPatterns.Count) corrupted lines"
$corruptedPatterns | Select-Object -First 20
