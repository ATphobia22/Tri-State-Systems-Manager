# Applied by CI before acquisition to prevent soft-fail of mandatory sources.
$ErrorActionPreference = "Stop"
$path = ".\scripts\posey\download-offline-authoritative-data.ps1"
$src = Get-Content -LiteralPath $path -Raw -Encoding UTF8
$old = @'
function Save-IgioWithResilience([scriptblock]$Acquisition, [string]$RequiredId) {
  try {
    return & $Acquisition
  } catch {
    Write-Warning "IGIO source unavailable (likely 504 outage): $RequiredId - $($_.Exception.Message)"
    return [pscustomobject]@{
      id=$RequiredId; authority="Indiana GIO"; path=$null; url=$null
      sha256=$null; bytes=0; featureCount=0; spatialRelation=$null
      status="unavailable-igio-outage"
    }
  }
}
'@
$new = @'
function Save-IgioWithResilience([scriptblock]$Acquisition, [string]$RequiredId) {
  $mandatoryIds = @("indiana-dnr-bafm", "indiana-gio-parcels-2025")
  try {
    return & $Acquisition
  } catch {
    if ($RequiredId -in $mandatoryIds) {
      Write-Error "Mandatory source $RequiredId failed; soft-outage is not permitted. $($_.Exception.Message)"
      throw
    }
    Write-Warning "IGIO source unavailable (likely 504 outage): $RequiredId - $($_.Exception.Message)"
    return [pscustomobject]@{
      id=$RequiredId; authority="Indiana GIO"; path=$null; url=$null
      sha256=$null; bytes=0; featureCount=0; spatialRelation=$null
      status="unavailable-igio-outage"
    }
  }
}
'@
if ($src.Contains($old.Trim())) {
  $src2 = $src.Replace($old.Trim(), $new.Trim())
  Set-Content -LiteralPath $path -Value $src2 -Encoding utf8
  Write-Host "Applied mandatory-source hard-fail patch to download script."
} else {
  Write-Host "Patch target not found (already patched or structure changed); continuing."
}
