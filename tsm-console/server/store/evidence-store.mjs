/**
 * Authoritative Evidence Store — Phase 1 file-backed implementation
 * Schema: schema.sql (PostgreSQL/PostGIS ready)
 * Production: swap persistence to pg; keep same API.
 *
 * SHA-256 proves integrity only.
 * Fail-closed: invalid hash or missing required fields → reject.
 */

import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
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

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(STORE_FILE)) {
    return { artifacts: [], verifications: [], merkleRoots: [] };
  }
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function save(state) {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2));
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

export function appendArtifact(raw) {
  for (const k of REQUIRED) {
    if (raw[k] === undefined || raw[k] === null || raw[k] === '') {
      const err = new Error(`fail-closed: missing required field ${k}`);
      err.code = 'FAIL_CLOSED';
      throw err;
    }
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

  const state = load();
  if (state.artifacts.some((a) => a.content_hash_sha256 === raw.content_hash_sha256)) {
    const err = new Error('fail-closed: duplicate content_hash_sha256');
    err.code = 'FAIL_CLOSED';
    throw err;
  }

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
    notes: raw.notes || null,
    payload: raw.payload || null,
    created_at: new Date().toISOString(),
  };

  // Demo data cannot claim OBSERVATION without explicit override flag
  if (artifact.is_simulation_demo && artifact.authority_class === 'OBSERVATION') {
    artifact.authority_class = 'SIMULATION_DEMO';
    artifact.notes = (artifact.notes || '') + ' [auto-relabeled: demo cannot be OBSERVATION]';
  }

  state.artifacts.unshift(artifact);
  save(state);
  return artifact;
}

export function listArtifacts({ limit = 50, authority_class, is_simulation_demo } = {}) {
  let rows = load().artifacts;
  if (authority_class) rows = rows.filter((a) => a.authority_class === authority_class);
  if (is_simulation_demo !== undefined) {
    rows = rows.filter((a) => a.is_simulation_demo === is_simulation_demo);
  }
  return rows.slice(0, limit);
}

export function getArtifact(id) {
  return load().artifacts.find((a) => a.artifact_id === id) || null;
}

export function recordVerification(artifact_id, expected, computed, verifier = 'tsm-server') {
  const state = load();
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
  save(state);
  return entry;
}
