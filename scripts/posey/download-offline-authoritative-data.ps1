[CmdletBinding()]
param([string]$OutDir = ".\data\posey-county\offline\2026-09-30")
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$OutDir = (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force -Path $OutDir)).Path

$CountyFips = "18129"
$CountyGEOID = "18129"
$CountyBoundaryUrl = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2026/MapServer/82"

function Save-Url([string]$Url,[string]$Path,[string]$RequiredId,[string]$Authority) {
  $full = Join-Path $OutDir $Path
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $full) | Out-Null
  & curl.exe --fail --silent --show-error --location --retry 8 --retry-delay 5 --retry-max-time 180 --retry-all-errors --http1.1 -A "TSM-Posey-Offline-Acquisition/1.0" --output "$full" "$Url"
  $curlExit = $LASTEXITCODE
  if ($curlExit -ne 0) { throw "Download failed ($curlExit): $RequiredId" }
  $item = Get-Item $full
  if ($item.Length -le 0) { throw "Empty download: $RequiredId" }
  Write-Host "Downloaded $RequiredId ($($item.Length) bytes)"
  [pscustomobject]@{
    id=$RequiredId; authority=$Authority; path=$Path; url=$Url
    sha256=(Get-FileHash $full -Algorithm SHA256).Hash.ToLowerInvariant()
    bytes=$item.Length; featureCount=$null; spatialRelation=$null
    status="acquired"
  }
}

function Invoke-ArcGisQuery([string]$ServiceLayerUrl,[hashtable]$Parameters) {
  $attempts = 0
  do {
    $attempts++
    try {
      $r = Invoke-RestMethod -Method Post -Uri "$ServiceLayerUrl/query" -Body $Parameters -ContentType "application/x-www-form-urlencoded" -TimeoutSec 300
      if ($r.error) { throw ($r.error | ConvertTo-Json -Depth 20) }
      return $r
    } catch {
      if ($attempts -ge 4) { throw }
      Start-Sleep -Seconds (2 * $attempts)
    }
  } while ($true)
}

