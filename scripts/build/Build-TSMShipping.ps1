<#
.SYNOPSIS
    Automates UE5.8 BuildCookRun for TSM Windows 11 Shipping binary.
.DESCRIPTION
    Invokes RunUAT.bat to compile, cook, pak, and archive a Win64 Shipping build.
    Requires Unreal Engine 5.8 and a valid .uproject on an authorized Windows runner.
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$UEEnginePath = "C:\Program Files\Epic Games\UE_5.8",

    [Parameter(Mandatory = $true)]
    [string]$ProjectFilePath,

    [Parameter(Mandatory = $true)]
    [string]$ArchiveDirectory
)

$ErrorActionPreference = "Stop"
$RunUAT = Join-Path $UEEnginePath "Engine\Build\BatchFiles\RunUAT.bat"

if (!(Test-Path $RunUAT)) {
    throw "Unreal Automation Tool not found at: $RunUAT"
}
if (!(Test-Path $ProjectFilePath)) {
    throw "Project file not found: $ProjectFilePath"
}

New-Item -ItemType Directory -Force -Path $ArchiveDirectory | Out-Null

Write-Host "=================================================="
Write-Host "UE5.8 BuildCookRun (Shipping)"
Write-Host "Project: $ProjectFilePath"
Write-Host "Archive: $ArchiveDirectory"
Write-Host "=================================================="

& $RunUAT BuildCookRun `
    -project="$ProjectFilePath" `
    -noP4 `
    -platform=Win64 `
    -clientconfig=Shipping `
    -serverconfig=Shipping `
    -cook `
    -allmaps `
    -stage `
    -pak `
    -archive `
    -archivedirectory="$ArchiveDirectory" `
    -compressed

if ($LASTEXITCODE -ne 0) {
    throw "BuildCookRun failed with exit code $LASTEXITCODE"
}

Write-Host "[SUCCESS] Shipping archive: $ArchiveDirectory" -ForegroundColor Green
