[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$DataRoot,
    [Parameter(Mandatory=$true)][string]$ManifestPath,
    [switch]$RejectExtraFiles
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path -LiteralPath $DataRoot).Path
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if ($manifest.integrity -ne "sha256" -or $manifest.schemaVersion -ne 1) { throw "Unsupported native data manifest format." }
$expected = @{}
foreach ($entry in @($manifest.files)) {
    if ($entry.path -match '(^|/)\.\.?(/|$)' -or [IO.Path]::IsPathRooted([string]$entry.path)) { throw "Unsafe manifest path: $($entry.path)" }
    $key = ([string]$entry.path).Replace("/", [IO.Path]::DirectorySeparatorChar)
    if ($expected.ContainsKey($key)) { throw "Duplicate manifest path: $entry.path" }
    $expected[$key] = [string]$entry.sha256
    $full = Join-Path $root $key
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "Manifest file missing: $entry.path" }
    $actual = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected[$key].ToLowerInvariant()) { throw "SHA-256 mismatch: $entry.path" }
    if ((Get-Item -LiteralPath $full).Length -ne [int64]$entry.sizeBytes) { throw "Size mismatch: $entry.path" }
}
if ($RejectExtraFiles) {
    $actualFiles = @(Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object { [IO.Path]::GetRelativePath($root, $_.FullName) })
    foreach ($file in $actualFiles) { if (-not $expected.ContainsKey($file)) { throw "Unmanifested data file: $file" } }
}
Write-Host "Native data manifest verified: $($expected.Count) files"
