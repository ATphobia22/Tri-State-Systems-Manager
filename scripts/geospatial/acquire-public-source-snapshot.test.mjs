import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const scriptPath = resolve(root, "scripts/geospatial/acquire-public-source-snapshot.mjs");
const registerPath = resolve(root, "docs/digital-twin/RESEARCH-AND-DATA-REGISTER.md");
const planPath = resolve(root, "docs/digital-twin/IMPLEMENTATION-PLAN-2026-10.md");

test("snapshot utility only exposes explicit public sources and caps response size", async () => {
  const source = await readFile(scriptPath, "utf8");
  assert.match(source, /api\.waterdata\.usgs\.gov/);
  assert.match(source, /hazards\.fema\.gov/);
  assert.match(source, /Unsupported source key/);
  assert.match(source, /5 \* 1024 \* 1024/);
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /AbortSignal\.timeout/);
});

test("research register distinguishes public access from redistribution rights", async () => {
  const register = await readFile(registerPath, "utf8");
  assert.match(register, /redistributable/);
  assert.match(register, /retrieval time/);
  assert.match(register, /SHA-256/);
  assert.match(register, /FEMA NFHL/);
  assert.match(register, /Houdini/);
});

test("implementation plan keeps the model separate from rendering", async () => {
  const plan = await readFile(planPath, "utf8");
  assert.match(plan, /scientific model and the renderer are separate systems/i);
  assert.match(plan, /vertical datum/i);
  assert.match(plan, /TwinEntityID/);
  assert.match(plan, /offline/i);
});
