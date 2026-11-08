param(
    [Parameter(Mandatory = $true)][string]$UERoot,
    [Parameter(Mandatory = $true)][string]$Project,
    [Parameter(Mandatory = $true)][string]$Map,
    [Parameter(Mandatory = $true)][string]$Sequence,
    [Parameter(Mandatory = $true)][string]$Preset,
    [Parameter(Mandatory = $true)][string]$LogFile
)
$ErrorActionPreference = "Stop"
$Editor = Join-Path $UERoot "Engine/Binaries/Win64/UnrealEditor.exe"
if (-not (Test-Path -LiteralPath $Editor)) { throw "UnrealEditor.exe not found: $Editor" }
$ProjectPath = (Resolve-Path -LiteralPath $Project).Path
$LogPath = [System.IO.Path]::GetFullPath($LogFile)
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogPath) | Out-Null
$Arguments = @(
    $ProjectPath, $Map, "-game", "-windowed", "-ResX=1920", "-ResY=1080",
    "-LevelSequence=$Sequence", "-MoviePipelineConfig=$Preset",
    "-log", "-abslog=$LogPath"
)
& $Editor @Arguments
if ($LASTEXITCODE -ne 0) { throw "Unreal exited with code $LASTEXITCODE" }
Write-Host "Unreal exited successfully. Review output frames and logs."
Write-Host "This does not verify a packaged Windows Shipping executable."
