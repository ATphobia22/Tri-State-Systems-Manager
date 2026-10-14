#!/usr/bin/env node
/**
 * Dependency-free, fail-closed verifier for the checked-in TwinEntityID example.
 * This intentionally validates the high-value invariants without claiming to
 * implement the full JSON Schema 2020-12 specification.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const schemaPath = resolve(repoRoot, "data/schemas/twin-entity-v1.schema.json");
const examplePath = resolve(repoRoot, "data/schemas/examples/twin-entity-v1.example.json");
const failures = [];
const fail = (message) => failures.push(message);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const idPattern = /^urn:tsm:entity:[a-z0-9][a-z0-9._:-]{2,180}$/;
const shaPattern = /^[a-f0-9]{64}$/;

function parseDateOrNull(value, field) {
  if (value === null) return;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) fail(`${field} must be null or an ISO-8601 date-time`);
}

function validateEntity(entity) {
  if (!isObject(entity)) return fail("entity must be an object");
  const required = ["schema_version", "twin_entity_id", "entity_type", "display_name", "identity_status", "aliases", "geometry", "temporal", "provenance", "attributes", "relationships"];
  for (const key of required) if (!(key in entity)) fail(`missing required field: ${key}`);
  if (entity.schema_version !== "1.0.0") fail("schema_version must equal 1.0.0");
  if (typeof entity.twin_entity_id !== "string" || !idPattern.test(entity.twin_entity_id)) fail("twin_entity_id is not a valid stable TSM URN");
  if (typeof entity.display_name !== "string" || entity.display_name.trim() === "") fail("display_name must be non-empty");
  if (!["provisional", "resolved", "merged", "retired"].includes(entity.identity_status)) fail("identity_status is invalid");
  for (const key of ["aliases", "attributes", "relationships"]) if (!Array.isArray(entity[key])) fail(`${key} must be an array`);
  if (!isObject(entity.temporal)) fail("temporal must be an object");
  else {
    parseDateOrNull(entity.temporal.valid_time_start, "temporal.valid_time_start");
    parseDateOrNull(entity.temporal.valid_time_end, "temporal.valid_time_end");
    if (typeof entity.temporal.recorded_at !== "string" || Number.isNaN(Date.parse(entity.temporal.recorded_at))) fail("temporal.recorded_at must be an ISO-8601 date-time");
  }
  if (!isObject(entity.provenance)) fail("provenance must be an object");
  else {
    if (!["OBSERVATION", "FORECAST", "REGULATORY", "DERIVED", "MODEL_OUTPUT", "SCENARIO", "VISUALIZATION", "SIMULATION_DEMO", "UNKNOWN"].includes(entity.provenance.class)) fail("provenance.class is invalid");
    if (!Array.isArray(entity.provenance.source_artifact_ids)) fail("provenance.source_artifact_ids must be an array");
    if (entity.provenance.content_sha256 !== null && entity.provenance.content_sha256 !== undefined && !shaPattern.test(entity.provenance.content_sha256)) fail("provenance.content_sha256 must be lowercase SHA-256 or null");
  }
  if (entity.geometry !== null) {
    if (!isObject(entity.geometry)) fail("geometry must be an object or null");
    else {
      for (const key of ["geometry_ref", "geometry_type", "horizontal_crs"]) if (typeof entity.geometry[key] !== "string" || entity.geometry[key].trim() === "") fail(`geometry.${key} must be non-empty`);
      if (entity.geometry.geometry_sha256 !== null && entity.geometry.geometry_sha256 !== undefined && !shaPattern.test(entity.geometry.geometry_sha256)) fail("geometry.geometry_sha256 must be lowercase SHA-256 or null");
    }
  }
  for (const [index, relation] of (Array.isArray(entity.relationships) ? entity.relationships : []).entries()) {
    if (!isObject(relation)) fail(`relationships[${index}] must be an object`);
    else {
      if (typeof relation.predicate !== "string" || !relation.predicate.trim()) fail(`relationships[${index}].predicate must be non-empty`);
      if (typeof relation.target_twin_entity_id !== "string" || !idPattern.test(relation.target_twin_entity_id)) fail(`relationships[${index}].target_twin_entity_id is invalid`);
      if (relation.target_twin_entity_id === entity.twin_entity_id) fail(`relationships[${index}] is a self-edge; allow only with explicit domain justification`);
    }
  }
}

const [schemaText, exampleText] = await Promise.all([readFile(schemaPath, "utf8"), readFile(examplePath, "utf8")]);
let schema;
let entity;
try { schema = JSON.parse(schemaText); } catch (error) { fail(`schema JSON parse failed: ${error.message}`); }
try { entity = JSON.parse(exampleText); } catch (error) { fail(`example JSON parse failed: ${error.message}`); }
if (schema) {
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") fail("schema must declare JSON Schema 2020-12");
  if (!Array.isArray(schema.required) || !schema.required.includes("twin_entity_id")) fail("schema must require twin_entity_id");
  if (schema.additionalProperties !== false) fail("schema must reject unknown top-level properties");
}
if (entity) validateEntity(entity);

if (failures.length) {
  console.error("Twin bundle validation FAILED:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Twin bundle validation passed (dependency-free invariant subset).");
  console.log(` - TwinEntityID: ${entity.twin_entity_id}`);
  console.log(` - entity type: ${entity.entity_type}`);
  console.log(` - provenance: ${entity.provenance.class}/${entity.provenance.status}`);
  console.log(" - full JSON Schema validation remains a separate CI gate when a schema validator is installed");
}
