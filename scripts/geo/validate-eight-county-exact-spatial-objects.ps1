[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Root,
  [Parameter(Mandatory=$true)][string]$BoundaryRoot
)
$ErrorActionPreference="Stop"
$cfg=Get-Content ".\data\regional\eight-county-exact-spatial-validation-v1.json" -Raw | ConvertFrom-Json
$failures=[System.Collections.Generic.List[string]]::new()
$checked=0
foreach($c in $cfg.counties){
  $boundary=Join-Path $BoundaryRoot "$($c.state.ToLowerInvariant())-$($c.fips)-$($c.name.ToLowerInvariant().Replace(' county','').Replace(' ','-')).geojson"
  if(-not(Test-Path $boundary)){
    $failures.Add("$($c.name): missing exact county boundary artifact: $boundary"); continue
  }
  $b=Get-Content $boundary -Raw | ConvertFrom-Json
  if(@($b.features).Count -ne 1 -or [string]$b.features[0].properties.GEOID -ne $c.geoid){
    $failures.Add("$($c.name): boundary GEOID mismatch"); continue
  }
  $files=Get-ChildItem -Path (Join-Path $Root "$($c.state.ToLowerInvariant())-$($c.fips)") -Recurse -File -ErrorAction SilentlyContinue
  foreach($f in $files){
    if($f.Name -match '\\.(geojson|json)$'){
      try{$o=Get-Content $f.FullName -Raw | ConvertFrom-Json}catch{continue}
      if($o.type -eq "FeatureCollection"){
        $checked++
        if([string]::IsNullOrWhiteSpace([string]$o.boundaryGEOID) -or [string]$o.boundaryGEOID -ne $c.geoid){$failures.Add("$($c.name): $($f.FullName): missing/wrong boundaryGEOID")}
        if([string]$o.spatialRelation -notin @("within","intersects","exact-county-attribute","exact-county-clip")){$failures.Add("$($c.name): $($f.FullName): invalid spatialRelation")}
        if([string]$o.spatialRelation -eq "bbox"){$failures.Add("$($c.name): $($f.FullName): bounding-box-only extraction rejected")}
      }
    }
  }
}
if($failures.Count){$failures|%{Write-Error $_};throw "Exact-county validation failed: $($failures.Count) error(s)."}
[ordered]@{schema="tsm-eight-county-exact-spatial-validation-result-v1";validatedAt=(Get-Date).ToUniversalTime().ToString("o");checkedFeatureCollections=$checked;status="validated"}|ConvertTo-Json|Set-Content (Join-Path $Root "eight-county-exact-spatial-validation.json") -Encoding utf8
Write-Host "Eight-county exact spatial validation: PASS"
