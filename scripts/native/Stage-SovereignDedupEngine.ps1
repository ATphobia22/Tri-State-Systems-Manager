[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ArchiveDirectory,
    [string]$ManifestPath = "$PSScriptRoot\..\..\crates\sovereign-dedup-engine\Cargo.toml"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$manifest = (Resolve-Path -LiteralPath $ManifestPath).Path
$cargo = Get-Command cargo.exe -ErrorAction Stop
& $cargo.Source "+1.85.1" build --release --locked --manifest-path $manifest --bin sde-graph
if ($LASTEXITCODE -ne 0) { throw "SDE Rust release build failed." }

$crateRoot = Split-Path -Parent $manifest
$source = Join-Path $crateRoot "target\release\sde-graph.exe"
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Rust SDE release executable missing: $source"
}
$staged = Join-Path $ArchiveDirectory "Windows\TSMNative\Tools"
if (-not (Test-Path -LiteralPath (Join-Path $ArchiveDirectory "Windows\TSMNative\TSMNative.exe"))) {
    throw "UE Shipping archive must exist before SDE staging."
}
New-Item -ItemType Directory -Force -Path $staged | Out-Null
$target = Join-Path $staged "sde-graph.exe"
Copy-Item -LiteralPath $source -Destination $target -Force
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "SDE companion executable was not staged."
}
$srcHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
$dstHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
if ($srcHash -ne $dstHash) { throw "Staged SDE digest mismatch." }
Write-Host "STAGED_SDE_SHA256=$($dstHash.ToLowerInvariant())"
Write-Host "STAGED_SDE_PATH=$target"
