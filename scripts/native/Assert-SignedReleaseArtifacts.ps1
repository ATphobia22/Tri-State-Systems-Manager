[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ArchiveRoot,
    [Parameter(Mandatory=$true)][string]$InstallerDirectory,
    [Parameter(Mandatory=$true)][string]$CertificateThumbprint,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [Parameter(Mandatory=$true)][string]$SourceCommit
)
$ErrorActionPreference = 'Stop'
if ($CertificateThumbprint -notmatch '^[A-Fa-f0-9]{40}$') {
    throw 'Signing certificate SHA-1 thumbprint must be exactly 40 hexadecimal digits.'
}
if ($SourceCommit -notmatch '^[A-Fa-f0-9]{40}$') {
    throw 'Immutable source commit is required.'
}
if (Test-Path -LiteralPath $OutputPath) {
    throw 'Refusing to overwrite an existing signed-artifact evidence record.'
}
$archive = (Resolve-Path -LiteralPath $ArchiveRoot).Path
$installerRoot = (Resolve-Path -LiteralPath $InstallerDirectory).Path
$native = @(Get-ChildItem -LiteralPath $archive -Recurse -File -Filter 'TSMNative.exe')
$engine = @(Get-ChildItem -LiteralPath $archive -Recurse -File -Filter 'sde-graph.exe')
$setup = @(Get-ChildItem -LiteralPath $installerRoot -File -Filter 'TSM-Native-Setup-*-windows-x64.exe')
if ($native.Count -ne 1 -or $engine.Count -ne 1 -or $setup.Count -ne 1) {
    throw "Require exactly one native executable, SDE companion and signed setup; found $($native.Count)/$($engine.Count)/$($setup.Count)."
}
$signTool = Get-Command signtool.exe -ErrorAction Stop
$files = @(
    [pscustomobject]@{ role = 'native_shipping_exe'; file = $native[0] },
    [pscustomobject]@{ role = 'sovereign_dedup_companion'; file = $engine[0] },
    [pscustomobject]@{ role = 'offline_installer'; file = $setup[0] }
)
$expected = $CertificateThumbprint.ToUpperInvariant()
$records = @()
foreach ($item in $files) {
    if ($item.file.Length -le 0 -or (($item.file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
        throw "Empty or reparse-point binary refused: $($item.role)"
    }
    $auth = Get-AuthenticodeSignature -LiteralPath $item.file.FullName
    if ($auth.Status -ne 'Valid' -or $null -eq $auth.SignerCertificate) {
        throw "Authenticode validation failed: $($item.role): $($auth.Status)"
    }
    $signedBy = $auth.SignerCertificate.Thumbprint.ToUpperInvariant()
    if ($signedBy -ne $expected) {
        throw "Unexpected signer on $($item.role); release must use the approved certificate."
    }
    if ($null -eq $auth.TimeStamperCertificate) {
        throw "Missing independently verifiable timestamp for $($item.role)"
    }
    & $signTool.Source verify /pa /all $item.file.FullName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "SignTool chain verification failed for $($item.role)"
    }
    $records += [ordered]@{
        role = $item.role
        filename = $item.file.Name
        bytes = $item.file.Length
        sha256 = (Get-FileHash -LiteralPath $item.file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        authenticode = 'Valid'
        signer_thumbprint = $signedBy
        timestamp_certificate_present = $true
    }
}
$record = [ordered]@{
    schema = 'tsm.native.signed-artifact-inventory.v1'
    source_commit = $SourceCommit.ToLowerInvariant()
    created_utc = (Get-Date).ToUniversalTime().ToString('o')
    state = 'SIGNED_ARTIFACT_INTEGRITY_VERIFIED_OFFLINE_RUNTIME_PENDING'
    signed_files = $records
    clean_windows11_offline_startup_verified = $false
    gpu_headed_terrain_tiles_verified = $false
    scientific_datum_certification = 'NOT_EVIDENCED'
    release_approval = 'HUMAN_REVIEW_REQUIRED'
}
$parent = Split-Path -Parent $OutputPath
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
$record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8 -NoNewline
Write-Host "SIGNED_BINARY_EVIDENCE=$OutputPath"
Write-Warning 'Signed-file verification does not prove air-gapped executable operation or scientific acceptance.'
