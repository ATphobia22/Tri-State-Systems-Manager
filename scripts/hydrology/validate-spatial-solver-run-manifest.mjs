#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUnsupportedSchemaKeywords, validateAgainstSchema } from './validate-hec-run-manifest.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const schemaPath = path.join(repoRoot, 'data/schemas/spatial-solver-run-manifest-v1.schema.json');

export function validateSpatialSolverManifest(manifest, schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))) {
  const errors = findUnsupportedSchemaKeywords(schema);
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') errors.push('schema dialect must be JSON Schema 2020-12');
  validateAgainstSchema(manifest, schema, '$', errors);

  const execution = manifest?.execution;
  if (execution && ['RUNNING', 'SUCCEEDED'].includes(execution.status) && manifest.approval_status !== 'APPROVED_FOR_EXECUTION') {
    errors.push('execution requires approval_status APPROVED_FOR_EXECUTION');
  }
  if (execution?.status === 'SUCCEEDED') {
    if (execution.exit_code !== 0) errors.push('SUCCEEDED execution must have exit_code 0');
    if (!execution.started_at || !execution.finished_at) errors.push('SUCCEEDED execution must have start and finish timestamps');
    if (!Array.isArray(manifest.outputs) || manifest.outputs.length === 0) errors.push('SUCCEEDED execution must declare at least one output artifact');
  }
  if (manifest?.scientific_validation?.status === 'PASSED') {
    if (manifest.scientific_validation.checks.some((check) => check.status !== 'PASSED')) errors.push('scientific_validation PASSED requires every declared check to be PASSED');
    if (execution?.status !== 'SUCCEEDED') errors.push('scientific_validation PASSED requires a SUCCEEDED execution');
  }
  if (manifest?.purpose === 'DECISION_SUPPORT' && manifest.scientific_validation?.human_review_required !== true) {
    errors.push('DECISION_SUPPORT runs must require human review');
  }
  return [...new Set(errors)];
}

function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error('Usage: node scripts/hydrology/validate-spatial-solver-run-manifest.mjs <manifest.json>');
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
  const errors = validateSpatialSolverManifest(manifest);
  if (errors.length) {
    console.error(JSON.stringify({ ok: false, errors }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ ok: true, schema: 'spatial-solver-run-manifest-v1', execution_status: manifest.execution.status, scientific_validation: manifest.scientific_validation.status }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
