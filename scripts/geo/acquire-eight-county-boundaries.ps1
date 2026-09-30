[CmdletBinding()]
param([string]$OutRoot=".\data\regional\boundaries")
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
 @{state="KY";fips="21225";geoid="21225";name="union"}
)
New-Item -ItemType Directory -Force -Path $OutRoot|Out-Null
foreach($c in $counties){
  $path=Join-Path $OutRoot "$($c.state.ToLowerInvariant())-$($c.fips)-$($c.name).geojson"
  $params="where=GEOID%3D%27$($c.geoid)%27&outFields=GEOID%2CNAME%2CSTATEFP%2CCOUNTYFP&returnGeometry=true&outSR=4326&f=geojson"
  Invoke-WebRequest -Uri ($base + "?" + $params) -OutFile $path -UseBasicParsing
  $o=Get-Content $path -Raw|ConvertFrom-Json
  if(@($o.features).Count -ne 1 -or [string]$o.features[0].properties.GEOID -ne $c.geoid){throw "Boundary validation failed for $($c.name), $($c.state)"}
  if((Get-Item $path).Length -le 0){throw "Zero-byte boundary: $path"}
  Write-Host "Exact boundary acquired: $($c.state) $($c.fips) SHA256 $((Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant())"
}
