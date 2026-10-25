import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyWindowsShipping } from "./verify-ue-windows-shipping.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsm-ue-shipping-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const archive = path.join(root, "Windows", "TSMNative");
  const engineRoot = path.join(root, "Unreal");
  const buildLog = path.join(root, "uat.log");
  const file = (base, relative, data) => {
    const p = path.join(base, relative);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
    return p;
  };
  const pe = Buffer.alloc(512);
  pe.write("MZ", 0, "ascii");
  pe.writeUInt32LE(128, 0x3c);
  pe.write("PE\0\0", 128, "latin1");
  pe.writeUInt16LE(0x8664, 132);
  const exe = file(archive, "TSMNative.exe", pe);
  file(archive, "TSMNative/Content/Paks/TSMNative-Windows.pak", Buffer.from("TEST ONLY - NOT AN UNREAL PAK"));
  file(archive, "Engine/Binaries/Win64/ArchimedesCore.dll", Buffer.from("TEST DLL"));
  file(archive, "Engine/Binaries/Win64/mod_spatialite.dll", Buffer.from("TEST DLL"));
  file(engineRoot, "Engine/Build/Build.version", JSON.stringify({ MajorVersion: 5, MinorVersion: 8, PatchVersion: 0 }));
  file(engineRoot, "Engine/Plugins/Marketplace/CesiumForUnreal/CesiumForUnreal.uplugin",
    JSON.stringify({ VersionName: "2.29.1" }));
  fs.writeFileSync(buildLog, "Running BuildCookRun -clientconfig=Shipping\nAutomationTool exiting with ExitCode=0 (Success)\n");
  return { archive, engineRoot, buildLog, exe, file, commit: "a".repeat(40) };
}
test("static proof passes correctly shaped fixture but never asserts an offline launch", (t) => {
  const f = fixture(t);
  const result = verifyWindowsShipping(f);
  assert.equal(result.status, "STATIC_PACKAGE_VERIFIED_OFFLINE_LAUNCH_PENDING");
  assert.equal(result.releaseCertified, false);
  assert.equal(result.cleanWindows11OfflineLaunchVerified, false);
  assert.equal(result.runtimeDataManifestVerified, false);
  assert.equal(result.inspectedFiles.length, 4);
  assert.equal(result.engine.cesiumPlugin, "2.29.1");
  assert.match(result.inspectedFiles[0].sha256, /^[0-9a-f]{64}$/);
});
test("rejects a false renamed .exe", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.exe, "I am not a Windows executable");
  assert.throws(() => verifyWindowsShipping(f), /Windows PE/);
});
test("rejects a non-AMD64 binary", (t) => {
  const f = fixture(t);
  const bytes = fs.readFileSync(f.exe);
  bytes.writeUInt16LE(0x14c, 132);
  fs.writeFileSync(f.exe, bytes);
  assert.throws(() => verifyWindowsShipping(f), /AMD64/);
});
test("rejects a missing cook archive", (t) => {
  const f = fixture(t);
  fs.rmSync(path.join(f.archive, "TSMNative/Content/Paks"), {recursive:true, force:true});
  assert.throws(() => verifyWindowsShipping(f), /No UE cooked/);
});
test("rejects an unsigned/absent UAT success claim", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.buildLog, "BuildCookRun -clientconfig=Shipping\nAutomationTool exiting with ExitCode=1\n");
  assert.throws(() => verifyWindowsShipping(f), /successful Unreal AutomationTool/);
});
test("rejects a declared non-Shipping build", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.buildLog, "BuildCookRun -clientconfig=Development\nAutomationTool exiting with ExitCode=0\n");
  assert.throws(() => verifyWindowsShipping(f), /clientconfig=Shipping/);
});
test("rejects mismatch with required installed UE 5.8", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.engineRoot, "Engine/Build/Build.version"), '{"MajorVersion":5,"MinorVersion":7}');
  assert.throws(() => verifyWindowsShipping(f), /Unreal Engine 5.8/);
});
test("rejects a mismatched installed Cesium plugin", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.engineRoot, "Engine/Plugins/Marketplace/CesiumForUnreal/CesiumForUnreal.uplugin"),
    '{"VersionName":"2.28.0"}');
  assert.throws(() => verifyWindowsShipping(f), /2.29.1/);
});
test("rejects a packaged browser/Node runtime", (t) => {
  const f = fixture(t);
  f.file(f.archive, "ThirdParty/msedgewebview2.exe", Buffer.from("runtime"));
  assert.throws(() => verifyWindowsShipping(f), /Browser\/Node runtime/);
});
test("requires a pinned commit", (t) => {
  const f = fixture(t);
  assert.throws(() => verifyWindowsShipping({...f, commit:"main"}), /Immutable 40-character/);
});
