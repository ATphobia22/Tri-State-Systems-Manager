[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ArtifactDirectory,
    [string]$CertificateBase64 = $env:WINDOWS_CERTIFICATE,
    [string]$CertificatePassword = $env:WINDOWS_CERTIFICATE_PASSWORD,
    [string]$TimestampUrl = $env:WINDOWS_TIMESTAMP_URL
)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($CertificateBase64)) { throw 'WINDOWS_CERTIFICATE is required for production signing.' }
if ([string]::IsNullOrWhiteSpace($CertificatePassword)) { throw 'WINDOWS_CERTIFICATE_PASSWORD is required for production signing.' }
if ([string]::IsNullOrWhiteSpace($TimestampUrl) -or -not $TimestampUrl.StartsWith('https://')) { throw 'WINDOWS_TIMESTAMP_URL must be an approved HTTPS timestamp service.' }
$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signtool) { throw 'signtool.exe is required.' }
$temp = Join-Path $env:TEMP "tsm-sign-$([guid]::NewGuid().ToString('N')).pfx"
try {
    [IO.File]::WriteAllBytes($temp, [Convert]::FromBase64String($CertificateBase64))
    $targets = Get-ChildItem $ArtifactDirectory -File | Where-Object { $_.Extension -in '.exe','.dll' }
    foreach ($target in $targets) {
        & $signtool.Source sign /fd SHA256 /f $temp /p $CertificatePassword /tr $TimestampUrl /td SHA256 $target.FullName
        if ($LASTEXITCODE -ne 0) { throw "Authenticode signing failed: $($target.FullName)" }
        & $signtool.Source verify /pa /all $target.FullName
        if ($LASTEXITCODE -ne 0) { throw "Authenticode verification failed: $($target.FullName)" }
    }
}
finally {
    Remove-Item $temp -Force -ErrorAction SilentlyContinue
}
Write-Host "Authenticode signing gate: PASS ($($targets.Count) files)"
