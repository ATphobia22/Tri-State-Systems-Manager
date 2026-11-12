[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$UnrealRoot,
    [string]$ProjectFile = "$PSScriptRoot\..\..\tsm-native\TSMNative.uproject",
    [string]$ArchimedesSource = "$PSScriptRoot\..\..\native\archimedes",
    [string]$ArchiveDirectory = "$PSScriptRoot\..\..\dist\tsm-native",
    [string]$InstallerScript = "$PSScriptRoot\..\..\tsm-native\Installer\TSM-Native.iss",
    [string]$SpatiaLiteDllPath = $env:TSM_SPATIALITE_DLL
)

$ErrorActionPreference = "Stop"

& "$PSScriptRoot\Build-ArchimedesCore.ps1" -SourceDir $ArchimedesSource -Configuration Release
if ($LASTEXITCODE -ne 0) { throw "ArchimedesCore build failed." }

$cmakeDll = Get-ChildItem "$ArchimedesSource\build" -Recurse -Filter "ArchimedesCore.dll" -File |
    Select-Object -First 1

if (-not $cmakeDll) { throw "ArchimedesCore.dll was not produced." }
if ([string]::IsNullOrWhiteSpace($SpatiaLiteDllPath) -or -not (Test-Path $SpatiaLiteDllPath)) {
    throw "TSM_SPATIALITE_DLL must point to the packaged mod_spatialite.dll."
}

$binaryDir = Join-Path (Split-Path $ProjectFile -Parent) "Binaries"
New-Item -ItemType Directory -Force -Path $binaryDir | Out-Null
Copy-Item $cmakeDll.FullName (Join-Path $binaryDir "ArchimedesCore.dll") -Force
Copy-Item $SpatiaLiteDllPath (Join-Path $binaryDir "mod_spatialite.dll") -Force

# Generate native map only after ArchimedesCore and SpatiaLite are staged so
# UnrealEditor-Cmd can load the actual native modules during asset authoring.
& "$PSScriptRoot\Generate-TSMNativeMap.ps1" -UnrealRoot $UnrealRoot -ProjectFile $ProjectFile -TilesetPath $env:TSM_LOCAL_TILESET
if ($LASTEXITCODE -ne 0) { throw "UE native map generation failed." }

& "$PSScriptRoot\Build-TSMNative.ps1" -UnrealRoot $UnrealRoot -ProjectFile $ProjectFile -Platform Win64 -Configuration Shipping -ArchiveDirectory $ArchiveDirectory
if ($LASTEXITCODE -ne 0) { throw "Unreal packaging failed." }

# Stage the offline, content-addressed Rust evidence companion in the
# UE archive before Inno Setup compiles its recursive [Files] payload.
& "$PSScriptRoot\\Stage-SovereignDedupEngine.ps1" -ArchiveDirectory $ArchiveDirectory
if ($LASTEXITCODE -ne 0) { throw "SDE staging failed." }

# Sign cooked executable BEFORE Inno Setup embeds it. The installer
# also gets signed separately after its own compilation in GitHub Actions.
$signSha = $env:TSM_WINDOWS_SIGNING_CERT_SHA1
$timestampUrl = $env:TSM_WINDOWS_TIMESTAMP_URL
if ([string]::IsNullOrWhiteSpace($signSha) -or $signSha -notmatch '^[A-Fa-f0-9]{40}$') {
    throw "TSM_WINDOWS_SIGNING_CERT_SHA1 must be a valid certificate thumbprint."
}
if ($timestampUrl -notmatch '^https://') { throw "HTTPS timestamp service URL is required." }
$signTool = Get-Command signtool.exe -ErrorAction Stop
$exes = @(Get-ChildItem -LiteralPath $ArchiveDirectory -Recurse -File -Filter TSMNative.exe)
if ($exes.Count -ne 1) { throw "Expected exactly one cooked TSMNative.exe, found $($exes.Count)." }
& $signTool.Source sign /sha1 $signSha /fd SHA256 /tr $timestampUrl /td SHA256 $exes[0].FullName
if ($LASTEXITCODE -ne 0) { throw "Signing cooked TSMNative.exe failed." }
& $signTool.Source verify /pa /all $exes[0].FullName
if ($LASTEXITCODE -ne 0) { throw "Cooked executable Authenticode verification failed." }
$auth = Get-AuthenticodeSignature -LiteralPath $exes[0].FullName
if ($auth.Status -ne 'Valid') { throw "Cooked executable Authenticode status: $($auth.Status)" }
Write-Host "SIGNED_COOKED_EXE_SHA256=$((Get-FileHash -LiteralPath $exes[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant())"

# Sign and verify the SDE companion independently; an unsigned CLI must
# not be embedded into the signed native installer.
$sdeBinary = Join-Path $ArchiveDirectory "Windows\\TSMNative\\Tools\\sde-graph.exe"
if (-not (Test-Path -LiteralPath $sdeBinary -PathType Leaf)) {
    throw "Staged SDE executable is required before installer compilation."
}
& $signTool.Source sign /sha1 $signSha /fd SHA256 /tr $timestampUrl /td SHA256 $sdeBinary
if ($LASTEXITCODE -ne 0) { throw "SDE companion signing failed." }
& $signTool.Source verify /pa /all $sdeBinary
if ($LASTEXITCODE -ne 0) { throw "SDE companion Authenticode verification failed." }
$sdeAuth = Get-AuthenticodeSignature -LiteralPath $sdeBinary
if ($sdeAuth.Status -ne 'Valid') { throw "SDE Authenticode status: $($sdeAuth.Status)" }
Write-Host "SIGNED_SDE_SHA256=$((Get-FileHash -LiteralPath $sdeBinary -Algorithm SHA256).Hash.ToLowerInvariant())"

$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (-not $iscc) { throw "Inno Setup 7 ISCC.exe is required to produce the standalone installer." }

& $iscc.Source $InstallerScript
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed with exit code $LASTEXITCODE." }

Write-Host "TSM native Windows installer created in dist\installer."
