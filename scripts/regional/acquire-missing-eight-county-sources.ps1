[CmdletBinding()]
param([string]$OutRoot = ".\data\regional\missing-source-recovery",[string]$BoundaryRoot = ".\data\regional\boundaries")
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$OutRoot = (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force -Path $OutRoot)).Path
$BoundaryRoot = (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force -Path $BoundaryRoot)).Path
$Counties = @(@{State="IL";Fips="17193";Name="white"},@{State="KY";Fips="21101";Name="henderson"},@{State="KY";Fips="21225";Name="union"})
$Sources = @{
"17193"=@{Authority="White County, Illinois GIS parcel publication (EagleView-hosted service)";Url="https://arcgisserver.eagleview.com/arcgis/rest/services/WhiteCountyIlParcels2024/MapServer/0";Where="1=1";OutFields="FID,OBJECTID_1,PIN,Acreage,PIN2,Parcel_Num,City,Tax_Code,Site_Addre,Site_City_,Gross_Acre,Homesite_A,Farm_Acres,Property_C,Tax_Status,Zip,Document,Legal_Desc,Farm_Land,Farm_Build,Non_Farm_L,Non_Farm_B,Tax_Billed,Shape__Are,Shape__Len";Mode="id-chunk"}
"21101"=@{Authority="Henderson County GIS";Url="https://services.arcgis.com/Iwwqwcdc5CWG2jt9/arcgis/rest/services/Parcels/FeatureServer/0";Where="1=1";OutFields="FID,PIDN,ZONE_,ZONE_DESCR,LOCATION,ZONE_LOC,GIS_ACRES";Mode="boundary"}
}
function Invoke-ArcGisQuery {
param([string]$LayerUrl,[hashtable]$Body)
for($attempt=1;$attempt -le 6;$attempt++){
try{$response=Invoke-RestMethod -Method Post -Uri "$LayerUrl/query" -Body $Body -ContentType "application/x-www-form-urlencoded" -TimeoutSec 300;if($response.error){throw($response.error|ConvertTo-Json -Depth 20)};return $response}
catch{if($attempt -eq 6){throw};Start-Sleep -Seconds ([math]::Min(30,2*$attempt))}
}}
function Get-CountyBoundaryGeometry {
param([string]$Fips)
$county=@($Counties|Where-Object Fips -eq $Fips)[0]
$path=Join-Path $BoundaryRoot "$($county.State.ToLowerInvariant())-$Fips-$($county.Name).geojson"
if(-not(Test-Path $path)){throw "Missing exact TIGER county boundary: $path"}
$fc=Get-Content $path -Raw|ConvertFrom-Json
if(@($fc.features).Count -ne 1){throw "Boundary $path must contain exactly one Feature."}
if([string]$fc.features[0].properties.GEOID -ne $Fips){throw "Boundary $path GEOID does not equal $Fips."}
$geometry=$fc.features[0].geometry
if($geometry.type -ne "Polygon" -and $geometry.type -ne "MultiPolygon"){throw "Boundary $path must be Polygon or MultiPolygon."}
return $geometry
}
function ConvertTo-EsriGeometry {
param([object]$GeoJsonGeometry)
if($GeoJsonGeometry.type -eq "Polygon"){
  return [ordered]@{rings=@($GeoJsonGeometry.coordinates | ForEach-Object { ,@($_) })}
}
if($GeoJsonGeometry.type -eq "MultiPolygon"){
  $rings=[System.Collections.Generic.List[object]]::new()
  foreach($polygon in @($GeoJsonGeometry.coordinates)){
    foreach($ring in @($polygon)){ [void]$rings.Add(@($ring)) }
  }
  return [ordered]@{rings=$rings.ToArray()}
}
throw "Unsupported county geometry type: $($GeoJsonGeometry.type)"
}

