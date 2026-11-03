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
  pe.writeUInt16LE(0xF0, 148); // PE32+ optional header size
  pe.writeUInt16LE(0x20b, 152); // PE32+ magic
  const exe = file(archive, "TSMNative.exe", pe);
  file(archive, "TSMNative/Content/Paks/TSMNative-Windows.pak", Buffer.from("TEST ONLY - NOT AN UNREAL PAK"));
  file(archive, "Engine/Binaries/Win64/ArchimedesCore.dll", Buffer.from("TEST DLL"));
  file(archive, "Engine/Binaries/Win64/mod_spatialite.dll", Buffer.from("TEST DLL"));
  file(engineRoot, "Engine/Build/Build.version", JSON.stringify({ MajorVersion: 5, MinorVersion: 8, PatchVersion: 0 }));
  file(engineRoot, "Engine/Plugins/Marketplace/CesiumForUnreal/CesiumForUnreal.uplugin",
    JSON.stringify({ VersionName: "2.29.1" }));
  fs.writeFileSync(buildLog, "TSM_SOURCE_COMMIT=" + "a".repeat(40) + "\nRunning BuildCookRun -clientconfig=Shipping\nAutomationTool exiting with ExitCode=0 (Success)\n");
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
test("rejects a symlinked archive root even when target has otherwise valid files", (t) => {
  const f = fixture(t);
  if (process.platform === "win32") {
    t.skip("Windows symlink creation may require developer mode or elevated permissions");
    return;
  }
  const alias = path.join(path.dirname(f.archive), "alias-archive");
  fs.symlinkSync(f.archive, alias, "dir");
  assert.throws(() => verifyWindowsShipping({ ...f, archive: alias }),
    /symlinked UE archive root/);
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
  fs.writeFileSync(f.buildLog, "TSM_SOURCE_COMMIT=" + f.commit + "\nBuildCookRun -clientconfig=Shipping\nAutomationTool exiting with ExitCode=1\n");
  assert.throws(() => verifyWindowsShipping(f), /successful Unreal AutomationTool/);
});
test("rejects a declared non-Shipping build", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.buildLog, "TSM_SOURCE_COMMIT=" + f.commit + "\nBuildCookRun -clientconfig=Development\nAutomationTool exiting with ExitCode=0\n");
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
test("rejects deceptive Cesium version prefixes that are not the pinned release", (t) => {
  const f = fixture(t);
  const pluginFile = path.join(f.engineRoot, "Engine/Plugins/Marketplace/CesiumForUnreal/CesiumForUnreal.uplugin");
  fs.writeFileSync(pluginFile, '{"VersionName":"2.29.10"}');
  assert.throws(() => verifyWindowsShipping(f), /2\.29\.1/);
  fs.writeFileSync(pluginFile, '{"VersionName":"2.29.1-local-modified"}');
  assert.throws(() => verifyWindowsShipping(f), /2\.29\.1/);
});

test("Windows runner preflight checks installed engine, Cesium and packaging tools", () => {
  const file = new URL("./Validate-NativeRunner.ps1", import.meta.url);
  const preflight = fs.readFileSync(file, "utf8");
  const required = [
    "UE_ROOT", "native-geospatial-runtime.json", "Build.version", "RunUAT.bat",
    "UnrealEditor.exe", "CesiumForUnreal.uplugin", "VersionName", "2.29.1",
    "signtool.exe", "ISCC.exe",
  ];
  for (const token of required) {
    assert.ok(preflight.includes(token), `Missing Windows runner preflight: ${token}`);
  }
  assert.match(preflight, /MajorVersion\s+-eq\s+5/);
  assert.match(preflight, /MinorVersion\s+-eq\s+8/);
  assert.match(preflight, /VersionName\s+-ceq\s+"2\.29\.1"/);
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

test("rejects absent or mismatched transcript source SHA even with successful UAT", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.buildLog, "BuildCookRun -clientconfig=Shipping\nAutomationTool exiting with ExitCode=0\n");
  assert.throws(() => verifyWindowsShipping(f), /transcript.*commit/i);
  fs.writeFileSync(f.buildLog, "TSM_SOURCE_COMMIT=" + "b".repeat(40) +
    "\nBuildCookRun -clientconfig=Shipping\nAutomationTool exiting with ExitCode=0\n");
  assert.throws(() => verifyWindowsShipping(f), /transcript.*commit/i);
});
test("rejects duplicated source SHA markers even if both agree", (t) => {
  const f = fixture(t);
  const stamp = "TSM_SOURCE_COMMIT=" + f.commit + "\n";
  fs.writeFileSync(f.buildLog, stamp + stamp +
    "BuildCookRun -clientconfig=Shipping\nAutomationTool exiting with ExitCode=0\n");
  assert.throws(() => verifyWindowsShipping(f), /transcript.*commit/i);
});

