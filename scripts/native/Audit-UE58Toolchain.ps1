[CmdletBinding()]
param([string]$OutputPath = "$PSScriptRoot\..\..\dist\provenance\ue58-toolchain-audit.json")
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Windows x64 host required.' }
$checks = [System.Collections.Generic.List[object]]::new()
function Check([string]$Name,[bool]$Ok,[string]$Path) {
  $checks.Add([ordered]@{ name=$Name; pass=$Ok; path=$Path })
}
$vswhere = Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'Microsoft Visual Studio\Installer\vswhere.exe'
$vs = ''
if (Test-Path -LiteralPath $vswhere) {
  $vs = (& $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
}
Check 'Visual Studio MSVC C++ tools' ([bool]$vs) $vs
$vcvars = if ($vs) { Join-Path $vs 'VC\Auxiliary\Build\vcvars64.bat' } else { '' }
Check 'vcvars64.bat' ([bool]($vcvars -and (Test-Path -LiteralPath $vcvars -PathType Leaf))) $vcvars
foreach ($cmd in @('cmake.exe','ninja.exe','ISCC.exe','signtool.exe','git.exe','node.exe')) {
  $tool = Get-Command $cmd -ErrorAction SilentlyContinue
  Check $cmd ([bool]$tool) $(if ($tool) { $tool.Source } else { '' })
}
$ue = $env:UE_ROOT
$plugin = if ($ue) { Join-Path $ue 'Engine\Plugins\Marketplace\CesiumForUnreal\CesiumForUnreal.uplugin' } else { '' }
$manifest = Join-Path $PSScriptRoot '..\..\tsm-native\config\native-geospatial-runtime.json'
$pinned = (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json).geospatial.pluginVersion
$installed = ''
if ($plugin -and (Test-Path -LiteralPath $plugin -PathType Leaf)) {
  $installed = (Get-Content -LiteralPath $plugin -Raw | ConvertFrom-Json).VersionName
}
Check 'UE_ROOT installed' ([bool]($ue -and (Test-Path -LiteralPath $ue -PathType Container))) $ue
Check "Cesium for Unreal $pinned" ($installed -ceq $pinned) $plugin
$report = [ordered]@{
  schema='tsm.ue58.toolchain-audit.v1'
  generatedUtc=(Get-Date).ToUniversalTime().ToString('o')
  releaseAccepted=$false
  allPrerequisitesPresent=(@($checks | Where-Object { -not $_.pass }).Count -eq 0)
  checks=@($checks)
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputPath -Encoding utf8
$checks | ForEach-Object { Write-Host "$($_.name): $($_.pass)" }
if (-not $report.allPrerequisitesPresent) { exit 2 }
