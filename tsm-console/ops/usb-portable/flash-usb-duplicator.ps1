# PTDT v35 / TSM — Multi-drive raw sector USB duplicator (Windows 11 elevated)
# SAFETY: Destroys all data on target USB disks. Admin required. Explicit confirm.
# Invariants reference: EPSG:2966 / NAVD88 | BFE 375.0 | LAG 377.2
# Do not run from CI. Operator-only.

[CmdletBinding()]
param (
    [string]$ImagePath = "ptdt_v35_master_duplication.img",
    [int]$BufferSize = 1048576,
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"

$Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = New-Object Security.Principal.WindowsPrincipal($Identity)
if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "CRITICAL: Administrative privileges required for PhysicalDrive access."
    Exit 1
}

Write-Host "PTDT/TSM MULTI-DRIVE RAW SECTOR DUPLICATOR" -ForegroundColor Cyan
Write-Host "Source Image: $ImagePath | Buffer: $BufferSize bytes" -ForegroundColor Gray

if (-not (Test-Path $ImagePath)) {
    Write-Error "Source image not found: $ImagePath"
    Exit 1
}

$ImageHash = (Get-FileHash -Path $ImagePath -Algorithm SHA256).Hash.ToLower()
Write-Host "Source SHA-256: $ImageHash" -ForegroundColor Green

$AllDisks = Get-Disk | Where-Object { $_.BusType -eq "USB" -or $_.BusType -eq "SCSI" }
$TargetUSBDisks = @()
foreach ($Disk in $AllDisks) {
    if ($Disk.IsSystem -or $Disk.IsBoot -or $Disk.IsReadOnly) {
        Write-Host "Skip protected Disk $($Disk.Number): $($Disk.FriendlyName)" -ForegroundColor DarkYellow
        continue
    }
    if ($Disk.Size -ge 26GB -and $Disk.Size -le 34GB) {
        $TargetUSBDisks += $Disk
        Write-Host "TARGET Disk $($Disk.Number): $($Disk.FriendlyName) ($([Math]::Round($Disk.Size / 1GB, 2)) GB)" -ForegroundColor Green
    }
}

if ($TargetUSBDisks.Count -eq 0) {
    Write-Warning "No compatible ~32GB USB targets found."
    Exit 0
}

if (-not $Force) {
    Write-Host "WARNING: Raw writes will DESTROY all data on:" -ForegroundColor Red
    foreach ($Target in $TargetUSBDisks) {
        Write-Host "  PhysicalDrive$($Target.Number) ($($Target.FriendlyName))" -ForegroundColor Yellow
    }
    $Confirmation = Read-Host "Type YES_DUPLICATE_v35 to proceed"
    if ($Confirmation -ne "YES_DUPLICATE_v35") {
        Write-Host "Aborted."
        Exit 0
    }
}

foreach ($Disk in $TargetUSBDisks) {
    Clear-Disk -Number $Disk.Number -RemoveData -RemoveOEM -Confirm:$false
}

$JobBlock = {
    param ([string]$SrcPath, [int]$DiskNumber, [int]$BlockSize)
    $PhysicalPath = "\\.\PhysicalDrive$DiskNumber"
    $SourceStream = [System.IO.File]::Open($SrcPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    $TargetStream = [System.IO.File]::Open($PhysicalPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
    $Buffer = New-Object byte[] $BlockSize
    $TotalWritten = 0
    try {
        while (($BytesRead = $SourceStream.Read($Buffer, 0, $Buffer.Length)) -gt 0) {
            $TargetStream.Write($Buffer, 0, $BytesRead)
            $TotalWritten += $BytesRead
        }
        $TargetStream.Flush()
        return [PSCustomObject]@{ Disk = "PhysicalDrive$DiskNumber"; Status = "SUCCESS"; WrittenMb = [Math]::Round($TotalWritten / 1MB, 2); Error = $null }
    } catch {
        return [PSCustomObject]@{ Disk = "PhysicalDrive$DiskNumber"; Status = "FAILED"; WrittenMb = [Math]::Round($TotalWritten / 1MB, 2); Error = $_.Exception.Message }
    } finally {
        $SourceStream.Close(); $TargetStream.Close()
    }
}

$Jobs = @()
foreach ($Disk in $TargetUSBDisks) {
    $Jobs += Start-Job -ScriptBlock $JobBlock -ArgumentList @($ImagePath, $Disk.Number, $BufferSize)
}
while ($Jobs.State -contains "Running") { Start-Sleep -Seconds 5 }

$FailureCount = 0
foreach ($Job in $Jobs) {
    $Result = Receive-Job -Job $Job
    Remove-Job -Job $Job
    if ($Result.Status -eq "SUCCESS") {
        Write-Host "[OK] $($Result.Disk) $($Result.WrittenMb) MB" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] $($Result.Disk): $($Result.Error)" -ForegroundColor Red
        $FailureCount++
    }
}

if ($FailureCount -eq 0) {
    Write-Host "DUPLICATION COMPLETE ($($TargetUSBDisks.Count) targets)." -ForegroundColor Green
} else {
    Write-Host "DUPLICATION FAILURES: $FailureCount" -ForegroundColor Red
    Exit 1
}
