[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet("windows-ue5")][string]$RunnerClass)
$ErrorActionPreference="Stop"
$checks=@()
$checks += [ordered]@{name="UE_ROOT";ok=!!$env:UE_ROOT}
$checks += [ordered]@{name="CMake";ok=!!(Get-Command cmake -ErrorAction SilentlyContinue)}
$checks += [ordered]@{name="Ninja";ok=!!(Get-Command ninja -ErrorAction SilentlyContinue)}
$checks += [ordered]@{name="signtool";ok=!!(Get-Command signtool.exe -ErrorAction SilentlyContinue)}
if(-not ($checks | Where-Object {!$_.ok})){Write-Host "Runner contract OK: $RunnerClass"; exit 0}
$checks | Where-Object {!$_.ok} | ForEach-Object {Write-Error "Missing runner capability: $($_.name)"}
exit 1
