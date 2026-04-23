[CmdletBinding()]
param(
    [string]$DesktopExePath = "",
    [string]$DesktopWebDir = "",
    [string]$OutputDirectory = "",
    [double]$MaxColdStartSeconds = 8,
    [double]$MaxIdleRamMb = 500,
    [int]$LaunchTimeoutSeconds = 30,
    [int]$IdleSettleSeconds = 20,
    [string]$ReferenceMachineLabel = "",
    [ValidateSet("not-run", "pass", "fail")]
    [string]$VisibleLoginStatus = "not-run",
    [string]$VisibleLoginNotes = "",
    [ValidateSet("not-run", "pass", "fail")]
    [string]$DegradedNetworkStatus = "not-run",
    [string]$DegradedNetworkNotes = "",
    [ValidateSet("not-run", "pass", "fail")]
    [string]$ForcedLogoutStatus = "not-run",
    [string]$ForcedLogoutNotes = "",
    [ValidateSet("not-run", "pass", "fail")]
    [string]$SignedReleaseStatus = "not-run",
    [string]$SignedReleaseNotes = "",
    [switch]$SkipRuntimeProbe,
    [switch]$KeepAppOpen
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if ([string]::IsNullOrWhiteSpace($DesktopExePath)) {
    $DesktopExePath = Join-Path $repoRoot "desktop/windows/TradersApp.Desktop/bin/Release/net8.0-windows/TradersApp.Desktop.exe"
}

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $repoRoot ".artifacts/windows/p23"
}

function Resolve-ExistingPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    return (Resolve-Path -LiteralPath $Path).Path
}

function Resolve-DesktopWebBundle {
    param(
        [string]$ExplicitPath,
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [string]$ReleaseRoot
    )

    if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
        return [PSCustomObject]@{
            resolvedPath = Resolve-ExistingPath -Path $ExplicitPath
            source = "explicit"
        }
    }

    $candidateDefinitions = @()
    if (-not [string]::IsNullOrWhiteSpace($ReleaseRoot)) {
        $candidateDefinitions += [PSCustomObject]@{
            path = Join-Path $ReleaseRoot "webapp"
            source = "release-webapp"
        }
    }

    $candidateDefinitions += [PSCustomObject]@{
        path = Join-Path $RepoRoot "dist/desktop-web"
        source = "dist-desktop-web"
    }
    $candidateDefinitions += [PSCustomObject]@{
        path = Join-Path $RepoRoot "desktop/windows/TradersApp.Desktop/webapp"
        source = "repo-webapp"
    }

    foreach ($candidate in $candidateDefinitions) {
        $resolvedPath = Resolve-ExistingPath -Path $candidate.path
        if ($resolvedPath) {
            return [PSCustomObject]@{
                resolvedPath = $resolvedPath
                source = $candidate.source
            }
        }
    }

    return [PSCustomObject]@{
        resolvedPath = $null
        source = "not-found"
    }
}

function Get-RecursiveChildProcesses {
    param([Parameter(Mandatory = $true)][int]$ParentProcessId)

    $queue = [System.Collections.Generic.Queue[int]]::new()
    $queue.Enqueue($ParentProcessId)
    $results = [System.Collections.Generic.List[object]]::new()

    while ($queue.Count -gt 0) {
        $currentParentId = $queue.Dequeue()
        $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $currentParentId" -ErrorAction SilentlyContinue)

        foreach ($child in $children) {
            $results.Add([PSCustomObject]@{
                processId = [int]$child.ProcessId
                parentProcessId = [int]$child.ParentProcessId
                name = $child.Name
                executablePath = $child.ExecutablePath
                commandLine = $child.CommandLine
            })

            $queue.Enqueue([int]$child.ProcessId)
        }
    }

    return @($results)
}

function Get-FileNameMatches {
    param(
        [Parameter(Mandatory = $true)][string]$RootPath,
        [Parameter(Mandatory = $true)][string[]]$Patterns
    )

    if (-not (Test-Path -LiteralPath $RootPath)) {
        return @()
    }

    $matches = [System.Collections.Generic.List[string]]::new()
    $files = Get-ChildItem -LiteralPath $RootPath -File -Recurse -ErrorAction SilentlyContinue

    foreach ($file in $files) {
        foreach ($pattern in $Patterns) {
            if ($file.Name -like $pattern) {
                $matches.Add($file.FullName)
                break
            }
        }
    }

    return @($matches | Sort-Object -Unique)
}

