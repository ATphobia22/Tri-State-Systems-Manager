[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Bundle
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BundlePath = (Resolve-Path $Bundle).Path
$Runtime = Join-Path $Root "offline-runtime"
$Stage = Join-Path $env:TEMP ("tsm-offline-" + [guid]::NewGuid().ToString("N"))
$Expected = "375598165e8247b6e342696c9fdad561ac31a6142560908830a3447ec1f504a4"

try {
  $actual = (Get-FileHash -Algorithm SHA256 $BundlePath).Hash.ToLowerInvariant()
  if ($actual -ne $Expected) { throw "Bundle SHA-256 mismatch. Expected $Expected; got $actual." }

  New-Item -ItemType Directory -Force -Path $Stage | Out-Null
  Expand-Archive -LiteralPath $BundlePath -DestinationPath $Stage -Force

  $tar = Get-ChildItem $Stage -Filter "*.tar.gz" -File | Select-Object -First 1
  if ($null -eq $tar) { throw "Offline runtime tarball was not found in the bundle." }

  if (Test-Path $Runtime) { Remove-Item $Runtime -Recurse -Force }
  tar -xzf $tar.FullName -C $Root

  if (-not (Test-Path (Join-Path $Runtime "manifests/runtime-manifest.json"))) {
    throw "Installed runtime manifest is missing."
  }

  node (Join-Path $Root "scripts/offline/doctor.mjs")
  Write-Host "TSM offline runtime integrated: PASS"
  Write-Host "Runtime root: $Runtime"
}
finally {
  if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
}
