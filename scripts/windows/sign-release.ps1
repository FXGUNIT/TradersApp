[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths,
    [string]$CertificateBase64 = $env:SIGN_CERTIFICATE_BASE64,
    [string]$CertificatePassword = $env:SIGN_CERTIFICATE_PASSWORD,
    [string]$TimestampUrl = $env:SIGN_TIMESTAMP_URL,
    [switch]$RequireSigning
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($CertificateBase64) -or [string]::IsNullOrWhiteSpace($CertificatePassword)) {
    if ($RequireSigning) {
        throw "Authenticode signing is required, but SIGN_CERTIFICATE_BASE64 or SIGN_CERTIFICATE_PASSWORD is missing."
    }

    Write-Warning "Signing secrets were not provided. Skipping Authenticode signing."
    return
}

if ([string]::IsNullOrWhiteSpace($TimestampUrl)) {
    $TimestampUrl = "http://timestamp.digicert.com"
}

function Resolve-SignToolPath {
    $signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($signtool) {
        return $signtool.Source
    }

    $candidates = Get-ChildItem -Path "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending

    if ($candidates) {
        return $candidates[0].FullName
    }

    throw "signtool.exe was not found on this machine."
}

$signtoolPath = Resolve-SignToolPath
$tempPfxPath = Join-Path $env:RUNNER_TEMP "tradersapp-signing-cert.pfx"
[IO.File]::WriteAllBytes($tempPfxPath, [Convert]::FromBase64String($CertificateBase64))

try {
    foreach ($path in $Paths) {
        $resolvedPath = Resolve-Path -LiteralPath $path
        & $signtoolPath sign `
            /fd SHA256 `
            /td SHA256 `
            /tr $TimestampUrl `
            /f $tempPfxPath `
            /p $CertificatePassword `
            $resolvedPath

        if ($LASTEXITCODE -ne 0) {
            throw "signtool.exe failed while signing $resolvedPath"
        }

        $signature = Get-AuthenticodeSignature -FilePath $resolvedPath
        if ($signature.Status -ne "Valid") {
            throw "Authenticode verification failed for $resolvedPath with status $($signature.Status)"
        }

        Write-Host "Signed $resolvedPath"
    }
}
finally {
    Remove-Item -LiteralPath $tempPfxPath -Force -ErrorAction SilentlyContinue
}
