[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$UnrealRoot,
    [Parameter(Mandatory=$true)][string]$ProjectFile,
    [ValidateSet("Win64","Mac")][string]$Platform = "Win64",
    [ValidateSet("Development","Shipping")][string]$Configuration = "Shipping",
    [Parameter(Mandatory=$true)][string]$ArchiveDirectory
)
$ErrorActionPreference = "Stop"
$uat = if ($Platform -eq "Win64") { Join-Path $UnrealRoot "Engine\Build\BatchFiles\RunUAT.bat" } else { Join-Path $UnrealRoot "Engine/Build/BatchFiles/RunUAT.sh" }
if (-not (Test-Path $uat)) { throw "Unreal Automation Tool not found: $uat" }
New-Item -ItemType Directory -Force -Path $ArchiveDirectory | Out-Null
& $uat BuildCookRun "-project=$ProjectFile" -noP4 -build -cook -stage -pak -package -archive "-archivedirectory=$ArchiveDirectory" "-platform=$Platform" "-clientconfig=$Configuration" -utf8output
if ($LASTEXITCODE -ne 0) { throw "UE5 BuildCookRun failed with exit code $LASTEXITCODE." }
