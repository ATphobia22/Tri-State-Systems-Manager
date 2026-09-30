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
if ($receipt.geographyPolicy.spatialRelation -ne "esriSpatialRelWithin") { throw "Strict-within geography policy missing" }
if ($receipt.geographyPolicy.boundaryVintage -ne "2026-01-01") { throw "Unexpected county boundary vintage" }

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
  $path = Join-Path $Root $actual.path
  if ($actual.status -ne "acquired") { $failures.Add("$($expected.id): status=$($actual.status)") }
  if (-not (Test-Path $path)) { $failures.Add("$($expected.id): missing file $($actual.path)"); continue }
  $item = Get-Item $path
  if ($item.Length -le 0) { $failures.Add("$($expected.id): zero-byte file") }
  $hash = (Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $actual.sha256) { $failures.Add("$($expected.id): SHA-256 mismatch") }

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
  if ($actual.path -match '\(fema|indiana-dnr|indiana-gio|usace-nld|usgs|usgs-lidar)\' -and
      $actual.id -ne "posey-county-boundary" -and
      $actual.spatialRelation -ne "esriSpatialRelWithin" -and
      $actual.id -notmatch "history|metadata|sir-2016-5119|current-imagery|service-catalog|noaa-inport") {
    $failures.Add("$($expected.id): spatialRelation is not strict-within")
  }
}

$boundary = Join-Path $Root "boundary\posey-county-2026-tigerweb.geojson"
if (-not (Test-Path $boundary)) { $failures.Add("Missing exact Posey County boundary artifact") }

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
  acquiredRequiredSourceCount=@($req.requiredSources | Where-Object { $byId.ContainsKey($_.id) }).Count
  strictSpatialPolicy=$true
  status="validated"
} | ConvertTo-Json -Depth 20 | Set-Content (Join-Path $Root "validation-receipt-v1.json") -Encoding utf8

Write-Host "Posey authoritative source validation: PASS"
