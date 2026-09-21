[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$DataRoot,
    [string]$OutputPath = (Join-Path $PSScriptRoot "../../tsm-native/config/data-manifest.json")
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path -LiteralPath $DataRoot).Path
if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw "Data root does not exist: $DataRoot" }
$files = @(Get-ChildItem -LiteralPath $root -Recurse -File | Sort-Object FullName | ForEach-Object {
    $hash = Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
    [ordered]@{
        path = [IO.Path]::GetRelativePath($root, $_.FullName).Replace("\\", "/")
        sizeBytes = [int64]$_.Length
        sha256 = $hash.Hash.ToLowerInvariant()
    }
})
$manifest = [ordered]@{ schemaVersion = 1; generatedAtUtc = [DateTime]::UtcNow.ToString("O"); integrity = "sha256"; files = $files }
$parent = Split-Path -Parent $OutputPath
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host "Generated native data manifest: $OutputPath"
