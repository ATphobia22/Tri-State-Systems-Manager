[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$UnrealRoot,
    [string]$ProjectFile = "$PSScriptRoot\..\..\tsm-native\TSMNative.uproject",
    [string]$TilesetPath = $env:TSM_LOCAL_TILESET
)
$ErrorActionPreference = "Stop"
$project = (Resolve-Path -LiteralPath $ProjectFile).Path
$root = (Resolve-Path -LiteralPath $UnrealRoot).Path
$editorBuild = Join-Path $root 'Engine\Build\BatchFiles\Build.bat'
$editorCmd = Join-Path $root 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
$script = (Resolve-Path -LiteralPath "$PSScriptRoot\..\..\tsm-native\Content\Python\tsm_generate_native_map.py").Path
if (-not (Test-Path -LiteralPath $editorBuild -PathType Leaf)) { throw "UE Build.bat absent" }
if (-not (Test-Path -LiteralPath $editorCmd -PathType Leaf)) { throw "UE UnrealEditor-Cmd.exe absent" }
if ([string]::IsNullOrWhiteSpace($TilesetPath) -or -not (Test-Path -LiteralPath $TilesetPath -PathType Leaf)) {
    throw "TSM_LOCAL_TILESET must point to a verified local tileset.json inside staged TSMData."
}
$env:TSM_LOCAL_TILESET = (Resolve-Path -LiteralPath $TilesetPath).Path
& $editorBuild TSMNativeEditor Win64 Development "-Project=$project" -WaitMutex
if ($LASTEXITCODE -ne 0) { throw "TSMNativeEditor compilation failed: $LASTEXITCODE" }
& $editorCmd $project '-run=pythonscript' "-script=$script" -unattended -nosplash -stdout -FullStdOutLogOutput
if ($LASTEXITCODE -ne 0) { throw "Native map generation failed: $LASTEXITCODE" }
$map = Join-Path (Split-Path $project -Parent) "Content\TSM\Maps\TSMNative.umap"
if (-not (Test-Path -LiteralPath $map -PathType Leaf) -or (Get-Item -LiteralPath $map).Length -le 0) {
    throw "No real generated TSMNative.umap on disk. Refusing Windows Shipping."
}
Write-Host "TSM native World Partition map generated and checked at $map"
