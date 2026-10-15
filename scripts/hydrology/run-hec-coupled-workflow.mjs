#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest } from './validate-hec-run-manifest.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
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
  return token.replace(/\{\{([a-z_]+)\}\}/g, (whole, key) => {
    if (!Object.hasOwn(values, key) || typeof values[key] !== 'string') {
      throw new Error('unsupported or unresolved execution placeholder: ' + whole);
    }
    return values[key];
  });
}
function checkedRuntimeEnvironment() {
  const allowed = [
    'PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'HOME',
    'JAVA_HOME', 'HEC_HMS_HOME', 'HEC_RAS_HOME', 'PYTHONPATH', 'PYTHONHOME',
    'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'OMP_NUM_THREADS',
  ];
  return Object.fromEntries(allowed.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
}
export function runStage({ name, stage, workspace, outputDirectory, tokenValues = {}, sourceProjectPackageSha256 = null }) {
  const project = safeWorkspacePath(workspace, stage.project_directory, name + '.project_directory');
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) throw new Error(name + ' project directory is missing: ' + stage.project_directory);
  if (fs.readdirSync(project).length === 0) throw new Error(name + ' project directory is empty; model project files are required');
  const output = safeWorkspacePath(workspace, outputDirectory, name + '.output_directory');
  if (fs.existsSync(output) && (!fs.statSync(output).isDirectory() || fs.readdirSync(output).length > 0)) {
    throw new Error(name + ' output directory must be new or empty to prevent stale-output reuse: ' + outputDirectory);
  }
  fs.mkdirSync(output, { recursive: true });
  const values = { workspace, project, output, ...tokenValues };
  const command = stage.command.map((part) => replaceTokens(part, values));
  if (command[0] === 'UNCONFIGURED' || command.some((part) => /^(UNCONFIGURED|UNPINNED|TBD)$/i.test(part))) throw new Error(name + ' command is not configured');
  if (!path.isAbsolute(command[0]) || !fs.existsSync(command[0]) || !fs.statSync(command[0]).isFile()) {
    throw new Error(name + ' executable must be an absolute path to an existing executable file');
  }
  const executableSha256 = sha256File(command[0]);
  if (!/^[a-f0-9]{64}$/.test(stage.executable_sha256 ?? '') || executableSha256 !== stage.executable_sha256) {
    throw new Error(name + ' adapter executable SHA-256 does not match the pinned manifest digest');
  }
  const projectPackageSha256 = sha256Tree(project);
  if (!/^[a-f0-9]{64}$/.test(stage.project_package_sha256 ?? '') || projectPackageSha256 !== stage.project_package_sha256) {
    throw new Error(name + ' staged project tree SHA-256 does not match the expected project package digest');
  }
  const startedAt = new Date().toISOString();
  const completed = spawnSync(command[0], command.slice(1), {
    cwd: project,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: stage.timeout_seconds * 1000,
    maxBuffer: 4 * 1024 * 1024,
    env: checkedRuntimeEnvironment(),
  });
  const stdout = completed.stdout ?? '';
  const stderr = completed.stderr ?? '';
  const stdoutPath = path.join(output, 'stage.stdout.log');
  const stderrPath = path.join(output, 'stage.stderr.log');
  fs.writeFileSync(stdoutPath, stdout, { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(stderrPath, stderr, { flag: 'wx', mode: 0o600 });
  if (completed.error) throw new Error(name + ' runner error: ' + completed.error.message);
  if (completed.status !== 0) throw new Error(name + ' exited with status ' + completed.status + ': ' + stderr.slice(-2000));
  const outputs = stage.expected_outputs.map((relative) => {
    const file = safeWorkspacePath(workspace, relative, name + '.expected_output');
    const relativeToOutput = path.relative(output, file);
    if (relativeToOutput === '..' || relativeToOutput.startsWith('..' + path.sep) || path.isAbsolute(relativeToOutput)) {
      throw new Error(name + ' expected outputs must be contained by its isolated output_directory: ' + relative);
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size === 0) {
      throw new Error(name + ' did not produce a non-empty expected file: ' + relative);
    }
    return { path: relative, sha256: sha256File(file), size_bytes: fs.statSync(file).size };
  });
  return {
    name,
    product_version: stage.product_version,
    platform: stage.platform,
    adapter_executable_sha256: executableSha256,
    source_project_package_sha256: sourceProjectPackageSha256 ?? stage.project_package_sha256,
    project_package_sha256: projectPackageSha256,
    command_sha256: sha256Buffer(Buffer.from(stableStringify(command))),
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    exit_code: completed.status,
    stdout_sha256: sha256Buffer(Buffer.from(stdout)),
    stderr_sha256: sha256Buffer(Buffer.from(stderr)),
    stdout_log_path: path.relative(workspace, stdoutPath).replace(/\\/g, '/'),
    stderr_log_path: path.relative(workspace, stderrPath).replace(/\\/g, '/'),
    stdout_tail: stdout.slice(-8192),
    stderr_tail: stderr.slice(-8192),
    outputs,
  };
}
function copyProjectChecked(source, destination, expectedHash, label) {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) throw new Error(label + ' source project directory is missing');
  const beforeHash = sha256Tree(source);
  if (!/^[a-f0-9]{64}$/.test(expectedHash ?? '') || beforeHash !== expectedHash) {
    throw new Error(label + ' source project hash differs from the approved manifest');
  }
  if (fs.existsSync(destination)) throw new Error(label + ' run-copy path already exists; refusing to reuse prior state');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });
  const copiedHash = sha256Tree(destination);
  if (copiedHash !== beforeHash) throw new Error(label + ' source-to-run-copy hash mismatch');
  if (sha256Tree(source) !== beforeHash) throw new Error(label + ' source project changed while the run copy was made');
  return { sourceHash: beforeHash, copiedHash };
}
function assertDirectoryDisjoint(left, right, leftName, rightName) {
  const relative = path.relative(left, right);
  const reverse = path.relative(right, left);
  if (left === right || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) ||
      (!reverse.startsWith('..' + path.sep) && reverse !== '..' && !path.isAbsolute(reverse))) {
    throw new Error(leftName + ' and ' + rightName + ' paths must not overlap');
  }
}


