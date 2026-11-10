import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const preflight = readFileSync(new URL("scripts/native/Invoke-Windows11RunnerPreflight.ps1", root), "utf8");
const handoff = readFileSync(new URL("docs/release/WINDOWS11-OWNER-RUNNER-HANDOFF-2026-11-10.md", root), "utf8");

test("Windows preflight covers genuine UE Shipping prerequisites without release claims", () => {
  for (const requirement of [
    "Build.version", "CesiumForUnreal.uplugin", "RunUAT.bat",
    "UnrealEditor-Cmd.exe", "TSM_NATIVE_DATA_ROOT", "data-manifest.json",
    "tileset.json", "TSM_SPATIALITE_DLL", "ISCC.exe", "signtool.exe",
    "LOCAL_STATIC_PREFLIGHT_READY", "shippingBuilt = $false",
    "offlineVisualTestPassed = $false", "geodeticAccepted = $false"
  ]) assert.ok(preflight.includes(requirement), requirement);
  assert.doesNotMatch(preflight, /git reset --hard|git clean -fdx|New-NetFirewallRule|Start-Process|Invoke-WebRequest/);
});
test("Windows handoff preserves Drive privacy and separates independent release evidence", () => {
  for (const token of [
    "1efwQlV1D3Aat4rhcmYPoo_kNtCRMNUt3",
    "1qc7cSiAplGakgBwrjwiFQ4yNy9TV7gwF",
    "Restore-TSMDataFromDrive.ps1",
    "Verify-NativeDataManifest.ps1",
    "Test-OfflineWindows11Shipping.ps1",
    "clean Windows 11", "EPSG:2968", "EPSG:2966"
  ]) assert.ok(handoff.includes(token), token);
});
