#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const required = [
  "contracts/engineering/design-ir-v2.schema.json",
  "contracts/engineering/solver-result-v1.schema.json",
  "contracts/cinematic/render-recipe-v1.schema.json",
  "contracts/dependencies/tsm-open-source-lock-v1.json",
  "integrations/engineering-fabric/engineering_kernel.py",
  "integrations/engineering-fabric/worker-runner.mjs",
  "integrations/engineering-fabric/worker-contract.json",
  "integrations/usd/TSMEngineering.usda",
  "integrations/engineering-fabric/capability-dispatch.mjs",
  "integrations/engineering-fabric/adapters/opencv-inspection.py",
  "integrations/engineering-fabric/adapters/openfoam-case-runner.py",
  "contracts/dependencies/tsm-capability-fabric-v1.json",
  "scripts/third-party/bootstrap.mjs"
];

for (const relative of required) {
  if (!existsSync(resolve(root, relative))) throw new Error(`missing engineering-fabric file: ${relative}`);
}

const lock = JSON.parse(readFileSync(resolve(root, "contracts/dependencies/tsm-open-source-lock-v1.json"), "utf8"));
if (lock.schemaVersion !== "TSM-OpenSourceLock-1.0") throw new Error("unexpected dependency lock schema");
if (!Array.isArray(lock.sources) || lock.sources.length < 7) throw new Error("tier-1 dependency lock is incomplete");

const capability = JSON.parse(readFileSync(resolve(root, "contracts/dependencies/tsm-capability-fabric-v1.json"), "utf8"));
if (capability.schemaVersion !== "TSM-CapabilityFabric-1.0" || capability.capabilities.length < 7) throw new Error("capability fabric is incomplete");
if (capability.mutationPolicy?.cinematicCannotMutateEngineeringState !== true || capability.mutationPolicy?.workerCannotMutateNativeWorldDirectly !== true) throw new Error("capability mutation policy is unsafe");

for (const source of lock.sources) {
  for (const key of ["name", "repo", "revision", "license", "boundary", "download"]) {
    if (typeof source[key] !== "string" || source[key].length === 0) throw new Error(`invalid lock field ${key} for ${source.name}`);
  }
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repo)) {
    throw new Error(`untrusted source URL: ${source.repo}`);
  }
}

const packageJson = JSON.parse(readFileSync(resolve(root, "tsm-console/package.json"), "utf8"));
for (const script of ["check:engineering-fabric", "test:engineering-fabric", "third-party:bootstrap"]) {
  if (typeof packageJson.scripts?.[script] !== "string") throw new Error(`missing npm script: ${script}`);
}

const product = JSON.parse(readFileSync(resolve(root, "tsm-native/config/native-product-contract.json"), "utf8"));
if (product.product?.browserRuntime !== false || product.product?.webViewRuntime !== false) {
  throw new Error("engineering fabric cannot weaken the native-only runtime contract");
}
console.log(JSON.stringify({ status: "ok", checkedFiles: required.length, dependencies: lock.sources.length }));
