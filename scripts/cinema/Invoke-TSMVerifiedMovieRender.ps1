# Unreal Engine 5.8 source-backed cinematic render on an authorized Windows GPU runner.
# Requires a real cooked/editor map, Sequencer LevelSequence, MRQ preset and validated TSMData.
# Never claims a film exists merely because Unreal returns exit code zero.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$UERoot,
    [string]$Project = "$PSScriptRoot\..\..\tsm-native\TSMNative.uproject",
    [Parameter(Mandatory=$true)][string]$DataRoot,
    [Parameter(Mandatory=$true)][string]$Manifest,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [string]$PythonExe = "python"
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $UERoot -ErrorAction Stop).Path
$project = (Resolve-Path -LiteralPath $Project -ErrorAction Stop).Path
$data = (Resolve-Path -LiteralPath $DataRoot -ErrorAction Stop).Path
$manifestPath = (Resolve-Path -LiteralPath $Manifest -ErrorAction Stop).Path
$editor = Join-Path $root 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
if (-not (Test-Path -LiteralPath $editor -PathType Leaf)) { throw 'Missing UnrealEditor-Cmd.exe (UE 5.8 Windows runner required)' }
$projectDir = Split-Path -Parent $project
$preflight = Join-Path $OutputDirectory 'preflight.json'
$log = Join-Path $OutputDirectory 'movie-render-queue.log'
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
if (Test-Path -LiteralPath $preflight) { throw 'Preflight file already exists, use a fresh output directory' }
& $PythonExe "$PSScriptRoot\validate_cinematic_production.py" --manifest $manifestPath --data-root $data --report $preflight
if ($LASTEXITCODE -ne 0) { throw 'Real-data cinematic preflight FAILED' }
$settings = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$report = Get-Content -LiteralPath $preflight -Raw | ConvertFrom-Json

# Preflight local UE asset presence. A valid name alone does not indicate a valid cinematic asset.
$map = Join-Path $projectDir 'Content\TSM\Maps\TSMNative.umap'
if (-not (Test-Path -LiteralPath $map -PathType Leaf)) { throw 'A real TSMNative.umap is missing' }
foreach ($property in @('sequence','preset')) {
    $assetName = [string]$settings.$property
    $rel = ($assetName.Split('.')[0] -replace '^/Game/', '') -replace '/', '\'
    $asset = Join-Path (Join-Path $projectDir 'Content') ($rel + '.uasset')
    if (-not (Test-Path -LiteralPath $asset -PathType Leaf)) {
        throw "Actual Unreal $property asset is missing: $asset"
    }
}
if ($report.expected_frames -lt (300 * $settings.fps)) { throw 'Five-minute minimum unmet' }
$args = @(
    $project, $settings.map, '-game',
    "-LevelSequence=$($settings.sequence)",
    "-MoviePipelineConfig=$($settings.preset)",
    '-windowed', "-resx=$($settings.resolution[0])", "-resy=$($settings.resolution[1])",
    '-log', "-abslog=$log", '-notexturestreaming', '-unattended', '-stdout', '-FullStdOutLogOutput'
)
& $editor @args
if ($LASTEXITCODE -ne 0) { throw "UE5.8 MRQ returned a nonzero exit code: $LASTEXITCODE" }

# The MRQ preset MUST be saved with PNG output directed to this run's frames folder
# and a stable sequential filename. An observed frame inventory is mandatory.
$framesDir = Join-Path $OutputDirectory 'frames'
if (-not (Test-Path -LiteralPath $framesDir -PathType Container)) {
    throw 'MRQ exited but no output frames directory was produced'
}
$frames = @(Get-ChildItem -LiteralPath $framesDir -Filter '*.png' -File)
if ($frames.Count -lt [int]$report.expected_frames) {
    throw "MRQ output incomplete: $($frames.Count) PNGs vs expected $($report.expected_frames)"
}
$inventory = [ordered]@{
    schema = 'tsm.cinematic.render-evidence.v1'
    state = 'FRAMES_PRESENT_NOT_INDEPENDENTLY_VISUALLY_VERIFIED'
    expected_frames = [int]$report.expected_frames
    observed_png_count = $frames.Count
    fps = [int]$settings.fps
    resolution = @([int]$settings.resolution[0], [int]$settings.resolution[1])
    project_file_sha256 = (Get-FileHash -LiteralPath $project -Algorithm SHA256).Hash.ToLowerInvariant()
    map_file_sha256 = (Get-FileHash -LiteralPath $map -Algorithm SHA256).Hash.ToLowerInvariant()
    source_preflight_sha256 = (Get-FileHash -LiteralPath $preflight -Algorithm SHA256).Hash.ToLowerInvariant()
    log_path = $log
    note = 'GPU-headed screenshots, source geography alignment, frame quality, water evidence and Windows Shipping verification require separate review.'
}
$receipt = Join-Path $OutputDirectory 'render-inventory.json'
if (Test-Path -LiteralPath $receipt) { throw 'Refusing to overwrite existing render receipt' }
$inventory | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $receipt -Encoding UTF8
Write-Host "MRQ_FRAME_RECEIPT=$receipt"
