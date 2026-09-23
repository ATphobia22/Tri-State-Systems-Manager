[CmdletBinding()]
param(
    [ValidateSet("x64-windows","x64-windows-static","arm64-windows","x64-osx","arm64-osx","x64-linux","arm64-linux")]
    [string]$Triplet = "x64-windows",
    [string]$VcpkgRoot = $env:VCPKG_ROOT,
    [switch]$InstallToolchain
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$manifestRoot = Join-Path $repoRoot "native\dependencies"
$lockedVcpkgCommit = "5f96cd15fd745122cf27e0524606d6c1efc5fd07"

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found."
    }
}

if ($InstallToolchain) {
    if ($IsWindows -and (Get-Command winget -ErrorAction SilentlyContinue)) {
        if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
            winget install --id Kitware.CMake --exact --accept-source-agreements --accept-package-agreements
        }
        if (-not (Get-Command ninja -ErrorAction SilentlyContinue)) {
            winget install --id Ninja-build.Ninja --exact --accept-source-agreements --accept-package-agreements
        }
    } elseif ($IsMacOS) {
        if (Get-Command xcode-select -ErrorAction SilentlyContinue) {
            xcode-select -p *> $null
            if ($LASTEXITCODE -ne 0) {
                throw "Install Xcode Command Line Tools before continuing: xcode-select --install"
            }
        }
        if (Get-Command brew -ErrorAction SilentlyContinue) {
            if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) { brew install cmake }
            if (-not (Get-Command ninja -ErrorAction SilentlyContinue)) { brew install ninja }
        }
    }
}

Require-Command git

if ([string]::IsNullOrWhiteSpace($VcpkgRoot)) {
    $VcpkgRoot = Join-Path $repoRoot ".native-tools\vcpkg"
}
$VcpkgRoot = [IO.Path]::GetFullPath($VcpkgRoot)

if (-not (Test-Path (Join-Path $VcpkgRoot ".git"))) {
    New-Item -ItemType Directory -Force -Path (Split-Path $VcpkgRoot -Parent) | Out-Null
    git clone --filter=blob:none https://github.com/microsoft/vcpkg.git $VcpkgRoot
}

Push-Location $VcpkgRoot
try {
    git fetch --quiet origin $lockedVcpkgCommit
    git checkout --quiet --detach $lockedVcpkgCommit
} finally {
    Pop-Location
}

if ($IsWindows) {
    $bootstrap = Join-Path $VcpkgRoot "bootstrap-vcpkg.bat"
    if (-not (Test-Path $bootstrap)) { throw "vcpkg Windows bootstrap script is missing at $bootstrap" }
    & cmd.exe /d /c "`"$bootstrap`" -disableMetrics"
} else {
    $bootstrap = Join-Path $VcpkgRoot "bootstrap-vcpkg.sh"
    if (-not (Test-Path $bootstrap)) { throw "vcpkg Unix bootstrap script is missing at $bootstrap" }
    & $bootstrap -disableMetrics
}
if ($LASTEXITCODE -ne 0) { throw "vcpkg bootstrap failed." }

$vcpkgExe = if ($IsWindows) { Join-Path $VcpkgRoot "vcpkg.exe" } else { Join-Path $VcpkgRoot "vcpkg" }
if (-not (Test-Path $vcpkgExe)) { throw "vcpkg executable was not produced." }

& $vcpkgExe install --x-manifest-root=$manifestRoot --triplet=$Triplet
if ($LASTEXITCODE -ne 0) { throw "vcpkg dependency installation failed for $Triplet." }

Write-Host "TSM native dependencies installed."
Write-Host "vcpkg root: $VcpkgRoot"
Write-Host "triplet: $Triplet"
Write-Host "manifest: $manifestRoot"
