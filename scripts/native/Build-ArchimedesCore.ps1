[CmdletBinding()]
param(
    [string]$SourceDir = "$PSScriptRoot\..\..\native\archimedes",
    [ValidateSet("Debug","Release","RelWithDebInfo")][string]$Configuration = "Release"
)
$ErrorActionPreference = "Stop"
$buildDir = Join-Path $SourceDir "build"
cmake -S $SourceDir -B $buildDir -DCMAKE_BUILD_TYPE=$Configuration -DBUILD_TESTING=ON
if ($LASTEXITCODE -ne 0) { throw "CMake configure failed." }
cmake --build $buildDir --config $Configuration --parallel
if ($LASTEXITCODE -ne 0) { throw "ArchimedesCore build failed." }
ctest --test-dir $buildDir --build-config $Configuration --output-on-failure
if ($LASTEXITCODE -ne 0) { throw "ArchimedesCore tests failed." }
Write-Host "ArchimedesCore build and tests passed."
