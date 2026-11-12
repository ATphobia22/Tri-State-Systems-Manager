# Windows 11 physically disconnected headed first-launch evidence capture.
# Invoke manually on a clean sacrificial Windows 11 desktop after installing
# the signed release. No firewall configuration, service install or network access.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Executable,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
    [Parameter(Mandatory=$true)][string]$ExpectedSha256,
    [Parameter(Mandatory=$true)][string]$ApprovedSignerSha1,
    [ValidateRange(12,120)][int]$ObservationSeconds = 30
)
$ErrorActionPreference = 'Stop'
$exe = (Resolve-Path -LiteralPath $Executable -ErrorAction Stop).Path
if ($ExpectedSha256 -notmatch '^[a-fA-F0-9]{64}$' -or $ApprovedSignerSha1 -notmatch '^[a-fA-F0-9]{40}$') {
    throw 'Expected SHA-256 and signer SHA-1 evidence are required.'
}
if (-not [Environment]::UserInteractive) { throw 'Headed interactive desktop required; service/session-zero capture rejected.' }
$os = Get-CimInstance Win32_OperatingSystem
if ($os.Caption -notmatch 'Windows 11') {
    throw 'Windows 11 acceptance requires a genuine Windows 11 workstation, not Windows Server.'
}
$physical = @(Get-NetAdapter -Physical -ErrorAction Stop | Where-Object { $_.Status -eq 'Up' })
if ($physical.Count -gt 0) {
    throw 'Physical network interfaces are still up. Disconnect physically before this air-gapped test.'
}
$actual = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
if ($actual -ne $ExpectedSha256) { throw 'Installed native executable differs from the signed release hash.' }
$signature = Get-AuthenticodeSignature -LiteralPath $exe
if ($signature.Status -ne 'Valid' -or
    $null -eq $signature.SignerCertificate -or
    $signature.SignerCertificate.Thumbprint -ne $ApprovedSignerSha1) {
    throw 'Native executable Authenticode signature or signer is invalid.'
}
if (Test-Path -LiteralPath $EvidenceDirectory) {
    throw 'Evidence output directory must be new; existing evidence is immutable.'
}
New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
$dir = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$receipt = Join-Path $dir 'windows11-offline-first-launch.json'
$screenshot = Join-Path $dir 'headed-desktop.png'
$log = Join-Path $dir 'native-runtime.log'
$record = [ordered]@{
    schema = 'tsm.native.windows11.verified-host-launch.v1'
    state = 'NOT_EVIDENCED'
    os_caption = $os.Caption
    os_version = $os.Version
    observed_utc = (Get-Date).ToUniversalTime().ToString('o')
    physical_interfaces_up = 0
    executable_sha256 = $actual.ToLowerInvariant()
    signer_sha1 = $signature.SignerCertificate.Thumbprint
    process_started = $false
    alive_after_observation = $false
    headed_capture_observed = $false
    screenshot_sha256 = $null
    exit_method = 'NOT_TESTED'
    regular_exit_verified = $false
    fps_vram_telemetry_verified = $false
    menu_and_layer_interactions_verified = $false
    lidar_and_terrain_scientifically_aligned = $false
    clean_host_independently_attested = $false
    approval = 'HUMAN_REVIEW_REQUIRED'
}
$process = $null
try {
    $process = Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe) -PassThru `
        -ArgumentList @('-windowed', '-ResX=1280', '-ResY=720', '-log', "-abslog=$log")
    $record.process_started = ($null -ne $process)
    Start-Sleep -Seconds $ObservationSeconds
    $process.Refresh()
    $record.alive_after_observation = -not $process.HasExited
    if (-not $record.alive_after_observation) {
        throw 'The native process exited before the headed observation.'
    }
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $rect = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    if ($rect.Width -lt 640 -or $rect.Height -lt 480) {
        throw 'Desktop screen too small for a useful headed screenshot.'
    }
    $bmp = New-Object System.Drawing.Bitmap($rect.Width, $rect.Height)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $graphics.CopyFromScreen($rect.Location, [System.Drawing.Point]::Empty, $rect.Size)
        } finally { $graphics.Dispose() }
        $bmp.Save($screenshot, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $bmp.Dispose() }
    if ((Get-Item -LiteralPath $screenshot).Length -le 0) { throw 'Screenshot is empty.' }
    $record.headed_capture_observed = $true
    $record.screenshot_sha256 = (Get-FileHash -LiteralPath $screenshot -Algorithm SHA256).Hash.ToLowerInvariant()
    $record.state = 'AIR_GAPPED_PROCESS_LAUNCH_AND_DESKTOP_CAPTURE_OBSERVED_REVIEW_PENDING'
} catch {
    $record.state = 'RUNTIME_SMOKE_FAILED'
    $record.failure = $_.Exception.Message
} finally {
    if ($null -ne $process) {
        $process.Refresh()
        if (-not $process.HasExited) {
            try { if ($process.CloseMainWindow()) { $process.WaitForExit(10000) | Out-Null } } catch {}
            $process.Refresh()
            if (-not $process.HasExited) {
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                $record.exit_method = 'FORCED_AFTER_SMOKE_TEST'
            } else {
                $record.exit_method = 'WINDOW_CLOSE_REQUEST'
            }
        } else { $record.exit_method = 'PROCESS_EXITED' }
    }
    $record.finished_utc = (Get-Date).ToUniversalTime().ToString('o')
    $record | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $receipt -Encoding utf8
}
if ($record.state -ne 'AIR_GAPPED_PROCESS_LAUNCH_AND_DESKTOP_CAPTURE_OBSERVED_REVIEW_PENDING') {
    throw "Air-gapped headed smoke test did not pass: $($record.state). Inspect $receipt."
}
Write-Host "AIR_GAPPED_HEAD_DESKTOP_CAPTURED=$screenshot"
Write-Warning 'A screenshot and live process are not proof of visual GIS alignment, interactive feature correctness, VRAM/FPS, normal exit or clean-host provenance.'
