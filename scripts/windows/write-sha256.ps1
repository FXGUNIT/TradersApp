[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths
)

$ErrorActionPreference = "Stop"

foreach ($path in $Paths) {
    $resolvedPath = Resolve-Path -LiteralPath $path
    $hash = Get-FileHash -LiteralPath $resolvedPath -Algorithm SHA256
    $sidecarPath = "$resolvedPath.sha256"
    $content = "{0}  {1}" -f $hash.Hash.ToUpperInvariant(), (Split-Path -Leaf $resolvedPath)
    Set-Content -LiteralPath $sidecarPath -Value $content -NoNewline
    Write-Host "Wrote SHA-256 sidecar $sidecarPath"
}
