import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { validateSpatialSolverManifest } from '../../scripts/hydrology/validate-spatial-solver-run-manifest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(path.resolve(here, '../../data/schemas/spatial-solver-run-manifest-v1.schema.json'), 'utf8'));
const example = JSON.parse(readFileSync(path.resolve(here, '../../data/schemas/examples/spatial-solver-run-manifest-v1.example.json'), 'utf8'));

function successfulReviewedManifest() {
  const manifest = structuredClone(example);
  manifest.approval_status = 'APPROVED_FOR_EXECUTION';
  manifest.execution.status = 'SUCCEEDED';
  manifest.execution.started_at = '2026-10-23T00:00:00Z';
  manifest.execution.finished_at = '2026-10-23T00:01:00Z';
  manifest.execution.exit_code = 0;
  manifest.outputs = [{
    artifact_id: 'out-1',
    uri: 'urn:tsm:fixture:out-1',
    sha256: 'e'.repeat(64),
    media_type: 'application/octet-stream',
    role: 'primary_result',
    units: null,
    horizontal_crs: null,
    vertical_datum: null,
  }];
  manifest.scientific_validation.status = 'PASSED';
  manifest.scientific_validation.checks = [{
    check_id: 'mass-balance',
    status: 'PASSED',
    method: 'synthetic deterministic test',
    evidence_uri: 'urn:tsm:fixture:validation-evidence',
    notes: 'Contract test fixture only.',
  }];
  manifest.scientific_validation.human_review_required = true;
  manifest.scientific_validation.reviewer_id = 'fixture-reviewer';
  manifest.scientific_validation.reviewed_at = '2026-10-23T00:02:00Z';
  return manifest;
}

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
  const invalid = successfulReviewedManifest();
  invalid.scientific_validation.checks[0].status = 'NOT_RUN';
  const errors = validateSpatialSolverManifest(invalid, schema);
  assert.ok(errors.some((error) => error.includes('every declared check to be PASSED')));
});

test('a scientific pass requires a non-empty set of checks and reviewer evidence', () => {
  const invalid = successfulReviewedManifest();
  invalid.scientific_validation.checks = [];
  invalid.scientific_validation.reviewer_id = null;
  invalid.scientific_validation.reviewed_at = null;
  const errors = validateSpatialSolverManifest(invalid, schema);
  assert.ok(errors.some((error) => error.includes('at least one validation check')));
  assert.ok(errors.some((error) => error.includes('reviewer_id')));
  assert.ok(errors.some((error) => error.includes('reviewed_at')));
});

test('execution timestamps must be chronologically consistent', () => {
  const invalid = successfulReviewedManifest();
  invalid.execution.finished_at = '2026-10-22T23:59:00Z';
  assert.ok(validateSpatialSolverManifest(invalid, schema).some((error) => error.includes('must not precede')));
});

test('execution state combinations must be coherent', () => {
  const running = structuredClone(example);
  running.approval_status = 'APPROVED_FOR_EXECUTION';
  running.execution.status = 'RUNNING';
  running.execution.started_at = '2026-10-23T00:00:00Z';
  assert.deepEqual(validateSpatialSolverManifest(running, schema), []);

  const invalidRunning = structuredClone(running);
  invalidRunning.execution.finished_at = '2026-10-23T00:01:00Z';
  assert.ok(validateSpatialSolverManifest(invalidRunning, schema).some((error) => error.includes('must not declare finished_at')));

  const invalidNotStarted = structuredClone(example);
  invalidNotStarted.execution.started_at = '2026-10-23T00:00:00Z';
  assert.ok(validateSpatialSolverManifest(invalidNotStarted, schema).some((error) => error.includes('NOT_STARTED')));
});

test('duplicate input, output, and validation identifiers are rejected', () => {
  const invalid = structuredClone(example);
  invalid.inputs.push(structuredClone(invalid.inputs[0]));
  invalid.outputs = [
    { artifact_id: 'same', uri: 'urn:tsm:fixture:one', sha256: 'e'.repeat(64), media_type: 'application/octet-stream', role: 'diagnostic' },
    { artifact_id: 'same', uri: 'urn:tsm:fixture:two', sha256: 'f'.repeat(64), media_type: 'application/octet-stream', role: 'diagnostic' },
  ];
  invalid.scientific_validation.checks = [
    { check_id: 'same', status: 'NOT_RUN', method: 'fixture' },
    { check_id: 'same', status: 'NOT_RUN', method: 'fixture' },
  ];
  const errors = validateSpatialSolverManifest(invalid, schema);
  assert.ok(errors.some((error) => error.includes('duplicate input_id')));
  assert.ok(errors.some((error) => error.includes('duplicate artifact_id')));
  assert.ok(errors.some((error) => error.includes('duplicate check_id')));
});

test('solver model kind must match the declared solver', () => {
  const invalid = structuredClone(example);
  invalid.solver.model_kind = 'surface_water_hydraulics';
  assert.ok(validateSpatialSolverManifest(invalid, schema).some((error) => error.includes('solver.model_kind must match')));
});

test('decision-support run cannot disable required human review', () => {
  const invalid = structuredClone(example);
  invalid.purpose = 'DECISION_SUPPORT';
  invalid.scientific_validation.human_review_required = false;
  assert.ok(validateSpatialSolverManifest(invalid, schema).some((error) => error.includes('must require human review')));
});
