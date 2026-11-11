<#
.SYNOPSIS
    TSM Production Pipeline Orchestrator
.DESCRIPTION
    Validates physical file existence on disk, reports Gate 4 readiness honestly,
    and runs the master verification suite (optionally --require-production).
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ShippingExe = "Binaries/Win64/ShippingOutput/Windows/TriStateSystemsManager.exe",

    [Parameter(Mandatory = $false)]
    [string]$AirgapLog = "Saved/Logs/tsm_acceptance_test_runtime.log",

    [Parameter(Mandatory = $false)]
    [switch]$RequireProduction
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================="
Write-Host "TSM Production Pipeline Evidence Audit"
Write-Host "=================================================="

$MissingFiles = @()
$RequiredPaths = @(
    "data/raw_usgs",
    "data/raw_vectors/posey_buildings.geojson",
    "tiles/posey_county_offline/tileset.json"
)

foreach ($Path in $RequiredPaths) {
    if (!(Test-Path $Path)) {
        $MissingFiles += $Path
    }
}

$GlbCount = 0
if (Test-Path "tiles/posey_county_offline") {
    $GlbCount = @(Get-ChildItem -Path "tiles/posey_county_offline" -Filter "*.glb" -Recurse -ErrorAction SilentlyContinue).Count
}

if ($MissingFiles.Count -gt 0) {
    Write-Warning "[EVIDENCE] Missing required paths:"
    foreach ($Missing in $MissingFiles) {
        Write-Warning "  - $Missing"
    }
    Write-Warning "Gate 4 HLOD will remain false until real assets exist."
} else {
    Write-Host "[PASS] Core raw/tileset paths present." -ForegroundColor Green
}

Write-Host "[INFO] GLB count under tiles/posey_county_offline: $GlbCount"
if ($GlbCount -eq 0) {
    Write-Warning "[EVIDENCE] Zero GLB meshes — production HLOD not certifiable yet."
}

if (!(Test-Path $ShippingExe)) {
    Write-Warning "[EVIDENCE] Shipping exe not found: $ShippingExe"
}
if (!(Test-Path $AirgapLog)) {
    Write-Warning "[EVIDENCE] Air-gap log not found: $AirgapLog"
}

Write-Host "`nExecuting Master Verification Suite..."
$PythonArgs = @("scripts/release/tsm_master_verification_suite.py")

if ($RequireProduction) {
    $PythonArgs += "--require-production"
    if (Test-Path $ShippingExe) {
        $PythonArgs += "--shipping-exe", (Resolve-Path $ShippingExe).Path
    }
    if (Test-Path $AirgapLog) {
        $PythonArgs += "--airgap-log", (Resolve-Path $AirgapLog).Path
    }
}

& python @PythonArgs
$code = $LASTEXITCODE

if ($code -eq 0) {
    Write-Host "`n[SUCCESS] Verification pipeline exit 0." -ForegroundColor Green
} else {
    Write-Error "`n[FAIL] Verification pipeline exit $code"
}

exit $code
