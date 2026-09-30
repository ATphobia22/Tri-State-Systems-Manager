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
  Invoke-WebRequest -Uri $Url -OutFile $full -UseBasicParsing
  $item = Get-Item $full
  if ($item.Length -le 0) { throw "Empty download: $RequiredId" }
  [pscustomobject]@{
    id=$RequiredId; authority=$Authority; path=$Path; url=$Url
    sha256=(Get-FileHash $full -Algorithm SHA256).Hash.ToLowerInvariant()
    bytes=$item.Length; featureCount=$null; spatialRelation=$null
    status="acquired"
  }
}

function Invoke-ArcGisQuery([string]$ServiceLayerUrl,[hashtable]$Parameters) {
  $r = Invoke-RestMethod -Method Post -Uri "$ServiceLayerUrl/query" -Body $Parameters -ContentType "application/x-www-form-urlencoded"
  if ($r.error) { throw ($r.error | ConvertTo-Json -Depth 20) }
  return $r
}

function Save-ArcGisWithinCounty(
  [string]$ServiceLayerUrl,
  [string]$Where,
  [string]$Name,
  [string]$RequiredId,
  [string]$Authority,
  [bool]$RequireFeature
) {
  $all = @()
  $offset = 0
  $size = 1900
  $geometryJson = $script:CountyGeometry | ConvertTo-Json -Compress -Depth 100
  do {
    $r = Invoke-ArcGisQuery $ServiceLayerUrl @{
      where=$Where; geometry=$geometryJson; geometryType="esriGeometryPolygon"; inSR="4326"
      spatialRel="esriSpatialRelWithin"; outFields="*"; returnGeometry="true"; outSR="4326"
      resultOffset=$offset; resultRecordCount=$size; f="json"
    }
    $features = @($r.features)
    $all += $features
    $got = $features.Count
    $offset += $got
  } while ($got -gt 0 -and $got -eq $size)

  if ($RequireFeature -and $all.Count -lt 1) {
    throw "Required spatial source returned zero strictly-within-Posey features: $RequiredId"
  }

  $path = Join-Path $OutDir $Name
  $payload = [ordered]@{
    type="FeatureCollection"
    source=$ServiceLayerUrl
    where=$Where
    countyFips=$CountyFips
    boundarySource=$CountyBoundaryUrl
    boundaryGEOID=$CountyGEOID
    spatialRelation="esriSpatialRelWithin"
    retrievedAt=(Get-Date).ToUniversalTime().ToString("o")
    features=$all
  }
  $payload | ConvertTo-Json -Depth 100 | Set-Content $path -Encoding utf8

  [pscustomobject]@{
    id=$RequiredId; authority=$Authority; path=$Name; url=$ServiceLayerUrl; where=$Where
    sha256=(Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
    bytes=(Get-Item $path).Length; featureCount=$all.Count
    spatialRelation="esriSpatialRelWithin"; status="acquired"
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
$boundary = Invoke-ArcGisQuery $CountyBoundaryUrl @{
  where="GEOID='$CountyGEOID'"; outFields="GEOID,NAME,STATE,COUNTY"
  returnGeometry="true"; outSR="4326"; f="json"
}
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

$fema="https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer"
$results += Save-ArcGisWithinCounty "$fema/3" "DFIRM_ID='$($CountyFips)C'" "fema\effective-firm-panels-18129C-within.json" "fema-firm-panels" "FEMA" $true
$results += Save-ArcGisWithinCounty "$fema/1" "1=1" "fema\lomrs-within.json" "fema-lomrs" "FEMA" $false
$results += Save-ArcGisWithinCounty "$fema/2" "1=1" "fema\lomas-within.json" "fema-lomas" "FEMA" $false
$results += Save-ArcGisWithinCounty "$fema/14" "1=1" "fema\cross-sections-within.json" "fema-cross-sections" "FEMA" $false
$results += Save-ArcGisWithinCounty "$fema/16" "1=1" "fema\base-flood-elevations-within.json" "fema-base-flood-elevations" "FEMA" $false
$results += Save-ArcGisWithinCounty "$fema/23" "1=1" "fema\levees-within.json" "fema-levees" "FEMA" $false
$results += Save-ArcGisWithinCounty "$fema/24" "1=1" "fema\general-structures-within.json" "fema-general-structures" "FEMA" $false
$results += Save-ArcGisWithinCounty "$fema/26" "1=1" "fema\hydrologic-reaches-within.json" "fema-hydrologic-reaches" "FEMA" $false
$results += Save-ArcGisWithinCounty "$fema/27" "1=1" "fema\flood-hazard-boundaries-within.json" "fema-flood-hazard-boundaries" "FEMA" $true
$results += Save-ArcGisWithinCounty "$fema/28" "1=1" "fema\flood-hazard-zones-within.json" "fema-flood-hazard-zones" "FEMA" $true
$results += Save-ArcGisWithinCounty "$fema/31" "1=1" "fema\subbasins-within.json" "fema-subbasins" "FEMA" $false

$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer/438" "1=1" "indiana-dnr\bafm-posey-strict.geojson" "indiana-dnr-bafm" "Indiana DNR" $true

$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0" "county_fips='$CountyFips'" "indiana-gio\parcel-boundaries-2025-posey-strict.json" "indiana-gio-parcels-2025" "Indiana GIO" $true
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Address_Points_of_Indiana_2025/FeatureServer/0" "county_fips='$CountyFips'" "indiana-gio\address-points-2025-posey-strict.json" "indiana-gio-address-points-2025" "Indiana GIO" $false
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2025/FeatureServer/0" "county_fips='$CountyFips'" "indiana-gio\road-centerlines-2025-posey-strict.json" "indiana-gio-road-centerlines-2025" "Indiana GIO" $false
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Administrative_Boundaries_of_Indiana_2025/FeatureServer/3" "1=1" "indiana-gio\administrative-boundaries-county-commissioner-posey-strict.json" "indiana-gio-administrative-boundaries-2025" "Indiana GIO" $false
$results += Save-Url "https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer?f=pjson" "indiana-gio\current-imagery-service.json" "indiana-gio-current-imagery-metadata" "Indiana GIO"
$results += Save-ArcGisWithinCounty "https://gisdata.in.gov/server/rest/services/Hosted/Orthoimagery_Tier_Map_2025_2028/FeatureServer/10" "1=1" "indiana-gio\posey-ortho-tier-2025-2028-strict.geojson" "indiana-gio-ortho-tier-2025-2028" "Indiana GIO" $true

$results += Save-ArcGisWithinCounty "https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer/16" "1=1" "usace-nld\leveed-areas-posey-strict.geojson" "usace-nld-leveed-areas" "USACE" $false
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

$results += Save-ArcGisWithinCounty "https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer/8" "1=1" "usgs-lidar\3dep-lidar-index-posey-strict.geojson" "usgs-3dep-lidar-index" "USGS" $true

$manifest=[ordered]@{
  schema="tsm-posey-offline-download-receipt-v2"
  retrievedAt=(Get-Date).ToUniversalTime().ToString("o")
  countyFips=$CountyFips
  countyGEOID=$CountyGEOID
  geographyPolicy=[ordered]@{
    boundarySource=$CountyBoundaryUrl
    boundaryVintage="2025-01-01"
    spatialRelation="esriSpatialRelWithin"
    rule="Strict spatial extracts contain only features wholly within the exact Posey County polygon."
  }
  files=$results
}
$mp=Join-Path $OutDir "download-receipt-v2.json"
$manifest|ConvertTo-Json -Depth 100|Set-Content $mp -Encoding utf8
Write-Host ("Receipt SHA-256: "+(Get-FileHash $mp -Algorithm SHA256).Hash.ToLowerInvariant())