function Get-ArcGisFeatures {
param([hashtable]$Source,[string]$Fips)
$metadata=Invoke-RestMethod -Method Get -Uri "$($Source.Url)?f=pjson" -TimeoutSec 120
if($metadata.error){throw($metadata.error|ConvertTo-Json -Depth 20)}
$pageSize=[int]$metadata.maxRecordCount;if($pageSize -lt 1){$pageSize=1000}
$supportsPagination=[bool]$metadata.advancedQueryCapabilities.supportsPagination
if($Source.Mode -eq "id-chunk"){
  $all=[System.Collections.Generic.List[object]]::new()
  $idUri="$($Source.Url)/query?where=$([uri]::EscapeDataString($Source.Where))&returnIdsOnly=true&f=json"
  $idResponse=Invoke-RestMethod -Method Get -Uri $idUri -TimeoutSec 300
  if($idResponse.error){throw($idResponse.error|ConvertTo-Json -Depth 20)}
  $objectIds=@($idResponse.objectIds|Sort-Object {[int64]$_})
  if($objectIds.Count -eq 0){throw "Required source returned zero object IDs for FIPS ${Fips}: $($Source.Url)"}
  Write-Host "Recovering $Fips from $($Source.Url): $($objectIds.Count) features"
  for($startIndex=0;$startIndex -lt $objectIds.Count;$startIndex+=100){
    $chunk=@($objectIds[$startIndex..([math]::Min($startIndex+99,$objectIds.Count-1))])
    $featureBody=@{objectIds=($chunk -join ",");outFields=$Source.OutFields;returnGeometry="true";outSR="4326";f="geojson"}
    $response=Invoke-ArcGisQuery -LayerUrl $Source.Url -Body $featureBody
    foreach($feature in @($response.features)){[void]$all.Add($feature)}
  }
  if($all.Count -ne $objectIds.Count){throw "Incomplete source recovery for FIPS ${Fips}: expected $($objectIds.Count), received $($all.Count)"}
  Write-Host "Recovered ${Fips}: $($all.Count) features"
  return $all.ToArray()
}
$boundaryGeometry=$null
if($Source.Mode -eq "boundary"){
  $boundaryGeometry=Get-CountyBoundaryGeometry -Fips $Fips
}
$body=@{where=$Source.Where;outFields=$Source.OutFields;returnGeometry="true";returnTrueCurves="false";outSR="4326";resultType="standard";f="geojson"}
if($Source.Mode -eq "boundary"){
  $body.geometry=(ConvertTo-EsriGeometry -GeoJsonGeometry $boundaryGeometry | ConvertTo-Json -Compress -Depth 100)
  $body.geometryType=if($boundaryGeometry.type -eq "MultiPolygon"){"esriGeometryMultipolygon"}else{"esriGeometryPolygon"}
  $body.inSR="4326";$body.spatialRel="esriSpatialRelIntersects"
}
$all=[System.Collections.Generic.List[object]]::new()
if($supportsPagination){
  $offset=0
  do{
    $pageBody=@{};foreach($key in $body.Keys){$pageBody[$key]=$body[$key]}
    $pageBody.resultOffset=$offset;$pageBody.resultRecordCount=$pageSize
    $response=Invoke-ArcGisQuery -LayerUrl $Source.Url -Body $pageBody
    $features=@($response.features)
    foreach($feature in $features){[void]$all.Add($feature)}
    if($features.Count -lt $pageSize){break}
    $offset+=$features.Count
  }while($true)
} else {
  # Older ArcGIS services may not expose offset pagination. Keep ID chunks
  # deliberately small because hosted map services can reject large ID lists.
  $pageSize=[math]::Min($pageSize,100)
  # Older ArcGIS services may not expose offset pagination. Resolve object IDs
  # first, then query deterministic ID chunks so county-wide sources are complete.
  $idBody=@{};foreach($key in $body.Keys){$idBody[$key]=$body[$key]}
  $idBody.returnGeometry="false";$idBody.returnIdsOnly="true";$idBody.outFields="OBJECTID"
  $idResponse=Invoke-ArcGisQuery -LayerUrl $Source.Url -Body $idBody
  $objectIds=@($idResponse.objectIds|Sort-Object {[int64]$_})
  if($objectIds.Count -eq 0){throw "Required source returned zero object IDs for FIPS ${Fips}: $($Source.Url)"}
  for($startIndex=0;$startIndex -lt $objectIds.Count;$startIndex+=$pageSize){
    $chunk=@($objectIds[$startIndex..([math]::Min($startIndex+$pageSize-1,$objectIds.Count-1))])
    $pageBody=@{};foreach($key in $body.Keys){$pageBody[$key]=$body[$key]}
    $pageBody.objectIds=($chunk -join ",")
    $pageBody.where="1=1"
    $response=Invoke-ArcGisQuery -LayerUrl $Source.Url -Body $pageBody
    foreach($feature in @($response.features)){[void]$all.Add($feature)}
  }
}
if($all.Count -eq 0){throw "Required source returned zero features for FIPS ${Fips}: $($Source.Url)"}
return $all.ToArray()
}