function Save-ArcGisCountyAttribute(
  [string]$ServiceLayerUrl,
  [string]$Where,
  [string]$Name,
  [string]$RequiredId,
  [string]$Authority,
  [bool]$RequireFeature
) {
  Write-Host "Acquiring $RequiredId via exact county attribute filter from $ServiceLayerUrl"
  $query = @{
    where=$Where; outFields="*"; returnGeometry="true"; outSR="4326"; f="json"
  } | ForEach-Object {
    ($_.GetEnumerator() | ForEach-Object { "$($_.Key)=$([uri]::EscapeDataString([string]$_.Value))" }) -join "&"
  }
  $r = Invoke-RestMethod -Method Get -Uri "$ServiceLayerUrl/query?$query"
  if ($r.error) { throw ($r.error | ConvertTo-Json -Depth 20) }
  $features=@($r.features)
  if ($RequireFeature -and $features.Count -lt 1) {
    throw "Required FEMA county source returned zero features for $RequiredId"
  }
  $path=Join-Path $OutDir $Name
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
  [ordered]@{
    type="FeatureCollection"; source=$ServiceLayerUrl; where=$Where
    countyFips=$CountyFips; boundarySource=$CountyBoundaryUrl; boundaryGEOID=$CountyGEOID
    spatialRelation="exact-county-attribute"; retrievedAt=(Get-Date).ToUniversalTime().ToString("o")
    features=$features
  } | ConvertTo-Json -Depth 100 | Set-Content $path -Encoding utf8
  [pscustomobject]@{
    id=$RequiredId; authority=$Authority; path=$Name; url=$ServiceLayerUrl; where=$Where
    sha256=(Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
    bytes=(Get-Item $path).Length; featureCount=$features.Count
    spatialRelation="exact-county-attribute"; status="acquired"
  }
}

function Save-ArcGisCountyIntersectAudit(
  [string]$ServiceLayerUrl,
  [string]$Where,
  [string]$RequiredId
) {
  $encodedGeometry = [uri]::EscapeDataString(($script:CountyGeometry | ConvertTo-Json -Compress -Depth 100))
  $q = "$ServiceLayerUrl/query?where=$([uri]::EscapeDataString($Where))&geometry=$encodedGeometry&geometryType=esriGeometryPolygon&inSR=4326&spatialRel=esriSpatialRelIntersects&returnIdsOnly=true&f=json"
  $r = Get-ArcGisJson $q
  return @($r.objectIds).Count
}

# Exact Posey County polygon: U.S. Census TIGERweb January 1, 2026 current county vintage.
$boundaryQueryUrl = "$CountyBoundaryUrl/query?where=GEOID%3D%27$CountyGEOID%27&outFields=GEOID%2CNAME%2CSTATE%2CCOUNTY&returnGeometry=true&outSR=4326&f=json"
$boundaryRawPath = Join-Path $OutDir "boundary\posey-county-2026-tigerweb-response.json"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $boundaryRawPath) | Out-Null
& curl.exe --fail --silent --show-error --location --retry 8 --retry-delay 5 --retry-max-time 180 --retry-all-errors --http1.1 -A "TSM-Posey-Offline-Acquisition/1.0" --output "$boundaryRawPath" "$boundaryQueryUrl"
$boundaryCurlExit = $LASTEXITCODE
if ($boundaryCurlExit -ne 0) { throw "Census boundary download failed ($boundaryCurlExit)" }
$boundary = Get-Content $boundaryRawPath -Raw | ConvertFrom-Json
if ($boundary.error) { throw ($boundary.error | ConvertTo-Json -Depth 20) }
if (@($boundary.features).Count -ne 1) { throw "Expected exactly one Posey County boundary feature; got $(@($boundary.features).Count)" }
if ($boundary.features[0].attributes.GEOID -ne $CountyGEOID) { throw "County GEOID mismatch" }
$script:CountyGeometry = $boundary.features[0].geometry
$boundaryPath = Join-Path $OutDir "boundary\posey-county-2026-tigerweb.geojson"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $boundaryPath) | Out-Null
[ordered]@{
  type="FeatureCollection"; source=$CountyBoundaryUrl; vintage="2026-01-01"
  countyFips=$CountyFips; features=@($boundary.features)
} | ConvertTo-Json -Depth 100 | Set-Content $boundaryPath -Encoding utf8

$results=@()
$results += [pscustomobject]@{
  id="posey-county-boundary"; authority="US_CENSUS_BUREAU"; path="boundary\posey-county-2026-tigerweb.geojson"
  url=$CountyBoundaryUrl; sha256=(Get-FileHash $boundaryPath -Algorithm SHA256).Hash.ToLowerInvariant()
  bytes=(Get-Item $boundaryPath).Length; featureCount=1; spatialRelation="exact-boundary"; status="acquired"
}

$femaCountyProduct="https://msc.fema.gov/portal/downloadProduct?productID=NFHL_18129C"
$results += Save-Url $femaCountyProduct "fema\\NFHL_18129C.zip" "fema-countywide-nfhl-18129C" "FEMA"

$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer/438" "1=1" "indiana-dnr\bafm-posey-strict.geojson" "indiana-dnr-bafm" "Indiana DNR" $true "esriSpatialRelIntersects"

$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0" "1=1" "indiana-gio\parcel-boundaries-2025-posey-strict.json" "indiana-gio-parcels-2025" "Indiana GIO"  $true "esriSpatialRelIntersects"
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Address_Points_of_Indiana_2025/FeatureServer/0" "1=1" "indiana-gio\address-points-2025-posey-strict.json" "indiana-gio-address-points-2025" "Indiana GIO" $false
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2025/FeatureServer/0" "1=1" "indiana-gio\road-centerlines-2025-posey-strict.json" "indiana-gio-road-centerlines-2025" "Indiana GIO" $false
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Administrative_Boundaries_of_Indiana_2025/FeatureServer/3" "1=1" "indiana-gio\administrative-boundaries-county-commissioner-posey-strict.json" "indiana-gio-administrative-boundaries-2025" "Indiana GIO" $false
$results += Save-Url "https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer?f=pjson" "indiana-gio\current-imagery-service.json" "indiana-gio-current-imagery-metadata" "Indiana GIO"
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Orthoimagery_Tier_Map_2025_2028/FeatureServer/10" "1=1" "indiana-gio\posey-ortho-tier-2025-2028-strict.geojson" "indiana-gio-ortho-tier-2025-2028" "Indiana GIO" $true "esriSpatialRelIntersects"

