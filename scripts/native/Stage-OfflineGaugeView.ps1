[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $VerifiedObservationBundle,
    [string] $Python = 'python',
    [string] $AsOfUtc = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Build-time only. Shipping never embeds Python, a localhost daemon or a WebView.
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$service = Join-Path $repo 'services/living-twin'
$package = Join-Path $repo 'tsm-native/Content/TSMData/observations'
if (-not (Test-Path -LiteralPath $VerifiedObservationBundle -PathType Container)) {
    throw "Source must be a previously verified offline USGS observation bundle."
}
if (Test-Path -LiteralPath $package) {
    throw "Local observation package exists. Do not overwrite a potentially reviewed snapshot."
}
$parent = Split-Path -Parent $package
if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
}
Push-Location $service
try {
    $options = @('-m','twin.native_gauge_export','build',$VerifiedObservationBundle,$package)
    if ($AsOfUtc) { $options += @('--as-of',$AsOfUtc) }
    & $Python @options
    if ($LASTEXITCODE -ne 0) { throw "USGS native gauge handoff build failed: $LASTEXITCODE" }
    & $Python -m twin.native_gauge_export verify $package
    if ($LASTEXITCODE -ne 0) { throw "USGS native gauge handoff verify failed: $LASTEXITCODE" }
} finally {
    Pop-Location
}
Write-Host "Packaged USGS gage heights staged from verified local capture. Source identity is NOT independently authenticated."
