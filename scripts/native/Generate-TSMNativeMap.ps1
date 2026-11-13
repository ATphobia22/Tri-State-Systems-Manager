[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$UnrealRoot,
    [string]$ProjectFile = "$PSScriptRoot\..\..\tsm-native\TSMNative.uproject",
    [string]$TilesetPath = $env:TSM_LOCAL_TILESET,
    [string]$TerrainTilesetPath = $env:TSM_LOCAL_TERRAIN_TILESET,
    [string]$RoadsTilesetPath = $env:TSM_LOCAL_ROADS_TILESET
)
$ErrorActionPreference = "Stop"
$project = (Resolve-Path -LiteralPath $ProjectFile).Path
$root = (Resolve-Path -LiteralPath $UnrealRoot).Path
$editorBuild = Join-Path $root 'Engine\Build\BatchFiles\Build.bat'
$editorCmd = Join-Path $root 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
$script = (Resolve-Path -LiteralPath "$PSScriptRoot\..\..\tsm-native\Content\Python\tsm_generate_native_map.py").Path
if (-not (Test-Path -LiteralPath $editorBuild -PathType Leaf)) { throw "UE Build.bat absent" }
if (-not (Test-Path -LiteralPath $editorCmd -PathType Leaf)) { throw "UE UnrealEditor-Cmd.exe absent" }
if ([string]::IsNullOrWhiteSpace($TilesetPath)) {
    throw "TSM_LOCAL_TILESET must be a relative tileset.json path inside staged TSMData."
}
$staged = (Resolve-Path -LiteralPath (Join-Path (Split-Path $project -Parent) 'Content\\TSMData')).Path
function Resolve-AuditedTileset([string]$Selected, [string]$Kind) {
    if ([string]::IsNullOrWhiteSpace($Selected)) {
        throw "TSM $Kind requires a local tileset.json in verified Content/TSMData."
    }
    $candidate = if ([IO.Path]::IsPathRooted($Selected)) { $Selected } else { Join-Path $staged $Selected }
    $resolved = (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) { throw "Missing $Kind local 3D Tiles index." }
    if ([IO.Path]::GetFileName($resolved) -ne 'tileset.json') { throw "$Kind entry must be tileset.json" }
    $rootPrefix = $staged.TrimEnd('\\','/') + [IO.Path]::DirectorySeparatorChar
    if (-not $resolved.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Kind tileset escapes the hash-verified staged data root."
    }
    return $resolved
}
$env:TSM_LOCAL_TILESET = Resolve-AuditedTileset $TilesetPath 'Buildings'
$env:TSM_LOCAL_TERRAIN_TILESET = Resolve-AuditedTileset $TerrainTilesetPath 'Terrain'
if ($env:TSM_LOCAL_TILESET -eq $env:TSM_LOCAL_TERRAIN_TILESET) {
    throw 'Buildings and terrain may not share a tileset source.'
}
if (-not [string]::IsNullOrWhiteSpace($RoadsTilesetPath)) {
    $env:TSM_LOCAL_ROADS_TILESET = Resolve-AuditedTileset $RoadsTilesetPath 'Roads'
} else {
    Remove-Item Env:TSM_LOCAL_ROADS_TILESET -ErrorAction SilentlyContinue
}
# Reject network-dependent, missing or unsafe staged Cesium content before authoring the map.
$auditor = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'audit_local_3d_tiles.py')).Path
$pythonExe = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonExe) { throw 'Python is required for offline staged 3D Tiles content verification.' }
$reportRoot = Join-Path $PSScriptRoot '..\..\dist\evidence'
New-Item -Path $reportRoot -ItemType Directory -Force | Out-Null
$tileInputs = @(
    @{ Name = 'buildings'; Tileset = $env:TSM_LOCAL_TILESET },
    @{ Name = 'terrain'; Tileset = $env:TSM_LOCAL_TERRAIN_TILESET }
)
if ($env:TSM_LOCAL_ROADS_TILESET) { $tileInputs += @{ Name = 'roads'; Tileset = $env:TSM_LOCAL_ROADS_TILESET } }
foreach ($item in $tileInputs) {
    $report = Join-Path $reportRoot ("native-" + $item.Name + "-tiles-static-audit.json")
    & $pythonExe.Source $auditor --root $staged --tileset $item.Tileset --output $report
    if ($LASTEXITCODE -ne 0) { throw ("Local " + $item.Name + " 3D Tiles content reference audit failed.") }
}
& $editorBuild TSMNativeEditor Win64 Development "-Project=$project" -WaitMutex
if ($LASTEXITCODE -ne 0) { throw "TSMNativeEditor compilation failed: $LASTEXITCODE" }
# Full Editor scripting waits for level/editor subsystems; commandlet mode may not
# expose World Partition authoring and EditorActorSubsystem reliably.
& $editorCmd $project "-ExecutePythonScript=$script" -unattended -nosplash -stdout -FullStdOutLogOutput
if ($LASTEXITCODE -ne 0) { throw "Native map generation failed: $LASTEXITCODE" }
$map = Join-Path (Split-Path $project -Parent) "Content\TSM\Maps\TSMNative.umap"
if (-not (Test-Path -LiteralPath $map -PathType Leaf) -or (Get-Item -LiteralPath $map).Length -le 0) {
    throw "No real generated TSMNative.umap on disk. Refusing Windows Shipping."
}
Write-Host "TSM native World Partition map generated and checked at $map"
