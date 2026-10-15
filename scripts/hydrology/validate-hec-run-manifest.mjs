#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SCHEMA_PATH = path.join(root, 'data/schemas/hec-coupled-run-manifest-v1.schema.json');

function matchesType(value, type) {
  const types = Array.isArray(type) ? type : [type];
  return types.some((item) => {
    if (item === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    if (item === 'array') return Array.isArray(value);
    if (item === 'integer') return Number.isInteger(value);
    if (item === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (item === 'null') return value === null;
    return typeof value === item;
  });
}

/** Validates the keyword subset used by the checked-in HEC run schema. */
export function validateAgainstSchema(value, schema, at = '$', errors = []) {
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(at + ': expected type ' + JSON.stringify(schema.type));
    return errors;
  }
  if (Object.hasOwn(schema, 'const') && JSON.stringify(value) !== JSON.stringify(schema.const)) errors.push(at + ': must equal const ' + JSON.stringify(schema.const));
  if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) errors.push(at + ': value is not an allowed enum member');
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(at + ': below minLength');
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(at + ': above maxLength');
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(at + ': pattern mismatch');
    if (schema.format === 'date-time' && (!/^\d{4}-\d\d-\d\dT/.test(value) || Number.isNaN(Date.parse(value)))) errors.push(at + ': invalid date-time');
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(at + ': below minimum');
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(at + ': above maximum');
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(at + ': below minItems');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(at + ': above maxItems');
    if (schema.items) value.forEach((item, i) => validateAgainstSchema(item, schema.items, at + '[' + i + ']', errors));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(at + ': missing required property ' + key);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties && Object.hasOwn(schema.properties, key)) validateAgainstSchema(child, schema.properties[key], at + '.' + key, errors);
      else if (schema.additionalProperties === false) errors.push(at + ': unexpected property ' + key);
    }
  }
  return errors;
}

const PLACEHOLDER = /^(?:UNASSIGNED|UNVERIFIED|UNPINNED|UNCONFIGURED|AOI_NOT_SELECTED|MISSING|TBD)$/i;
function assertExecutionReady(manifest) {
  const errors = [];
  if (manifest.approval?.status !== 'APPROVED') errors.push('approval.status must be APPROVED before execution');
  if (!manifest.approval?.approved_by || PLACEHOLDER.test(manifest.approval.approved_by)) errors.push('approval.approved_by must identify an accountable approver');
  if (!manifest.approval?.evidence_uri || PLACEHOLDER.test(manifest.approval.evidence_uri)) errors.push('approval.evidence_uri must reference approval evidence');
  const nonPlaceholder = (value) => typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER.test(value.trim());
  if (!nonPlaceholder(manifest.aoi?.name) || !nonPlaceholder(manifest.aoi?.geometry_uri) || !nonPlaceholder(manifest.aoi?.watershed_delineation_uri)) errors.push('AOI geometry and watershed delineation must have named, source-backed references');
  if (manifest.aoi?.geometry_sha256 === '0'.repeat(64) || manifest.aoi?.watershed_delineation_sha256 === '0'.repeat(64)) errors.push('AOI geometry and watershed hashes must be measured, non-placeholder SHA-256 values');
  if (!nonPlaceholder(manifest.reference_system?.horizontal_crs) || !nonPlaceholder(manifest.reference_system?.vertical_datum) || !nonPlaceholder(manifest.reference_system?.datum_evidence_uri) || !nonPlaceholder(manifest.reference_system?.units_policy)) errors.push('horizontal CRS, vertical datum, units and datum evidence must be qualified');
  if (manifest.source_inputs?.some((input) => input.quality_status !== 'QUALIFIED')) errors.push('every source input quality_status QUALIFIED is required before execution');
  if (manifest.source_inputs?.some((input) => !nonPlaceholder(input.source_uri) || !nonPlaceholder(input.valid_time) || !nonPlaceholder(input.license_or_terms_uri) || !nonPlaceholder(input.units) || !nonPlaceholder(input.horizontal_crs) || !nonPlaceholder(input.vertical_datum) || input.sha256 === '0'.repeat(64))) errors.push('every source input must be licensed/source-referenced, datum-aware and have a measured SHA-256');
  for (const [name, runner] of [['hec_hms', manifest.hec_hms], ['hec_ras', manifest.hec_ras]]) {
    if (!nonPlaceholder(runner?.product_version) || PLACEHOLDER.test(runner?.product_version ?? '') || runner?.command?.some((part) => PLACEHOLDER.test(part))) errors.push(name + ' must use a pinned version and configured command');
  }
  if (!nonPlaceholder(manifest.hydrograph_handoff?.time_zone) || !nonPlaceholder(manifest.hydrograph_handoff?.conversion_method)) errors.push('hydrograph handoff time zone and conversion method must be documented');
  if (manifest.hec_hms?.expected_outputs && !manifest.hec_hms.expected_outputs.includes(manifest.hydrograph_handoff?.source_output)) errors.push('hydrograph_handoff.source_output must be declared as a HEC-HMS expected output');
  if (manifest.hec_ras?.expected_outputs && !manifest.hec_ras.expected_outputs.some((file) => /\.hdf$/i.test(file))) errors.push('HEC-RAS expected_outputs must include a real HDF result artifact');
  return errors;
}

export function validateManifest(manifest, { execution = false } = {}) {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const errors = [];
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') errors.push('schema dialect must be JSON Schema 2020-12');
  validateAgainstSchema(manifest, schema, '$', errors);
  if (execution) errors.push(...assertExecutionReady(manifest));
  return [...new Set(errors)];
}

function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error('Usage: node scripts/hydrology/validate-hec-run-manifest.mjs <manifest.json> [--execution]');
    process.exitCode = 2;
    return;
  }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8')); }
  catch (error) {
    console.error('Invalid manifest JSON: ' + error.message);
    process.exitCode = 2;
    return;
  }
  const execution = process.argv.includes('--execution');
  const errors = validateManifest(manifest, { execution });
  if (errors.length) {
    console.error(JSON.stringify({ ok: false, execution_ready: false, errors }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ ok: true, execution_ready: execution, schema: 'hec-coupled-run-manifest-v1' }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