$results += Save-ArcGisWithinCounty "https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer/16" "1=1" "usace-nld\leveed-areas-posey-strict.geojson" "usace-nld-leveed-areas" "USACE" $false "esriSpatialRelIntersects"
$results += Save-Url "https://levees.sec.usace.army.mil/data-services/services/" "usace-nld\service-catalog.html" "usace-nld-service-catalog" "USACE"

$results += Save-Url "https://waterservices.usgs.gov/nwis/dv/?format=rdb&sites=03378500&startDT=1900-01-01&endDT=2026-09-30&statCd=00003" "usgs\03378500-daily-mean-history.rdb" "usgs-03378500-daily-mean-history" "USGS"
$results += Save-Url "https://waterservices.usgs.gov/nwis/site/?format=rdb&sites=03378500&siteOutput=expanded" "usgs\03378500-site-metadata.rdb" "usgs-03378500-site-metadata" "USGS"
$study=@(
  "https://pubs.usgs.gov/sir/2016/5119/sir20165119.pdf",
  "https://pubs.usgs.gov/sir/2016/5119/downloads/metadata_depth_grids.pdf",
  "https://pubs.usgs.gov/sir/2016/5119/downloads/metadata_shapefile.pdf",
  "https://pubs.usgs.gov/sir/2016/5119/downloads/00Readme.pdf",
  "https://pubs.usgs.gov/sir/2016/5119/downloads/depth_grids.zip",
  "https://pubs.usgs.gov/sir/2016/5119/downloads/shapefiles.zip"
)
$studyIds = @{
  "sir20165119.pdf"="usgs-sir-2016-5119-report"
  "metadata_depth_grids.pdf"="usgs-sir-2016-5119-depth-grid-metadata"
  "metadata_shapefile.pdf"="usgs-sir-2016-5119-shapefile-metadata"
  "00Readme.pdf"="usgs-sir-2016-5119-readme"
  "depth_grids.zip"="usgs-sir-2016-5119-depth-grids"
  "shapefiles.zip"="usgs-sir-2016-5119-shapefiles"
}
foreach($u in $study) {
  $leaf=Split-Path ([uri]$u).AbsolutePath -Leaf
  $results += Save-Url $u ("usgs\sir20165119\"+$leaf) $studyIds[$leaf] "USGS"
}
$results += Save-Url "https://www.fisheries.noaa.gov/inport/item/69202" "usgs-lidar\noaa-inport-69202.html" "usgs-lidar-noaa-inport-69202" "USGS"

$results += Save-ArcGisWithinCounty "https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer/8" "1=1" "usgs-lidar\3dep-lidar-index-posey-strict.geojson" "usgs-3dep-lidar-index" "USGS" $true "esriSpatialRelIntersects"

$manifest=[ordered]@{
  schema="tsm-posey-offline-download-receipt-v2"
  retrievedAt=(Get-Date).ToUniversalTime().ToString("o")
  countyFips=$CountyFips
  countyGEOID=$CountyGEOID
  geographyPolicy=[ordered]@{
    boundarySource=$CountyBoundaryUrl
    boundaryVintage="2026-01-01"
    spatialRelation="exact-county"
    rule="Strict spatial extracts contain only features wholly within the exact Posey County polygon."
  }
  files=$results
}
$mp=Join-Path $OutDir "download-receipt-v2.json"
$manifest|ConvertTo-Json -Depth 100|Set-Content $mp -Encoding utf8
Write-Host ("Receipt SHA-256: "+(Get-FileHash $mp -Algorithm SHA256).Hash.ToLowerInvariant()function Save-ArcGisWithinCounty(
  [string]$ServiceLayerUrl,
  [string]$Where,
  [string]$Name,
  [string]$RequiredId,
  [string]$Authority,
  [bool]$RequireFeature,
  [ValidateSet("esriSpatialRelWithin","esriSpatialRelIntersects")][string]$SpatialRelation = "esriSpatialRelWithin"
) {
  Write-Host "Acquiring $RequiredId via $SpatialRelation from $ServiceLayerUrl"
  $all = @()
  $geometryJson = $script:CountyGeometry | ConvertTo-Json -Compress -Depth 100
  $meta = Invoke-RestMethod -Method Get -Uri "$ServiceLayerUrl?f=pjson" -TimeoutSec 120
  if ($meta.error) { throw ($meta.error | ConvertTo-Json -Depth 20) }
  $pageSize = [int]$meta.maxRecordCount
  if ($pageSize -lt 1) { $pageSize = 1000 }
  $supportsPagination = [bool]$meta.advancedQueryCapabilities.supportsPagination
  $offset = 0
  do {
    $params = @{
      where=$Where; geometry=$geometryJson; geometryType="esriGeometryPolygon"; inSR="4326"
      spatialRel=$SpatialRelation; outFields="*"; returnGeometry="true"; outSR="4326"
      f="json"
    }
    if ($supportsPagination) {
      $params.resultOffset=$offset
      $params.resultRecordCount=$pageSize
    }
    $r = Invoke-ArcGisQuery $ServiceLayerUrl $params
    $features = @($r.features)
    if ($features.Count -eq 0) { break }
    $all += $features
    if (-not $supportsPagination -or $features.Count -lt $pageSize) { break }
    $offset += $features.Count
  } while ($true)

  if ($RequireFeature -and $all.Count -lt 1) {
    throw "Required spatial source returned zero features for exact Posey County spatial relation ($SpatialRelation): $RequiredId"
  }

  $path = Join-Path $OutDir $Name
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
  $payload = [ordered]@{
    type="FeatureCollection"; source=$ServiceLayerUrl; where=$Where
    countyFips=$CountyFips; boundarySource=$CountyBoundaryUrl; boundaryGEOID=$CountyGEOID
    spatialRelation=$SpatialRelation; retrievedAt=(Get-Date).ToUniversalTime().ToString("o")
    features=$all
  }
  $payload | ConvertTo-Json -Depth 100 | Set-Content $path -Encoding utf8
  [pscustomobject]@{
    id=$RequiredId; authority=$Authority; path=$Name; url=$ServiceLayerUrl; where=$Where
    sha256=(Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
    bytes=(Get-Item $path).Length; featureCount=$all.Count
    spatialRelation=$SpatialRelation; status="acquired"
  }
}

function Save-ArcGisCountyAttribute(
  [string]$ServiceLayerUrl,
  [string]$Where,
  [string]$Name,
  [string]$RequiredId,
  [string]$Authority,
  [bool]$RequireFeature
) {
  Write-Host "Acquiring $RequiredId via exact county attribute filter from $ServiceLayerUrl"
  $query = @{
    where=$Where; outFields="*"; returnGeometry="true"; outSR="4326"; f="json"
  } | ForEach-Object {
    ($_.GetEnumerator() | ForEach-Object { "$($_.Key)=$([uri]::EscapeDataString([string]$_.Value))" }) -join "&"
  }
  $r = Invoke-RestMethod -Method Get -Uri "$ServiceLayerUrl/query?$query"
  if ($r.error) { throw ($r.error | ConvertTo-Json -Depth 20) }
  $features=@($r.features)
  if ($RequireFeature -and $features.Count -lt 1) {
    throw "Required FEMA county source returned zero features for $RequiredId"
  }
  $path=Join-Path $OutDir $Name
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
  [ordered]@{
    type="FeatureCollection"; source=$ServiceLayerUrl; where=$Where
    countyFips=$CountyFips; boundarySource=$CountyBoundaryUrl; boundaryGEOID=$CountyGEOID
    spatialRelation="exact-county-attribute"; retrievedAt=(Get-Date).ToUniversalTime().ToString("o")
    features=$features
  } | ConvertTo-Json -Depth 100 | Set-Content $path -Encoding utf8
  [pscustomobject]@{
    id=$RequiredId; authority=$Authority; path=$Name; url=$ServiceLayerUrl; where=$Where
    sha256=(Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
    bytes=(Get-Item $path).Length; featureCount=$features.Count
    spatialRelation="exact-county-attribute"; status="acquired"
  }
}

function Save-ArcGisCountyIntersectAudit(
  [string]$ServiceLayerUrl,
  [string]$Where,
  [string]$RequiredId
) {
  $encodedGeometry = [uri]::EscapeDataString(($script:CountyGeometry | ConvertTo-Json -Compress -Depth 100))
  $q = "$ServiceLayerUrl/query?where=$([uri]::EscapeDataString($Where))&geometry=$encodedGeometry&geometryType=esriGeometryPolygon&inSR=4326&spatialRel=esriSpatialRelIntersects&returnIdsOnly=true&f=json"
  $r = Get-ArcGisJson $q
  return @($r.objectIds).Count
}

# Exact Posey County polygon: U.S. Census TIGERweb January 1, 2026 current county vintage.
$boundaryQueryUrl = "$CountyBoundaryUrl/query?where=GEOID%3D%27$CountyGEOID%27&outFields=GEOID%2CNAME%2CSTATE%2CCOUNTY&returnGeometry=true&outSR=4326&f=json"
$boundaryRawPath = Join-Path $OutDir "boundary\posey-county-2026-tigerweb-response.json"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $boundaryRawPath) | Out-Null
& curl.exe --fail --silent --show-error --location --retry 8 --retry-delay 5 --retry-max-time 180 --retry-all-errors --http1.1 -A "TSM-Posey-Offline-Acquisition/1.0" --output "$boundaryRawPath" "$boundaryQueryUrl"
$boundaryCurlExit = $LASTEXITCODE
if ($boundaryCurlExit -ne 0) { throw "Census boundary download failed ($boundaryCurlExit)" }
$boundary = Get-Content $boundaryRawPath -Raw | ConvertFrom-Json
if ($boundary.error) { throw ($boundary.error | ConvertTo-Json -Depth 20) }
if (@($boundary.features).Count -ne 1) { throw "Expected exactly one Posey County boundary feature; got $(@($boundary.features).Count)" }
if ($boundary.features[0].attributes.GEOID -ne $CountyGEOID) { throw "County GEOID mismatch" }
$script:CountyGeometry = $boundary.features[0].geometry
$boundaryPath = Join-Path $OutDir "boundary\posey-county-2026-tigerweb.geojson"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $boundaryPath) | Out-Null
[ordered]@{
  type="FeatureCollection"; source=$CountyBoundaryUrl; vintage="2026-01-01"
  countyFips=$CountyFips; features=@($boundary.features)
} | ConvertTo-Json -Depth 100 | Set-Content $boundaryPath -Encoding utf8

$results=@()
$results += [pscustomobject]@{
  id="posey-county-boundary"; authority="US_CENSUS_BUREAU"; path="boundary\posey-county-2026-tigerweb.geojson"
  url=$CountyBoundaryUrl; sha256=(Get-FileHash $boundaryPath -Algorithm SHA256).Hash.ToLowerInvariant()
  bytes=(Get-Item $boundaryPath).Length; featureCount=1; spatialRelation="exact-boundary"; status="acquired"
}

$femaCountyProduct="https://msc.fema.gov/portal/downloadProduct?productID=NFHL_18129C"
$results += Save-Url $femaCountyProduct "fema\\NFHL_18129C.zip" "fema-countywide-nfhl-18129C" "FEMA"

$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer/438" "1=1" "indiana-dnr\bafm-posey-strict.geojson" "indiana-dnr-bafm" "Indiana DNR" $true "esriSpatialRelIntersects"

$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0" "1=1" "indiana-gio\parcel-boundaries-2025-posey-strict.json" "indiana-gio-parcels-2025" "Indiana GIO"  $true "esriSpatialRelIntersects"
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Address_Points_of_Indiana_2025/FeatureServer/0" "1=1" "indiana-gio\address-points-2025-posey-strict.json" "indiana-gio-address-points-2025" "Indiana GIO" $false
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2025/FeatureServer/0" "1=1" "indiana-gio\road-centerlines-2025-posey-strict.json" "indiana-gio-road-centerlines-2025" "Indiana GIO" $false
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Administrative_Boundaries_of_Indiana_2025/FeatureServer/3" "1=1" "indiana-gio\administrative-boundaries-county-commissioner-posey-strict.json" "indiana-gio-administrative-boundaries-2025" "Indiana GIO" $false
$results += Save-Url "https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer?f=pjson" "indiana-gio\current-imagery-service.json" "indiana-gio-current-imagery-metadata" "Indiana GIO"
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Orthoimagery_Tier_Map_2025_2028/FeatureServer/10" "1=1" "indiana-gio\posey-ortho-tier-2025-2028-strict.geojson" "indiana-gio-ortho-tier-2025-2028" "Indiana GIO" $true "esriSpatialRelIntersects"

$results += Save-ArcGisWithinCounty "https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer/16" "1=1" "usace-nld\leveed-areas-posey-strict.geojson" "usace-nld-leveed-areas" "USACE" $false "esriSpatialRelIntersects"
$results += Save-Url "https://levees.sec.usace.army.mil/data-services/services/" "usace-nld\service-catalog.html" "usace-nld-service-catalog" "USACE"

$results += Save-Url "https://waterservices.usgs.gov/nwis/dv/?format=rdb&sites=03378500&startDT=1900-01-01&endDT=2026-09-30&statCd=00003" "usgs\03378500-daily-mean-history.rdb" "usgs-03378500-daily-mean-history" "USGS"
$results += Save-Url "https://waterservices.usgs.gov/nwis/site/?format=rdb&sites=03378500&siteOutput=expanded" "usgs\03378500-site-metadata.rdb" "usgs-03378500-site-metadata" "USGS"
$study=@(
  "https://pubs.usgs.gov/sir/2016/5119/sir20165119.pdf",
  "https://pubs.usgs.gov/sir/2016/5119/downloads/metadata_depth_grids.pdf",
  "https://pubs.usgs.gov/sir/2016/5119/downloads/metadata_shapefile.pdf",
  "https://pubs.usgs.gov/sir/2016/5119/downloads/00Readme.pdf",
  "https://pubs.usgs.gov/sir/2016/5119/downloads/depth_grids.zip",
  "https://pubs.usgs.gov/sir/2016/5119/downloads/shapefiles.zip"
)
$studyIds = @{
  "sir20165119.pdf"="usgs-sir-2016-5119-report"
  "metadata_depth_grids.pdf"="usgs-sir-2016-5119-depth-grid-metadata"
  "metadata_shapefile.pdf"="usgs-sir-2016-5119-shapefile-metadata"
  "00Readme.pdf"="usgs-sir-2016-5119-readme"
  "depth_grids.zip"="usgs-sir-2016-5119-depth-grids"
  "shapefiles.zip"="usgs-sir-2016-5119-shapefiles"
}
foreach($u in $study) {
  $leaf=Split-Path ([uri]$u).AbsolutePath -Leaf
  $results += Save-Url $u ("usgs\sir20165119\"+$leaf) $studyIds[$leaf] "USGS"
}
$results += Save-Url "https://www.fisheries.noaa.gov/inport/item/69202" "usgs-lidar\noaa-inport-69202.html" "usgs-lidar-noaa-inport-69202" "USGS"

$results += Save-ArcGisWithinCounty "https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer/8" "1=1" "usgs-lidar\3dep-lidar-index-posey-strict.geojson" "usgs-3dep-lidar-index" "USGS" $true "esriSpatialRelIntersects"

$manifest=[ordered]@{
  schema="tsm-posey-offline-download-receipt-v2"
  retrievedAt=(Get-Date).ToUniversalTime().ToString("o")
  countyFips=$CountyFips
  countyGEOID=$CountyGEOID
  geographyPolicy=[ordered]@{
    boundarySource=$CountyBoundaryUrl
    boundaryVintage="2026-01-01"
    spatialRelation="exact-county"
    rule="Strict spatial extracts contain only features wholly within the exact Posey County polygon."
  }
  files=$results
}
$mp=Join-Path $OutDir "download-receipt-v2.json"
$manifest|ConvertTo-Json -Depth 100|Set-Content $mp -Encoding utf8
Write-Host ("Receipt SHA-256: "+(Get-FileHash $mp -Algorithm SHA256).Hash.ToLowerInvariant())