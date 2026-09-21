import fs from "node:fs";

const path = new URL("../../tsm-native/config/platform-build-matrix.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(path, "utf8"));

const required = new Map([
  ["Windows", ["x64", "arm64"]],
  ["macOS", ["arm64", "x86_64"]],
  ["iOS", ["arm64"]],
  ["iPadOS", ["arm64"]],
  ["Android", ["arm64-v8a", "x86_64"]],
  ["Linux", ["x86_64", "arm64"]]
]);

for (const [platform, architectures] of required) {
  const target = manifest.targets.find((item) => item.platform === platform);
  if (!target) throw new Error(`Missing platform target: ${platform}`);
  for (const architecture of architectures) {
    if (!target.architectures.includes(architecture)) {
      throw new Error(`Missing ${platform} architecture: ${architecture}`);
    }
  }
}

if (manifest.sovereignRuntime.networkDataSources !== false ||
    manifest.sovereignRuntime.browser !== false ||
    manifest.sovereignRuntime.nodeJs !== false ||
    manifest.sovereignRuntime.localhostServer !== false ||
    manifest.sovereignRuntime.mutableRuntimeData !== false) {
  throw new Error("Sovereign runtime platform policy is not fail-closed.");
}

console.log("Native platform build matrix validation passed.");