function Get-SourceAudit {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][hashtable]$Checks
    )

    $sourceText = if (Test-Path -LiteralPath $Path) {
        Get-Content -LiteralPath $Path -Raw
    } else {
        ""
    }

    $results = [ordered]@{
        path = $Path
        exists = [bool](Test-Path -LiteralPath $Path)
        checks = [ordered]@{}
    }

    foreach ($checkName in $Checks.Keys) {
        $pattern = $Checks[$checkName]
        $results.checks[$checkName] = [bool]($sourceText -match $pattern)
    }

    return $results
}

function Get-StatusLabel {
    param([bool]$Value)

    if ($Value) {
        return "PASS"
    }

    return "FAIL"
}

function Get-DisplayValue {
    param(
        $Value,
        [string]$Fallback = "n/a"
    )

    if ($null -eq $Value) {
        return $Fallback
    }

    if ($Value -is [string] -and [string]::IsNullOrWhiteSpace($Value)) {
        return $Fallback
    }

    return [string]$Value
}

function Get-OcrAudit {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$DesktopWebPath
    )

    $sourcePath = Join-Path $RepoRoot "src/features/terminal/terminalOcrService.js"
    $sourceText = if (Test-Path -LiteralPath $sourcePath) {
        Get-Content -LiteralPath $sourcePath -Raw
    } else {
        ""
    }

    $ocrChunkPaths = if (Test-Path -LiteralPath (Join-Path $DesktopWebPath "assets")) {
        @(Get-ChildItem -LiteralPath (Join-Path $DesktopWebPath "assets") -Filter "ocr-*.js" -File -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty FullName)
    } else {
        @()
    }

    $dynamicImportFound = $sourceText -match 'await import\("tesseract\.js"\)'
    $lazyLoaded = $dynamicImportFound -and $ocrChunkPaths.Count -gt 0

    return [PSCustomObject]@{
        sourcePath = $sourcePath
        dynamicImportFound = $dynamicImportFound
        ocrChunkPaths = @($ocrChunkPaths)
        lazyLoaded = $lazyLoaded
    }
}

function Wait-ForMainWindow {
    param(
        [Parameter(Mandatory = $true)][System.Diagnostics.Process]$Process,
        [Parameter(Mandatory = $true)][datetime]$StartedAt,
        [Parameter(Mandatory = $true)][int]$TimeoutSeconds
    )

    try {
        $null = $Process.WaitForInputIdle([Math]::Min($TimeoutSeconds * 1000, 10000))
    }
    catch {
        # Some release shells do not expose an input-idle state immediately.
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $Process.Refresh()
        if ($Process.HasExited) {
            return $null
        }

        if ($Process.MainWindowHandle -ne 0) {
            return [Math]::Round(((Get-Date) - $StartedAt).TotalSeconds, 2)
        }

        Start-Sleep -Milliseconds 250
    }

    return $null
}

$resolvedDesktopExePath = Resolve-ExistingPath -Path $DesktopExePath

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$resolvedOutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$artifactBaseName = "desktop-p23-certification-$timestamp"
$jsonPath = Join-Path $resolvedOutputDirectory "$artifactBaseName.json"
$markdownPath = Join-Path $resolvedOutputDirectory "$artifactBaseName.md"

$releaseRoot = if ($resolvedDesktopExePath) {
    Split-Path -Parent $resolvedDesktopExePath
} else {
    $null
}

$desktopWebBundle = Resolve-DesktopWebBundle -ExplicitPath $DesktopWebDir -RepoRoot $repoRoot -ReleaseRoot $releaseRoot
$resolvedDesktopWebDir = $desktopWebBundle.resolvedPath

$gpuFilePatterns = @(
    "*cuda*",
    "*cudnn*",
    "*directml*",
    "*onnxruntime_providers_cuda*",
    "*nvinfer*",
    "*tensorrt*",
    "*torch_cuda*"
)

