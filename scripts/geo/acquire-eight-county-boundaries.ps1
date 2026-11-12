[CmdletBinding()]
param([string]$OutRoot=".\data\regional\boundaries", [ValidateSet("community-six","engineering-eight","combined-nine")][string]$Scope="engineering-eight")
$ErrorActionPreference="Stop"
$base="https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2026/MapServer/82/query"
$counties=@(
 @{state="IN";fips="18129";geoid="18129";name="posey"},
 @{state="IN";fips="18163";geoid="18163";name="vanderburgh"},
 @{state="IN";fips="18051";geoid="18051";name="gibson"},
 @{state="IN";fips="18173";geoid="18173";name="warrick"},
 @{state="IL";fips="17193";geoid="17193";name="white"},
 @{state="IL";fips="17059";geoid="17059";name="gallatin"},
 @{state="KY";fips="21101";geoid="21101";name="henderson"},
 @{state="KY";fips="21225";geoid="21225";name="union"},
 @{state="IL";fips="17185";geoid="17185";name="wabash"}
)
$scopeFips = switch ($Scope) {
  "community-six" { @("18129","21101","21225","17193","17185","17059") }
  "engineering-eight" { @("18129","18163","18051","18173","17193","17059","21101","21225") }
  "combined-nine" { @("18129","21101","21225","17193","17185","17059","18163","18051","18173") }
}
$counties = @($counties | Where-Object { $_.fips -in $scopeFips })
if ($counties.Count -ne $scopeFips.Count) { throw "County scope selection is incomplete" }
Write-Host "TIGER_SCOPE=$Scope counties=$($counties.Count)"
New-Item -ItemType Directory -Force -Path $OutRoot|Out-Null
foreach($c in $counties){
  $path=Join-Path $OutRoot "$($c.state.ToLowerInvariant())-$($c.fips)-$($c.name).geojson"
  $query=@{where="GEOID='$($c.geoid)'";outFields="*";returnGeometry="true";outSR="4326";f="geojson"}
  $o=Invoke-RestMethod -Uri $base -Method Get -Body $query
  if($null -ne $o.error){throw "TIGERweb query failed for $($c.name), $($c.state): $($o.error.message)"}
  if($null -eq $o.features -or @($o.features).Count -ne 1 -or [string]$o.features[0].properties.GEOID -ne $c.geoid){throw "Boundary validation failed for $($c.name), $($c.state): expected one GEOID $($c.geoid)"}
  $o|ConvertTo-Json -Depth 100|Set-Content $path -Encoding utf8
  if((Get-Item $path).Length -le 0){throw "Zero-byte boundary: $path"}
  Write-Host "Exact boundary acquired: $($c.state) $($c.fips) SHA256 $((Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant())"
}
