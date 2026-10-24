#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgainstSchema } from './validate-hec-run-manifest.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const schemaPath = path.join(repoRoot, 'data/schemas/spatial-solver-run-manifest-v1.schema.json');

function findUnsupportedSchemaKeywords(schema, at = '$schema', errors = []) {
  const supported = new Set(['$schema', '$id', 'title', 'description', 'type', 'additionalProperties', 'required', 'properties', 'items', 'const', 'enum', 'minLength', 'maxLength', 'pattern', 'format', 'minimum', 'maximum', 'minItems', 'maxItems']);
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return errors;
  for (const [keyword, value] of Object.entries(schema)) {
    if (!supported.has(keyword)) errors.push(at + ': unsupported schema keyword ' + keyword);
    if (keyword === 'properties' && value && typeof value === 'object') {
      for (const [name, child] of Object.entries(value)) findUnsupportedSchemaKeywords(child, at + '.properties.' + name, errors);
    } else if (keyword === 'items' && value && typeof value === 'object') {
      findUnsupportedSchemaKeywords(value, at + '.items', errors);
    }
  }
  return errors;
}

const SOLVER_MODEL_KINDS = Object.freeze({
  'HEC-RAS': 'surface_water_hydraulics',
  'MODFLOW-6': 'groundwater_flow',
  OpenFOAM: 'computational_fluid_dynamics',
  CARLA: 'traffic_simulation',
  OTHER: 'other',
});

function duplicateIds(items, field, label, errors) {
  if (!Array.isArray(items)) return;
  const seen = new Set();
  for (const item of items) {
    const id = item?.[field];
    if (typeof id !== 'string' || id.length === 0) continue;
    if (seen.has(id)) errors.push(label + ' contains duplicate ' + field + ': ' + id);
    seen.add(id);
  }
}

function isTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validateExecutionState(manifest, errors) {
  const execution = manifest?.execution;
  if (!execution || typeof execution !== 'object') return;

  const status = execution.status;
  const started = execution.started_at;
  const finished = execution.finished_at;
  const exitCode = execution.exit_code;
  const hasStarted = isTimestamp(started);
  const hasFinished = isTimestamp(finished);
  const hasExecutionEvidence = status !== 'NOT_STARTED';

  if (hasExecutionEvidence && manifest.approval_status !== 'APPROVED_FOR_EXECUTION') {
    errors.push('executed runs require approval_status APPROVED_FOR_EXECUTION');
  }

  if (status === 'NOT_STARTED') {
    if (started !== null || finished !== null || exitCode !== null) {
      errors.push('NOT_STARTED execution must not declare timestamps or an exit code');
    }
  } else if (status === 'RUNNING') {
    if (!hasStarted) errors.push('RUNNING execution requires a valid started_at timestamp');
    if (finished !== null) errors.push('RUNNING execution must not declare finished_at');
    if (exitCode !== null) errors.push('RUNNING execution must not declare exit_code');
  } else if (status === 'SUCCEEDED') {
    if (exitCode !== 0) errors.push('SUCCEEDED execution must have exit_code 0');
    if (!hasStarted || !hasFinished) errors.push('SUCCEEDED execution must have start and finish timestamps');
    if (!Array.isArray(manifest.outputs) || manifest.outputs.length === 0) {
      errors.push('SUCCEEDED execution must declare at least one output artifact');
    }
  } else if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(status)) {
    if (!hasFinished) errors.push(status + ' execution requires a valid finished_at timestamp');
    if (status === 'FAILED' && exitCode === 0) errors.push('FAILED execution must not have exit_code 0');
  }

  if (hasStarted && hasFinished && Date.parse(finished) < Date.parse(started)) {
    errors.push('execution.finished_at must not precede execution.started_at');
  }
}

export function validateSpatialSolverManifest(manifest, schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))) {
  const errors = findUnsupportedSchemaKeywords(schema);
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') errors.push('schema dialect must be JSON Schema 2020-12');
  validateAgainstSchema(manifest, schema, '$', errors);

  const solver = manifest?.solver;
  if (solver && SOLVER_MODEL_KINDS[solver.name] && solver.model_kind !== SOLVER_MODEL_KINDS[solver.name]) {
    errors.push('solver.model_kind must match solver.name (' + SOLVER_MODEL_KINDS[solver.name] + ' for ' + solver.name + ')');
  }

  validateExecutionState(manifest, errors);
  duplicateIds(manifest?.inputs, 'input_id', 'inputs', errors);
  duplicateIds(manifest?.outputs, 'artifact_id', 'outputs', errors);
  duplicateIds(manifest?.scientific_validation?.checks, 'check_id', 'scientific_validation.checks', errors);

  const scientific = manifest?.scientific_validation;
  if (scientific?.status === 'PASSED') {
    if (!Array.isArray(scientific.checks) || scientific.checks.length === 0) {
      errors.push('scientific_validation PASSED requires at least one validation check');
    }
    if (scientific.checks?.some((check) => check.status !== 'PASSED')) {
      errors.push('scientific_validation PASSED requires every declared check to be PASSED');
    }
    if (manifest?.execution?.status !== 'SUCCEEDED') {
      errors.push('scientific_validation PASSED requires a SUCCEEDED execution');
    }
    if (scientific.human_review_required !== true) {
      errors.push('scientific_validation PASSED requires human_review_required true');
    }
    if (typeof scientific.reviewer_id !== 'string' || scientific.reviewer_id.trim().length === 0) {
      errors.push('scientific_validation PASSED requires reviewer_id');
    }
    if (!isTimestamp(scientific.reviewed_at)) {
      errors.push('scientific_validation PASSED requires a valid reviewed_at timestamp');
    }
  }
  if (manifest?.purpose === 'DECISION_SUPPORT' && scientific?.human_review_required !== true) {
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
