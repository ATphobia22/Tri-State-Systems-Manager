[CmdletBinding()]
param([string]$OutDir = ".\data\posey-county\offline\2026-09-30")
$ErrorActionPreference="Stop"
$ProgressPreference="SilentlyContinue"
$OutDir=(Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force -Path $OutDir)).Path
function Save-Url([string]$Url,[string]$Path){
  $full=Join-Path $OutDir $Path
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $full)|Out-Null
  Invoke-WebRequest -Uri $Url -OutFile $full -UseBasicParsing
  [pscustomobject]@{path=$Path;url=$Url;sha256=(Get-FileHash $full -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item $full).Length}
}
function Save-ArcGisPaged([string]$Url,[string]$Where,[string]$Name){
  $all=@();$offset=0;$size=1900
  do{
    $q="$Url/query?where=$([uri]::EscapeDataString($Where))&outFields=*&returnGeometry=true&outSR=4326&resultOffset=$offset&resultRecordCount=$size&f=json"
    $r=Invoke-RestMethod $q
    if($r.error){throw ($r.error|ConvertTo-Json -Depth 10)}
    $all+=@($r.features);$got=@($r.features).Count;$offset+=$got
  }while($got -gt 0 -and $got -eq $size)
  $path=Join-Path $OutDir $Name
  [ordered]@{type="FeatureCollection";source=$Url;where=$Where;retrievedAt=(Get-Date).ToUniversalTime().ToString("o");features=$all}|ConvertTo-Json -Depth 100|Set-Content $path -Encoding utf8
  [pscustomobject]@{path=$Name;url=$Url;where=$Where;sha256=(Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item $path).Length;featureCount=$all.Count}
}
$results=@()
$results+=Save-ArcGisPaged "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/3" "DFIRM_ID='18129C'" "fema\effective-firm-panels-18129C.json"
$env="-88.10,37.77,-87.62,38.26"
$results+=Save-Url "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=$([uri]::EscapeDataString($env))&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&f=geojson" "fema\effective-flood-hazard-zones-posey.geojson"
$results+=Save-Url "https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer/438/query?geometry=$([uri]::EscapeDataString($env))&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&f=geojson" "indiana-dnr\bafm-posey.geojson"
$results+=Save-ArcGisPaged "https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0" "county_fips='18129'" "indiana-gio\parcel-boundaries-2025-posey.json"
$results+=Save-Url "https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer?f=pjson" "indiana-gio\current-imagery-service.json"
$results+=Save-Url "https://gisdata.in.gov/server/rest/services/Hosted/Orthoimagery_Tier_Map_2025_2028/FeatureServer/10/query?where=name%3D%27Posey%27&outFields=*&returnGeometry=true&outSR=4326&f=geojson" "indiana-gio\posey-ortho-tier-2025-2028.geojson"
$results+=Save-Url "https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer/16/query?geometry=$([uri]::EscapeDataString($env))&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&f=geojson" "usace-nld\leveed-areas-posey.geojson"
$results+=Save-Url "https://levees.sec.usace.army.mil/data-services/services/" "usace-nld\service-catalog.html"
$results+=Save-Url "https://waterservices.usgs.gov/nwis/dv/?format=rdb&sites=03378500&startDT=1900-01-01&endDT=2026-09-30&statCd=00003" "usgs\03378500-daily-mean-history.rdb"
$results+=Save-Url "https://waterservices.usgs.gov/nwis/site/?format=rdb&sites=03378500&siteOutput=expanded" "usgs\03378500-site-metadata.rdb"
$study=@("https://pubs.usgs.gov/sir/2016/5119/sir20165119.pdf","https://pubs.usgs.gov/sir/2016/5119/downloads/metadata_depth_grids.pdf","https://pubs.usgs.gov/sir/2016/5119/downloads/metadata_shapefile.pdf","https://pubs.usgs.gov/sir/2016/5119/downloads/00Readme.pdf","https://pubs.usgs.gov/sir/2016/5119/downloads/depth_grids.zip","https://pubs.usgs.gov/sir/2016/5119/downloads/shapefiles.zip")
foreach($u in $study){$leaf=Split-Path ([uri]$u).AbsolutePath -Leaf;$results+=Save-Url $u ("usgs\sir20165119\"+$leaf)}
$results+=Save-Url "https://www.fisheries.noaa.gov/inport/item/69202" "usgs-lidar\noaa-inport-69202.html"
foreach($b in @("B1","B2","B3","B4","B5","B6")){$u="https://s3-us-west-2.amazonaws.com/usgs-lidar-public/IN_Statewide_Opt2_\${b}_2017/ept.json";$results+=Save-Url $u ("usgs-lidar\ept\"+$b+".json")}
$results+=Save-Url "https://tnmaccess.nationalmap.gov/api/v1/products?bbox=-88.10,37.77,-87.62,38.26&datasets=Lidar%20Point%20Cloud%20(LPC)&prodFormats=LAZ&max=1000" "usgs-lidar\3dep-posey-product-index.json"
$manifest=[ordered]@{schema="tsm-posey-offline-download-receipt-v1";retrievedAt=(Get-Date).ToUniversalTime().ToString("o");countyFips="18129";files=$results;note="Large current 3DEP and imagery products are represented by exact official product indexes/service metadata unless a bounded raw extraction is practical."}
$mp=Join-Path $OutDir "download-receipt-v1.json"
$manifest|ConvertTo-Json -Depth 100|Set-Content $mp -Encoding utf8
Write-Host ("Receipt SHA-256: "+(Get-FileHash $mp -Algorithm SHA256).Hash.ToLowerInvariant())