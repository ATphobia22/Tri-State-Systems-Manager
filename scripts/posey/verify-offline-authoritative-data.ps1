[CmdletBinding()]
param(
  [string]$Root = ".\data\posey-county\offline\2026-09-30",
  [string]$Requirements = ".\data\posey-county\authoritative-source-requirements-v1.json"
)
$ErrorActionPreference = "Stop"

$req = Get-Content $Requirements -Raw | ConvertFrom-Json
$receiptPath = Join-Path $Root "download-receipt-v2.json"
if (-not (Test-Path $receiptPath)) { throw "Missing download-receipt-v2.json" }
$receipt = Get-Content $receiptPath -Raw | ConvertFrom-Json

if ($receipt.schema -ne "tsm-posey-offline-download-receipt-v2") { throw "Receipt schema mismatch" }
if ($receipt.countyFips -ne "18129" -or $receipt.countyGEOID -ne "18129") { throw "Posey FIPS/GEOID mismatch" }
if ($receipt.geographyPolicy.spatialRelation -ne "exact-county") { throw "Exact-county spatial policy missing" }
if ($receipt.geographyPolicy.boundaryVintage -ne "2023") { throw "Unexpected county boundary vintage" }

# Independent byte-level verification, not simply an echo of acquisition claims.
$receiptGate = Join-Path $PSScriptRoot "verify-offline-receipt.mjs"
if (-not (Test-Path -LiteralPath $receiptGate)) { throw "Missing independent Posey receipt integrity verifier" }
& node $receiptGate --root $Root --requirements $Requirements
if ($LASTEXITCODE -ne 0) { throw "Independent source digest and completeness verification failed" }

$byId = @{}
foreach ($f in @($receipt.files)) {
  if ($byId.ContainsKey($f.id)) { throw "Duplicate receipt asset id: $($f.id)" }
  $byId[$f.id] = $f
}

$failures = New-Object System.Collections.Generic.List[string]
foreach ($expected in @($req.requiredSources)) {
  if (-not $byId.ContainsKey($expected.id)) {
    $failures.Add("Missing required source: $($expected.id)")
    continue
  }
  $actual = $byId[$expected.id]

  # Some catalog/reference layers are explicitly non-mandatory (minimumFeatureCount=0
  # and no minimumBytes). If Indiana GIO is temporarily unavailable, its receipt
  # entry intentionally has no path. Record the outage as a warning rather than
  # attempting to hash the output directory. Mandatory sources still fail closed.
  $optionalCatalogSource = ($expected.required -eq $false) -and ($null -ne $expected.minimumFeatureCount) -and
    ([int]$expected.minimumFeatureCount -eq 0) -and ($null -eq $expected.minimumBytes)
  if ($actual.status -eq "unavailable-igio-outage" -and $optionalCatalogSource) {
    Write-Warning "$($expected.id): optional catalog layer unavailable; no local file expected."
    continue
  }
  if ($actual.status -notin @("acquired", "acquired-from-cache")) {
    $failures.Add("$($expected.id): status=$($actual.status) (mandatory sources must be acquired or acquired-from-cache; soft unavailable-igio-outage is only valid for optional catalog layers with minimumFeatureCount=0)")
  }
  if ([string]::IsNullOrWhiteSpace([string]$actual.path)) {
    $failures.Add("$($expected.id): receipt has no file path (status=$($actual.status))")
    continue
  }
  $path = Join-Path $Root $actual.path
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { $failures.Add("$($expected.id): missing file $($actual.path)"); continue }
  $item = Get-Item -LiteralPath $path
  if ($null -ne $expected.minimumBytes -and $item.Length -lt [int64]$expected.minimumBytes) {
    $failures.Add("$($expected.id): bytes $($item.Length) < required $($expected.minimumBytes)")
  }
  if ($null -ne $expected.minimumFeatureCount -and $null -ne $actual.featureCount) {
    if ([int]$actual.featureCount -lt [int]$expected.minimumFeatureCount) {
      $failures.Add("$($expected.id): featureCount $($actual.featureCount) < required $($expected.minimumFeatureCount)")
    }
  }
  if ($actual.authority -ne $expected.authority) {
    $failures.Add("$($expected.id): authority mismatch ($($actual.authority) != $($expected.authority))")
  }
  if ($actual.path -match '(fema|indiana-dnr|indiana-gio|usace-nld|usgs|usgs-lidar)' -and
      $actual.id -ne "posey-county-boundary" -and
      $actual.spatialRelation -notin @("esriSpatialRelWithin","esriSpatialRelIntersects","exact-county-attribute","exact-county-clip","coverage-reference") -and
      $actual.id -notmatch "history|metadata|sir-2016-5119|current-imagery|service-catalog|noaa-inport|fema-countywide-nfhl") {
    $failures.Add("$($expected.id): spatialRelation is not an exact-county spatial filter or documented coverage reference")
  }
}

$boundary = Join-Path $Root "boundary\posey-county-exact-tigerline.geojson"
if (-not (Test-Path $boundary)) { $failures.Add("Missing exact Posey County boundary artifact") }

# Independent local geometry audit: no bounding-box-only acceptance.
$geometryValidator = Join-Path $PSScriptRoot "..\geo\validate-exact-county.mjs"
if (-not (Test-Path $geometryValidator)) { $failures.Add("Missing exact-county geometry validator") }
else {
  foreach ($actual in $byId.Values) {
    if ($actual.path -match "\.geojson$" -and $actual.spatialRelation -in @("esriSpatialRelWithin","esriSpatialRelIntersects","exact-county-clip")) {
      $sourcePath = Join-Path $Root $actual.path
      if (Test-Path $sourcePath) {
        $relation = if ($actual.spatialRelation -eq "esriSpatialRelWithin") { "within" } else { "intersects" }
        node $geometryValidator $boundary $sourcePath $relation | Out-Null
        if ($LASTEXITCODE -ne 0) { $failures.Add("$($actual.id): independent exact-county geometry audit failed") }
      }
    }
  }
}

if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Error $_ }
  throw "Posey authoritative acquisition validation failed with $($failures.Count) error(s)."
}

$receiptSha = (Get-FileHash $receiptPath -Algorithm SHA256).Hash.ToLowerInvariant()
[ordered]@{
  schema="tsm-posey-offline-validation-v1"
  validatedAt=(Get-Date).ToUniversalTime().ToString("o")
  countyFips="18129"
  countyGEOID="18129"
  receiptSha256=$receiptSha
  requiredSourceCount=@($req.requiredSources).Count
  acquiredRequiredSourceCount=@($req.requiredSources | Where-Object { $byId.ContainsKey($_.id) -and $byId[$_.id].status -in @("acquired", "acquired-from-cache") }).Count
  exactCountySpatialPolicy=$true
  status="validated"
} | ConvertTo-Json -Depth 20 | Set-Content (Join-Path $Root "validation-receipt-v1.json") -Encoding utf8

Write-Host "Posey authoritative source validation: PASS"
