#!/usr/bin/env node
/**
 * Evidence gate for a COOKED Unreal Engine 5.8 Win64 Shipping package.
 * This is a static archive check, NOT a clean-host offline launch or release
 * certification. Do not use its result to claim executable runtime acceptance.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";

function required(condition, message) {
  if (!condition) throw new Error(message);
}
function listFiles(root, current = root) {
  return fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(current, entry.name);
    required(!entry.isSymbolicLink(), `Refusing archive symlink: ${full}`);
    return entry.isDirectory() ? listFiles(root, full) : entry.isFile() ? [full] : [];
  });
}
function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function peMachine(file) {
  const fd = fs.openSync(file, "r");
  try {
    const header = Buffer.alloc(4096);
    const n = fs.readSync(fd, header, 0, header.length, 0);
    required(n >= 64 && header.toString("ascii", 0, 2) === "MZ",
      "Expected a Windows PE executable, not a renamed file");
    const offset = header.readUInt32LE(0x3c);
    required(offset >= 64 && offset < n - 24 && header.toString("latin1", offset, offset + 4) === "PE\0\0",
      "Invalid PE header or truncated Windows executable");
    return header.readUInt16LE(offset + 4);
  } finally {
    fs.closeSync(fd);
  }
}
function inventory(file, root) {
  return {
    path: path.relative(root, file).split(path.sep).join("/"),
    bytes: fs.statSync(file).size,
    sha256: digest(file),
  };
}
function validateEngine(engineRoot) {
  const buildVersion = path.join(engineRoot, "Engine", "Build", "Build.version");
  required(fs.existsSync(buildVersion), "UE Engine/Build/Build.version is missing");
  const version = JSON.parse(fs.readFileSync(buildVersion, "utf8"));
  required(version.MajorVersion === 5 && version.MinorVersion === 8,
    `Required Unreal Engine 5.8, got ${version.MajorVersion}.${version.MinorVersion}`);
  const pluginPath = path.join(engineRoot, "Engine", "Plugins", "Marketplace", "CesiumForUnreal", "CesiumForUnreal.uplugin");
  required(fs.existsSync(pluginPath), "CesiumForUnreal plugin is not installed in UE_ROOT");
  const plugin = JSON.parse(fs.readFileSync(pluginPath, "utf8"));
  required(String(plugin.VersionName ?? "").startsWith("2.29.1"),
    `Expected installed CesiumForUnreal 2.29.1, got ${plugin.VersionName ?? "unspecified"}`);
  return { unrealMajor: version.MajorVersion, unrealMinor: version.MinorVersion, unrealPatch: version.PatchVersion, cesiumPlugin: plugin.VersionName };
}
export function verifyWindowsShipping({ archive, buildLog, engineRoot, commit }) {
  required(archive && fs.existsSync(archive) && fs.statSync(archive).isDirectory(), "UE Windows archive directory is missing");
  required(buildLog && fs.existsSync(buildLog), "BuildCookRun transcript is required");
  required(engineRoot && fs.existsSync(engineRoot), "Installed Unreal Engine root is required");
  required(/^[a-f0-9]{40}$/i.test(commit ?? ""), "Immutable 40-character Git commit is required");
  const engine = validateEngine(engineRoot);
  const log = fs.readFileSync(buildLog, "utf8");
  required(/BuildCookRun/i.test(log) && /clientconfig[=:\s]+Shipping/i.test(log),
    "Build log does not prove BuildCookRun with clientconfig=Shipping");
  required(/AutomationTool exiting with ExitCode=0\b/i.test(log),
    "Build log does not prove successful Unreal AutomationTool completion");
  required(!/AutomationTool exiting with ExitCode=[1-9]/i.test(log),
    "Build log contains nonzero AutomationTool exit");
  const files = listFiles(archive);
  const exe = files.filter((f) => path.basename(f).toLowerCase() === "tsmnative.exe");
  required(exe.length === 1, `Expected exactly one packaged TSMNative.exe, found ${exe.length}`);
  required(peMachine(exe[0]) === 0x8664, "Packaged TSMNative.exe is not a PE32+ AMD64 executable");
  const relative = (f) => path.relative(archive, f).split(path.sep).join("/").toLowerCase();
  const cook = files.filter((f) => /\/content\/paks\/.*\.(pak|utoc|ucas)$/i.test("/" + relative(f)));
  const hasPak = cook.some((f) => f.toLowerCase().endsWith(".pak"));
  const hasIoStore = cook.some((f) => f.toLowerCase().endsWith(".utoc")) &&
    cook.some((f) => f.toLowerCase().endsWith(".ucas"));
  required(hasPak || hasIoStore, "No UE cooked .pak or paired .utoc/.ucas content found");
  const dlls = ["archimedescore.dll", "mod_spatialite.dll"].map((name) => {
    const matches = files.filter((f) => path.basename(f).toLowerCase() === name);
    required(matches.length === 1, `Expected one packaged ${name}, found ${matches.length}`);
    return matches[0];
  });
  const banned = files.filter((f) => /^(node|electron|msedgewebview2|chrome)\.exe$|^webview2loader\.dll$/i.test(path.basename(f)));
  required(banned.length === 0, "Browser/Node runtime present in native package");
  const selected = [exe[0], ...dlls, ...cook].sort((a, b) => relative(a).localeCompare(relative(b)));
  required(selected.every((f) => fs.statSync(f).size > 0), "Zero-byte cooked executable, DLL or content");
  return {
    schemaVersion: "tsm.native.win64-shipping-static-evidence.v1",
    status: "STATIC_PACKAGE_VERIFIED_OFFLINE_LAUNCH_PENDING",
    releaseCertified: false,
    cleanWindows11OfflineLaunchVerified: false,
    runtimeDataManifestVerified: false,
    warning: "PE header, cooked assets, libraries, engine installation and UAT transcript are static evidence only; they do not prove offline launch, interactive cinematic rendering or bundled data verification",
    sourceCommit: commit,
    engine,
    buildLog: inventory(buildLog, path.dirname(buildLog)),
    archiveFileCount: files.length,
    inspectedFiles: selected.map((f) => inventory(f, archive)),
    forbiddenRuntimeFileCount: banned.length,
  };
}
function cli() {
  const a = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < a.length; i += 2) {
    required(["--archive","--build-log","--engine-root","--commit","--output"].includes(a[i]) && a[i + 1], `Invalid CLI option: ${a[i]}`);
    required(!options[a[i]], `Duplicate option: ${a[i]}`);
    options[a[i]] = a[i + 1];
  }
  required(options["--output"], "--output is required");
  const report = verifyWindowsShipping({
    archive: options["--archive"], buildLog: options["--build-log"],
    engineRoot: options["--engine-root"], commit: options["--commit"],
  });
  fs.mkdirSync(path.dirname(options["--output"]), { recursive: true });
  fs.writeFileSync(options["--output"], JSON.stringify(report, null, 2) + "\n");
  console.log(`${report.status}: ${report.inspectedFiles.length} files SHA-256 inventoried; offline clean-host launch NOT verified`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { cli(); } catch (error) { console.error(`UE Shipping gate: ${error.message}`); process.exitCode = 1; }
}
