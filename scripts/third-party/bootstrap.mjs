#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lockPath = resolve(root, "contracts/dependencies/tsm-open-source-lock-v1.json");
const cacheRoot = resolve(root, ".cache/tsm-third-party");
const allowMutable = process.argv.includes("--allow-mutable");
const only = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

const lock = JSON.parse(readFileSync(lockPath, "utf8"));
mkdirSync(cacheRoot, { recursive: true });

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}

function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const selected = lock.sources.filter((source) => only.length === 0 || only.includes(source.name) || only.includes(safeName(source.name)));
if (selected.length === 0) {
  throw new Error("No matching third-party sources.");
}

const resolved = [];
for (const source of selected) {
  if (source.mutableRevision && !allowMutable) {
    throw new Error(`Mutable revision rejected for ${source.name}; pass --allow-mutable only for research builds.`);
  }

  const dir = resolve(cacheRoot, safeName(source.name));
  if (!existsSync(dir)) {
    run("git", ["clone", "--filter=blob:none", "--no-tags", source.repo, dir], root);
  }

  run("git", ["fetch", "--depth=1", "origin", source.revision], dir);
  run("git", ["checkout", "--detach", source.revision], dir);
  const commit = run("git", ["rev-parse", "HEAD"], dir);
  const sourceHash = createHash("sha256").update(`${source.repo}@${commit}`).digest("hex");

  resolved.push({
    name: source.name,
    repo: source.repo,
    requestedRevision: source.revision,
    resolvedCommit: commit,
    license: source.license,
    boundary: source.boundary,
    sourceIdentitySha256: sourceHash
  });
}

const manifest = {
  schemaVersion: "TSM-ResolvedThirdParty-1.0",
  generatedAt: new Date().toISOString(),
  sources: resolved
};
const manifestPath = resolve(cacheRoot, "resolved-manifest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify({ manifest: manifestPath, count: resolved.length }, null, 2));
