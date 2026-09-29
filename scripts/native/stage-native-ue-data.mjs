#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const stagingRoot = path.join(repoRoot, "tsm-native", "Content", "TSMData");
const manifestSource = path.join(repoRoot, "dist", "tsm-native-data", "data-manifest.json");

execFileSync(process.execPath, [path.join(import.meta.dirname, "stage-native-data.mjs"), "--output=dist/tsm-native-data"], {
  cwd: repoRoot,
  stdio: "inherit"
});

fs.rmSync(stagingRoot, { recursive: true, force: true });
fs.mkdirSync(stagingRoot, { recursive: true });

function copyTree(sourceRoot, destinationRoot) {
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    const source = path.join(sourceRoot, entry.name);
    const destination = path.join(destinationRoot, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destination, { recursive: true });
      copyTree(source, destination);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  }
}

copyTree(path.join(repoRoot, "dist", "tsm-native-data"), stagingRoot);

if (!fs.existsSync(manifestSource)) {
  throw new Error("Native data manifest was not generated.");
}

console.log(`Prepared UE packaged data: ${stagingRoot}`);
