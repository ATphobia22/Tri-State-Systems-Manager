#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const sourceRoot = process.env.TSM_NATIVE_DATA_ROOT;
const destinationRoot = path.join(repoRoot, "tsm-native", "Content", "TSMData");

if (!sourceRoot) throw new Error("TSM_NATIVE_DATA_ROOT is required.");
if (!fs.existsSync(path.join(sourceRoot, "data-manifest.json"))) {
  throw new Error("TSM_NATIVE_DATA_ROOT/data-manifest.json is required.");
}

fs.rmSync(destinationRoot, { recursive: true, force: true });
fs.mkdirSync(destinationRoot, { recursive: true });

function copyTree(source, destination) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyTree(from, to);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

copyTree(path.resolve(sourceRoot), destinationRoot);
console.log(`Staged immutable native data snapshot at ${destinationRoot}`);
