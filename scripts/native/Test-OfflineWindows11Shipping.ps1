[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$PackageRoot,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
    [ValidateRange(10,120)][int]$ObservationSeconds = 25
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $PackageRoot).Path
$launcher = Get-Item -LiteralPath (Join-Path $root 'TSMNative.exe')
$exe = Get-Item -LiteralPath (Join-Path $root 'TSMNative/Binaries/Win64/TSMNative-Win64-Shipping.exe')
$evidence = New-Item -ItemType Directory -Path $EvidenceDirectory -Force
$log = Join-Path $evidence.FullName 'packaged-first-launch.log'
$ruleName = "TSM-OffLine-Smoke-$PID"
$hash = (Get-FileHash -LiteralPath $exe.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$signature = (Get-AuthenticodeSignature -LiteralPath $exe.FullName)
$summary = [ordered]@{
    schema = 'tsm.ue58.windows11.offline-smoke.v1'
    classification = 'NOT_VERIFIED'
    sourcePackageRoot = $root
    executable = $exe.FullName
    executableSha256 = $hash
    authenticode = [string]$signature.Status
    launcherSha256 = (Get-FileHash -LiteralPath $launcher.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    observationSeconds = $ObservationSeconds
    startedUtc = (Get-Date).ToUniversalTime().ToString('o')
    firewallIsolationApplied = $false
    processStarted = $false
    processAliveAtObservation = $false
    runtimeMenusVerified = $false
    terrainStreamingVerified = $false
    screenshotsVerified = $false
    engineeringDataVerified = $false
    cleanHostVerified = $false
    humanReviewRequired = $true
}
$process = $null
try {
    # Use a disposable CLEAN Windows 11 machine, elevated PowerShell and
    # disconnect its physical network in addition to these executable rules.
    # Firewall isolation alone does not prove the whole machine is offline.
    if ($signature.Status -ne 'Valid' -or (Get-AuthenticodeSignature -LiteralPath $launcher.FullName).Status -ne 'Valid') {
        throw 'The launcher and Shipping game must have valid signatures.'
    }
    New-NetFirewallRule -DisplayName "$ruleName-out" -Direction Outbound -Program $exe.FullName -Action Block -Profile Any | Out-Null
    New-NetFirewallRule -DisplayName "$ruleName-in" -Direction Inbound -Program $exe.FullName -Action Block -Profile Any | Out-Null
    $summary.firewallIsolationApplied = $true
    $process = Start-Process -FilePath $exe.FullName -ArgumentList ('-log -abslog="{0}"' -f $log) -WorkingDirectory $exe.DirectoryName -PassThru
    $summary.processStarted = ($null -ne $process)
    Start-Sleep -Seconds $ObservationSeconds
    $process.Refresh()
    $summary.processAliveAtObservation = (-not $process.HasExited)
    $summary.classification = if ($summary.processAliveAtObservation) { 'PROCESS_START_OBSERVED_INTERACTION_PENDING' } else { 'EARLY_PROCESS_EXIT' }
} catch {
    $summary.classification = 'SMOKE_TEST_FAILED'
    $summary.error = $_.Exception.Message
} finally {
    if ($null -ne $process) {
        $process.Refresh()
        if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    }
    Get-NetFirewallRule -DisplayName "$ruleName-*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
    $summary.finishedUtc = (Get-Date).ToUniversalTime().ToString('o')
    $summary | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $evidence.FullName 'offline-smoke-evidence.json') -Encoding UTF8
}
if ($summary.classification -ne 'PROCESS_START_OBSERVED_INTERACTION_PENDING') {
    throw "Packaged executable did not survive startup test: $($summary.classification)"
}
Write-Host 'Executable process launched in firewall isolation. Clean-host offline/terrain/HUD evidence remains unverified until independently recorded.'
