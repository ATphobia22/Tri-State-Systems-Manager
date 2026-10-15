#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest } from './validate-hec-run-manifest.mjs';

const sha256Buffer = (buffer) => createHash('sha256').update(buffer).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
function sha256Tree(root) {
  const digest = createHash('sha256');
  function walk(directory, relativeRoot = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = path.posix.join(relativeRoot, entry.name);
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('model project contains a symbolic link; package hashing fails closed: ' + relative);
      if (entry.isDirectory()) walk(absolute, relative);
      else if (entry.isFile()) {
        digest.update(relative.replace(/\\/g, '/'));
        digest.update(Buffer.from([0]));
        digest.update(Buffer.from(sha256File(absolute), 'hex'));
      } else throw new Error('model project contains a non-regular filesystem entry: ' + relative);
    }
  }
  walk(root);
  return digest.digest('hex');
}
function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function safeWorkspacePath(workspace, relative, label) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\0')) throw new Error(label + ' must be a non-empty relative workspace path');
  const normalized = relative.replace(/\\/g, '/');
  if (normalized.split('/').some((part) => part === '..' || part === '.')) throw new Error(label + ' cannot contain dot segments');
  const root = path.resolve(workspace);
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error(label + ' escapes workspace');
  // Lexical containment alone is insufficient: a symlink inside the workspace
  // could point outside it. Resolve the target or nearest existing ancestor.
  let ancestor = resolved;
  while (!fs.existsSync(ancestor) && ancestor !== path.dirname(ancestor)) ancestor = path.dirname(ancestor);
  const realAncestor = fs.realpathSync(ancestor);
  if (realAncestor !== root && !realAncestor.startsWith(root + path.sep)) throw new Error(label + ' traverses a symlink outside workspace');
  if (fs.existsSync(resolved)) {
    const realTarget = fs.realpathSync(resolved);
    if (realTarget !== root && !realTarget.startsWith(root + path.sep)) throw new Error(label + ' resolves outside workspace');
  }
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
export function runStage({ name, stage, workspace, outputDirectory }) {
  const project = safeWorkspacePath(workspace, stage.project_directory, name + '.project_directory');
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) throw new Error(name + ' project directory is missing: ' + stage.project_directory);
  if (fs.readdirSync(project).length === 0) throw new Error(name + ' project directory is empty; model project files are required');
  const output = safeWorkspacePath(workspace, outputDirectory, name + '.output_directory');
  if (fs.existsSync(output) && (!fs.statSync(output).isDirectory() || fs.readdirSync(output).length > 0)) {
    throw new Error(name + ' output directory must be a new or empty directory to prevent stale-output reuse: ' + outputDirectory);
  }
  fs.mkdirSync(output, { recursive: true });
  const command = stage.command.map((part) => replaceTokens(part, { workspace, project, output }));
  if (command[0] === 'UNCONFIGURED' || command.some((part) => /^(UNCONFIGURED|UNPINNED|TBD)$/i.test(part))) throw new Error(name + ' command is not configured');
  if (!path.isAbsolute(command[0]) || !fs.existsSync(command[0]) || !fs.statSync(command[0]).isFile()) {
    throw new Error(name + ' executable must be an absolute path to an existing executable file');
  }
  const executableSha256 = sha256File(command[0]);
  const projectPackageSha256 = sha256Tree(project);
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
    const relativeToOutput = path.relative(output, file);
    if (relativeToOutput === '..' || relativeToOutput.startsWith('..' + path.sep) || path.isAbsolute(relativeToOutput)) {
      throw new Error(name + ' expected outputs must be contained by its isolated output_directory: ' + relative);
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(name + ' did not produce expected file: ' + relative);
    return { path: relative, sha256: sha256File(file), size_bytes: fs.statSync(file).size };
  });
  return {
    name,
    product_version: stage.product_version,
    platform: stage.platform,
    command_sha256: sha256Buffer(Buffer.from(stableStringify(command))),
    executable_sha256: executableSha256,
    project_package_sha256: projectPackageSha256,
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
  const hmsProjectCheck = safeWorkspacePath(workspace, manifest.hec_hms.project_directory, 'HEC-HMS project directory');
  const rasProjectCheck = safeWorkspacePath(workspace, manifest.hec_ras.project_directory, 'HEC-RAS project directory');
  const hmsOutputCheck = safeWorkspacePath(workspace, manifest.hec_hms.output_directory, 'HEC-HMS output directory');
  const rasOutputCheck = safeWorkspacePath(workspace, manifest.hec_ras.output_directory, 'HEC-RAS output directory');
  const disjoint = (left, right, leftName, rightName) => {
    const relative = path.relative(left, right);
    const reverse = path.relative(right, left);
    if (left === right || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) ||
        (!reverse.startsWith('..' + path.sep) && reverse !== '..' && !path.isAbsolute(reverse))) {
      throw new Error(leftName + ' and ' + rightName + ' directories must not overlap');
    }
  };
  for (const [dir, label] of [[hmsProjectCheck, 'HEC-HMS project'], [rasProjectCheck, 'HEC-RAS project']]) {
    disjoint(storeRoot, dir, 'artifact store', label);
  }
  const immutableInputPaths = [
    [manifest.aoi.geometry_workspace_path, 'AOI geometry'],
    [manifest.aoi.watershed_delineation_workspace_path, 'watershed delineation'],
    ...manifest.source_inputs.map((input) => [input.workspace_path, 'source input ' + input.input_id]),
  ];
  for (const [relative, label] of immutableInputPaths) {
    const inputPath = safeWorkspacePath(workspace, relative, label);
    disjoint(storeRoot, inputPath, 'artifact store', label);
  }
  for (const [dir, label] of [[hmsOutputCheck, 'HEC-HMS output'], [rasOutputCheck, 'HEC-RAS output']]) {
    disjoint(storeRoot, dir, 'artifact store', label);
    disjoint(dir, hmsProjectCheck, label, 'HEC-HMS project');
    disjoint(dir, rasProjectCheck, label, 'HEC-RAS project');
  }
  disjoint(hmsProjectCheck, rasProjectCheck, 'HEC-HMS project', 'HEC-RAS project');
  disjoint(hmsOutputCheck, rasOutputCheck, 'HEC-HMS output', 'HEC-RAS output');
  const rasInputCheck = safeWorkspacePath(workspace, manifest.hydrograph_handoff.ras_input, 'hydrograph RAS input');
  const relativeToRasProject = path.relative(rasProjectCheck, rasInputCheck);
  if (relativeToRasProject === '..' || relativeToRasProject.startsWith('..' + path.sep) || path.isAbsolute(relativeToRasProject)) {
    throw new Error('hydrograph RAS input must be inside the configured HEC-RAS project directory');
  }
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
  const persistTree = (directory, label) => {
    const records = [];
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = path.join(current, entry.name);
        if (entry.isSymbolicLink()) throw new Error(label + ' contains a symbolic link: ' + file);
        if (entry.isDirectory()) walk(file);
        else if (entry.isFile()) records.push(persistArtifact(file, label + ':' + path.relative(directory, file).replace(/\\/g, '/')));
        else throw new Error(label + ' contains a non-regular filesystem entry: ' + file);
      }
    };
    walk(directory);
    if (records.length === 0) throw new Error(label + ' has no files to preserve');
    return records;
  };
  try {
    run.artifacts.push(persistArtifact(verifyHashedFile(workspace, manifest.aoi.geometry_workspace_path, manifest.aoi.geometry_sha256, 'AOI geometry'), 'approved AOI geometry'));
    run.artifacts.push(persistArtifact(verifyHashedFile(workspace, manifest.aoi.watershed_delineation_workspace_path, manifest.aoi.watershed_delineation_sha256, 'watershed delineation'), 'approved watershed delineation'));
    for (const input of manifest.source_inputs) run.artifacts.push(persistArtifact(verifyHashedFile(workspace, input.workspace_path, input.sha256, 'source input ' + input.input_id), 'source input:' + input.input_id));
    const hmsProject = safeWorkspacePath(workspace, manifest.hec_hms.project_directory, 'HEC-HMS project directory');
    run.artifacts.push(...persistTree(hmsProject, 'HEC-HMS model package'));
    const hmsOutputDir = manifest.hec_hms.output_directory;
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
    const rasProject = safeWorkspacePath(workspace, manifest.hec_ras.project_directory, 'HEC-RAS project directory');
    run.artifacts.push(...persistTree(rasProject, 'HEC-RAS model package including configured hydrograph handoff'));
    const rasOutputDir = manifest.hec_ras.output_directory;
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
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(JSON.stringify({ ok: false, status: 'FAILED_OR_BLOCKED', error: String(error.message ?? error) }, null, 2));
    process.exitCode = 1;
  }
}
