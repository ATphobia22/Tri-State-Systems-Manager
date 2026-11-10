[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$RemoteName,
    [Parameter(Mandatory=$true)][string]$DataRoot,
    [string]$DriveFolderId = '1efwQlV1D3Aat4rhcmYPoo_kNtCRMNUt3'
)
$ErrorActionPreference = 'Stop'
if ($RemoteName -cnotmatch '^[A-Za-z0-9_-]+:$') { throw 'TSM_DATA_DRIVE_REMOTE must be a pre-authorized rclone remote ending in colon' }
if ([string]::IsNullOrWhiteSpace($DataRoot)) { throw 'TSM_NATIVE_DATA_ROOT required' }
if ($DriveFolderId -notmatch '^[A-Za-z0-9_-]+$') { throw 'Invalid Drive input folder ID' }
$tool = Get-Command rclone -ErrorAction Stop
$dest = [System.IO.Path]::GetFullPath($DataRoot)
New-Item -ItemType Directory -Path $dest -Force | Out-Null
if ((Get-Item -LiteralPath $dest).LinkType) { throw 'Refusing symlinked local data root' }
# No deletes, no unaudited source substitutions. Missing/extra files are rejected
# downstream by the SHA-256 manifest verifier.
& $tool.Source --drive-root-folder-id $DriveFolderId copy $RemoteName $dest --immutable --transfers 2 --checkers 4
if ($LASTEXITCODE -ne 0) { throw 'Drive staged-data restore failed' }
$manifest = Join-Path $dest 'data-manifest.json'
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { throw 'No pinned data-manifest.json in private Drive snapshot' }
& node (Join-Path $PSScriptRoot 'native-data-manifest.mjs') verify $dest $manifest true
if ($LASTEXITCODE -ne 0) { throw 'Restored Drive snapshot failed strict SHA-256, size or path verification' }
Write-Host 'Source bytes restored and verified. Datum, license, scene completeness and regulatory approval still require separate evidence.'
