[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$DataRoot,
    [Parameter(Mandatory=$true)][string]$ManifestPath,
    [Parameter(Mandatory=$true)][string]$ReportPath,
    [ValidateSet('community-six','engineering-eight','combined-nine')]
    [string]$Scope = 'community-six',
    [string]$PythonExe = 'python'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $DataRoot).Path
$manifest = (Resolve-Path -LiteralPath $ManifestPath).Path
$script = (Resolve-Path -LiteralPath "$PSScriptRoot\..\geospatial\audit_cross_state_release_data.py").Path
if (Test-Path -LiteralPath $ReportPath) { throw 'Refusing to overwrite cross-state evidence receipt.' }
if (-not (Test-Path -LiteralPath (Join-Path $root 'data-manifest.json') -PathType Leaf)) {
    throw 'A verified native data-manifest.json must accompany the release snapshot.'
}
$pythonCommand = Get-Command $PythonExe -ErrorAction Stop
& $pythonCommand.Source $script --manifest $manifest --data-root $root --scope $Scope --report $ReportPath
if ($LASTEXITCODE -ne 0) {
    throw "Cross-state release-data coverage preflight failed ($LASTEXITCODE)."
}
$report = Get-Content -LiteralPath $ReportPath -Raw | ConvertFrom-Json
if ($report.result -ne 'SOURCE_FILES_AND_RASTER_BOUNDS_CHECKED_ONLY' -or
    $report.scope -ne $Scope -or $report.blocking_findings.Count -ne 0) {
    throw 'Required county source files or raster bounds are not verified.'
}
Write-Host "CROSS_STATE_SOURCE_FOOTPRINTS_PRESENT scope=$Scope counties=$($report.county_count)"
Write-Warning 'Only source hashes and raster footprint bounds checked. Raster pixels, geoid and LoD completeness are not certified.'
