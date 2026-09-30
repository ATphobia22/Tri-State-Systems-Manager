$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Runtime = Join-Path $Root "offline-runtime"
$NpmCache = Join-Path $Runtime "npm-cache"
$Wheelhouse = Join-Path $Runtime "python-wheels"

node "$Root/scripts/offline/doctor.mjs"

Push-Location (Join-Path $Root "tsm-console")
npm ci --offline --no-audit --no-fund --cache $NpmCache
Pop-Location

python -m pip install --no-index --find-links $Wheelhouse -r (Join-Path $Root "packages/hydraulics/python/requirements.txt")
python -m pip install --no-index --find-links $Wheelhouse -r (Join-Path $Root "backend/requirements.txt")

Write-Host "Offline dependency installation: PASS"
