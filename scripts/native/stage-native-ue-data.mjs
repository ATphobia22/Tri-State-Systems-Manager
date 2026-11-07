#!/usr/bin/env node
import path from "node:path";
import { execFileSync } from "node:child_process";
import { stageNativeData } from "./stage-native-data-root.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
execFileSync(process.execPath, [path.join(import.meta.dirname, "stage-native-data.mjs"), "--output=dist/tsm-native-data"], { cwd: repoRoot, stdio: "inherit" });
const receipt = stageNativeData({
  sourceRoot: path.join(repoRoot, "dist", "tsm-native-data"),
  destinationRoot: path.join(repoRoot, "tsm-native", "Content", "TSMData")
});
console.log(JSON.stringify(receipt));
