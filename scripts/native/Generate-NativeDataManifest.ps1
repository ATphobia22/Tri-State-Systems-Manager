[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$DataRoot,
    [string]$OutputPath = (Join-Path $PSScriptRoot "../../tsm-native/config/data-manifest.json")
)
$ErrorActionPreference = "Stop"
& node (Join-Path $PSScriptRoot 'native-data-manifest.mjs') generate $DataRoot $OutputPath
if ($LASTEXITCODE -ne 0) { throw "Native data manifest generation failed." }
