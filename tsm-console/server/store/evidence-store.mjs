/**
 * Authoritative Evidence Store — Phase 1 file-backed implementation
 * Schema: schema.sql (PostgreSQL/PostGIS ready)
 * Production: swap persistence to pg; keep same API.
 *
 * SHA-256 proves integrity only.
 * Fail-closed: invalid hash or missing required fields → reject.
 *
 * Persistence is fully async (node:fs/promises). Mutations are serialized
 * through an in-process write queue so concurrent appends cannot interleave
 * their read-modify-write cycles. Retention caps bound file growth: the
 * newest N artifacts / verifications / Merkle roots are kept and older
 * entries are pruned on write.
 */

import { createHash, randomUUID } from 'node:crypto';
import { validateSpatialFields } from './geodetic-guard.mjs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.TSM_EVIDENCE_DIR || path.join(__dirname, '../../.data');
const STORE_FILE = path.join(DATA_DIR, 'evidence-store.json');

const REQUIRED = [
  'artifact_type', 'source_authority', 'source_uri', 'retrieved_at',
  'horizontal_crs', 'vertical_datum', 'content_hash_sha256',
  'authority_class', 'derivation_class', 'governance_status',
];

const HASH_RE = /^[a-f0-9]{64}$/;

function retentionLimit(envName, fallback) {
  const parsed = Number(process.env[envName]);
  if (Number.isInteger(parsed) && parsed >= 100) return parsed;
  return fallback;
}

// Retention caps: newest-first arrays are truncated to these lengths on write.
const MAX_ARTIFACTS = retentionLimit('TSM_EVIDENCE_MAX_ARTIFACTS', 10_000);
const MAX_VERIFICATIONS = retentionLimit('TSM_EVIDENCE_MAX_VERIFICATIONS', 10_000);
const MAX_MERKLE_ROOTS = retentionLimit('TSM_EVIDENCE_MAX_MERKLE_ROOTS', 1_000);

function emptyState() {
  return { artifacts: [], verifications: [], merkleRoots: [], merkleLeaves: [] };
}