$sidecarFilePatterns = @(
    "node.exe",
    "python.exe",
    "pythonw.exe",
    "uvicorn*.exe",
    "gunicorn*.exe",
    "redis-server*.exe",
    "bff*",
    "ml-engine*",
    "analysis-service*"
)

$forbiddenProcessNames = @(
    "node",
    "python",
    "pythonw",
    "uvicorn",
    "gunicorn",
    "redis-server",
    "bff",
    "ml-engine",
    "analysis-service"
)

$ocrAuditDesktopWebPath = if ($resolvedDesktopWebDir) { $resolvedDesktopWebDir } else { $DesktopWebDir }
$ocrAudit = Get-OcrAudit -RepoRoot $repoRoot -DesktopWebPath $ocrAuditDesktopWebPath
$gpuPayloadMatches = if ($releaseRoot) { Get-FileNameMatches -RootPath $releaseRoot -Patterns $gpuFilePatterns } else { @() }
$sidecarPayloadMatches = if ($releaseRoot) { Get-FileNameMatches -RootPath $releaseRoot -Patterns $sidecarFilePatterns } else { @() }
$connectionStatusAudit = Get-SourceAudit -Path (Join-Path $repoRoot "src/features/shell/useConnectionStatusEffect.js") -Checks @{
    onlineEventListener = 'window\.addEventListener\("online"'
    offlineEventListener = 'window\.addEventListener\("offline"'
    reconnectToast = 'Network bridge restored\. Data synchronization in progress'
    offlineToast = 'Network link severed\. Verify connection strength and retry'
    reconnectEvent = 'CustomEvent\("connectionRestored"'
    disconnectEvent = 'CustomEvent\("connectionLost"'
}
$desktopPolicyAudit = Get-SourceAudit -Path (Join-Path $repoRoot "src/features/shell/useDesktopClientPolicy.js") -Checks @{
    policyPolling = 'DESKTOP_POLICY_POLL_MS'
    maintenanceMode = 'maintenanceActive'
    forceLogout = 'forceLogout'
    notifyDesktopPolicy = 'notifyDesktopPolicy'
    minimumVersionEnforcement = 'MINIMUM_DESKTOP_VERSION_REQUIRED'
    handleLogout = 'handleLogout'
}
$connectionStatusReady = $connectionStatusAudit.exists -and -not ($connectionStatusAudit.checks.Values -contains $false)
$desktopPolicyReady = $desktopPolicyAudit.exists -and -not ($desktopPolicyAudit.checks.Values -contains $false)

$staticAudit = [ordered]@{
    desktopExeFound = [bool]$resolvedDesktopExePath
    desktopExePath = $resolvedDesktopExePath
    desktopWebDirFound = [bool]$resolvedDesktopWebDir
    desktopWebDir = $resolvedDesktopWebDir
    desktopWebDirSource = $desktopWebBundle.source
    releaseRoot = $releaseRoot
    ocrDynamicImportFound = $ocrAudit.dynamicImportFound
    ocrChunkPaths = @($ocrAudit.ocrChunkPaths)
    ocrLazyLoaded = $ocrAudit.lazyLoaded
    gpuPayloadMatches = @($gpuPayloadMatches)
    gpuFreePayload = $gpuPayloadMatches.Count -eq 0
    sidecarPayloadMatches = @($sidecarPayloadMatches)
    sidecarPayloadAbsent = $sidecarPayloadMatches.Count -eq 0
    connectionStatusAudit = $connectionStatusAudit
    connectionStatusReady = $connectionStatusReady
    desktopPolicyAudit = $desktopPolicyAudit
    desktopPolicyReady = $desktopPolicyReady
}

$runtimeAudit = [ordered]@{
    executed = $false
    shellWindowReadySeconds = $null
    shellWindowReadyWithinBudget = $null
    idleSettleSeconds = $IdleSettleSeconds
    workingSetMb = $null
    privateMemoryMb = $null
    childProcesses = @()
    forbiddenProcessMatches = @()
    noSidecarProcesses = $null
    status = "not-run"
    notes = @()
}

