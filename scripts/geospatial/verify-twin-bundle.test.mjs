import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { validateEntity } from "./verify-twin-bundle.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const verifier = resolve(root, "scripts/geospatial/verify-twin-bundle.mjs");
const fixture = resolve(root, "data/schemas/examples/twin-entity-v1.example.json");

async function example() {
  return JSON.parse(await readFile(fixture, "utf8"));
}

test("checked-in twin entity bundle passes dependency-free validation", () => {
  const result = spawnSync(process.execPath, [verifier], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Twin bundle validation passed/);
});

test("example preserves renderer-independent identity and source provenance", async () => {
  const entity = await example();
  assert.match(entity.twin_entity_id, /^urn:tsm:entity:/);
  assert.ok(Array.isArray(entity.aliases));
  assert.ok(Array.isArray(entity.provenance.source_artifact_ids));
  assert.equal(entity.geometry.horizontal_crs, "OGC:CRS84");
});

test("model or visual values cannot be mislabeled by the schema example", async () => {
  const entity = await example();
  assert.equal(entity.provenance.class, "OBSERVATION");
  assert.equal(entity.provenance.status, "provisional");
  assert.equal(entity.provenance.content_sha256, null);
});

test("rejects malformed stable identity and invalid provenance class", async () => {
  const entity = await example();
  entity.twin_entity_id = "Actor_12";
  entity.provenance.class = "REALITY";
  const failures = validateEntity(entity);
  assert.ok(failures.some((failure) => failure.includes("stable TSM URN")));
  assert.ok(failures.some((failure) => failure.includes("provenance.class")));
});

test("rejects missing temporal fields and malformed SHA-256 evidence", async () => {
  const entity = await example();
  delete entity.temporal.recorded_at;
  entity.provenance.content_sha256 = "not-a-hash";
  const failures = validateEntity(entity);
  assert.ok(failures.some((failure) => failure.includes("temporal.recorded_at")));
  assert.ok(failures.some((failure) => failure.includes("content_sha256")));
});

test("rejects self-referential relationships", async () => {
  const entity = await example();
  entity.relationships = [{
    predicate: "connected_to",
    target_twin_entity_id: entity.twin_entity_id
  }];
  const failures = validateEntity(entity);
  assert.ok(failures.some((failure) => failure.includes("self-edge")));
});

test("rejects non-object records", () => {
  assert.deepEqual(validateEntity(null), ["entity must be an object"]);
  assert.deepEqual(validateEntity([]), ["entity must be an object"]);
});
