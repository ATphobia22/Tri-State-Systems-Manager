#!/usr/bin/env node
/**
 * TSM AI worker PRE-FLIGHT planner.
 * No model inference, network, process spawning, or publishing occurs here.
 * See docs/engineering-development/AI-WORKER-PIPELINE.md and ADR-006.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKERS = Object.freeze({
  'photogrammetry-mesh': {
    kind: 'geometry_candidate',
    stages: ['verify_capture_rights', 'colmap_camera_recovery', 'openmvs_dense_mesh',
      'register_with_ground_control', 'independent_checkpoint_validation',
      'gltf_conversion', '3d_tiles_1_1_validation'],
    tools: ['COLMAP', 'OpenMVS', 'glTF Validator', '3D Tiles Validator'],
  },
  'gaussian-appearance': {
    kind: 'visual_context',
    stages: ['verify_capture_rights', 'colmap_camera_recovery', 'nerfstudio_gsplat_training',
      'visual_quality_review', 'geospatial_registration_review'],
    tools: ['COLMAP', 'Nerfstudio', 'gsplat'],
  },
  'synthetic-pbr-prop': {
    kind: 'synthetic_visual',
    stages: ['verify_image_rights', 'trellis2_local_image_to_mesh',
      'pbr_material_review', 'gltf_validation', 'human_visual_review'],
    tools: ['TRELLIS.2', 'glTF Validator'],
  },
});

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}
function requireObject(value, field) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new TypeError(field + ' must be an object');
  }
}
function withinRoot(root, target) {
  const rel = relative(root, target);
  return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
}
function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(field + ' must be a non-empty string');
  }
  return value;
}

/**
 * Resolve and hash ACTUAL local bytes. Reject path escapes and symlink escapes.
 * The sha256 asserts file integrity only, not the truth or accuracy of its data.
 */
async function hashSource(source, root) {
  requireObject(source, 'source');
  const sourceId = requireString(source.sourceId, 'source.sourceId');
  const path = requireString(source.path, 'source.path');
  if (isAbsolute(path) || path.includes('://') || path.includes('\\')) {
    throw new Error('source path must be a relative local file: ' + sourceId);
  }
  const target = await realpath(resolve(root, path));
  if (!withinRoot(root, target)) throw new Error('source escapes the approved source root: ' + sourceId);
  if (!(await stat(target)).isFile()) throw new Error('source is not a regular file: ' + sourceId);
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(target)) {
    size += chunk.length;
    hash.update(chunk);
  }
  return {
    sourceId,
    path,
    sha256: hash.digest('hex'),
    bytes: size,
    declaredSourceClass: source.declaredSourceClass ?? 'UNVERIFIED',
    captureTime: source.captureTime ?? null,
    crs: source.crs ?? null,
    verticalDatum: source.verticalDatum ?? null,
    independentlyVerified: false,
  };
}

export async function createWorkerPlan(request, sourceRoot) {
  requireObject(request, 'request');
  const workerId = requireString(request.workerId, 'request.workerId');
  if (!Object.hasOwn(WORKERS, workerId)) throw new Error('unrecognized workerId: ' + workerId);
  if (!Array.isArray(request.sources) || request.sources.length < 1 || request.sources.length > 32) {
    throw new Error('sources must contain 1-32 local files');
  }
  if (request.autonomy && request.autonomy !== 'S1') {
    throw new Error('pre-flight accepts S1 planning only; S2 needs a separate explicit human approval');
  }
  const root = await realpath(resolve(sourceRoot));
  const sources = [];
  const ids = new Set();
  for (const source of request.sources) {
    const hashed = await hashSource(source, root);
    if (ids.has(hashed.sourceId)) throw new Error('duplicate sourceId: ' + hashed.sourceId);
    ids.add(hashed.sourceId);
    sources.push(hashed);
  }

  const worker = WORKERS[workerId];
  const blockers = ['MODEL_RUNTIME_NOT_PROVISIONED_OR_EXECUTED',
    'MODEL_AND_DEPENDENCY_LICENSE_REVIEW_REQUIRED',
    'INDEPENDENT_OUTPUT_VALIDATION_NOT_PERFORMED',
    'HUMAN_PUBLICATION_APPROVAL_REQUIRED'];
  if (request.rightsCleared !== true) blockers.push('INPUT_USAGE_RIGHTS_UNVERIFIED');
  if (workerId === 'photogrammetry-mesh') {
    const ref = request.spatialReference;
    if (!ref || !/^EPSG:[0-9]+$/.test(ref.crs ?? '') || !ref.verticalDatum) {
      blockers.push('GEOREFERENCING_CRS_AND_VERTICAL_DATUM_MISSING');
    }
    if (!request.independentCheckpointsAvailable) blockers.push('INDEPENDENT_CHECKPOINTS_MISSING');
  }

  const plan = {
    schemaVersion: 'tsm.ai-worker-plan.v1',
    workerId,
    outputKind: worker.kind,
    authorityClass: 'DERIVED',
    sourceTrust: 'DECLARED_NOT_VERIFIED',
    governanceStatus: 'human_review_required',
    publishable: false,
    engineeringUseAllowed: false,
    executed: false,
    autonomy: 'S1',
    sourceRoot: '.',
    sources,
    spatialReference: request.spatialReference ?? null,
    toolsToProvision: worker.tools,
    proposedStages: worker.stages,
    blockers,
    evidencePolicy: {
      preserveInputHashes: true,
      recordPinnedToolAndModelRevisions: true,
      requireIndependentValidation: true,
      noAutomaticLedgerWrites: true,
      noAutomaticPublishing: true,
      noAutomaticRegulatoryFilings: true,
      syntheticGeometryNeverAuthoritative: true,
    },
  };
  return { ...plan, planSha256: digest(JSON.stringify(stable(plan))) };
}

async function main() {
  const [flag, requestFile, rootFlag, rootDir] = process.argv.slice(2);
  if (flag !== '--request' || !requestFile || rootFlag !== '--source-root' || !rootDir) {
    throw new Error('usage: node integrations/ai-workers/plan.mjs --request request.json --source-root ./capture');
  }
  const request = JSON.parse(await readFile(requestFile, 'utf8'));
  const plan = await createWorkerPlan(request, rootDir);
  process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    console.error('AI worker plan rejected:', error.message);
    process.exitCode = 1;
  });
}
