[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$DataRoot,
    [Parameter(Mandatory=$true)][string]$ManifestPath,
    [switch]$RejectExtraFiles
)
$ErrorActionPreference = "Stop"
$strict = if ($RejectExtraFiles) { "true" } else { "false" }
& node (Join-Path $PSScriptRoot 'native-data-manifest.mjs') verify $DataRoot $ManifestPath $strict
if ($LASTEXITCODE -ne 0) { throw "Native data manifest verification failed." }
