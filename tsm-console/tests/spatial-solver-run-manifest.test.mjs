import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { validateSpatialSolverManifest } from '../../scripts/hydrology/validate-spatial-solver-run-manifest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(path.resolve(here, '../../data/schemas/spatial-solver-run-manifest-v1.schema.json'), 'utf8'));
const example = JSON.parse(readFileSync(path.resolve(here, '../../data/schemas/examples/spatial-solver-run-manifest-v1.example.json'), 'utf8'));

test('synthetic solver manifest fixture conforms to the schema', () => {
  assert.deepEqual(validateSpatialSolverManifest(example, schema), []);
  assert.equal(example.execution.status, 'NOT_STARTED');
  assert.equal(example.scientific_validation.status, 'NOT_RUN');
  assert.equal(example.approval_status, 'DRAFT');
});

test('invalid input hash and unexpected properties are rejected', () => {
  const invalid = structuredClone(example);
  invalid.inputs[0].sha256 = 'not-a-sha256';
  invalid.unexpected = true;
  const errors = validateSpatialSolverManifest(invalid, schema);
  assert.ok(errors.some((error) => error.includes('pattern mismatch')));
  assert.ok(errors.some((error) => error.includes('unexpected property unexpected')));
});

test('successful execution requires approval, timestamps, exit code zero, and output artifacts', () => {
  const invalid = structuredClone(example);
  invalid.execution.status = 'SUCCEEDED';
  invalid.execution.exit_code = 0;
  const errors = validateSpatialSolverManifest(invalid, schema);
  assert.ok(errors.some((error) => error.includes('APPROVED_FOR_EXECUTION')));
  assert.ok(errors.some((error) => error.includes('start and finish timestamps')));
  assert.ok(errors.some((error) => error.includes('output artifact')));
});

test('scientific pass cannot be inferred from a successful process alone', () => {
  const invalid = structuredClone(example);
  invalid.approval_status = 'APPROVED_FOR_EXECUTION';
  invalid.execution.status = 'SUCCEEDED';
  invalid.execution.started_at = '2026-10-23T00:00:00Z';
  invalid.execution.finished_at = '2026-10-23T00:01:00Z';
  invalid.execution.exit_code = 0;
  invalid.outputs = [{artifact_id:'out-1',uri:'urn:tsm:fixture:out-1',sha256:'e'.repeat(64),media_type:'application/octet-stream',role:'primary_result',units:null,horizontal_crs:null,vertical_datum:null}];
  invalid.scientific_validation.status = 'PASSED';
  invalid.scientific_validation.checks = [{check_id:'mass-balance',status:'NOT_RUN',method:'fixture-only',evidence_uri:null,notes:null}];
  const errors = validateSpatialSolverManifest(invalid, schema);
  assert.ok(errors.some((error) => error.includes('every declared check to be PASSED')));
});

test('decision-support run cannot disable required human review', () => {
  const invalid = structuredClone(example);
  invalid.purpose = 'DECISION_SUPPORT';
  invalid.scientific_validation.human_review_required = false;
  assert.ok(validateSpatialSolverManifest(invalid, schema).some((error) => error.includes('must require human review')));
});
