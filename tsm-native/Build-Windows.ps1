<#
.SYNOPSIS
    Builds the TSM native Unreal target into a standalone Windows .exe.
.DESCRIPTION
    Runs on a Windows 11 machine with Unreal Engine 5.8 and MSVC v143.
    This script CANNOT run in the Linux CI/container environment — Unreal,
    MSVC, and the Windows SDK do not exist there. It is the machine-side
    half of the offline build pipeline (docs/architecture/v45-offline-build-pipeline.md).

    Steps: prerequisite check -> UnrealBuildTool (Development/Shipping) ->
    cook -> package Win64 -> SHA-256 record -> optional sign.
.EXAMPLE
    .\Build-Windows.ps1 -Configuration Shipping
#>
[CmdletBinding()]
param(
    [ValidateSet('Development', 'Shipping')]
    [string]$Configuration = 'Shipping',

    [string]$ProjectName = 'TSMNative',

    [string]$EngineRoot = $env:UE_5_8_ROOT,   # e.g. C:\Program Files\Epic Games\UE_5.8

    [string]$OutputDir = (Join-Path $PSScriptRoot 'dist\windows'),

    [string]$SignThumbprint = ''               # optional: cert thumbprint for signtool
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$uproject = Join-Path $root "$ProjectName.uproject"

function Fail($msg) { throw "[TSM build] $msg" }

# --- 1. Prerequisites (fail fast, no partial builds) -------------------------
if (-not (Test-Path $uproject)) { Fail "uproject not found: $uproject" }
if ([string]::IsNullOrWhiteSpace($EngineRoot) -or -not (Test-Path $EngineRoot)) {
    Fail "Unreal Engine 5.8 not found. Set UE_5_8_ROOT to the engine install root."
}
$ubt = Join-Path $EngineRoot 'Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe'
$uat = Join-Path $EngineRoot 'Engine\Build\BatchFiles\RunUAT.bat'
if (-not (Test-Path $ubt)) { Fail "UnrealBuildTool not found: $ubt" }
if (-not (Test-Path $uat)) { Fail "RunUAT not found: $uat" }

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) { Fail "vswhere not found; install Visual Studio 2022 with MSVC v143." }
$msvc = & $vswhere -latest -requires Microsoft.VisualStudio.Component.VC.Tools -property installationVersion
if (-not $msvc) { Fail "MSVC v143 (VS2022 C++ tools) not found." }

$commit = 'unknown'
try { $commit = (git -C $root rev-parse HEAD 2>$null).Trim() } catch { }
Write-Host "[TSM build] commit=$commit engine=$EngineRoot msvc=$msvc config=$Configuration"

# --- 2. Build editor-less target ---------------------------------------------
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
& $ubt "$ProjectName" Win64 $Configuration "-Project=$uproject" -WaitMutex -NoHotReload
if ($LASTEXITCODE -ne 0) { Fail "UnrealBuildTool failed ($LASTEXITCODE)." }

# --- 3. Cook + package standalone Win64 ---------------------------------------
& $uat BuildCookRun `
    -project="$uproject" -noP4 -platform=Win64 `
    -clientconfig=$Configuration -serverconfig=$Configuration `
    -cook -allmaps -build -stage -pak -archive `
    -archivedirectory="$OutputDir"
if ($LASTEXITCODE -ne 0) { Fail "BuildCookRun failed ($LASTEXITCODE)." }

# --- 4. Reproducibility record -------------------------------------------------
$exe = Get-ChildItem -Path $OutputDir -Recurse -Filter "$ProjectName.exe" | Select-Object -First 1
if (-not $exe) { Fail "Packaged exe not found under $OutputDir." }
$hash = (Get-FileHash -Algorithm SHA256 $exe.FullName).Hash.ToLower()
$record = [ordered]@{
    project       = $ProjectName
    configuration = $Configuration
    git_commit    = $commit
    engine_root   = $EngineRoot
    msvc_version  = $msvc
    built_at_utc  = (Get-Date).ToUniversalTime().ToString('o')
    exe_path      = $exe.FullName
    exe_sha256    = $hash
    signed        = $false
}
if ($SignThumbprint) {
    $signtool = "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
    if (-not (Test-Path $signtool)) { Fail "signtool not found; install the Windows SDK." }
    & $signtool sign /sha1 $SignThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $exe.FullName
    if ($LASTEXITCODE -ne 0) { Fail "signtool failed ($LASTEXITCODE)." }
    $record.signed = $true
}
$recordPath = Join-Path $OutputDir 'reproducibility.json'
($record | ConvertTo-Json -Depth 4) | Out-File -Encoding utf8 $recordPath

Write-Host "[TSM build] DONE: $($exe.FullName)"
Write-Host "[TSM build] SHA-256: $hash"
Write-Host "[TSM build] record: $recordPath"
