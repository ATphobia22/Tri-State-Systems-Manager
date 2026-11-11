<#
.SYNOPSIS
  Evidence-oriented headed startup smoke test for packaged TSMNative on Windows 11.
.DESCRIPTION
  Process survival is a smoke test, not proof of rendered terrain or air-gap.
  Run on a physically disconnected test host; script cannot enforce isolation.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$ExecutablePath,
  [int]$MonitoringSeconds = 30,
  [string]$LogDirectory = '',
  [string]$EvidenceDirectory = '',
  [switch]$StopAfterCheck
)
$ErrorActionPreference = 'Stop'
if ($MonitoringSeconds -lt 10 -or $MonitoringSeconds -gt 600) {
  throw 'MonitoringSeconds must be between 10 and 600.'
}
$Exe = (Resolve-Path -LiteralPath $ExecutablePath -ErrorAction Stop).Path
if ([IO.Path]::GetExtension($Exe) -ne '.exe') { throw 'Executable must be a Windows .exe.' }
if ([string]::IsNullOrWhiteSpace($EvidenceDirectory)) {
  $EvidenceDirectory = Join-Path (Get-Location).Path 'dist\verification'
}
New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
$Stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$Report = Join-Path $EvidenceDirectory "offline-launch-$Stamp.json"
$Start = Get-Date
$ExeHash = (Get-FileHash -LiteralPath $Exe -Algorithm SHA256).Hash.ToLowerInvariant()
$Process = $null
$Status = 'NOT_VERIFIED'
$ExitCode = $null
$LogTail = @()
try {
  $Process = Start-Process -FilePath $Exe -WorkingDirectory (Split-Path $Exe -Parent) -PassThru
  Start-Sleep -Seconds $MonitoringSeconds
  $Process.Refresh()
  if ($Process.HasExited) {
    $ExitCode = $Process.ExitCode
    $Status = 'FAILED_EARLY_EXIT'
  } else {
    $Status = 'PROCESS_ALIVE_ONLY'
  }
  if ($LogDirectory -and (Test-Path -LiteralPath $LogDirectory)) {
    $Latest = Get-ChildItem -LiteralPath $LogDirectory -Filter '*.log' -File |
      Where-Object { $_.LastWriteTime -ge $Start.AddSeconds(-2) } |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($Latest) {
      $LogTail = @(Get-Content -LiteralPath $Latest.FullName -Tail 60)
      if ($LogTail -match '(?i)fatal error|unhandled exception|critical error|assertion failed') {
        $Status = 'FAILED_LOG_FATAL'
      }
    }
  }
} finally {
  if ($Process -and $StopAfterCheck -and -not $Process.HasExited) {
    Stop-Process -Id $Process.Id -ErrorAction SilentlyContinue
  }
  $Evidence = [ordered]@{
    schema_version='1.0.0'; status=$Status
    executable=$Exe; executable_sha256=$ExeHash
    started_utc=$Start.ToUniversalTime().ToString('o')
    checked_utc=(Get-Date).ToUniversalTime().ToString('o')
    monitoring_seconds=$MonitoringSeconds
    process_id=if($Process){$Process.Id}else{$null}
    exit_code=$ExitCode
    log_tail=$LogTail
    air_gap='NOT_ATTESTED'
    rendered_frame='NOT_ATTESTED'
    note='Manual clean Windows 11 air-gap, GPU screenshot and content inspection required.'
  }
  $Evidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $Report -Encoding UTF8
  Write-Host "Evidence: $Report"
}
if ($Status -like 'FAILED*') { throw "Packaged startup smoke test failed: $Status" }
Write-Host "Smoke test status: $Status (not full release verification)"
