import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const verifier = resolve(root, "scripts/geospatial/verify-twin-bundle.mjs");
const fixture = resolve(root, "data/schemas/examples/twin-entity-v1.example.json");

test("checked-in twin entity bundle passes dependency-free validation", () => {
  const result = spawnSync(process.execPath, [verifier], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Twin bundle validation passed/);
});

test("example preserves renderer-independent identity and source provenance", async () => {
  const entity = JSON.parse(await readFile(fixture, "utf8"));
  assert.match(entity.twin_entity_id, /^urn:tsm:entity:/);
  assert.ok(Array.isArray(entity.aliases));
  assert.ok(Array.isArray(entity.provenance.source_artifact_ids));
  assert.equal(entity.geometry.horizontal_crs, "OGC:CRS84");
});

test("model or visual values cannot be mislabeled by the schema example", async () => {
  const entity = JSON.parse(await readFile(fixture, "utf8"));
  assert.equal(entity.provenance.class, "OBSERVATION");
  assert.equal(entity.provenance.status, "provisional");
  assert.equal(entity.provenance.content_sha256, null);
});
