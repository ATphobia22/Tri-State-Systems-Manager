<#
.SYNOPSIS
    Tri-State Systems Manager (TSM) - UE5.8 Shipping Offline Acceptance Test Runner
.DESCRIPTION
    Automates pre-flight local asset verification, network isolation checks,
    packaged executable launching, and runtime log analysis for air-gapped runtimes.

    Milestone B gate. Does not claim hydraulic model validation or survey accuracy.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ExecutablePath = "C:\TSM\Binaries\Win64\TriStateSystemsManager.exe",

    [Parameter(Mandatory = $false)]
    [string]$StagedAssetsDir = "C:\TSM\Binaries\Win64\Content\Tiles\posey_county_offline",

    [Parameter(Mandatory = $false)]
    [string]$LogOutputDir = "C:\TSM\Logs",

    [Parameter(Mandatory = $false)]
    [int]$TimeoutSeconds = 60,

    [Parameter(Mandatory = $false)]
    [switch]$RequireAirGap
)

if (!(Test-Path -Path $LogOutputDir)) {
    New-Item -ItemType Directory -Force -Path $LogOutputDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$TestLogFile = Join-Path $LogOutputDir "tsm_acceptance_test_$Timestamp.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $LogEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"
    Write-Host $LogEntry
    Add-Content -Path $TestLogFile -Value $LogEntry
}

Write-Log "=================================================="
Write-Log "TSM Offline Acceptance Test Runner Initiated"
Write-Log "=================================================="

# PHASE 1: Pre-Flight Local Asset Verification
Write-Log "Phase 1: Verifying local staged assets..."

if (!(Test-Path -Path $ExecutablePath)) {
    Write-Log "CRITICAL: Target executable not found at $ExecutablePath" "ERROR"
    exit 1
}
Write-Log "  [PASS] Executable located: $ExecutablePath"

$TilesetJsonPath = Join-Path $StagedAssetsDir "tileset.json"
if (!(Test-Path -Path $TilesetJsonPath)) {
    Write-Log "CRITICAL: tileset.json not found: $TilesetJsonPath" "ERROR"
    exit 1
}
Write-Log "  [PASS] Staged tileset.json located: $TilesetJsonPath"

$GlbFiles = @(Get-ChildItem -Path $StagedAssetsDir -Filter "*.glb" -ErrorAction SilentlyContinue)
Write-Log "  [INFO] Discovered $($GlbFiles.Count) local GLB asset(s) for offline mounting."
if ($GlbFiles.Count -eq 0) {
    Write-Log "  [WARN] Zero GLB files — DERIVED_STAGING root may still load; not a full HLOD product." "WARN"
}

# PHASE 2: Network Isolation Verification
Write-Log "Phase 2: Checking network isolation status..."
$ActiveAdapters = @()
try {
    $ActiveAdapters = @(Get-NetAdapter -ErrorAction Stop | Where-Object { $_.Status -eq 'Up' })
} catch {
    Write-Log "  [WARN] Get-NetAdapter unavailable: $($_.Exception.Message)" "WARN"
}

if ($ActiveAdapters.Count -gt 0) {
    Write-Log "WARNING: Active network adapters detected." "WARN"
    foreach ($adapter in $ActiveAdapters) {
        Write-Log "  - Active Interface: $($adapter.Name) ($($adapter.InterfaceDescription))" "WARN"
    }
    if ($RequireAirGap) {
        Write-Log "CRITICAL: -RequireAirGap set and adapters are Up." "ERROR"
        exit 1
    }
} else {
    Write-Log "  [PASS] Zero active network interfaces detected (or none reported)."
}

# PHASE 3: Process Launch & Log Capture
Write-Log "Phase 3: Launching UE5.8 Shipping executable under test monitoring..."
$ProcessArgs = "-log -windowed -ResX=1280 -ResY=720 -nosound"
Write-Log "Launching: $ExecutablePath $ProcessArgs"

$StdoutPath = Join-Path $LogOutputDir "ue_stdout_$Timestamp.log"
$StderrPath = Join-Path $LogOutputDir "ue_stderr_$Timestamp.log"

try {
    $UeProcess = Start-Process -FilePath $ExecutablePath -ArgumentList $ProcessArgs -PassThru `
        -RedirectStandardOutput $StdoutPath -RedirectStandardError $StderrPath
} catch {
    Write-Log "CRITICAL: Failed to spawn process: $($_.Exception.Message)" "ERROR"
    exit 1
}

if (!$UeProcess) {
    Write-Log "CRITICAL: Failed to spawn Unreal Engine process." "ERROR"
    exit 1
}

Write-Log "Process started with PID: $($UeProcess.Id). Monitoring up to $TimeoutSeconds s..."
$StopWatch = [System.Diagnostics.Stopwatch]::StartNew()
$ProcessRunning = $true

while ($StopWatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    if ($UeProcess.HasExited) {
        $ProcessRunning = $false
        break
    }
    Start-Sleep -Seconds 2
}

if ($ProcessRunning) {
    Write-Log "Test window complete. Stopping PID $($UeProcess.Id)..."
    Stop-Process -Id $UeProcess.Id -Force -ErrorAction SilentlyContinue
} else {
    Write-Log "Process exited with code: $($UeProcess.ExitCode)"
}
$StopWatch.Stop()

# PHASE 4: Runtime Log Analysis
Write-Log "Phase 4: Analyzing captured runtime logs..."
if (Test-Path -Path $StdoutPath) {
    $LogContent = Get-Content -Path $StdoutPath -Raw -ErrorAction SilentlyContinue
    if ($null -eq $LogContent) { $LogContent = "" }

    if ($LogContent -match "tileset\.json" -or $LogContent -match "Cesium") {
        Write-Log "  [PASS] Runtime log shows tileset/Cesium activity."
    } else {
        Write-Log "  [INFO] No explicit tileset strings in stdout (check UE Saved/Logs)."
    }

    if ($LogContent -match "Cesium Ion Token" -or $LogContent -match "401 Unauthorized" -or $LogContent -match "Network unreachable") {
        Write-Log "  [FAIL] Cloud token or network dependency error in logs." "ERROR"
        exit 1
    } else {
        Write-Log "  [PASS] No unauthorized cloud/token failures detected in stdout."
    }
} else {
    Write-Log "  [WARN] Stdout log file not found for analysis." "WARN"
}

Write-Log "=================================================="
Write-Log "TSM Acceptance Test Completed."
Write-Log "Artifacts and logs: $LogOutputDir"
Write-Log "=================================================="
exit 0
