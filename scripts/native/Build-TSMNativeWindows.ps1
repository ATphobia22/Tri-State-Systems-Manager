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

# The Inno [Setup] SignTool signs Setup, the uninstaller and temporary self-copies.
# Never sign Setup only after compilation; that leaves the other copies unsigned.
$timestampUri = $null
if (-not [Uri]::TryCreate($timestampUrl, [UriKind]::Absolute, [ref]$timestampUri) -or
    $timestampUri.Scheme -ne "https" -or
    $timestampUri.Host -notmatch '^[A-Za-z0-9.-]+$' -or
    $timestampUrl.Contains('"')) {
    throw "Invalid HTTPS timestamp URL for installer signing."
}
if (-not (Test-Path -LiteralPath $InstallerScript -PathType Leaf)) {
    throw "Inno Setup release script not found."
}
$installerDirectory = Join-Path $PSScriptRoot '..\\..\\dist\\installer'
New-Item -Path $installerDirectory -ItemType Directory -Force | Out-Null
$previous = @(Get-ChildItem -LiteralPath $installerDirectory -File -Filter 'TSM-Native-Setup-*-windows-x64.exe')
if ($previous.Count -ne 0) {
    throw "Refusing to reuse an old release installer; isolate or clear old output explicitly."
}
# Keep literal Inno placeholder $f for the file being signed.
$signatureCommand = ('"{0}" sign /sha1 {1} /fd SHA256 /tr "{2}" /td SHA256 $f' -f
    $signTool.Source, $signSha, $timestampUrl)
$signToolOption = '--signtool=tsmrelease=' + $signatureCommand
& $iscc.Source $signToolOption '--no-ide-signtools' $InstallerScript
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation/signing failed with exit code $LASTEXITCODE." }

$installers = @(Get-ChildItem -LiteralPath $installerDirectory -File -Filter 'TSM-Native-Setup-*-windows-x64.exe')
if ($installers.Count -ne 1) { throw "Exactly one compiled native installer is required." }
& $signTool.Source verify /pa /all $installers[0].FullName
if ($LASTEXITCODE -ne 0) { throw "Compiled installer signature chain verification failed." }
$installerAuth = Get-AuthenticodeSignature -LiteralPath $installers[0].FullName
if ($installerAuth.Status -ne 'Valid' -or $null -eq $installerAuth.SignerCertificate -or
    $installerAuth.SignerCertificate.Thumbprint -ne $signSha -or
    $null -eq $installerAuth.TimeStamperCertificate) {
    throw "Installer was not signed and timestamped by the pinned release certificate."
}
Write-Host "SIGNED_INSTALLER_SHA256=$((Get-FileHash -LiteralPath $installers[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant())"
Write-Host "TSM signed native offline Windows installer created in dist\\installer."