function Write-Receipt {
param([string]$Id,[string]$CountyFips,[string]$Authority,[string]$SourceUrl,[string]$Path,[int]$FeatureCount,[string]$SpatialRelation)
$file=Get-Item $Path
[ordered]@{id=$Id;countyFips=$CountyFips;authority=$Authority;sourceUrl=$SourceUrl;path=$Path.Replace("\","/");retrievedAt=(Get-Date).ToUniversalTime().ToString("o");bytes=$file.Length;sha256=(Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant();featureCount=$FeatureCount;spatialRelation=$SpatialRelation;status="acquired"}
}
$receipts=[System.Collections.Generic.List[object]]::new()
foreach($county in $Counties){
$source=$Sources[$county.Fips]
if(-not $source){
  Write-Host "SKIP parcels for $($county.Fips) ($($county.Name) County): no public parcel source (documented gap, see MISSING.md)"
  continue
}
$features=Get-ArcGisFeatures -Source $source -Fips $county.Fips
$relative="$($county.State.ToLowerInvariant())-$($county.Name)-$($county.Fips)/parcels/$($county.Fips)-parcels.geojson"
$target=Join-Path $OutRoot $relative
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target)|Out-Null
[ordered]@{type="FeatureCollection";source=$source.Url;sourceAuthority=$source.Authority;countyFips=$county.Fips;state=$county.State;boundaryGEOID=$county.Fips;boundarySource="US_CENSUS_BUREAU_TIGER_LINE";boundaryPolicy=if($source.Mode -eq "boundary"){"exact-county-within-tiger-boundary"}else{"exact-county-attribute"};spatialRelation=if($source.Mode -eq "boundary"){"exact-county-within-tiger-boundary"}else{"exact-county-attribute"};retrievedAt=(Get-Date).ToUniversalTime().ToString("o");privacyPolicy="Only public parcel identifiers and non-owner spatial attributes are retained; owner and mailing fields are not requested.";features=$features}|ConvertTo-Json -Depth 100|Set-Content -LiteralPath $target -Encoding utf8
if($source.Mode -eq "boundary"){
  $boundaryPath=Join-Path $BoundaryRoot "$($county.State.ToLowerInvariant())-$($county.Fips)-$($county.Name).geojson"
  python .\scripts\geo\clip-geojson-to-county-boundary.py --geojson $target --boundary $boundaryPath
  $features=(Get-Content $target -Raw|ConvertFrom-Json).features
}
$parcelSpatialRelation = if($source.Mode -eq "boundary"){"exact-county-within-tiger-boundary"}else{"exact-county-attribute"}
[void]$receipts.Add((Write-Receipt -Id "$($county.Fips)-parcels-recovery" -CountyFips $county.Fips -Authority $source.Authority -SourceUrl $source.Url -Path $target -FeatureCount $features.Count -SpatialRelation $parcelSpatialRelation))
}
$femaUrl="https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28"
$femaWhere="DFIRM_ID LIKE '21225%'"
$femaFields="DFIRM_ID,FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,DEPTH"
# FEMA NFHL returns HTTP 500 on a single full-geometry county query; resolve
# object IDs first (fast), then fetch geometry in small chunks.
$femaIdBody=@{where=$femaWhere;returnIdsOnly="true";f="json"}
$femaIdResponse=Invoke-ArcGisQuery -LayerUrl $femaUrl -Body $femaIdBody
$femaObjectIds=@($femaIdResponse.objectIds | Sort-Object {[int64]$_})
if($femaObjectIds.Count -eq 0){throw "Direct FEMA NFHL layer 28 returned zero object IDs for DFIRM_ID 21225."}
Write-Host "Recovering FEMA NFHL 21225: $($femaObjectIds.Count) features"
$femaList=[System.Collections.Generic.List[object]]::new()
$chunkSize=25
for($startIndex=0;$startIndex -lt $femaObjectIds.Count;$startIndex+=$chunkSize){
  $chunk=@($femaObjectIds[$startIndex..([math]::Min($startIndex+$chunkSize-1,$femaObjectIds.Count-1))])
  $femaBody=@{objectIds=($chunk -join ",");outFields=$femaFields;returnGeometry="true";outSR="4326";geometryPrecision=5;maxAllowableOffset=0.00001;resultType="standard";f="geojson"}
  $chunkDone=$false
  for($femaAttempt=1;$femaAttempt -le 12 -and -not $chunkDone;$femaAttempt++){
    try{
      $femaResponse=Invoke-ArcGisQuery -LayerUrl $femaUrl -Body $femaBody
      foreach($feature in @($femaResponse.features)){[void]$femaList.Add($feature)}
      $chunkDone=$true
    }catch{
      if($femaAttempt -eq 12){throw}
      $wait=[math]::Min(120,10*$femaAttempt)
      Write-Host "FEMA chunk $($startIndex+1)-$([math]::Min($startIndex+$chunkSize,$femaObjectIds.Count)) failed (attempt $femaAttempt/12); waiting ${wait}s"
      Start-Sleep -Seconds $wait
    }
  }
  Write-Host "FEMA NFHL progress: $($femaList.Count)/$($femaObjectIds.Count) features"
  Start-Sleep -Seconds 5
}
$femaFeatures=$femaList.ToArray()
if($femaFeatures.Count -eq 0){throw "Direct FEMA NFHL layer 28 returned zero features for DFIRM_ID 21225."}
Write-Host "Recovered FEMA NFHL 21225: $($femaFeatures.Count) features"
$femaRelative="ky-union-21225/floodplain/fema-nfhl-21225.geojson"
$femaTarget=Join-Path $OutRoot $femaRelative
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $femaTarget)|Out-Null
[ordered]@{type="FeatureCollection";source=$femaUrl;sourceAuthority="FEMA effective NFHL";countyFips="21225";dfirmPrefix="21225";retrievedAt=(Get-Date).ToUniversalTime().ToString("o");boundaryGEOID="21225";boundarySource="US_CENSUS_BUREAU_TIGER_LINE";spatialRelation="exact-county-attribute";authorityWarning="Direct FEMA NFHL source. Do not relabel as preliminary, pending, state BAFM, or derived mirror.";features=$femaFeatures}|ConvertTo-Json -Depth 100|Set-Content -LiteralPath $femaTarget -Encoding utf8
[void]$receipts.Add((Write-Receipt -Id "21225-fema-nfhl-recovery" -CountyFips "21225" -Authority "FEMA effective NFHL" -SourceUrl $femaUrl -Path $femaTarget -FeatureCount $femaFeatures.Count -SpatialRelation "exact-county-attribute"))
$manifest=[ordered]@{schema="tsm-missing-source-recovery-v1";generatedAt=(Get-Date).ToUniversalTime().ToString("o");sourcePolicy="official-county-or-federal-source-first";counties=$Counties;receipts=$receipts;unresolved=@(
@{id="nfhl-flood-zones-17059-size-mismatch";status="requires-offline-bundle-reconciliation";reason="External 11.2 GB bundle required before bytes/SHA-256 can be reconciled."},
@{id="nfhl-flood-zones-21101-size-mismatch";status="requires-offline-bundle-reconciliation";reason="External 11.2 GB bundle required before bytes/SHA-256 can be reconciled."}
)}
$manifestPath=Join-Path $OutRoot "recovery-manifest.json";$manifest|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $manifestPath -Encoding utf8
$hashPath=Join-Path $OutRoot "SHA256SUMS";$lines=@()
Get-ChildItem -LiteralPath $OutRoot -Recurse -File|Where-Object{$_.FullName -ne $hashPath}|Sort-Object FullName|ForEach-Object{$relative=$_.FullName.Substring($OutRoot.Length+1).Replace("\","/");$hash=(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant();$lines+="$hash  $relative"}
$lines|Set-Content -LiteralPath $hashPath -Encoding utf8
Write-Host "RECOVERY ACQUISITION COMPLETE: $($receipts.Count) artifacts."
