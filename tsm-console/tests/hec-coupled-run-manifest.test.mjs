import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { validateManifest } from '../../scripts/hydrology/validate-hec-run-manifest.mjs';
import { runStage, safeWorkspacePath, validateHandoffReport } from '../../scripts/hydrology/run-hec-coupled-workflow.mjs';

const examplePath = new URL('../../data/schemas/examples/hec-coupled-run-manifest-v2.example.json', import.meta.url);
const validDraft = JSON.parse(readFileSync(examplePath, 'utf8'));

test('draft HEC coupled-run example satisfies the manifest schema', () => {
  assert.deepEqual(validateManifest(validDraft), []);
});

test('execution validation blocks unapproved or placeholder manifests', () => {
  const errors = validateManifest(validDraft, { execution: true });
  assert.ok(errors.some((error) => error.includes('approval.status must be APPROVED')));
  assert.ok(errors.some((error) => error.includes('AOI')));
  assert.ok(errors.some((error) => error.includes('every source input must be qualified')));
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

function makeHandoffReportFixture(directory) {
  const handoff = {
    ...validDraft.hydrograph_handoff,
    adapter_version: 'tsm-hms-ras-handoff@1.0.0',
    source_dss_pathname: '/BASIN/OUTLET/FLOW//1HOUR/RUN:RUN1/',
    source_element_name: 'OUTLET',
    source_run_name: 'RUN1',
    ras_dss_pathname: '/RAS/UPSTREAM/FLOW//1HOUR/RAS_RUN1/',
    source_flow_units: 'CFS',
    flow_units: 'CFS',
    conversion_method: 'NONE_EXACT_VALUES',
    interval: '1HOUR',
    time_zone: 'America/Chicago',
    boundary_selector: {
      mode: '1D', river: 'River', reach: 'Reach', station: '1200',
      area_2d: null, bc_line: null, boundary_index: null,
      expected_bc_type: 'Flow Hydrograph',
    },
  };
  const sourceOutput = path.join(directory, 'hms.dss');
  const rasDss = path.join(directory, 'ras.dss');
  const rasInput = path.join(directory, 'plan.u01');
  writeFileSync(sourceOutput, 'source-dss-fixture');
  writeFileSync(rasDss, 'target-dss-fixture');
  writeFileSync(rasInput, 'target-u01-fixture');
  const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
  const sourceSha256 = sha(sourceOutput);
  const rasDssSha256 = sha(rasDss);
  const rasInputSha256 = sha(rasInput);
  const report = {
    adapter: handoff.adapter_version,
    status: 'HANDOFF_WRITTEN_AND_STRUCTURALLY_CHECKED_HYDROLOGY_UNVALIDATED',
    scientific_validation_status: 'NOT_PERFORMED',
    human_review_required: true,
    source_dss: { path: sourceOutput, sha256: sourceSha256 },
    target_dss: {
      path: rasDss, sha256: rasDssSha256,
      pathname: handoff.ras_dss_pathname,
      pathname_validation_passed: true,
      round_trip_validation: {
        status: 'PASS', pathname: handoff.ras_dss_pathname, units: 'CFS',
        point_count: 3, timestamps_exact: true, values_within_tolerance: true,
        relative_tolerance: 1e-5, absolute_tolerance: 1e-6,
        maximum_absolute_error: 0, maximum_relative_error: 0,
      },
    },
    target_unsteady_flow: {
      path: rasInput, before_sha256: 'd'.repeat(64), after_sha256: rasInputSha256,
      relative_dss_reference: 'ras.dss',
      boundary_selector: structuredClone(handoff.boundary_selector),
    },
    series: {
      source_pathname: handoff.source_dss_pathname,
      source_units: 'CFS', target_units: 'CFS', conversion_method: 'NONE_EXACT_VALUES',
      interval: '1HOUR', time_zone: 'America/Chicago', point_count: 3,
      status: 'FORMAT_AND_UNIT_CONTRACT_VALIDATED_HYDROLOGY_UNVALIDATED',
    },
  };
  return { handoff, report, sourceOutput, sourceSha256, rasDss, rasDssSha256, rasInput, rasInputSha256 };
}

test('handoff report validator accepts matching source, target, boundary, and DSS read-back evidence', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'tsm-hec-report-test-'));
  try {
    const fixture = makeHandoffReportFixture(directory);
    const result = validateHandoffReport(fixture.report, {
      handoff: fixture.handoff,
      adapterVersion: fixture.handoff.adapter_version,
      sourceOutput: fixture.sourceOutput,
      sourceSha256: fixture.sourceSha256,
      rasDss: fixture.rasDss,
      rasDssSha256: fixture.rasDssSha256,
      rasInput: fixture.rasInput,
      rasInputSha256: fixture.rasInputSha256,
    });
    assert.equal(result.status, 'HANDOFF_WRITTEN_AND_STRUCTURALLY_CHECKED_HYDROLOGY_UNVALIDATED');
    assert.equal(result.point_count, 3);
    assert.equal(result.max_round_trip_absolute_error, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('handoff report validator rejects absent read-back verification', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'tsm-hec-report-missing-'));
  try {
    const fixture = makeHandoffReportFixture(directory);
    fixture.report.target_dss.round_trip_validation.status = 'PENDING';
    assert.throws(() => validateHandoffReport(fixture.report, {
      handoff: fixture.handoff,
      adapterVersion: fixture.handoff.adapter_version,
      sourceOutput: fixture.sourceOutput,
      sourceSha256: fixture.sourceSha256,
      rasDss: fixture.rasDss,
      rasDssSha256: fixture.rasDssSha256,
      rasInput: fixture.rasInput,
      rasInputSha256: fixture.rasInputSha256,
    }), /target DSS record lacks passing read-back timestamp\/value checks/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('handoff report validator rejects a boundary selector that differs from the approved manifest', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'tsm-hec-report-selector-'));
  try {
    const fixture = makeHandoffReportFixture(directory);
    fixture.report.target_unsteady_flow.boundary_selector.station = '9999';
    assert.throws(() => validateHandoffReport(fixture.report, {
      handoff: fixture.handoff,
      adapterVersion: fixture.handoff.adapter_version,
      sourceOutput: fixture.sourceOutput,
      sourceSha256: fixture.sourceSha256,
      rasDss: fixture.rasDss,
      rasDssSha256: fixture.rasDssSha256,
      rasInput: fixture.rasInput,
      rasInputSha256: fixture.rasInputSha256,
    }), /boundary selector differs from the approved manifest/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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
