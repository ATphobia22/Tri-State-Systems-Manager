[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BinaryPath,
    [string]$ExpectedSha256
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $BinaryPath -PathType Leaf)) { throw "Native artifact does not exist: $BinaryPath" }
$hash = (Get-FileHash -LiteralPath $BinaryPath -Algorithm SHA256).Hash.ToLowerInvariant()
if (-not [string]::IsNullOrWhiteSpace($ExpectedSha256) -and $hash -ne $ExpectedSha256.ToLowerInvariant()) { throw "SHA-256 mismatch for $BinaryPath. Expected $ExpectedSha256; got $hash." }
if ($IsWindows) {
    $signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($null -ne $signtool) {
        & $signtool.Source verify /pa /all $BinaryPath
        if ($LASTEXITCODE -ne 0) { throw "Authenticode verification failed: $BinaryPath" }
    }
}
Write-Host "Native artifact verified: $BinaryPath"
Write-Host "SHA-256: $hash"