function removeStaleRasPlanOutputs(projectDirectory) {
  const removed = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('staged HEC-RAS project contains a symlink: ' + file);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && (/\.p\d{2}\.hdf$/i.test(entry.name) || /\.p\d{2}\.comp_msgs\.txt$/i.test(entry.name))) {
        fs.rmSync(file);
        removed.push(path.relative(projectDirectory, file).replace(/\\/g, '/'));
      }
    }
  };
  walk(projectDirectory);
  return removed.sort();
}
function assertHdf5File(file, label) {
  const expected = Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]);
  const descriptor = fs.openSync(file, 'r');
  let actual;
  try {
    actual = Buffer.alloc(expected.length);
    fs.readSync(descriptor, actual, 0, expected.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (!actual || !actual.equals(expected)) throw new Error(label + ' is not a valid HDF5 file signature: ' + file);
}
function mapStageOutputLayout(stage, workspace, runWorkRelative, label) {
  const configuredRoot = safeWorkspacePath(workspace, stage.output_directory, label + ' configured output root');
  const runtimeRootRelative = path.posix.join(runWorkRelative, 'outputs', label.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
  const runtimeRoot = safeWorkspacePath(workspace, runtimeRootRelative, label + ' isolated output root');
  const mapped = stage.expected_outputs.map((relative) => {
    const configuredFile = safeWorkspacePath(workspace, relative, label + ' configured expected output');
    const within = path.relative(configuredRoot, configuredFile);
    if (within === '..' || within.startsWith('..' + path.sep) || path.isAbsolute(within)) {
      throw new Error(label + ' expected_outputs must be contained within its configured output_directory: ' + relative);
    }
    return path.posix.join(runtimeRootRelative, within.replace(/\\/g, '/'));
  });
  return { outputDirectory: runtimeRootRelative, outputRoot: runtimeRoot, expectedOutputs: mapped };
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
  const sourceControlCommit = process.env.GITHUB_SHA ?? process.env.TSM_SOURCE_COMMIT ?? '';
  if (!/^[a-f0-9]{40}$/.test(sourceControlCommit) || sourceControlCommit !== manifest.source_commit) {
    throw new Error('execution must set GITHUB_SHA or TSM_SOURCE_COMMIT to the exact manifest.source_commit; unrecorded local execution is prohibited');
  }
  if (manifest.artifact_storage.metadata_store !== 'run-manifest-only') {
    throw new Error('metadata_store=tsm-evidence-store-adapter is declared but the transaction-safe adapter is not implemented; use run-manifest-only until that adapter is separately verified');
  }
  const expectedPlatform = process.platform === 'win32' ? 'windows-x64' : process.platform === 'linux' ? 'linux-x64' : process.platform === 'darwin' ? 'macos-arm64' : 'other';
  for (const [label, stage] of [['HEC-HMS', manifest.hec_hms], ['HEC-RAS', manifest.hec_ras]]) {
    if (stage.platform !== 'other' && stage.platform !== expectedPlatform) {
      throw new Error(label + ' platform mismatch: manifest=' + stage.platform + ', runtime=' + expectedPlatform);
    }
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
  const sourceHmsProjectSha256 = sha256Tree(hmsProjectCheck);
  const sourceRasProjectSha256 = sha256Tree(rasProjectCheck);
  if (sourceHmsProjectSha256 !== manifest.hec_hms.project_package_sha256) throw new Error('HEC-HMS source project SHA-256 differs from the approved manifest');
  if (sourceRasProjectSha256 !== manifest.hec_ras.project_package_sha256) throw new Error('HEC-RAS source project SHA-256 differs from the approved manifest');
  for (const [label, stage] of [['HEC-HMS', manifest.hec_hms], ['HEC-RAS', manifest.hec_ras]]) {
    const adapterExecutable = stage.command[0];
    if (!path.isAbsolute(adapterExecutable) || !fs.existsSync(adapterExecutable) || !fs.statSync(adapterExecutable).isFile()) {
      throw new Error(label + ' adapter executable must be an existing absolute file');
    }
    if (sha256File(adapterExecutable) !== stage.executable_sha256) throw new Error(label + ' adapter executable does not match pinned SHA-256');
    const runtimeExecutable = stage.runtime_executable_path;
    if (!path.isAbsolute(runtimeExecutable) || !fs.existsSync(runtimeExecutable) || !fs.statSync(runtimeExecutable).isFile()) {
      throw new Error(label + ' vendor HEC runtime must be an existing absolute file');
    }
    if (sha256File(runtimeExecutable) !== stage.runtime_executable_sha256) throw new Error(label + ' vendor HEC executable does not match pinned SHA-256');
  }
  const handoff = manifest.hydrograph_handoff;
  const handoffScriptPath = path.resolve(REPO_ROOT, handoff.adapter_script_path);
  const relativeScriptPath = path.relative(REPO_ROOT, handoffScriptPath);
  if (path.isAbsolute(relativeScriptPath) || relativeScriptPath === '..' || relativeScriptPath.startsWith('..' + path.sep)) {
    throw new Error('handoff adapter script path must be relative to the checked-out TSM repository');
  }
  if (!fs.existsSync(handoffScriptPath) || !fs.statSync(handoffScriptPath).isFile() || fs.lstatSync(handoffScriptPath).isSymbolicLink()) {
    throw new Error('handoff adapter script is missing, not a regular file, or a symlink');
  }
  if (sha256File(handoffScriptPath) !== handoff.adapter_script_sha256) throw new Error('handoff adapter script SHA-256 does not match the manifest');
  const adapterSource = fs.readFileSync(handoffScriptPath, 'utf8');
  const adapterVersionMatch = adapterSource.match(/ADAPTER_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!adapterVersionMatch || adapterVersionMatch[1] !== handoff.adapter_version) throw new Error('handoff adapter version constant does not match the manifest');
  const rasDssRelative = handoff.ras_dss_relative_path;
  if (path.isAbsolute(rasDssRelative) || rasDssRelative.replace(/\\/g, '/').split('/').some((part) => part === '..' || part === '.' || part === '')) {
    throw new Error('hydrograph_handoff.ras_dss_relative_path must be a safe relative project path');
  }
  const runWorkRelative = path.posix.join('runs-work', manifest.run_id);
  const runWorkRoot = safeWorkspacePath(workspace, runWorkRelative, 'isolated run workspace');
  assertDirectoryDisjoint(storeRoot, runWorkRoot, 'artifact store', 'isolated run workspace');
  for (const [dir, label] of [[hmsProjectCheck, 'HEC-HMS source project'], [rasProjectCheck, 'HEC-RAS source project'], [hmsOutputCheck, 'HEC-HMS configured output'], [rasOutputCheck, 'HEC-RAS configured output']]) {
    assertDirectoryDisjoint(runWorkRoot, dir, 'isolated run workspace', label);
  }
  fs.mkdirSync(path.dirname(runWorkRoot), { recursive: true });
  if (fs.existsSync(runWorkRoot)) throw new Error('isolated run workspace already exists; refusing to reuse prior state');
  fs.mkdirSync(runWorkRoot, { recursive: false });
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
    source_control_commit: sourceControlCommit,
    source_project_hashes: { hec_hms: sourceHmsProjectSha256, hec_ras: sourceRasProjectSha256 },
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
    if (fs.existsSync(blob)) {
      if (!fs.statSync(blob).isFile() || sha256File(blob) !== hash) throw new Error('existing content-addressed blob failed integrity check: ' + blob);
    } else {
      const temporaryBlob = blob + '.tmp-' + process.pid + '-' + Math.random().toString(16).slice(2);
      try {
        fs.copyFileSync(file, temporaryBlob, fs.constants.COPYFILE_EXCL);
        if (sha256File(temporaryBlob) !== hash) throw new Error('artifact changed during content-addressed copy: ' + file);
        fs.renameSync(temporaryBlob, blob);
      } finally {
        if (fs.existsSync(temporaryBlob)) fs.rmSync(temporaryBlob, { force: true });
      }
    }
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
    run.manifest_file_sha256 = sha256File(manifestPath);
    const aoiGeometry = verifyHashedFile(workspace, manifest.aoi.geometry_workspace_path, manifest.aoi.geometry_sha256, 'AOI geometry');
    const watershed = verifyHashedFile(workspace, manifest.aoi.watershed_delineation_workspace_path, manifest.aoi.watershed_delineation_sha256, 'watershed delineation');
    run.artifacts.push(persistArtifact(aoiGeometry, 'approved AOI geometry'));
    run.artifacts.push(persistArtifact(watershed, 'approved watershed delineation'));
    for (const input of manifest.source_inputs) {
      run.artifacts.push(persistArtifact(verifyHashedFile(workspace, input.workspace_path, input.sha256, 'source input ' + input.input_id), 'source input:' + input.input_id));
    }

    const hmsSource = safeWorkspacePath(workspace, manifest.hec_hms.project_directory, 'HEC-HMS source project');
    const rasSource = safeWorkspacePath(workspace, manifest.hec_ras.project_directory, 'HEC-RAS source project');
    run.artifacts.push(...persistTree(hmsSource, 'HEC-HMS immutable source package'));
    run.artifacts.push(...persistTree(rasSource, 'HEC-RAS immutable source package'));

    const hmsWorking = path.join(runWorkRoot, 'models', 'hec-hms');
    const rasWorking = path.join(runWorkRoot, 'models', 'hec-ras');
    const hmsCopy = copyProjectChecked(hmsSource, hmsWorking, sourceHmsProjectSha256, 'HEC-HMS');
    const rasCopy = copyProjectChecked(rasSource, rasWorking, sourceRasProjectSha256, 'HEC-RAS');
    run.model_copies = {
      hec_hms: { path: path.relative(workspace, hmsWorking).replace(/\\/g, '/'), source_sha256: hmsCopy.sourceHash, copied_sha256: hmsCopy.copiedHash },
      hec_ras: { path: path.relative(workspace, rasWorking).replace(/\\/g, '/'), source_sha256: rasCopy.sourceHash, copied_sha256: rasCopy.copiedHash },
    };

    const hmsLayout = mapStageOutputLayout(manifest.hec_hms, workspace, runWorkRelative, 'hec-hms');
    const rasLayout = mapStageOutputLayout(manifest.hec_ras, workspace, runWorkRelative, 'hec-ras');
    const hmsRunStage = {
      ...manifest.hec_hms,
      project_directory: path.relative(workspace, hmsWorking).replace(/\\/g, '/'),
      output_directory: hmsLayout.outputDirectory,
      expected_outputs: hmsLayout.expectedOutputs,
      project_package_sha256: hmsCopy.copiedHash,
    };
    const hms = runStage({
      name: 'HEC-HMS', stage: hmsRunStage, workspace,
      outputDirectory: hmsLayout.outputDirectory,
      sourceProjectPackageSha256: sourceHmsProjectSha256,
      tokenValues: { manifest: manifestPath },
    });
    run.stages.push(hms);
    run.artifacts.push(...persistTree(hmsLayout.outputRoot, 'HEC-HMS stage outputs and logs'));
    run.artifacts.push(...persistTree(hmsWorking, 'HEC-HMS run-copy package after compute'));

    const configuredHmsOutputDir = safeWorkspacePath(workspace, manifest.hec_hms.output_directory, 'configured HEC-HMS output directory');
    const configuredSourceOutput = safeWorkspacePath(workspace, manifest.hydrograph_handoff.source_output, 'configured hydrograph source output');
    const sourceOutputWithin = path.relative(configuredHmsOutputDir, configuredSourceOutput);
    if (sourceOutputWithin === '..' || sourceOutputWithin.startsWith('..' + path.sep) || path.isAbsolute(sourceOutputWithin)) {
      throw new Error('hydrograph_handoff.source_output must be inside hec_hms.output_directory');
    }
    const sourceOutputRelative = path.posix.join(hmsLayout.outputDirectory, sourceOutputWithin.replace(/\\/g, '/'));
    const sourceOutput = safeWorkspacePath(workspace, sourceOutputRelative, 'isolated HEC-HMS DSS output');
    if (!hms.outputs.some((item) => path.resolve(workspace, item.path) === sourceOutput)) {
      throw new Error('mapped source_output must be one of the declared HEC-HMS expected_outputs');
    }
    if (!fs.existsSync(sourceOutput) || !fs.statSync(sourceOutput).isFile() || fs.statSync(sourceOutput).size === 0) {
      throw new Error('HEC-HMS handoff DSS artifact missing or empty: ' + sourceOutputRelative);
    }

    const rasInputRelativeFromSource = path.relative(rasProjectCheck, rasInputCheck);
    const rasInput = path.resolve(rasWorking, rasInputRelativeFromSource);
    const rasInputRelativeFromWorking = path.relative(rasWorking, rasInput);
    if (rasInputRelativeFromWorking === '..' || rasInputRelativeFromWorking.startsWith('..' + path.sep) || path.isAbsolute(rasInputRelativeFromWorking)) {
      throw new Error('mapped RAS .uNN path escapes the staged HEC-RAS project');
    }
    if (!fs.existsSync(rasInput) || !fs.statSync(rasInput).isFile()) throw new Error('staged HEC-RAS unsteady-flow input is missing: ' + rasInput);
    const rasDss = path.resolve(rasWorking, handoff.ras_dss_relative_path);
    const rasDssRelativeFromWorking = path.relative(rasWorking, rasDss);
    if (rasDssRelativeFromWorking === '..' || rasDssRelativeFromWorking.startsWith('..' + path.sep) || path.isAbsolute(rasDssRelativeFromWorking)) {
      throw new Error('target DSS path escapes the staged HEC-RAS project');
    }
    if (path.resolve(rasDss) === path.resolve(rasInput) || path.resolve(rasDss) === path.resolve(sourceOutput)) {
      throw new Error('HMS DSS, RAS target DSS, and RAS .uNN files must be distinct artifacts');
    }

    const handoffOutput = path.join(runWorkRoot, 'handoff');
    fs.mkdirSync(handoffOutput, { recursive: false });
    const handoffReportPath = path.join(handoffOutput, 'handoff-report.json');
    const adapterCommand = handoff.adapter_command.map((part) => replaceTokens(part, {
      workspace,
      project: rasWorking,
      output: handoffOutput,
      source_output: sourceOutput,
      ras_input: rasInput,
      ras_dss: rasDss,
      manifest: manifestPath,
      handoff_report: handoffReportPath,
      adapter_script: handoffScriptPath,
    }));
    if (!adapterCommand.includes(handoffScriptPath)) throw new Error('adapter_command must invoke the exact hash-pinned {{adapter_script}}');
    if (!path.isAbsolute(adapterCommand[0]) || !fs.existsSync(adapterCommand[0]) || !fs.statSync(adapterCommand[0]).isFile()) {
      throw new Error('hydrograph adapter launcher must be an absolute path to an existing file');
    }
    if (sha256File(adapterCommand[0]) !== handoff.adapter_executable_sha256) {
      throw new Error('hydrograph adapter launcher SHA-256 does not match the manifest');
    }
    const handoffStartedAt = new Date().toISOString();
    const handoffProcess = spawnSync(adapterCommand[0], adapterCommand.slice(1), {
      cwd: rasWorking,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      timeout: handoff.timeout_seconds * 1000,
      maxBuffer: 4 * 1024 * 1024,
      env: checkedRuntimeEnvironment(),
    });
    const handoffStdout = handoffProcess.stdout ?? '';
    const handoffStderr = handoffProcess.stderr ?? '';
    const handoffStdoutPath = path.join(handoffOutput, 'handoff.stdout.log');
    const handoffStderrPath = path.join(handoffOutput, 'handoff.stderr.log');
    fs.writeFileSync(handoffStdoutPath, handoffStdout, { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(handoffStderrPath, handoffStderr, { flag: 'wx', mode: 0o600 });
    run.stages.push({
      name: 'HMS_TO_RAS_HYDROGRAPH_HANDOFF',
      adapter_version: handoff.adapter_version,
      adapter_command_sha256: sha256Buffer(Buffer.from(stableStringify(adapterCommand))),
      adapter_executable_sha256: sha256File(adapterCommand[0]),
      adapter_script_sha256: sha256File(handoffScriptPath),
      started_at: handoffStartedAt,
      finished_at: new Date().toISOString(),
      exit_code: handoffProcess.status,
      stdout_sha256: sha256Buffer(Buffer.from(handoffStdout)),
      stderr_sha256: sha256Buffer(Buffer.from(handoffStderr)),
      stdout_log_path: path.relative(workspace, handoffStdoutPath).replace(/\\/g, '/'),
      stderr_log_path: path.relative(workspace, handoffStderrPath).replace(/\\/g, '/'),
      stdout_tail: handoffStdout.slice(-8192),
      stderr_tail: handoffStderr.slice(-8192),
    });
    if (handoffProcess.error) throw new Error('hydrograph transfer adapter error: ' + handoffProcess.error.message);
    if (handoffProcess.status !== 0) throw new Error('hydrograph transfer adapter exited with status ' + handoffProcess.status + ': ' + handoffStderr.slice(-2000));
    if (!fs.existsSync(handoffReportPath) || !fs.statSync(handoffReportPath).isFile() || fs.statSync(handoffReportPath).size === 0) {
      throw new Error('hydrograph adapter did not produce its declared handoff report');
    }
    const handoffReport = JSON.parse(fs.readFileSync(handoffReportPath, 'utf8'));
    if (handoffReport.adapter !== handoff.adapter_version) throw new Error('handoff report adapter version does not match the manifest');
    if (handoffReport.status !== 'HANDOFF_WRITTEN_AND_STRUCTURALLY_CHECKED_HYDROLOGY_UNVALIDATED') {
      throw new Error('handoff report does not confirm the required structured transfer state');
    }
    if (handoffReport.source_dss?.sha256 !== sha256File(sourceOutput)) throw new Error('handoff report source DSS hash does not match HEC-HMS output');
    if (handoffReport.target_dss?.sha256 !== sha256File(rasDss) || handoffReport.target_dss?.pathname !== handoff.ras_dss_pathname) {
      throw new Error('handoff report target DSS path/hash mismatch');
    }
    if (handoffReport.target_unsteady_flow?.after_sha256 !== sha256File(rasInput)) {
      throw new Error('handoff report staged RAS .uNN hash mismatch');
    }
    if (!String(handoffReport.series?.status ?? '').startsWith('FORMAT_AND_UNIT_CONTRACT_VALIDATED')) {
      throw new Error('handoff report does not demonstrate hydrograph format/unit contract validation');
    }
    run.hydrograph_handoff = {
      status: handoffReport.status,
      report: handoffReport,
      report_path: path.relative(workspace, handoffReportPath).replace(/\\/g, '/'),
      report_sha256: sha256File(handoffReportPath),
      source_dss_sha256: sha256File(sourceOutput),
      target_dss_sha256: sha256File(rasDss),
      target_unsteady_flow_sha256: sha256File(rasInput),
      scientific_validation_status: 'NOT_PERFORMED',
    };
    run.artifacts.push(...persistTree(handoffOutput, 'HMS-to-RAS handoff receipt and logs'));
    run.artifacts.push(...persistTree(rasWorking, 'HEC-RAS run copy after explicit DSS boundary handoff'));

    const staleRasOutputsRemoved = removeStaleRasPlanOutputs(rasWorking);
    run.stages.push({
      name: 'HEC_RAS_STALE_OUTPUT_PREFLIGHT',
      status: 'PASS',
      removed_stale_plan_hdf_and_message_files: staleRasOutputsRemoved,
      note: 'Existing plan HDF and computation-message files were removed from the isolated run copy to prevent stale output reuse.',
    });
    const rasRunStage = {
      ...manifest.hec_ras,
      project_directory: path.relative(workspace, rasWorking).replace(/\\/g, '/'),
      output_directory: rasLayout.outputDirectory,
      expected_outputs: rasLayout.expectedOutputs,
      project_package_sha256: sha256Tree(rasWorking),
    };
    const ras = runStage({
      name: 'HEC-RAS', stage: rasRunStage, workspace,
      outputDirectory: rasLayout.outputDirectory,
      sourceProjectPackageSha256: sourceRasProjectSha256,
      tokenValues: { manifest: manifestPath, source_output: sourceOutput, ras_input: rasInput, ras_dss: rasDss, handoff_report: handoffReportPath },
    });
    run.stages.push(ras);
    for (const output of ras.outputs) {
      const file = safeWorkspacePath(workspace, output.path, 'HEC-RAS output');
      if (/\.hdf$/i.test(file)) assertHdf5File(file, 'HEC-RAS result');
    }
    run.artifacts.push(...persistTree(rasLayout.outputRoot, 'HEC-RAS result artifacts and logs'));
    run.artifacts.push(...persistTree(rasWorking, 'HEC-RAS run-copy package after computation'));
    for (const stage of run.stages) for (const output of stage.outputs ?? []) {
      run.artifacts.push(persistArtifact(safeWorkspacePath(workspace, output.path, 'model output'), stage.name + ':' + output.path));
    }
    if (sha256Tree(hmsProjectCheck) !== sourceHmsProjectSha256) throw new Error('HEC-HMS source package mutated during execution; provenance invalid');
    if (sha256Tree(rasProjectCheck) !== sourceRasProjectSha256) throw new Error('HEC-RAS source package mutated during execution; provenance invalid');

    run.status = 'COMPLETED_UNVALIDATED';
    run.finished_at = new Date().toISOString();
    run.validation = {
      status: 'PENDING',
      required_next_steps: [
        'qualify observed hydrograph and document source-to-boundary mapping',
        'inspect real HEC-RAS HDF output and solver diagnostics',
        'review numerical stability and hydraulic mass balance',
        'independent calibration and validation on separate observations',
        'uncertainty and sensitivity assessment',
        'qualified engineering review before engineering or regulatory use',
      ],
    };
    const receipt = path.join(runRoot, 'run-receipt.json');
    const runManifestCopy = path.join(runRoot, 'input-manifest.json');
    fs.writeFileSync(runManifestCopy, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    run.artifacts.push(persistArtifact(runManifestCopy, 'run input manifest'));
    fs.writeFileSync(receipt, JSON.stringify(run, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const receiptArtifact = persistArtifact(receipt, 'reproducible workflow run receipt');
    console.log(JSON.stringify({ ok: true, run_id: run.run_id, status: run.status, receipt: path.relative(workspace, receipt), receipt_sha256: receiptArtifact.sha256, output_count: run.artifacts.length, note: 'Execution completed; scientific validation and human review remain pending.' }, null, 2));
  } catch (error) {
    run.status = 'FAILED_OR_BLOCKED';
    run.finished_at = new Date().toISOString();
    run.failure = String(error.message ?? error);
    fs.writeFileSync(path.join(runRoot, 'run-receipt.json'), JSON.stringify(run, null, 2) + '\n', { mode: 0o600 });

  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(JSON.stringify({ ok: false, status: 'FAILED_OR_BLOCKED', error: String(error.message ?? error) }, null, 2));
    process.exitCode = 1;
  }
}
