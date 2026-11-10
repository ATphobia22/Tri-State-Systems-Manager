[CmdletBinding()]
param(
    [string]$RepoRoot = 'C:\Tri-State-Systems-Manager',
    [string]$UnrealRoot = $env:UE_ROOT,
    [string]$NativeDataRoot = $env:TSM_NATIVE_DATA_ROOT,
    [string]$LocalTileset = $env:TSM_LOCAL_TILESET,
    [string]$SpatialiteDll = $env:TSM_SPATIALITE_DLL,
    [string]$OutputPath = ''
)
$ErrorActionPreference = 'Stop'
$checks = [System.Collections.Generic.List[object]]::new()
function Add-Check([string]$Name, [bool]$Pass, [string]$Detail, [string]$Category) {
    $checks.Add([ordered]@{ name=$Name; pass=$Pass; detail=$Detail; category=$Category })
}
function Find-Tool([string]$Name) {
    $c = Get-Command $Name -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    return ''
}
function Is-File([string]$Path) {
    return (-not [string]::IsNullOrWhiteSpace($Path)) -and (Test-Path -LiteralPath $Path -PathType Leaf)
}
function Is-Dir([string]$Path) {
    return (-not [string]::IsNullOrWhiteSpace($Path)) -and (Test-Path -LiteralPath $Path -PathType Container)
}
$rootOk = Is-Dir $RepoRoot
if (-not $rootOk) { throw "Source directory not found: $RepoRoot" }
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
if (-not $UnrealRoot) {
    $candidate = 'C:\Program Files\Epic Games\UE_5.8'
    if (Is-Dir $candidate) { $UnrealRoot = $candidate }
}
$ueVersionFile = if (Is-Dir $UnrealRoot) { Join-Path $UnrealRoot 'Engine\Build\Build.version' } else { '' }
$ueVersionOk = $false
if (Is-File $ueVersionFile) {
    try {
        $v = Get-Content -LiteralPath $ueVersionFile -Raw | ConvertFrom-Json
        $ueVersionOk = ($v.MajorVersion -eq 5 -and $v.MinorVersion -eq 8)
    } catch { $ueVersionOk = $false }
}
Add-Check 'UE 5.8 installed' $ueVersionOk "UE_ROOT=$UnrealRoot" 'engine'
$uat = if ($UnrealRoot) { Join-Path $UnrealRoot 'Engine\Build\BatchFiles\RunUAT.bat' } else { '' }
Add-Check 'Unreal Automation Tool' (Is-File $uat) $uat 'engine'
$editor = if ($UnrealRoot) { Join-Path $UnrealRoot 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe' } else { '' }
Add-Check 'Unreal Editor CLI' (Is-File $editor) $editor 'engine'
$cesium = if ($UnrealRoot) { Join-Path $UnrealRoot 'Engine\Plugins\Marketplace\CesiumForUnreal\CesiumForUnreal.uplugin' } else { '' }
$cesiumValid = $false
if (Is-File $cesium) {
    try { $cesiumValid = ((Get-Content -LiteralPath $cesium -Raw | ConvertFrom-Json).VersionName -ceq '2.29.1') } catch {}
}
Add-Check 'Cesium for Unreal 2.29.1' $cesiumValid $cesium 'engine'
foreach ($name in @('git','node','cmake','ninja','ISCC.exe','signtool.exe','rclone','gh')) {
    $found = Find-Tool $name
    Add-Check $name ([bool]$found) $found 'toolchain'
}
$project = Join-Path $RepoRoot 'tsm-native\TSMNative.uproject'
Add-Check 'Unreal project file' (Is-File $project) $project 'source'
$head = ''
$git = Find-Tool 'git'
if ($git) {
    $head = (& $git -C $RepoRoot rev-parse HEAD 2>$null | Select-Object -First 1)
    if ($LASTEXITCODE -ne 0) { $head = '' }
}
Add-Check 'Immutable Git checkout SHA' ([bool]($head -match '^[a-fA-F0-9]{40}$')) "SHA=$head" 'source'
$requiredScript = Join-Path $RepoRoot 'scripts\native\Build-TSMNativeWindows.ps1'
Add-Check 'Windows native builder present' (Is-File $requiredScript) $requiredScript 'source'
$manifest = if ($NativeDataRoot) { Join-Path $NativeDataRoot 'data-manifest.json' } else { '' }
Add-Check 'Native data manifest present' (Is-File $manifest) $manifest 'data'
$tilePath = ''
if ($LocalTileset) {
    if ([System.IO.Path]::IsPathRooted($LocalTileset)) { $tilePath = $LocalTileset }
    elseif ($NativeDataRoot) { $tilePath = Join-Path $NativeDataRoot $LocalTileset }
}
$tileOk = (Is-File $tilePath) -and ([IO.Path]::GetFileName($tilePath) -eq 'tileset.json')
Add-Check 'Local tileset.json present' $tileOk $tilePath 'data'
Add-Check 'SpatiaLite DLL present' (Is-File $SpatialiteDll) $SpatialiteDll 'data'
$signingThumbprint = [bool]$env:TSM_WINDOWS_SIGNING_CERT_SHA1
Add-Check 'Windows signing certificate thumbprint configured' $signingThumbprint 'Secret not printed' 'signing'
Add-Check 'Timestamp URL configured' ([bool]$env:TSM_WINDOWS_TIMESTAMP_URL) 'Value not printed' 'signing'
$buildReady = -not @($checks | Where-Object { -not $_.pass -and $_.name -notin @('rclone','gh') }).Count
$dataReady = -not @($checks | Where-Object { $_.category -eq 'data' -and -not $_.pass }).Count
$report = [ordered]@{
    schema = 'tsm.windows11.native-runner-preflight.v1'
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    repository = $RepoRoot
    sourceCommit = $head
    platform = [Environment]::OSVersion.VersionString
    isWindows = $env:OS -eq 'Windows_NT'
    status = if ($buildReady -and $dataReady) { 'LOCAL_STATIC_PREFLIGHT_READY' } else { 'MISSING_PREREQUISITES' }
    releaseAccepted = $false
    shippingBuilt = $false
    offlineVisualTestPassed = $false
    geodeticAccepted = $false
    checks = @($checks)
}
if (-not $OutputPath) {
    $OutputPath = Join-Path $RepoRoot 'dist\provenance\windows11-runner-preflight.json'
}
New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPath) -Force | Out-Null
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
foreach ($check in $checks) {
    $prefix = if ($check.pass) { '[PASS]' } else { '[NEEDS SETUP]' }
    Write-Host "$prefix $($check.name) — $($check.detail)"
}
Write-Host "Preflight report: $OutputPath"
Write-Host "Overall: $($report.status)"
Write-Host 'No packages installed, credentials disclosed, service registered, or release claims promoted.'
if ($report.status -ne 'LOCAL_STATIC_PREFLIGHT_READY') { exit 2 }
