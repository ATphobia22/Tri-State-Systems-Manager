[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet("windows-ue5")][string]$RunnerClass)

$ErrorActionPreference = "Stop"
$checks = @()
$ueRoot = $env:UE_ROOT
$ueRootValid = (-not [string]::IsNullOrWhiteSpace($ueRoot)) -and
    (Test-Path -LiteralPath $ueRoot -PathType Container)
$checks += [ordered]@{name="UE_ROOT installed engine directory";ok=$ueRootValid}

$runtimeContractPath = Join-Path $PSScriptRoot "..\..\tsm-native\config\native-geospatial-runtime.json"
$runtimeContractOk = $false
if (Test-Path -LiteralPath $runtimeContractPath -PathType Leaf) {
    try {
        $contract = Get-Content -LiteralPath $runtimeContractPath -Raw | ConvertFrom-Json
        $runtimeContractOk = ($contract.engine.version -eq "5.8") -and
            ($contract.geospatial.pluginVersion -eq "2.29.1")
    } catch {
        $runtimeContractOk = $false
    }
}
$checks += [ordered]@{name="pinned UE 5.8 / Cesium 2.29.1 runtime contract";ok=$runtimeContractOk}

if ($ueRootValid) {
    $buildVersionPath = Join-Path $ueRoot "Engine\Build\Build.version"
    $engineVersionOk = $false
    if (Test-Path -LiteralPath $buildVersionPath -PathType Leaf) {
        try {
            $buildVersion = Get-Content -LiteralPath $buildVersionPath -Raw | ConvertFrom-Json
            $engineVersionOk = ($buildVersion.MajorVersion -eq 5) -and ($buildVersion.MinorVersion -eq 8)
        } catch {
            $engineVersionOk = $false
        }
    }
    $checks += [ordered]@{name="installed Unreal Engine 5.8 Build.version";ok=$engineVersionOk}
    $checks += [ordered]@{
        name="Unreal AutomationTool RunUAT.bat"
        ok=(Test-Path -LiteralPath (Join-Path $ueRoot "Engine\Build\BatchFiles\RunUAT.bat") -PathType Leaf)
    }
    $checks += [ordered]@{
        name="UnrealEditor.exe for Win64"
        ok=(Test-Path -LiteralPath (Join-Path $ueRoot "Engine\Binaries\Win64\UnrealEditor.exe") -PathType Leaf)
    }

    $pluginPath = Join-Path $ueRoot "Engine\Plugins\Marketplace\CesiumForUnreal\CesiumForUnreal.uplugin"
    $pluginVersionOk = $false
    if (Test-Path -LiteralPath $pluginPath -PathType Leaf) {
        try {
            $installedPlugin = Get-Content -LiteralPath $pluginPath -Raw | ConvertFrom-Json
            $pluginVersionOk = ($installedPlugin.VersionName -ceq "2.29.1")
        } catch {
            $pluginVersionOk = $false
        }
    }
    $checks += [ordered]@{name="installed CesiumForUnreal 2.29.1 plugin";ok=$pluginVersionOk}
}

$checks += [ordered]@{name="CMake";ok=!!(Get-Command cmake -ErrorAction SilentlyContinue)}
$checks += [ordered]@{name="Ninja";ok=!!(Get-Command ninja -ErrorAction SilentlyContinue)}
$checks += [ordered]@{name="signtool.exe";ok=!!(Get-Command signtool.exe -ErrorAction SilentlyContinue)}
$checks += [ordered]@{name="Inno Setup ISCC.exe";ok=!!(Get-Command ISCC.exe -ErrorAction SilentlyContinue)}

$missing = @($checks | Where-Object {-not $_.ok} | ForEach-Object {$_.name})
if ($missing.Count -gt 0) {
    throw "Runner contract failed for $RunnerClass; missing or invalid capabilities: $($missing -join ', ')"
}
Write-Host "Runner contract OK: $RunnerClass (UE 5.8, Cesium 2.29.1, Windows packaging tools)"