test("rejects an AMD64 PE with PE32 (not PE32+) optional-header magic", (t) => {
  const f = fixture(t);
  const bytes = fs.readFileSync(f.exe);
  bytes.writeUInt16LE(0x10b, 152);
  fs.writeFileSync(f.exe, bytes);
  assert.throws(() => verifyWindowsShipping(f), /PE32\+/);
});
test("rejects truncated PE optional-header claims", (t) => {
  const f = fixture(t);
  const bytes = fs.readFileSync(f.exe);
  bytes.writeUInt16LE(0xFFFF, 148);
  fs.writeFileSync(f.exe, bytes);
  assert.throws(() => verifyWindowsShipping(f), /optional header/);
});


test("native workflow records a verified checkout SHA before invoking Windows BuildCookRun", () => {
  const workflow = fs.readFileSync(new URL("../../.github/workflows/tsm-native.yml", import.meta.url), "utf8");
  const start = workflow.indexOf("      - name: Build native Windows package");
  const end = workflow.indexOf("      - name: Verify genuine UE5.8 Win64 Shipping archive", start);
  assert.ok(start >= 0 && end > start, "native Windows packaging step must exist");
  const step = workflow.slice(start, end);
  const guard = "if ($env:GITHUB_SHA -notmatch '^[a-fA-F0-9]{40}$')";
  const git = "$checkoutSha = (git rev-parse HEAD).Trim()";
  const match = "if ($checkoutSha -ne $env:GITHUB_SHA)";
  const marker = 'Write-Host "TSM_SOURCE_COMMIT=$checkoutSha"';
  const build = "Build-TSMNativeWindows.ps1 -UnrealRoot $env:UE_ROOT";
  const positions = [guard, git, match, marker, build].map((token) => step.indexOf(token));
  assert.ok(positions.every((i) => i >= 0), "exact SHA preflight, stamp and BuildCookRun invocation must be present");
  assert.deepEqual([...positions].sort((a, b) => a - b), positions,
    "checkout must be verified and stamped before packaging");
});

test("rejects UAT logs with a failed attempt followed by successful exit", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.buildLog,
    "TSM_SOURCE_COMMIT=" + f.commit + "\n" +
    "BuildCookRun -clientconfig=Shipping\n" +
    "AutomationTool exiting with ExitCode=-1\n" +
    "AutomationTool exiting with ExitCode=0\n");
  assert.throws(() => verifyWindowsShipping(f), /expected exactly one ExitCode=0/);
});
test("rejects duplicated successful UAT exits in a single transcript", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.buildLog,
    "TSM_SOURCE_COMMIT=" + f.commit + "\n" +
    "BuildCookRun -clientconfig=Shipping\n" +
    "AutomationTool exiting with ExitCode=0\n" +
    "AutomationTool exiting with ExitCode=0\n");
  assert.throws(() => verifyWindowsShipping(f), /expected exactly one ExitCode=0/);
});
