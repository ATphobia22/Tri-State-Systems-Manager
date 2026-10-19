[CmdletBinding(DefaultParameterSetName = "Selected")]
param(
  [Parameter(Mandatory = $true, ParameterSetName = "Selected")]
  [string[]]$TileName,

  [Parameter(Mandatory = $true, ParameterSetName = "All")]
  [switch]$AllPoseyTiles,

  [string]$ManifestPath = ".\data\posey-county\elevation\posey-dem-tile-manifest-2020.json",
  [string]$OutDir = ".\data\posey-county\downloads\indiana-dem-2016-2020",
  [string]$ReceiptPath = ".\data\posey-county\downloads\indiana-dem-2016-2020\download-receipt.json",
  [ValidateRange(1, 581)]
  [int]$MaxTiles = 25,
  [switch]$RequireGdalValidation
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
  throw "DEM tile manifest not found: $ManifestPath"
}
$manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.tile_count -ne @($manifest.tiles).Count) {
  throw "Manifest tile_count does not match the actual tile array."
}
if (@($manifest.tiles).Count -gt 581) {
  throw "Unexpected tile count; review manifest before downloading."
}

$byName = @{}
foreach ($tile in $manifest.tiles) {
  if (-not $tile.filename -or -not $tile.urlpath) {
    throw "Manifest contains a tile without filename or URL."
  }
  if ($tile.urlpath -notmatch '^https://gisimageryingov\.s3\.us-east-2\.amazonaws\.com/demoptimized/statewide/20(19|20)/SPW/2\.5ft/[A-Za-z0-9_.-]+\.tif$') {
    throw "Refusing URL outside the expected Indiana DEM S3 path: $($tile.urlpath)"
  }
  if ($byName.ContainsKey([string]$tile.filename)) {
    throw "Duplicate tile filename in manifest: $($tile.filename)"
  }
  $byName[[string]$tile.filename] = $tile
}

if ($AllPoseyTiles) {
  $selected = @($manifest.tiles)
} else {
  $names = @($TileName | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  if ($names.Count -eq 0) { throw "Supply one or more -TileName values, or explicitly use -AllPoseyTiles." }
  $unknown = @($names | Where-Object { -not $byName.ContainsKey($_) })
  if ($unknown.Count -gt 0) { throw "Tile(s) not found in the checked-in Posey manifest: $($unknown -join ', ')" }
  $selected = @($names | Select-Object -Unique | ForEach-Object { $byName[$_] })
}
if ($selected.Count -gt $MaxTiles) {
  throw "Requested $($selected.Count) tiles exceeds MaxTiles=$MaxTiles. Raise -MaxTiles explicitly after reviewing storage/network cost."
}

$OutDir = [System.IO.Path]::GetFullPath($OutDir)
$ReceiptPath = [System.IO.Path]::GetFullPath($ReceiptPath)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ReceiptPath) | Out-Null

$gdalInfo = Get-Command gdalinfo -ErrorAction SilentlyContinue
$cogValidate = Get-Command gdal -ErrorAction SilentlyContinue
if ($RequireGdalValidation -and (-not $gdalInfo -or -not $cogValidate)) {
  throw "-RequireGdalValidation was specified, but gdalinfo and/or gdal are not installed."
}

$results = [System.Collections.Generic.List[object]]::new()
foreach ($tile in $selected) {
  $dest = Join-Path $OutDir ([string]$tile.filename)
  $downloaded = $false
  if (-not (Test-Path -LiteralPath $dest -PathType Leaf)) {
    Write-Host "Downloading $($tile.filename) ($($tile.image_year), $($tile.pixel_size))"
    & curl.exe --fail --silent --show-error --location --retry 8 --retry-delay 3 --retry-max-time 180 --retry-all-errors --http1.1 -A "TSM-Posey-DEM-Acquisition/1.0" --output "$dest" "$($tile.urlpath)"
    if ($LASTEXITCODE -ne 0) {
      Remove-Item -LiteralPath $dest -Force -ErrorAction SilentlyContinue
      throw "Download failed ($LASTEXITCODE): $($tile.filename)"
    }
    $downloaded = $true
  }
  $file = Get-Item -LiteralPath $dest
  if ($file.Length -le 0) {
    Remove-Item -LiteralPath $dest -Force -ErrorAction SilentlyContinue
    throw "Empty DEM tile: $($tile.filename)"
  }
  $hash = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
  $gdal = $null
  if ($gdalInfo) {
    $raw = & $gdalInfo.Source -json "$dest" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gdalinfo failed for $($tile.filename): $raw" }
    try { $gdal = ($raw -join "`n") | ConvertFrom-Json } catch { throw "gdalinfo did not return valid JSON for $($tile.filename)." }
    if (-not $gdal.size -or @($gdal.bands).Count -lt 1) {
      throw "Raster metadata is incomplete for $($tile.filename)."
    }
  }
  $cogStatus = "NOT_CHECKED"
  if ($cogValidate) {
    $validation = & $cogValidate.Source driver cog validate --input "$dest" --full-check auto 2>&1
    if ($LASTEXITCODE -eq 0) { $cogStatus = "PASS" }
    else {
      $cogStatus = "FAIL"
      if ($RequireGdalValidation) { throw "COG validation failed for $($tile.filename): $validation" }
      Write-Warning "COG validation did not pass for $($tile.filename): $validation"
    }
  } elseif ($RequireGdalValidation) {
    throw "GDAL COG validation is required but the gdal command is unavailable."
  }

  $results.Add([pscustomobject]@{
    filename = [string]$tile.filename
    sourceUrl = [string]$tile.urlpath
    sourceYear = [int]$tile.image_year
    sourcePixelSize = [string]$tile.pixel_size
    bytes = [long]$file.Length
    sha256 = $hash
    downloadedThisRun = $downloaded
    gdalInfo = if ($gdal) { [ordered]@{ size = $gdal.size; driver = $gdal.driverShortName; crs = $gdal.coordinateSystem.wkt; geoTransform = $gdal.geoTransform; noDataValues = @($gdal.bands | ForEach-Object { $_.noDataValue }) } } else { $null }
    cogValidation = $cogStatus
    status = "acquired_and_hashed"
  })
}

$receipt = [ordered]@{
  schema = "tsm.posey-dem-download-receipt/v1"
  generatedAt = [DateTime]::UtcNow.ToString("o")
  manifestPath = [System.IO.Path]::GetFullPath($ManifestPath)
  manifestSha256 = (Get-FileHash -LiteralPath $ManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
  manifestQueriedAt = $manifest.queried
  source = $manifest.source
  licenseAsRecordedInManifest = $manifest.license
  outputDirectory = $OutDir
  selectedCount = $results.Count
  results = @($results)
}
$receipt | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReceiptPath -Encoding UTF8
Write-Host "Acquired $($results.Count) DEM tile(s); receipt: $ReceiptPath"
