[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$CommitSha,
    [Parameter(Mandatory=$true)][string]$RemoteName,
    [string]$DriveFolderId = '1qc7cSiAplGakgBwrjwiFQ4yNy9TV7gwF',
    [string]$InstallerDirectory = 'dist/installer',
    [string]$ProvenanceDirectory = 'dist/provenance'
)
$ErrorActionPreference = 'Stop'
if ($CommitSha -cnotmatch '^[a-f0-9]{40}$') { throw 'Immutable commit SHA required' }
if ($RemoteName -cnotmatch '^[A-Za-z0-9_-]+:$') { throw 'Expected preconfigured rclone Drive remote name ending in colon' }
if ($DriveFolderId -notmatch '^[A-Za-z0-9_-]+$') { throw 'Invalid Drive folder ID' }
$rclone = Get-Command rclone -ErrorAction Stop
$installer = @(Get-ChildItem -LiteralPath $InstallerDirectory -File -Filter 'TSM-Native-Setup-*-windows-x64.exe')
if ($installer.Count -ne 1) { throw "Expected exactly one signed UE Windows installer; got $($installer.Count)" }
$mustHave = @(
    'windows-ue-buildcookrun.log',
    'windows-ue-shipping-static-evidence.json',
    'windows-release-manifest.json',
    'windows-native.spdx.json'
)
foreach ($file in $mustHave) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProvenanceDirectory $file) -PathType Leaf)) {
        throw "Provenance artifact missing: $file"
    }
}
$tmp = Join-Path $env:RUNNER_TEMP "tsm-drive-$CommitSha"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
foreach ($file in @($installer[0].FullName) + @($mustHave | ForEach-Object { Join-Path $ProvenanceDirectory $_ })) {
    Copy-Item -LiteralPath $file -Destination $tmp -Force
}
$files = @(Get-ChildItem -LiteralPath $tmp -File | Sort-Object Name)
$inventory = foreach ($file in $files) {
    [ordered]@{
        name = $file.Name
        bytes = $file.Length
        sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
$record = [ordered]@{
    schema = 'tsm.ue58.drive.archive.v1'
    sourceCommit = $CommitSha
    uploadedUtc = (Get-Date).ToUniversalTime().ToString('o')
    status = 'ARCHIVED_NOT_CLEAN_HOST_VERIFIED'
    cleanWindows11OfflineLaunchVerified = $false
    engineeringCertified = $false
    driveFolderId = $DriveFolderId
    files = @($inventory)
}
$record | ConvertTo-Json -Depth 7 | Set-Content (Join-Path $tmp 'archive-manifest.json') -Encoding UTF8
$dest = "$RemoteName$CommitSha"
& $rclone.Source --drive-root-folder-id $DriveFolderId copy $tmp $dest --immutable --transfers 2 --checkers 4
if ($LASTEXITCODE -ne 0) { throw 'Google Drive artifact upload failed' }
& $rclone.Source --drive-root-folder-id $DriveFolderId check $tmp $dest
if ($LASTEXITCODE -ne 0) { throw 'Google Drive upload checksum/size comparison failed' }
Write-Host "TSM Drive archived at private folder $DriveFolderId revision $CommitSha (offline runtime acceptance NOT verified)"
