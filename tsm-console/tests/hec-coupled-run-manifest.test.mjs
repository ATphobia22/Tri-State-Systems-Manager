import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { validateManifest } from '../../scripts/hydrology/validate-hec-run-manifest.mjs';
import { safeWorkspacePath } from '../../scripts/hydrology/run-hec-coupled-workflow.mjs';

const examplePath = new URL('../../data/schemas/examples/hec-coupled-run-manifest-v1.example.json', import.meta.url);
const validDraft = JSON.parse(readFileSync(examplePath, 'utf8'));

test('draft HEC coupled-run example satisfies the manifest schema', () => {
  assert.deepEqual(validateManifest(validDraft), []);
});

test('execution validation blocks unapproved or placeholder manifests', () => {
  const errors = validateManifest(validDraft, { execution: true });
  assert.ok(errors.some((error) => error.includes('approval.status must be APPROVED')));
  assert.ok(errors.some((error) => error.includes('AOI')));
  assert.ok(errors.some((error) => error.includes('quality_status QUALIFIED')));
  assert.ok(errors.some((error) => error.includes('pinned version')));
});

test('schema validation rejects unknown fields and malformed SHA-256 values', () => {
  const invalid = structuredClone(validDraft);
  invalid.unexpected_field = true;
  invalid.source_inputs[0].sha256 = 'not-a-hash';
  const errors = validateManifest(invalid);
  assert.ok(errors.some((error) => error.includes('unexpected property unexpected_field')));
  assert.ok(errors.some((error) => error.includes('pattern mismatch')));
});

test('workspace path guard rejects absolute and traversal paths', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'tsm-hec-path-test-'));
  try {
    assert.throws(() => safeWorkspacePath(directory, '../outside.txt', 'test'), /dot segments/);
    assert.throws(() => safeWorkspacePath(directory, path.resolve(directory, 'absolute.txt'), 'test'), /relative workspace path/);
    assert.equal(safeWorkspacePath(directory, 'project/input.dss', 'test'), path.join(directory, 'project', 'input.dss'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
