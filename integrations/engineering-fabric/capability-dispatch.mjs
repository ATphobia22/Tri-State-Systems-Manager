#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(root, "contracts/dependencies/tsm-capability-fabric-v1.json"), "utf8"));
const [capability, inputPath] = process.argv.slice(2);
if (!capability || !inputPath) throw new Error("usage: node capability-dispatch.mjs <capability-id> <input.json>");

const selected = manifest.capabilities.find((item) => item.id === capability);
if (!selected) throw new Error(`unknown capability: ${capability}`);

const result = spawnSync(
  process.execPath,
  [resolve(root, "integrations/engineering-fabric/worker-runner.mjs"), selected.worker, inputPath],
  { cwd: root, encoding: "utf8", stdio: "inherit", shell: false, env: process.env }
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
