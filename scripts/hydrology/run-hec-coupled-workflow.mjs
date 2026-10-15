#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest } from './validate-hec-run-manifest.mjs';

const sha256Buffer = (buffer) => createHash('sha256').update(buffer).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function safeWorkspacePath(workspace, relative, label) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\0')) throw new Error(label + ' must be a non-empty relative workspace path');
  const normalized = relative.replace(/\\/g, '/');
  if (normalized.split('/').some((part) => part === '..' || part === '.')) throw new Error(label + ' cannot contain dot segments');
  const root = path.resolve(workspace);
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error(label + ' escapes workspace');
  return resolved;
}
function verifyHashedFile(workspace, relative, expectedHash, label) {
  const file = safeWorkspacePath(workspace, relative, label);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(label + ' is missing or not a regular file: ' + relative);
  const actual = sha256File(file);
  if (actual !== expectedHash) throw new Error(label + ' SHA-256 mismatch: expected ' + expectedHash + ', got ' + actual);
  return file;
}
function replaceTokens(token, values) {
  return token.replace(/\{\{(workspace|project|output)\}\}/g, (_, key) => values[key]);
}
function runStage({ name, stage, workspace, outputDirectory }) {
  const project = safeWorkspacePath(workspace, stage.project_directory, name + '.project_directory');
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) throw new Error(name + ' project directory is missing: ' + stage.project_directory);
  const output = safeWorkspacePath(workspace, outputDirectory, name + '.output_directory');
  fs.mkdirSync(output, { recursive: true });
  const command = stage.command.map((part) => replaceTokens(part, { workspace, project, output }));
  if (command[0] === 'UNCONFIGURED' || command.some((part) => /^(UNCONFIGURED|UNPINNED|TBD)$/i.test(part))) throw new Error(name + ' command is not configured');
  const startedAt = new Date().toISOString();
  const completed = spawnSync(command[0], command.slice(1), {
    cwd: project,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: stage.timeout_seconds * 1000,
    maxBuffer: 4 * 1024 * 1024,
    env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', TEMP: process.env.TEMP ?? '', TMP: process.env.TMP ?? '' },
  });
  if (completed.error) throw new Error(name + ' runner error: ' + completed.error.message);
  const stdout = completed.stdout ?? '';
  const stderr = completed.stderr ?? '';
  if (completed.status !== 0) throw new Error(name + ' exited with status ' + completed.status + ': ' + stderr.slice(-2000));
  const outputs = stage.expected_outputs.map((relative) => {
    const file = safeWorkspacePath(workspace, relative, name + '.expected_output');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(name + ' did not produce expected file: ' + relative);
    return { path: relative, sha256: sha256File(file), size_bytes: fs.statSync(file).size };
  });
  return {
    name,
    product_version: stage.product_version,
    platform: stage.platform,
    command_sha256: sha256Buffer(Buffer.from(stableStringify(command))),
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    exit_code: completed.status,
    stdout_sha256: sha256Buffer(Buffer.from(stdout)),
    stderr_sha256: sha256Buffer(Buffer.from(stderr)),
    stdout_tail: stdout.slice(-8192),
    stderr_tail: stderr.slice(-8192),
    outputs,
  };
}