async function loadState() {
  await mkdir(DATA_DIR, { recursive: true });
  let raw;
  try {
    raw = await readFile(STORE_FILE, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyState();
    throw error;
  }
  const state = JSON.parse(raw);
  if (!Array.isArray(state.artifacts)) state.artifacts = [];
  if (!Array.isArray(state.verifications)) state.verifications = [];
  if (!Array.isArray(state.merkleRoots)) state.merkleRoots = [];
  if (!Array.isArray(state.merkleLeaves)) state.merkleLeaves = [];
  return state;
}

function applyRetention(state) {
  if (state.artifacts.length > MAX_ARTIFACTS) state.artifacts.length = MAX_ARTIFACTS;
  if (state.verifications.length > MAX_VERIFICATIONS) state.verifications.length = MAX_VERIFICATIONS;
  if (state.merkleRoots.length > MAX_MERKLE_ROOTS) state.merkleRoots.length = MAX_MERKLE_ROOTS;
  return state;
}

async function saveState(state) {
  applyRetention(state);
  await mkdir(DATA_DIR, { recursive: true });
  const temporary = `${STORE_FILE}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(temporary, STORE_FILE);
}

// Serialize read-modify-write mutations so concurrent async appends cannot
// interleave. Reads are lock-free.
let writeQueue = Promise.resolve();
function serializeWrite(task) {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Verify that payload recomputes to content_hash_sha256.
 * Fail-closed: mismatch → { ok: false }.
 */
export function verifyProvenance(artifact, canonicalPayload) {
  const computed = sha256Hex(typeof canonicalPayload === 'string'
    ? canonicalPayload
    : JSON.stringify(canonicalPayload));
  const expected = artifact.content_hash_sha256;
  const match = HASH_RE.test(expected) && computed === expected;
  return { ok: match, expected, computed };
}

function validateArtifactFields(raw) {
  for (const k of REQUIRED) {
    if (raw[k] === undefined || raw[k] === null || raw[k] === '') {
      const err = new Error(`fail-closed: missing required field ${k}`);
      err.code = 'FAIL_CLOSED';
      throw err;
    }
  }
  if (raw.governance_status === 'human_authorized' && raw._governance_transition !== true) {
    const err = new Error('fail-closed: human_authorized artifacts must cross the governance transition boundary');
    err.code = 'FAIL_CLOSED';
    throw err;
  }

  const geo = validateSpatialFields(raw);
  if (!geo.ok) {
    const err = new Error(geo.error);
    err.code = 'FAIL_CLOSED';
    throw err;
  }

  if (!HASH_RE.test(raw.content_hash_sha256)) {
    const err = new Error('fail-closed: content_hash_sha256 must be 64-char lowercase hex');
    err.code = 'FAIL_CLOSED';
    throw err;
  }

  // Re-verify if payload provided
  if (raw._canonical_for_verify) {
    const v = verifyProvenance(raw, raw._canonical_for_verify);
    if (!v.ok) {
      const err = new Error(`fail-closed: hash mismatch expected=${v.expected} computed=${v.computed}`);
      err.code = 'FAIL_CLOSED';
      throw err;
    }
  }
}

function buildArtifact(raw) {
  const artifact = {
    artifact_id: raw.artifact_id || `ART-${randomUUID()}`,
    artifact_type: raw.artifact_type,
    source_authority: raw.source_authority,
    source_uri: raw.source_uri,
    source_identifier: raw.source_identifier || null,
    retrieved_at: raw.retrieved_at,
    observation_time: raw.observation_time || null,
    horizontal_crs: raw.horizontal_crs,
    horizontal_crs_name: raw.horizontal_crs_name || null,
    vertical_datum: raw.vertical_datum,
    source_version: raw.source_version || null,
    content_hash_sha256: raw.content_hash_sha256,
    parent_artifacts: raw.parent_artifacts || [],
    transformation_chain: raw.transformation_chain || [],
    validation_status: raw.validation_status || 'pending',
    uncertainty: raw.uncertainty || null,
    authority_class: raw.authority_class,
    derivation_class: raw.derivation_class,
    model_version: raw.model_version || null,
    software_version: raw.software_version || null,
    operator_or_service_identity: raw.operator_or_service_identity || null,
    governance_status: raw.governance_status,
    supersedes: raw.supersedes || null,
    superseded_by: raw.superseded_by || null,
    is_simulation_demo: Boolean(raw.is_simulation_demo),
    human_review_status: raw.human_review_status || 'pending',
    human_authorization: raw.human_authorization || null,
    notes: raw.notes || null,
    payload: raw.payload || null,
    created_at: new Date().toISOString(),
  };

  // Demo data cannot claim OBSERVATION without explicit override flag
  if (artifact.is_simulation_demo && artifact.authority_class === 'OBSERVATION') {
    artifact.authority_class = 'SIMULATION_DEMO';
    artifact.notes = (artifact.notes || '') + ' [auto-relabeled: demo cannot be OBSERVATION]';
  }
  return artifact;
}

export async function appendArtifact(raw) {
  validateArtifactFields(raw);
  return serializeWrite(async () => {
    const state = await loadState();
    if (state.artifacts.some((a) => a.content_hash_sha256 === raw.content_hash_sha256)) {
      const err = new Error('fail-closed: duplicate content_hash_sha256');
      err.code = 'FAIL_CLOSED';
      throw err;
    }
    const artifact = buildArtifact(raw);
    state.artifacts.unshift(artifact);
    await saveState(state);
    return artifact;
  });
}

export async function listArtifacts({ limit = 50, authority_class, is_simulation_demo } = {}) {
  let rows = (await loadState()).artifacts;
  if (authority_class) rows = rows.filter((a) => a.authority_class === authority_class);
  if (is_simulation_demo !== undefined) {
    rows = rows.filter((a) => a.is_simulation_demo === is_simulation_demo);
  }
  return rows.slice(0, limit);
}

export async function getArtifact(id) {
  return (await loadState()).artifacts.find((a) => a.artifact_id === id) || null;
}

export async function appendMerkleLeaf(artifact) {
  if (!artifact || artifact.governance_status !== 'human_authorized' || artifact.human_review_status !== 'signed') {
    const err = new Error('fail-closed: only human-authorized signed artifacts may enter the Merkle ledger');
    err.code = 'FAIL_CLOSED';
    throw err;
  }

  return serializeWrite(async () => {
    const state = await loadState();
    if (!Array.isArray(state.merkleLeaves)) state.merkleLeaves = [];
    if (state.merkleLeaves.some((leaf) => leaf.artifact_id === artifact.artifact_id)) {
      const err = new Error('fail-closed: artifact already exists in Merkle ledger');
      err.code = 'FAIL_CLOSED';
      throw err;
    }

    const leafHash = sha256Hex(`TSM_LEAF:${artifact.content_hash_sha256}`);
    const leaves = [...state.merkleLeaves, { artifact_id: artifact.artifact_id, leaf_hash: leafHash }];
    let level = leaves.map((leaf) => leaf.leaf_hash);
    if (level.length === 0) level = [sha256Hex('TSM_NODE:EMPTY')];

    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        next.push(sha256Hex(`TSM_NODE:${left}${right}`));
      }
      level = next;
    }

    const root = level[0];
    const sequence = leaves.length;
    state.merkleLeaves = leaves;
    state.merkleRoots.unshift({
      sequence,
      root_hash: root,
      leaf_count: sequence,
      created_at: new Date().toISOString(),
    });
    await saveState(state);

    return { sequence, leaf_hash: leafHash, root_hash: root, leaf_count: sequence };
  });
}

export async function recordVerification(artifact_id, expected, computed, verifier = 'tsm-server') {
  return serializeWrite(async () => {
    const state = await loadState();
    const entry = {
      id: state.verifications.length + 1,
      artifact_id,
      expected_hash: expected,
      computed_hash: computed,
      match: expected === computed,
      verified_at: new Date().toISOString(),
      verifier,
    };
    state.verifications.unshift(entry);
    await saveState(state);
    return entry;
  });
}
