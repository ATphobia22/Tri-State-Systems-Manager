[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$UnrealRoot,
    [string]$ProjectFile = "$PSScriptRoot\..\..\tsm-native\TSMNative.uproject",
    [string]$ArchimedesSource = "$PSScriptRoot\..\..\native\archimedes",
    [string]$ArchiveDirectory = "$PSScriptRoot\..\..\dist\tsm-native",
    [string]$InstallerScript = "$PSScriptRoot\..\..\tsm-native\Installer\TSM-Native.iss"
)

$ErrorActionPreference = "Stop"

& "$PSScriptRoot\Build-ArchimedesCore.ps1" -SourceDir $ArchimedesSource -Configuration Release
if ($LASTEXITCODE -ne 0) { throw "ArchimedesCore build failed." }

$cmakeDll = Get-ChildItem "$ArchimedesSource\build" -Recurse -Filter "ArchimedesCore.dll" -File |
    Select-Object -First 1

if (-not $cmakeDll) { throw "ArchimedesCore.dll was not produced." }

$binaryDir = Join-Path (Split-Path $ProjectFile -Parent) "Binaries"
New-Item -ItemType Directory -Force -Path $binaryDir | Out-Null
Copy-Item $cmakeDll.FullName (Join-Path $binaryDir "ArchimedesCore.dll") -Force

& "$PSScriptRoot\Build-TSMNative.ps1" -UnrealRoot $UnrealRoot -ProjectFile $ProjectFile -Platform Win64 -Configuration Shipping -ArchiveDirectory $ArchiveDirectory
if ($LASTEXITCODE -ne 0) { throw "Unreal packaging failed." }

$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (-not $iscc) { throw "Inno Setup 7 ISCC.exe is required to produce the standalone installer." }

& $iscc.Source $InstallerScript
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed with exit code $LASTEXITCODE." }

Write-Host "TSM native Windows installer created in dist\installer."
