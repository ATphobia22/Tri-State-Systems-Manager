#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

const contract = JSON.parse(read("tsm-native/config/native-product-contract.json"));
const manifest = JSON.parse(read("tsm-native/config/authoritative-source-catalog.json"));
const uproject = JSON.parse(read("tsm-native/TSMNative.uproject"));
const packageConfig = read("tsm-native/Config/DefaultGame.ini");

const failures = [];

if (contract.product.browserRuntime !== false) failures.push("Native browser runtime must be false.");
if (contract.product.webViewRuntime !== false) failures.push("Native WebView runtime must be false.");
if (contract.product.localhostRuntime !== false) failures.push("Native localhost runtime must be false.");
if (contract.product.nodeRuntime !== false) failures.push("Native Node runtime must be false.");
if (contract.product.networkRequiredForSimulation !== false) failures.push("Native simulation must not require network access.");
if (contract.operatorExperience.hud.collapsible !== true) failures.push("Native HUD must be collapsible.");
if (contract.operatorExperience.dashboards !== "native Slate/UMG") failures.push("Dashboard implementation must remain native Slate/UMG.");
if (!Array.isArray(manifest.sources) || manifest.sources.length < 10) failures.push("Authoritative source catalog is incomplete.");
if (!manifest.policy || manifest.policy.runtimeNetworkAccess !== false) failures.push("Source catalog must declare offline runtime policy.");
if (!uproject.Plugins?.some((plugin) => plugin.Name === "CesiumForUnreal" && plugin.Enabled === true)) failures.push("Cesium for Unreal must be enabled.");
if (!packageConfig.includes('DirectoriesToAlwaysStageAsUFS=(Path="TSMData")')) failures.push("TSMData must be packaged into the native build.");

for (const required of [
  "tsm-native/Source/TSMNative/TSMEngineeringRuntimeSubsystem.h",
  "tsm-native/Source/TSMNative/TSMEngineeringRuntimeSubsystem.cpp",
  "tsm-native/Source/TSMNative/TSMEngineeringHUD.h",
  "tsm-native/Source/TSMNative/TSMEngineeringHUD.cpp",
  "scripts/native/stage-native-data-root.mjs"
]) {
  if (!fs.existsSync(path.join(root, required))) failures.push(`Required native component missing: ${required}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `ERROR: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Native product contract validation passed.");
console.log(`Authoritative sources: ${manifest.sources.length}`);
console.log("Browser/WebView runtime: disabled");
console.log("Local data packaging: TSMData");
