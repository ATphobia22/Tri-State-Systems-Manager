[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$DataRoot,
    [string]$OutputPath = "$PSScriptRoot....	sm-nativeconfigdata-manifest.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $DataRoot -PathType Container)) {
    throw "Data root does not exist: $DataRoot"
}

$files = Get-ChildItem -LiteralPath $DataRoot -Recurse -File |
    Sort-Object FullName |
    ForEach-Object {
        $hash = Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
        [pscustomobject]@{
            path = [IO.Path]::GetRelativePath((Resolve-Path $DataRoot), $_.FullName).Replace("", "/")
            sizeBytes = $_.Length
            sha256 = $hash.Hash.ToLowerInvariant()
        }
    }

$manifest = [ordered]@{
    schemaVersion = 1
    generatedAtUtc = [DateTime]::UtcNow.ToString("O")
    integrity = "sha256"
    files = @($files)
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host "Generated native data manifest: $OutputPath"
