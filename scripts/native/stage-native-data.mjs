#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
const outputRoot = path.resolve(repoRoot, outputArg ? outputArg.slice("--output=".length) : "dist/tsm-native-data");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function copyTree(sourceRoot, destinationRoot) {
  if (!fs.existsSync(sourceRoot)) fail(`Required native data source is missing: ${sourceRoot}`);
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

function collectFiles(root) {
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...collectFiles(absolute));
    else if (entry.isFile()) result.push(absolute);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

const sourceRoots = [
  ["data", path.join(repoRoot, "data")],
  ["config", path.join(repoRoot, "tsm-native", "config")]
];

for (const [target, source] of sourceRoots) copyTree(source, path.join(outputRoot, target));

const manifestPath = path.join(outputRoot, "data-manifest.json");
const files = collectFiles(outputRoot)
  .filter((file) => file !== manifestPath)
  .map((absolute) => {
    const relative = path.relative(outputRoot, absolute).split(path.sep).join("/");
    const bytes = fs.readFileSync(absolute);
    return {
      path: relative,
      sizeBytes: bytes.byteLength,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex")
    };
  });

fs.writeFileSync(
  manifestPath,
  JSON.stringify({
    schemaVersion: 1,
    integrity: "sha256",
    generatedBy: "scripts/native/stage-native-data.mjs",
    sourceRoots: sourceRoots.map(([name]) => name),
    files
  }, null, 2) + "\n",
  "utf8"
);

console.log(`Staged native data package: ${outputRoot}`);
console.log(`Manifested files: ${files.length}`);
