#requires -Version 5.1
<#
.SYNOPSIS
    TSM Windows code-signing audit; advisory, never a release gate.
.DESCRIPTION
    Records observed Authenticode evidence. Does not sign binaries, import
    certificates, install roots, or claim trust on independent Windows 11.
#>
[CmdletBinding()]
param(
    [string]$ArchiveRoot = 'dist/tsm-native/Windows',
    [string]$InstallerDirectory = 'dist/installer',
    [string]$ExpectedPublisherSubject = '',
    [string]$SourceCommit = '',
    [string]$OutputPath = 'dist/provenance/windows-signing-advisory.json'
)
$ErrorActionPreference = 'Stop'
$signTool = Get-Command signtool.exe -ErrorAction SilentlyContinue
$setupFiles = @()
if (Test-Path -LiteralPath $InstallerDirectory -PathType Container) {
    $setupFiles = @(Get-ChildItem -LiteralPath $InstallerDirectory -File -Filter 'TSM-Native-Setup-*-windows-x64.exe' -ErrorAction SilentlyContinue)
}
$setupPath = if ($setupFiles.Count -eq 1) { $setupFiles[0].FullName } else { '' }
$targets = @(
    @{ role = 'native_launch_exe'; path = (Join-Path $ArchiveRoot 'TSMNative.exe') },
    @{ role = 'native_shipping_exe'; path = (Join-Path $ArchiveRoot 'TSMNative/Binaries/Win64/TSMNative-Win64-Shipping.exe') },
    @{ role = 'sovereign_dedup_companion'; path = (Join-Path $ArchiveRoot 'Tools/sde-graph.exe') },
    @{ role = 'offline_installer'; path = $setupPath }
)
$records = @()
foreach ($target in $targets) {
    $entry = [ordered]@{
        role = $target.role
        filename = if ($target.path) { Split-Path -Leaf $target.path } else { $null }
        status = 'NOT_EVIDENCED'
        issues = @()
        sha256 = $null
        signer_subject = $null
        signer_issuer = $null
        signer_thumbprint_sha1_identifier = $null
        authenticode_status_on_runner = 'NOT_CHECKED'
        code_signing_eku = $false
        timestamp_certificate_present = $false
        signtool_policy_on_runner = 'NOT_CHECKED'
        independent_windows11_chain = 'NOT_EVIDENCED'
    }
    try {
        if ($target.role -eq 'offline_installer' -and $setupFiles.Count -ne 1) {
            $entry.issues += 'REQUIRE_EXACTLY_ONE_INSTALLER'
        } elseif (-not $target.path -or -not (Test-Path -LiteralPath $target.path -PathType Leaf)) {
            $entry.issues += 'ARTIFACT_MISSING'
        } else {
            $item = Get-Item -LiteralPath $target.path
            if ($item.Length -le 0 -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
                $entry.issues += 'EMPTY_OR_REPARSE_POINT_ARTIFACT'
            } else {
                $entry.sha256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
                $signature = Get-AuthenticodeSignature -LiteralPath $item.FullName
                $entry.authenticode_status_on_runner = [string]$signature.Status
                if ($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate) {
                    $entry.issues += 'SIGNATURE_NOT_VALID_ON_RUNNER'
                } else {
                    $cert = $signature.SignerCertificate
                    $entry.signer_subject = $cert.Subject
                    $entry.signer_issuer = $cert.Issuer
                    $entry.signer_thumbprint_sha1_identifier = $cert.Thumbprint
                    if ($cert.Subject -ceq $cert.Issuer) { $entry.issues += 'SELF_SIGNED_LEAF' }
                    if ([string]::IsNullOrWhiteSpace($ExpectedPublisherSubject)) {
                        $entry.issues += 'APPROVED_PUBLISHER_NOT_CONFIGURED'
                    } elseif ($cert.Subject -cne $ExpectedPublisherSubject) {
                        $entry.issues += 'PUBLISHER_SUBJECT_MISMATCH'
                    }
                    $ekuExtension = $cert.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' } | Select-Object -First 1
                    if ($null -ne $ekuExtension) {
                        $usage = [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($ekuExtension, $ekuExtension.Critical)
                        $entry.code_signing_eku = ('1.3.6.1.5.5.7.3.3' -in @($usage.EnhancedKeyUsages | ForEach-Object { $_.Value }))
                    }
                    if (-not $entry.code_signing_eku) { $entry.issues += 'CODE_SIGNING_EKU_NOT_EVIDENCED' }
                    $entry.timestamp_certificate_present = ($null -ne $signature.TimeStamperCertificate)
                    if (-not $entry.timestamp_certificate_present) { $entry.issues += 'TIMESTAMP_NOT_EVIDENCED' }
                    if ($null -eq $signTool) {
                        $entry.issues += 'SIGNTOOL_NOT_INSTALLED'
                    } else {
                        & $signTool.Source verify /pa /all /tw $item.FullName | Out-Null
                        if ($LASTEXITCODE -eq 0) {
                            $entry.signtool_policy_on_runner = 'VALID_ON_RUNNER'
                        } else {
                            $entry.signtool_policy_on_runner = 'NOT_VERIFIED'
                            $entry.issues += 'SIGNTOOL_VERIFY_NONZERO'
                        }
                    }
                }
            }
        }
    } catch {
        $entry.issues += 'INSPECTION_ERROR'
    }
    $entry.status = if (@($entry.issues).Count -eq 0) {
        'RUNNER_CHECKS_OBSERVED_INDEPENDENT_VERIFICATION_PENDING'
    } else {
        'NEEDS_REVIEW'
    }
    $records += [pscustomobject]$entry
}
$issues = @($records | ForEach-Object { $_.issues })
$receipt = [ordered]@{
    schema = 'tsm.windows.signing-advisory.v1'
    mode = 'ADVISORY_NON_BLOCKING'
    build_or_publish_blocked_by_this_check = $false
    source_commit = $SourceCommit
    inspected_utc = (Get-Date).ToUniversalTime().ToString('o')
    approved_publisher_subject = if ($ExpectedPublisherSubject) { $ExpectedPublisherSubject } else { $null }
    artifacts = $records
    issue_count = $issues.Count
    public_signing_certification = 'NOT_EVIDENCED_ON_INDEPENDENT_WINDOWS11'
    public_distribution_approved_by_this_check = $false
    offline_windows11_runtime = 'NOT_EVIDENCED'
    scientific_or_regulatory_certification = 'NOT_EVIDENCED'
    human_authority_final = $true
}
try {
    $parent = Split-Path -Parent $OutputPath
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8 -NoNewline
    Write-Host "TSM_WINDOWS_SIGNING_ADVISORY=$OutputPath"
    Write-Host "TSM_WINDOWS_SIGNING_ISSUES=$($issues.Count)"
} catch {
    Write-Warning 'Advisory report unavailable; do not infer release trust.'
}
exit 0