$overallChecks = [ordered]@{
    staticAuditPass = (
        $staticAudit.desktopExeFound -and
        $staticAudit.desktopWebDirFound -and
        $staticAudit.ocrLazyLoaded -and
        $staticAudit.gpuFreePayload -and
        $staticAudit.sidecarPayloadAbsent -and
        $staticAudit.connectionStatusReady -and
        $staticAudit.desktopPolicyReady
    )
    runtimeAuditPass = $null
}

$manualValidation = [ordered]@{
    referenceMachineLabel = (Get-DisplayValue -Value $ReferenceMachineLabel -Fallback "unspecified")
    visibleLogin = [ordered]@{
        status = $VisibleLoginStatus
        notes = $VisibleLoginNotes
    }
    degradedNetwork = [ordered]@{
        status = $DegradedNetworkStatus
        notes = $DegradedNetworkNotes
    }
    forcedLogout = [ordered]@{
        status = $ForcedLogoutStatus
        notes = $ForcedLogoutNotes
    }
    signedReleasePayload = [ordered]@{
        status = $SignedReleaseStatus
        notes = $SignedReleaseNotes
    }
}

$process = $null

if (-not $SkipRuntimeProbe) {
    if (-not $resolvedDesktopExePath) {
        throw "Desktop executable not found at '$DesktopExePath'. Build the Windows desktop shell or pass -DesktopExePath explicitly."
    }

    $runtimeAudit.executed = $true
    $runtimeAudit.status = "running"
    $startedAt = Get-Date

    try {
        $process = Start-Process -FilePath $resolvedDesktopExePath -PassThru
        $readySeconds = Wait-ForMainWindow -Process $process -StartedAt $startedAt -TimeoutSeconds $LaunchTimeoutSeconds

        if ($null -eq $readySeconds) {
            $runtimeAudit.status = "failed"
            $runtimeAudit.notes += "Main window did not become ready within $LaunchTimeoutSeconds seconds."
            throw "Desktop shell did not expose a main window within the timeout."
        }

        $runtimeAudit.shellWindowReadySeconds = $readySeconds
        $runtimeAudit.shellWindowReadyWithinBudget = $readySeconds -le $MaxColdStartSeconds

        Start-Sleep -Seconds $IdleSettleSeconds

        $process.Refresh()
        if ($process.HasExited) {
            $runtimeAudit.status = "failed"
            $runtimeAudit.notes += "Desktop shell exited before idle memory sampling."
            throw "Desktop shell exited before idle memory sampling completed."
        }

        $runtimeAudit.workingSetMb = [Math]::Round($process.WorkingSet64 / 1MB, 1)
        $runtimeAudit.privateMemoryMb = [Math]::Round($process.PrivateMemorySize64 / 1MB, 1)

        $childProcesses = Get-RecursiveChildProcesses -ParentProcessId $process.Id
        $runtimeAudit.childProcesses = @($childProcesses)
        $runtimeAudit.forbiddenProcessMatches = @(
            $childProcesses |
                Where-Object { $forbiddenProcessNames -contains ([IO.Path]::GetFileNameWithoutExtension($_.name).ToLowerInvariant()) } |
                Select-Object -ExpandProperty name -Unique
        )
        $runtimeAudit.noSidecarProcesses = $runtimeAudit.forbiddenProcessMatches.Count -eq 0
        $runtimeAudit.status = "completed"
    }
    finally {
        if ($process -and -not $KeepAppOpen) {
            try {
                $process.Refresh()
                if (-not $process.HasExited) {
                    $closed = $process.CloseMainWindow()
                    if ($closed) {
                        if (-not $process.WaitForExit(10000)) {
                            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                        }
                    }
                    else {
                        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                    }
                }
            }
            catch {
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }

    $overallChecks.runtimeAuditPass = (
        $runtimeAudit.shellWindowReadyWithinBudget -eq $true -and
        $runtimeAudit.workingSetMb -le $MaxIdleRamMb -and
        $runtimeAudit.noSidecarProcesses -eq $true
    )
}
else {
    $runtimeAudit.notes += "Runtime probe skipped by request."
}

$manualGatesRemaining = @(
    "Confirm the visible login screen reaches the operator-ready state on both Windows 10 x64 and Windows 11 x64 4 GB reference machines.",
    "Run the degraded-network and reconnect flow against the live backend and capture the expected offline and reconnect behavior.",
    "Trigger forced logout from the admin path or minimum-version policy and confirm the desktop route collapses back to login on the reference machines.",
    "Repeat the certification after packaging the final signed release payload, not only the local build output."
)

$report = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    repoRoot = $repoRoot
    thresholds = [ordered]@{
        maxColdStartSeconds = $MaxColdStartSeconds
        maxIdleRamMb = $MaxIdleRamMb
        launchTimeoutSeconds = $LaunchTimeoutSeconds
        idleSettleSeconds = $IdleSettleSeconds
    }
    staticAudit = $staticAudit
    runtimeAudit = $runtimeAudit
    overallChecks = $overallChecks
    manualValidation = $manualValidation
    manualGatesRemaining = $manualGatesRemaining
}

$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath

$displayDesktopExePath = Get-DisplayValue -Value $staticAudit.desktopExePath -Fallback "not found"
$displayDesktopWebDir = Get-DisplayValue -Value $staticAudit.desktopWebDir -Fallback "not found"
$displayShellReadySeconds = Get-DisplayValue -Value $runtimeAudit.shellWindowReadySeconds
$displayWorkingSetMb = Get-DisplayValue -Value $runtimeAudit.workingSetMb
$displayPrivateMemoryMb = Get-DisplayValue -Value $runtimeAudit.privateMemoryMb
$displayShellReadyBudget = if ($null -eq $runtimeAudit.shellWindowReadyWithinBudget) {
    "n/a"
}
else {
    Get-StatusLabel $runtimeAudit.shellWindowReadyWithinBudget
}
$displayIdleRamBudget = if ($null -eq $runtimeAudit.workingSetMb) {
    "n/a"
}
else {
    Get-StatusLabel ($runtimeAudit.workingSetMb -le $MaxIdleRamMb)
}
$displayNoSidecars = if ($null -eq $runtimeAudit.noSidecarProcesses) {
    "n/a"
}
else {
    Get-StatusLabel $runtimeAudit.noSidecarProcesses
}

$markdownLines = @(
    "# P23 Desktop Certification Evidence",
    "",
    ('- Generated: `' + $report.generatedAt + '`'),
    ('- Reference machine: `' + $manualValidation.referenceMachineLabel + '`'),
    ('- Desktop EXE: `' + $displayDesktopExePath + '`'),
    ('- Desktop web bundle: `' + $displayDesktopWebDir + '`'),
    ('- Desktop web bundle source: `' + (Get-DisplayValue -Value $staticAudit.desktopWebDirSource) + '`'),
    ('- JSON artifact: `' + $jsonPath + '`'),
    "",
    "## Static Audit",
    "",
    "- Desktop executable present: **$(Get-StatusLabel $staticAudit.desktopExeFound)**",
    "- Desktop web bundle present: **$(Get-StatusLabel $staticAudit.desktopWebDirFound)**",
    "- OCR remains lazy-loaded: **$(Get-StatusLabel $staticAudit.ocrLazyLoaded)**",
    "- GPU-specific payload absent: **$(Get-StatusLabel $staticAudit.gpuFreePayload)**",
    "- Local sidecar payload absent: **$(Get-StatusLabel $staticAudit.sidecarPayloadAbsent)**",
    "- Degraded-network hook path present: **$(Get-StatusLabel $staticAudit.connectionStatusReady)**",
    "- Forced-logout / policy hook path present: **$(Get-StatusLabel $staticAudit.desktopPolicyReady)**",
    ""
)

if ($staticAudit.ocrChunkPaths.Count -gt 0) {
    $markdownLines += "OCR chunk(s):"
    foreach ($chunkPath in $staticAudit.ocrChunkPaths) {
        $markdownLines += ('- `' + $chunkPath + '`')
    }
    $markdownLines += ""
}

if ($staticAudit.gpuPayloadMatches.Count -gt 0) {
    $markdownLines += "GPU payload matches:"
    foreach ($path in $staticAudit.gpuPayloadMatches) {
        $markdownLines += ('- `' + $path + '`')
    }
    $markdownLines += ""
}

if ($staticAudit.sidecarPayloadMatches.Count -gt 0) {
    $markdownLines += "Sidecar payload matches:"
    foreach ($path in $staticAudit.sidecarPayloadMatches) {
        $markdownLines += ('- `' + $path + '`')
    }
    $markdownLines += ""
}

$markdownLines += "Connection-status source checks:"
foreach ($checkName in $staticAudit.connectionStatusAudit.checks.Keys) {
    $markdownLines += ('- `' + $checkName + '` — **' + (Get-StatusLabel $staticAudit.connectionStatusAudit.checks[$checkName]) + '**')
}
$markdownLines += ""

$markdownLines += "Desktop-policy source checks:"
foreach ($checkName in $staticAudit.desktopPolicyAudit.checks.Keys) {
    $markdownLines += ('- `' + $checkName + '` — **' + (Get-StatusLabel $staticAudit.desktopPolicyAudit.checks[$checkName]) + '**')
}
$markdownLines += ""

$markdownLines += @(
    "## Runtime Audit",
    "",
    "- Executed: **$($runtimeAudit.executed)**",
    "- Shell window ready seconds: **$displayShellReadySeconds**",
    ('- Shell-ready budget (`<= ' + $MaxColdStartSeconds + ' s`): **' + $displayShellReadyBudget + '**'),
    "- Idle working set MB: **$displayWorkingSetMb**",
    "- Idle private memory MB: **$displayPrivateMemoryMb**",
    ('- Idle RAM budget (`<= ' + $MaxIdleRamMb + ' MB` working set): **' + $displayIdleRamBudget + '**'),
    "- No local sidecar processes launched: **$displayNoSidecars**",
    ""
)

if ($runtimeAudit.forbiddenProcessMatches.Count -gt 0) {
    $markdownLines += "Forbidden child process matches:"
    foreach ($name in $runtimeAudit.forbiddenProcessMatches) {
        $markdownLines += ('- `' + $name + '`')
    }
    $markdownLines += ""
}

if ($runtimeAudit.notes.Count -gt 0) {
    $markdownLines += "Runtime notes:"
    foreach ($note in $runtimeAudit.notes) {
        $markdownLines += "- $note"
    }
    $markdownLines += ""
}

$markdownLines += @(
    "## Manual Gates Remaining",
    ""
)

foreach ($manualGate in $manualGatesRemaining) {
    $markdownLines += "- $manualGate"
}

$markdownLines += @(
    "",
    "## Manual Validation Status",
    "",
    ('- Visible login route: **' + $manualValidation.visibleLogin.status.ToUpperInvariant() + '**'),
    ('- Degraded-network flow: **' + $manualValidation.degradedNetwork.status.ToUpperInvariant() + '**'),
    ('- Forced logout / minimum-version flow: **' + $manualValidation.forcedLogout.status.ToUpperInvariant() + '**'),
    ('- Signed release payload rerun: **' + $manualValidation.signedReleasePayload.status.ToUpperInvariant() + '**')
)

if (-not [string]::IsNullOrWhiteSpace($manualValidation.visibleLogin.notes)) {
    $markdownLines += ('- Visible login notes: ' + $manualValidation.visibleLogin.notes)
}
if (-not [string]::IsNullOrWhiteSpace($manualValidation.degradedNetwork.notes)) {
    $markdownLines += ('- Degraded-network notes: ' + $manualValidation.degradedNetwork.notes)
}
if (-not [string]::IsNullOrWhiteSpace($manualValidation.forcedLogout.notes)) {
    $markdownLines += ('- Forced logout notes: ' + $manualValidation.forcedLogout.notes)
}
if (-not [string]::IsNullOrWhiteSpace($manualValidation.signedReleasePayload.notes)) {
    $markdownLines += ('- Signed payload notes: ' + $manualValidation.signedReleasePayload.notes)
}

$markdownLines | Set-Content -LiteralPath $markdownPath

Write-Host "Wrote JSON evidence to $jsonPath"
Write-Host "Wrote Markdown evidence to $markdownPath"

if (-not $overallChecks.staticAuditPass) {
    throw "Static P23 audit failed. See $markdownPath"
}

if ($runtimeAudit.executed -and -not $overallChecks.runtimeAuditPass) {
    throw "Runtime P23 audit failed. See $markdownPath"
}
