import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { validateManifest } from '../../scripts/hydrology/validate-hec-run-manifest.mjs';
import { runStage, safeWorkspacePath } from '../../scripts/hydrology/run-hec-coupled-workflow.mjs';

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

test('runner executes pinned argv without a shell and records fresh outputs', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'tsm-hec-stage-test-'));
  try {
    mkdirSync(path.join(directory, 'project'));
    const relativeProjectFile = 'model-project.fixture';
    const projectContents = 'pinned-test-project';
    writeFileSync(path.join(directory, 'project', relativeProjectFile), projectContents);
    const fileDigest = createHash('sha256').update(projectContents).digest();
    const relativeDigest = Buffer.from(relativeProjectFile);
    const projectPackageDigest = createHash('sha256')
      .update(relativeDigest).update(Buffer.from([0])).update(fileDigest).digest('hex');
    const executableDigest = createHash('sha256').update(readFileSync(process.execPath)).digest('hex');
    const receipt = runStage({
      name: 'fixture-stage',
      workspace: directory,
      outputDirectory: 'outputs',
      stage: {
        product_version: 'test-fixture-1',
        platform: process.platform === 'win32' ? 'windows-x64' : process.platform === 'darwin' ? 'macos-arm64' : 'linux-x64',
        project_directory: 'project',
        project_package_sha256: projectPackageDigest,
        executable_sha256: executableDigest,
        command: [process.execPath, '-e', "require('node:fs').writeFileSync(process.argv[1], 'fixture-output')", '{{output}}/result.txt'],
        timeout_seconds: 10,
        expected_outputs: ['outputs/result.txt'],
      },
    });
    assert.equal(receipt.exit_code, 0);
    assert.equal(receipt.outputs.length, 1);
    assert.equal(receipt.outputs[0].size_bytes, 'fixture-output'.length);
    assert.equal(receipt.project_package_sha256, projectPackageDigest);
    assert.equal(receipt.adapter_executable_sha256, executableDigest);
    assert.ok(receipt.stdout_log_path.endsWith('stage.stdout.log'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('runner fails closed when a pinned project tree changes', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'tsm-hec-stage-hash-test-'));
  try {
    mkdirSync(path.join(directory, 'project'));
    writeFileSync(path.join(directory, 'project', 'model.fixture'), 'actual-content');
    const executableDigest = createHash('sha256').update(readFileSync(process.execPath)).digest('hex');
    assert.throws(() => runStage({
      name: 'fixture-stage',
      workspace: directory,
      outputDirectory: 'outputs',
      stage: {
        product_version: 'test-fixture-1',
        platform: process.platform === 'win32' ? 'windows-x64' : process.platform === 'darwin' ? 'macos-arm64' : 'linux-x64',
        project_directory: 'project',
        project_package_sha256: '0'.repeat(64),
        executable_sha256: executableDigest,
        command: [process.execPath, '-e', "process.exit(0)"],
        timeout_seconds: 10,
        expected_outputs: ['outputs/result.txt'],
      },
    }), /project tree SHA-256 does not match/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