function main() {
  const manifestArg = process.argv[2];
  const workspaceArg = process.argv[3];
  if (!manifestArg || !workspaceArg) {
    console.error('Usage: node scripts/hydrology/run-hec-coupled-workflow.mjs <manifest.json> <workspace-directory>');
    process.exitCode = 2;
    return;
  }
  const manifestPath = path.resolve(manifestArg);
  const workspace = fs.realpathSync(path.resolve(workspaceArg));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const errors = validateManifest(manifest, { execution: true });
  if (errors.length) throw new Error('Manifest is not execution-ready: ' + errors.join('; '));
  if (manifest.artifact_storage.metadata_store !== 'run-manifest-only') {
    throw new Error('metadata_store=tsm-evidence-store-adapter is declared but the transaction-safe adapter is not implemented; use run-manifest-only until that adapter is separately verified');
  }
  if (manifest.hec_hms.platform !== process.platform && manifest.hec_hms.platform !== 'other') {
    const expected = process.platform === 'win32' ? 'windows-x64' : process.platform === 'linux' ? 'linux-x64' : process.platform === 'darwin' ? 'macos-arm64' : 'other';
    if (manifest.hec_hms.platform !== expected) throw new Error('HEC-HMS platform mismatch: manifest=' + manifest.hec_hms.platform + ', runtime=' + expected);
  }
  if (manifest.hec_ras.platform === 'windows-x64' && process.platform !== 'win32') {
    throw new Error('HEC-RAS is configured for Windows but this runner is not Windows; run on the approved Windows HEC-RAS worker');
  }

  verifyHashedFile(workspace, manifest.aoi.geometry_workspace_path, manifest.aoi.geometry_sha256, 'AOI geometry');
  verifyHashedFile(workspace, manifest.aoi.watershed_delineation_workspace_path, manifest.aoi.watershed_delineation_sha256, 'watershed delineation');
  for (const input of manifest.source_inputs) verifyHashedFile(workspace, input.workspace_path, input.sha256, 'source input ' + input.input_id);

  const storeRoot = safeWorkspacePath(workspace, manifest.artifact_storage.root_directory, 'artifact_storage.root_directory');
  fs.mkdirSync(storeRoot, { recursive: true });
  const runRoot = safeWorkspacePath(workspace, path.posix.join(manifest.artifact_storage.root_directory.replace(/\\/g, '/'), manifest.run_id), 'run artifact directory');
  fs.mkdirSync(runRoot, { recursive: false });
  const inputManifestSha256 = sha256Buffer(Buffer.from(stableStringify(manifest)));
  const run = {
    schema_version: manifest.schema_version,
    run_id: manifest.run_id,
    project_id: manifest.project_id,
    purpose: manifest.purpose,
    aoi: manifest.aoi,
    reference_system: manifest.reference_system,
    input_manifest_sha256: inputManifestSha256,
    source_control_commit: process.env.GITHUB_SHA ?? process.env.TSM_SOURCE_COMMIT ?? 'UNRECORDED_LOCAL_EXECUTION',
    started_at: new Date().toISOString(),
    status: 'RUNNING',
    stages: [],
    artifacts: [],
    human_review_required: true,
    regulatory_use_eligible: false,
  };
  const persistArtifact = (file, label) => {
    const hash = sha256File(file);
    const blobDirectory = path.join(storeRoot, 'blobs', hash.slice(0, 2));
    fs.mkdirSync(blobDirectory, { recursive: true });
    const blob = path.join(blobDirectory, hash);
    if (!fs.existsSync(blob)) fs.copyFileSync(file, blob, fs.constants.COPYFILE_EXCL);
    return { label, source_path: path.relative(workspace, file).replace(/\\/g, '/'), sha256: hash, size_bytes: fs.statSync(file).size, storage_uri: path.relative(workspace, blob).replace(/\\/g, '/') };
  };
  try {
    const hmsOutputDir = path.posix.join(manifest.artifact_storage.root_directory.replace(/\\/g, '/'), manifest.run_id, 'hms-output');
    const hms = runStage({ name: 'HEC-HMS', stage: manifest.hec_hms, workspace, outputDirectory: hmsOutputDir });
    run.stages.push(hms);
    const sourceOutput = safeWorkspacePath(workspace, manifest.hydrograph_handoff.source_output, 'hydrograph source output');
    if (!fs.existsSync(sourceOutput) || !fs.statSync(sourceOutput).isFile()) throw new Error('HEC-HMS handoff artifact missing: ' + manifest.hydrograph_handoff.source_output);
    const declaredHmsOutput = hms.outputs.some((item) => path.resolve(workspace, item.path) === sourceOutput);
    if (!declaredHmsOutput) throw new Error('hydrograph source_output must be one of the declared HEC-HMS expected_outputs');
    const rasInput = safeWorkspacePath(workspace, manifest.hydrograph_handoff.ras_input, 'hydrograph RAS input');
    fs.mkdirSync(path.dirname(rasInput), { recursive: true });
    fs.copyFileSync(sourceOutput, rasInput);
    run.hydrograph_handoff = {
      ...manifest.hydrograph_handoff,
      sha256: sha256File(rasInput),
      size_bytes: fs.statSync(rasInput).size,
      copied_to_ras_input: true,
      semantic_validation: 'NOT_PERFORMED_BY_GENERIC_RUNNER',
    };
    const rasOutputDir = path.posix.join(manifest.artifact_storage.root_directory.replace(/\\/g, '/'), manifest.run_id, 'ras-output');
    const ras = runStage({ name: 'HEC-RAS', stage: manifest.hec_ras, workspace, outputDirectory: rasOutputDir });
    run.stages.push(ras);
    for (const stage of run.stages) for (const output of stage.outputs) {
      run.artifacts.push(persistArtifact(safeWorkspacePath(workspace, output.path, 'model output'), stage.name + ':' + output.path));
    }
    run.artifacts.push(persistArtifact(rasInput, 'HEC-HMS-to-HEC-RAS handoff'));
    run.status = 'COMPLETED_UNVALIDATED';
    run.finished_at = new Date().toISOString();
    run.validation = {
      status: 'PENDING',
      required_next_steps: ['validate hydrograph time axis, units, gaps and location', 'inspect real HEC-RAS HDF outputs and solver diagnostics', 'mass-balance and stability review', 'independent calibration and validation', 'uncertainty and sensitivity assessment', 'qualified engineering review'],
    };
    const receipt = path.join(runRoot, 'run-receipt.json');
    fs.writeFileSync(receipt, JSON.stringify(run, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(path.join(runRoot, 'input-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ ok: true, run_id: run.run_id, status: run.status, receipt: path.relative(workspace, receipt), output_count: run.artifacts.length, note: 'Execution completed; scientific validation and human review remain pending.' }, null, 2));
  } catch (error) {
    run.status = 'FAILED_OR_BLOCKED';
    run.finished_at = new Date().toISOString();
    run.failure = String(error.message ?? error);
    fs.writeFileSync(path.join(runRoot, 'run-receipt.json'), JSON.stringify(run, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    throw error;
  }
}
try { main(); } catch (error) {
  console.error(JSON.stringify({ ok: false, status: 'FAILED_OR_BLOCKED', error: String(error.message ?? error) }, null, 2));
  process.exitCode = 1;
}
