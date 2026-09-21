import { createHash } from 'node:crypto';

const REQUIRED_FIELDS = Object.freeze([
  'source_org',
  'source_uri',
  'published_date',
  'coordinate_system',
  'license_type',
  'uncertainty',
]);

const AUTHORITY_CLASSES = new Set(['AUTHORITATIVE', 'DERIVED', 'OBSERVATIONAL', 'PRESENTATION']);
const GOVERNANCE_STATUSES = new Set(['public', 'quarantine', 'authenticated_review', 'restricted']);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw Object.assign(new TypeError(`provenance field '${field}' is required`), { code: 'PROVENANCE_CONTRACT_INVALID' });
  }
  return value.trim();
}

function isoDate(value, field) {
  const text = requiredString(value, field);
  if (!Number.isFinite(Date.parse(text))) {
    throw Object.assign(new TypeError(`provenance field '${field}' must be an ISO-compatible date`), { code: 'PROVENANCE_CONTRACT_INVALID' });
  }
  return new Date(text).toISOString();
}

export function validateProvenanceContract(provenance) {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    throw Object.assign(new TypeError('provenance contract must be an object'), { code: 'PROVENANCE_CONTRACT_INVALID' });
  }
  for (const field of REQUIRED_FIELDS) requiredString(provenance[field], field);
  const sourceUri = requiredString(provenance.source_uri, 'source_uri');
  if (!/^https:\/\//i.test(sourceUri) && !/^urn:/i.test(sourceUri) && !/^internal:/i.test(sourceUri)) {
    throw Object.assign(new TypeError('source_uri must use https, urn, or internal scheme'), { code: 'PROVENANCE_CONTRACT_INVALID' });
  }
  const authorityClass = requiredString(provenance.authority_class || 'OBSERVATIONAL', 'authority_class');
  if (!AUTHORITY_CLASSES.has(authorityClass)) {
    throw Object.assign(new TypeError('unsupported authority_class'), { code: 'PROVENANCE_CONTRACT_INVALID' });
  }
  const governanceStatus = requiredString(provenance.governance_status || 'public', 'governance_status');
  if (!GOVERNANCE_STATUSES.has(governanceStatus)) {
    throw Object.assign(new TypeError('unsupported governance_status'), { code: 'PROVENANCE_CONTRACT_INVALID' });
  }
  return Object.freeze({
    source_org: requiredString(provenance.source_org, 'source_org'),
    source_uri: sourceUri,
    published_date: isoDate(provenance.published_date, 'published_date'),
    coordinate_system: requiredString(provenance.coordinate_system, 'coordinate_system'),
    license_type: requiredString(provenance.license_type, 'license_type'),
    uncertainty: requiredString(provenance.uncertainty, 'uncertainty'),
    authority_class: authorityClass,
    governance_status: governanceStatus,
    retrieved_at: isoDate(provenance.retrieved_at || new Date().toISOString(), 'retrieved_at'),
    source_version: provenance.source_version ? requiredString(provenance.source_version, 'source_version') : null,
    limitations: provenance.limitations ? requiredString(provenance.limitations, 'limitations') : 'Source-specific limitations were not supplied.',
    transformation_chain: Array.isArray(provenance.transformation_chain) ? Object.freeze([...provenance.transformation_chain]) : Object.freeze([]),
  });
}

export function buildProvenanceManifest({ datasetId, payload, provenance }) {
  const contract = validateProvenanceContract(provenance);
  const canonical = JSON.stringify({ dataset_id: datasetId, payload, provenance: contract });
  const contentHash = `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
  return Object.freeze({
    dataset_id: requiredString(datasetId, 'dataset_id'),
    content_hash_sha256: contentHash,
    provenance: contract,
    lineage: Object.freeze([
      { stage: 'INGESTED', at: contract.retrieved_at },
      { stage: 'VALIDATED', at: contract.retrieved_at },
      { stage: 'STANDARDIZED', at: contract.retrieved_at },
    ]),
  });
}

export function buildPublicTransparencyManifest({ datasetId, payload, provenance }) {
  const manifest = buildProvenanceManifest({ datasetId, payload, provenance });
  return {
    dataset_id: manifest.dataset_id,
    content_hash_sha256: manifest.content_hash_sha256,
    origin: manifest.provenance.source_org,
    source_uri: manifest.provenance.source_uri,
    published_date: manifest.provenance.published_date,
    retrieved_at: manifest.provenance.retrieved_at,
    spatial_reference: manifest.provenance.coordinate_system,
    legal_terms: manifest.provenance.license_type,
    uncertainty: manifest.provenance.uncertainty,
    limitations: manifest.provenance.limitations,
    authority_class: manifest.provenance.authority_class,
    governance_status: manifest.provenance.governance_status,
    data_lineage: manifest.lineage,
  };
}
