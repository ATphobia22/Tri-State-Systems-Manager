import { appendArtifact } from '../store/evidence-store.mjs';
import { buildProvenanceManifest } from './data-fabric-provenance.mjs';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_CLIENT_SUBMISSIONS = 30;

const clientWindows = new Map();

function reject(message, code) {
  throw Object.assign(new TypeError(message), { code });
}

export function validateCommunityObservation(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) reject('JSON object required', 'COMMUNITY_PAYLOAD_INVALID');
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : body;
  const encoded = JSON.stringify(payload);
  if (Buffer.byteLength(encoded, 'utf8') > 256_000) reject('community payload exceeds 256 KB', 'COMMUNITY_PAYLOAD_TOO_LARGE');
  if (body.lat !== undefined && (!Number.isFinite(Number(body.lat)) || Number(body.lat) < -90 || Number(body.lat) > 90)) reject('latitude out of range', 'COMMUNITY_COORDINATE_INVALID');
  if (body.lon !== undefined && (!Number.isFinite(Number(body.lon)) || Number(body.lon) < -180 || Number(body.lon) > 180)) reject('longitude out of range', 'COMMUNITY_COORDINATE_INVALID');
  return payload;
}

export function submitCommunityObservation(body, now = Date.now(), clientKey = 'anonymous') {
  const key = String(clientKey || 'anonymous').slice(0, 128);
  const current = clientWindows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) clientWindows.set(key, { startedAt: now, count: 0 });
  const window = clientWindows.get(key);
  if (window.count >= MAX_CLIENT_SUBMISSIONS) throw Object.assign(new Error('community submission rate limit reached for this client'), { code: 'COMMUNITY_RATE_LIMITED', status: 429 });
  const payload = validateCommunityObservation(body);
  window.count += 1;
  if (clientWindows.size > 4096) for (const [candidate, state] of clientWindows) if (now - state.startedAt >= WINDOW_MS) clientWindows.delete(candidate);
  const retrievedAt = new Date(now).toISOString();
  const provenance = {
    source_org: 'TSM Community Observation',
    source_uri: 'internal://tsm/community-observation',
    published_date: retrievedAt,
    coordinate_system: 'EPSG:4326 when coordinates are supplied',
    license_type: 'Contributor terms must be supplied by deployment policy',
    uncertainty: 'Unverified community observation; requires human review.',
    authority_class: 'OBSERVATIONAL',
    governance_status: 'quarantine',
    retrieved_at: retrievedAt,
    limitations: 'Not an authoritative government observation and not an emergency instruction.',
  };
  const manifest = buildProvenanceManifest({ datasetId: 'community-observation', payload, provenance });
  return appendArtifact({
    artifact_type: 'community_observation',
    source_authority: provenance.source_org,
    source_uri: provenance.source_uri,
    source_identifier: manifest.content_hash_sha256,
    retrieved_at: retrievedAt,
    observation_time: body.observed_at || retrievedAt,
    horizontal_crs: 'EPSG:4326 when coordinates are supplied',
    vertical_datum: 'UNKNOWN',
    content_hash_sha256: manifest.content_hash_sha256,
    authority_class: 'OBSERVATION',
    derivation_class: 'RAW',
    validation_status: 'pending',
    governance_status: 'quarantine',
    is_simulation_demo: false,
    human_review_status: 'pending',
    payload,
    notes: 'Anonymous community observation. Quarantined until authorized human review. Never treat as an emergency instruction or regulatory source.',
  });
}../store/evidence-store.mjs';
import { buildProvenanceManifest } from './data-fabric-provenance.mjs';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_CLIENT_SUBMISSIONS = 30;

const clientWindows = new Map();

function reject(message, code) {
  throw Object.assign(new TypeError(message), { code });
}

export function validateCommunityObservation(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) reject('JSON object required', 'COMMUNITY_PAYLOAD_INVALID');
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : body;
  const encoded = JSON.stringify(payload);
  if (Buffer.byteLength(encoded, 'utf8') > 256_000) reject('community payload exceeds 256 KB', 'COMMUNITY_PAYLOAD_TOO_LARGE');
  if (body.lat !== undefined && (!Number.isFinite(Number(body.lat)) || Number(body.lat) < -90 || Number(body.lat) > 90)) reject('latitude out of range', 'COMMUNITY_COORDINATE_INVALID');
  if (body.lon !== undefined && (!Number.isFinite(Number(body.lon)) || Number(body.lon) < -180 || Number(body.lon) > 180)) reject('longitude out of range', 'COMMUNITY_COORDINATE_INVALID');
  return payload;
}

export function submitCommunityObservation(body, now = Date.now(), clientKey = 'anonymous') {
  const key = String(clientKey || 'anonymous').slice(0, 128);
  const current = clientWindows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) clientWindows.set(key, { startedAt: now, count: 0 });
  const window = clientWindows.get(key);
  if (window.count >= MAX_CLIENT_SUBMISSIONS) throw Object.assign(new Error('community submission rate limit reached for this client'), { code: 'COMMUNITY_RATE_LIMITED', status: 429 });
  const payload = validateCommunityObservation(body);
  window.count += 1;
  if (clientWindows.size > 4096) for (const [candidate, state] of clientWindows) if (now - state.startedAt >= WINDOW_MS) clientWindows.delete(candidate);
  const retrievedAt = new Date(now).toISOString();
  const provenance = {
    source_org: 'TSM Community Observation',
    source_uri: 'internal://tsm/community-observation',
    published_date: retrievedAt,
    coordinate_system: 'EPSG:4326 when coordinates are supplied',
    license_type: 'Contributor terms must be supplied by deployment policy',
    uncertainty: 'Unverified community observation; requires human review.',
    authority_class: 'OBSERVATIONAL',
    governance_status: 'quarantine',
    retrieved_at: retrievedAt,
    limitations: 'Not an authoritative government observation and not an emergency instruction.',
  };
  const manifest = buildProvenanceManifest({ datasetId: 'community-observation', payload, provenance });
  return appendArtifact({
    artifact_type: 'community_observation',
    source_authority: provenance.source_org,
    source_uri: provenance.source_uri,
    source_identifier: manifest.content_hash_sha256,
    retrieved_at: retrievedAt,
    observation_time: body.observed_at || retrievedAt,
    horizontal_crs: 'EPSG:4326 when coordinates are supplied',
    vertical_datum: 'UNKNOWN',
    content_hash_sha256: manifest.content_hash_sha256,
    authority_class: 'OBSERVATION',
    derivation_class: 'RAW',
    validation_status: 'pending',
    governance_status: 'quarantine',
    is_simulation_demo: false,
    human_review_status: 'pending',
    payload,
    notes: 'Anonymous community observation. Quarantined until authorized human review. Never treat as an emergency instruction or regulatory source.',
  });
}
