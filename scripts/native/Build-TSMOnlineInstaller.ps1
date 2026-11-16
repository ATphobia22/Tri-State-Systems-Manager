#requires -Version 5.1
<#
.SYNOPSIS
  Build an optional small online bootstrapper for a pinned TSM offline release.
.DESCRIPTION
  Inno Setup 7 downloads and SHA-256 verifies the offline installer before
  launching it. Packaging can succeed without production signing; the receipt
  will clearly mark those artifacts as unsigned/unverified.
.EXAMPLE
  .\scripts\native\Build-TSMOnlineInstaller.ps1 -ReleaseTag v1.0.0 \
    -OfflineInstallerSha256 '0123...64hex'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ReleaseTag,
    [string]$OfflineInstallerSha256 = '',
    [string]$OfflineInstallerPath = '',
    [string]$SigningThumbprint = $env:TSM_WINDOWS_SIGNING_CERT_SHA1,
    [string]$TimestampUrl = $env:TSM_WINDOWS_TIMESTAMP_URL,
    [string]$OutputDirectory = "$PSScriptRoot\..\..\dist\online-installer",
    [string]$ReceiptPath = "$PSScriptRoot\..\..\dist\provenance\windows-online-installer.json"
)
$ErrorActionPreference = 'Stop'
if ($ReleaseTag -cnotmatch '^v([0-9]+)\.([0-9]+)\.([0-9]+)$') {
    throw 'ReleaseTag must be exactly vMAJOR.MINOR.PATCH (no arbitrary URL or host).'
}
$version = $ReleaseTag.Substring(1)
$offlineFile = "TSM-Native-Setup-$version-windows-x64.exe"
if (-not [string]::IsNullOrWhiteSpace($OfflineInstallerPath)) {
    $inputItem = Get-Item -LiteralPath $OfflineInstallerPath -ErrorAction Stop
    if ($inputItem.Name -cne $offlineFile -or $inputItem.Length -le 0) {
        throw "Offline installer must be the nonempty signed-setup filename $offlineFile."
    }
    $observedHash = (Get-FileHash -LiteralPath $inputItem.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($OfflineInstallerSha256 -and $observedHash -cne $OfflineInstallerSha256.ToLowerInvariant()) {
        throw 'Supplied SHA-256 does not match the local offline installer.'
    }
    $OfflineInstallerSha256 = $observedHash
}
if ($OfflineInstallerSha256 -notmatch '^[0-9a-fA-F]{64}$' -or $OfflineInstallerSha256 -match '^0{64}$') {
    throw 'A real 64-character SHA-256 of the finalized offline installer is required.'
}
$OfflineInstallerSha256 = $OfflineInstallerSha256.ToLowerInvariant()
$releaseURL = "https://github.com/ATphobia22/Tri-State-Systems-Manager/releases/download/$ReleaseTag/$offlineFile"
$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if ($null -eq $iscc) {
    $candidates = @(
        (Join-Path $env:ProgramFiles 'Inno Setup 7\ISCC.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 7\ISCC.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 7\ISCC.exe')
    )
    $path = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
    if (-not $path) { throw 'Inno Setup 7 ISCC.exe required. Install JRSoftware.InnoSetup.7.' }
    $isccPath = $path
} else {
    $isccPath = $iscc.Source
}
$scriptPath = Join-Path $PSScriptRoot '..\..\tsm-native\Installer\TSM-Online.iss'
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -Path $OutputDirectory -ItemType Directory -Force | Out-Null
$expectedName = "TSM-Online-Setup-$version-windows-x64.exe"
$outputFile = Join-Path $OutputDirectory $expectedName
if (Test-Path -LiteralPath $outputFile) {
    throw 'Refusing to overwrite an existing online setup. Use an empty output directory.'
}
& $isccPath "--output-dir=$OutputDirectory" "--define=TSMVersion=$version" \
    "--define=TSMReleaseTag=$ReleaseTag" "--define=TSMOfflineSha256=$OfflineInstallerSha256" \
    '--no-ide-signtools' $scriptPath
if ($LASTEXITCODE -ne 0) { throw "Inno Setup online bootstrapper compile failed: $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $outputFile -PathType Leaf)) {
    throw 'The expected online installer executable was not produced.'
}

$signing = 'UNSIGNED_OR_NOT_VERIFIED'
$signTool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if ($SigningThumbprint -match '^[0-9a-fA-F]{40}$' -and $TimestampUrl -match '^https://' -and $signTool) {
    try {
        & $signTool.Source sign /sha1 $SigningThumbprint /fd SHA256 /tr $TimestampUrl /td SHA256 $outputFile
        if ($LASTEXITCODE -eq 0) {
            & $signTool.Source verify /pa /all /tw $outputFile | Out-Null
            if ($LASTEXITCODE -eq 0) { $signing = 'AUTHENTICODE_VERIFIED_ON_BUILD_RUNNER' }
        }
    } catch {
        Write-Warning 'Signing attempt failed; online installer trust remains unverified.'
    }
} else {
    Write-Warning 'No usable production signer and HTTPS timestamp supplied; online setup remains unsigned.'
}
if ($signing -ne 'AUTHENTICODE_VERIFIED_ON_BUILD_RUNNER') {
    Write-Warning 'Online setup was built, but its public signing/trust is NOT verified.'
}
$receipt = [ordered]@{
    schema = 'tsm.windows.online-installer.v1'
    version = $version
    release_tag = $ReleaseTag
    offline_installer_name = $offlineFile
    offline_installer_sha256 = $OfflineInstallerSha256
    source_url = $releaseURL
    source_url_live_and_public = 'NOT_EVIDENCED'
    online_installer_name = $expectedName
    online_installer_sha256 = (Get-FileHash -LiteralPath $outputFile -Algorithm SHA256).Hash.ToLowerInvariant()
    built_utc = (Get-Date).ToUniversalTime().ToString('o')
    build_host_signing = $signing
    independent_windows11_public_trust = 'NOT_EVIDENCED'
    online_download_smoke = 'NOT_RUN'
    offline_runtime_smoke = 'NOT_RUN'
    certification_check = 'ADVISORY_NON_BLOCKING'
    publisher_review = 'HUMAN_AUTHORITY_FINAL'
}
$receiptParent = Split-Path -Parent $ReceiptPath
if ($receiptParent) { New-Item -ItemType Directory -Force -Path $receiptParent | Out-Null }
$receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReceiptPath -Encoding utf8 -NoNewline
Write-Host "TSM_ONLINE_INSTALLER=$outputFile"
Write-Host "TSM_ONLINE_INSTALLER_SHA256=$($receipt.online_installer_sha256)"
Write-Host "TSM_ONLINE_INSTALLER_EVIDENCE=$ReceiptPath"
