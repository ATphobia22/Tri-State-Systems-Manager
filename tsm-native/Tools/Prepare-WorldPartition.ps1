<#
Creates no fake map or geodetic data. Requires a UE5.8-produced TSMRegion.umap
from Unreal Editor > File > New Level > Open World, saved under /Game/Maps.
#>
[CmdletBinding()]
param(
    [string]$EngineRoot = $env:UE_5_8_ROOT,
    [string]$MapPackage = '/Game/Maps/TSMRegion',
    [switch]$BuildHLODs,
    [switch]$AdoptAsDefaultMap
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Project = Join-Path $ProjectRoot 'TSMNative.uproject'
if (-not (Test-Path -LiteralPath $Project)) { throw "Missing Unreal project $Project" }
if ($MapPackage -notmatch '^/Game/[A-Za-z0-9_/]+$' -or $MapPackage.Contains('..')) {
    throw 'Unsafe World Partition map package path'
}
$Relative = $MapPackage.Substring(6).Replace('/', [IO.Path]::DirectorySeparatorChar)
$MapFile = Join-Path $ProjectRoot ('Content\' + $Relative + '.umap')
if (-not (Test-Path -LiteralPath $MapFile -PathType Leaf)) {
    throw "Missing native TSM partitioned map: $MapFile. Create it in UE5.8 Editor with File > New Level > Open World, and commit the generated map and external assets."
}
if ([string]::IsNullOrWhiteSpace($EngineRoot)) { throw 'Set UE_5_8_ROOT' }
$Editor = Join-Path $EngineRoot 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
if (-not (Test-Path -LiteralPath $Editor)) { throw "Unreal editor commandlet missing: $Editor" }
$ProjectInfo = Get-Content -LiteralPath $Project -Raw | ConvertFrom-Json
if ($ProjectInfo.EngineAssociation -ne '5.8') { throw 'EngineAssociation must be 5.8' }

if ($BuildHLODs) {
    & $Editor $Project $MapPackage '-run=WorldPartitionBuilderCommandlet' '-AllowCommandletRendering' '-builder=WorldPartitionHLODsBuilder' '-SCCProvider=None' '-unattended'
    if ($LASTEXITCODE -ne 0) { throw "World Partition HLOD build failed: $LASTEXITCODE" }
}
if ($AdoptAsDefaultMap) {
    if (-not $BuildHLODs) { throw 'Run a successful HLOD build before adopting the default map' }
    $Config = Join-Path $ProjectRoot 'Config\DefaultEngine.ini'
    $Text = Get-Content -LiteralPath $Config -Raw
    if ($Text -notmatch '(?m)^GameDefaultMap=' -or $Text -notmatch '(?m)^EditorStartupMap=') {
        throw 'DefaultEngine.ini lacks required map settings'
    }
    $Text = [regex]::Replace($Text, '(?m)^GameDefaultMap=.*$', "GameDefaultMap=$MapPackage")
    $Text = [regex]::Replace($Text, '(?m)^EditorStartupMap=.*$', "EditorStartupMap=$MapPackage")
    Set-Content -LiteralPath $Config -Value $Text -Encoding UTF8
    Write-Host "Default map set to $MapPackage. Review and commit its map and external actor assets."
}
Write-Host "TSM World Partition preparation finished: $MapPackage (HLODs=$BuildHLODs)."
