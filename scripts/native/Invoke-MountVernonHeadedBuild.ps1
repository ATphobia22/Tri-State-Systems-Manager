<#
.SYNOPSIS
    Build TSMNative Development Editor or Shipping through the existing UE5.8 pipeline.
.DESCRIPTION
    No 'success' is declared until the invoked tool exits with 0. Shipping mode
    retains existing signing, staging and installer gates instead of bypassing them.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$UnrealRoot,
    [ValidateSet('Editor', 'Shipping')] [string]$Target = 'Editor',
    [string]$ProjectFile = "$PSScriptRoot\..\..\tsm-native\TSMNative.uproject",
    [string]$ArchiveDirectory = "$PSScriptRoot\..\..\dist\tsm-native"
)
$ErrorActionPreference = 'Stop'
$ProjectFile = (Resolve-Path -LiteralPath $ProjectFile -ErrorAction Stop).Path
if ([IO.Path]::GetFileName($ProjectFile) -ne 'TSMNative.uproject') {
    throw 'Expected canonical TSMNative.uproject, not a secondary PointTownship project.'
}
if (-not (Test-Path -LiteralPath (Join-Path $UnrealRoot 'Engine\Build\BatchFiles\RunUAT.bat'))) {
    throw 'UE root must provide Engine/Build/BatchFiles/RunUAT.bat.'
}
if ($Target -eq 'Shipping') {
    & "$PSScriptRoot\Build-TSMNativeWindows.ps1" -UnrealRoot $UnrealRoot -ProjectFile $ProjectFile -ArchiveDirectory $ArchiveDirectory
    if ($LASTEXITCODE -ne 0) { throw "Shipping pipeline failed with exit code $LASTEXITCODE" }
    Write-Host 'Shipping pipeline returned success; verify physical air-gapped Windows 11 startup separately.'
} else {
    $BuildBat = Join-Path $UnrealRoot 'Engine\Build\BatchFiles\Build.bat'
    if (-not (Test-Path -LiteralPath $BuildBat)) { throw 'Build.bat not found.' }
    & $BuildBat TSMNativeEditor Win64 Development "-Project=$ProjectFile" -WaitMutex -NoHotReloadFromIDE
    if ($LASTEXITCODE -ne 0) { throw "Development Editor build failed: $LASTEXITCODE" }
    Write-Host 'Development Editor compilation completed; PIE/render/inspection tests still required.'
}
