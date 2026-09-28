import { createHash } from 'node:crypto';

export const FLOOD_FEDERATION_SOFTWARE_VERSION = 'tsm-flood-federation@1.0.0';

const REGULATORY_STATUSES = new Set([
  'FEMA_EFFECTIVE',
  'FEMA_MAP_CHANGE',
  'IDNR_BEST_AVAILABLE',
  'IDNR_REGULATORY_STUDY',
  'IDNR_FARA',
  'MODEL_EVIDENCE',
  'USGS_INUNDATION',
  'USACE_LEVEE_EVIDENCE',
  'PLANNING',
  'OBSERVATIONAL',
  'ADVISORY',
  'HISTORICAL',
  'DERIVED_NONREGULATORY',
]);

const AUTHORITY_CLASSES = new Set([
  'FEDERAL_REGULATORY_REFERENCE',
  'STATE_REGULATORY_REFERENCE',
  'STATE_BEST_AVAILABLE',
  'SITE_ASSESSMENT',
  'MODEL_OUTPUT',
  'OBSERVATION',
  'DERIVED',
  'VISUALIZATION',
]);

const UNCERTAINTY_STATUSES = new Set(['quantified', 'qualitative', 'not_provided']);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    const error = new TypeError(`flood federation field '${field}' is required`);
    error.code = 'FLOOD_FEDERATION_CONTRACT_INVALID';
    throw error;
  }
  return value.trim();
}

function isoTimestamp(value, field) {
  const normalized = requiredString(value, field);
  if (Number.isNaN(Date.parse(normalized))) {
    const error = new TypeError(`flood federation field '${field}' must be ISO-8601`);
    error.code = 'FLOOD_FEDERATION_CONTRACT_INVALID';
    throw error;
  }
  return new Date(normalized).toISOString();
}

function enumValue(value, field, allowed) {
  const normalized = requiredString(value, field);
  if (!allowed.has(normalized)) {
    const error = new TypeError(`unsupported ${field}: ${normalized}`);
    error.code = 'FLOOD_FEDERATION_CONTRACT_INVALID';
    throw error;
  }
  return normalized;
}

function canonicalHash(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function validateUncertainty(uncertainty) {
  if (!uncertainty || typeof uncertainty !== 'object' || Array.isArray(uncertainty)) {
    throw new TypeError('flood federation uncertainty is required');
  }
  const status = enumValue(uncertainty.status, 'uncertainty.status', UNCERTAINTY_STATUSES);
  const method = requiredString(uncertainty.method, 'uncertainty.method');
  const notes = requiredString(uncertainty.notes, 'uncertainty.notes');
  if (uncertainty.value !== undefined && uncertainty.value !== null && !Number.isFinite(uncertainty.value)) {
    throw new TypeError('uncertainty.value must be finite when supplied');
  }
  if (status === 'quantified' && (uncertainty.value == null || !requiredString(uncertainty.unit, 'uncertainty.unit'))) {
    throw new TypeError('quantified uncertainty requires value and unit');
  }
  return Object.freeze({
    status,
    value: uncertainty.value ?? null,
    unit: uncertainty.unit ?? null,
    method,
    notes,
  });
}

function validateModelLineage(modelLineage) {
  if (!Array.isArray(modelLineage)) throw new TypeError('model_lineage must be an array');
  return Object.freeze(modelLineage.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError(`model_lineage[${index}] must be an object`);
    return Object.freeze({
      model_id: requiredString(entry.model_id, `model_lineage[${index}].model_id`),
      role: requiredString(entry.role, `model_lineage[${index}].role`),
      model_version: entry.model_version == null ? null : requiredString(entry.model_version, `model_lineage[${index}].model_version`),
      source_artifact_ids: Object.freeze(Array.isArray(entry.source_artifact_ids) ? entry.source_artifact_ids.map((id) => requiredString(id, 'model_lineage.source_artifact_ids')) : []),
    });
  }));
}

export function validateFloodInformationResult(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('flood information result must be an object');

  const normalized = {
    result_id: requiredString(input.result_id, 'result_id'),
    dataset_id: requiredString(input.dataset_id, 'dataset_id'),
    source_authority: requiredString(input.source_authority, 'source_authority'),
    source_uri: requiredString(input.source_uri, 'source_uri'),
    source_version: requiredString(input.source_version, 'source_version'),
    retrieved_at: isoTimestamp(input.retrieved_at, 'retrieved_at'),
    published_at: input.published_at == null ? null : isoTimestamp(input.published_at, 'published_at'),
    regulatory_status: enumValue(input.regulatory_status, 'regulatory_status', REGULATORY_STATUSES),
    authority_class: enumValue(input.authority_class, 'authority_class', AUTHORITY_CLASSES),
    horizontal_crs: requiredString(input.horizontal_crs, 'horizontal_crs'),
    vertical_datum: requiredString(input.vertical_datum, 'vertical_datum'),
    model_lineage: validateModelLineage(input.model_lineage),
    software_version: requiredString(input.software_version, 'software_version'),
    uncertainty: validateUncertainty(input.uncertainty),
    insurance_determination_eligible: input.insurance_determination_eligible,
    human_review_required: input.human_review_required,
    human_review_status: input.human_review_status ?? 'pending',
    transformation_chain: Object.freeze(Array.isArray(input.transformation_chain) ? [...input.transformation_chain] : []),
    content_hash_sha256: input.content_hash_sha256 ?? null,
  };

  if (typeof normalized.insurance_determination_eligible !== 'boolean') throw new TypeError('insurance_determination_eligible must be boolean');
  if (typeof normalized.human_review_required !== 'boolean') throw new TypeError('human_review_required must be boolean');
  if (!['pending', 'reviewed', 'authorized', 'not_applicable'].includes(normalized.human_review_status)) {
    throw new TypeError('unsupported human_review_status');
  }

  if (normalized.regulatory_status === 'IDNR_BEST_AVAILABLE' && normalized.insurance_determination_eligible) {
    throw new Error('fail-closed: IDNR Best Available data cannot be marked insurance-determination eligible');
  }
  if (normalized.regulatory_status === 'USGS_INUNDATION' && normalized.insurance_determination_eligible) {
    throw new Error('fail-closed: USGS inundation products cannot be marked insurance-determination eligible');
  }
  if (normalized.authority_class === 'MODEL_OUTPUT' && normalized.human_review_required !== true) {
    throw new Error('fail-closed: model output requires human review');
  }
  if (normalized.authority_class === 'VISUALIZATION' && normalized.insurance_determination_eligible) {
    throw new Error('fail-closed: visualization cannot establish insurance eligibility');
  }

  const { provenance_hash_sha256: _ignored, ...hashInput } = normalized;
  return Object.freeze({
    ...normalized,
    provenance_hash_sha256: canonicalHash(hashInput),
  });
}

export function buildFloodInformationResult(input) {
  return validateFloodInformationResult({
    ...input,
    software_version: input.software_version || FLOOD_FEDERATION_SOFTWARE_VERSION,
  });
}

export function toEvidenceArtifactFields(result) {
  const validated = validateFloodInformationResult(result);
  return Object.freeze({
    artifact_type: `flood_information:${validated.dataset_id}`,
    source_authority: validated.source_authority,
    source_uri: validated.source_uri,
    source_identifier: validated.result_id,
    retrieved_at: validated.retrieved_at,
    horizontal_crs: validated.horizontal_crs,
    vertical_datum: validated.vertical_datum,
    source_version: validated.source_version,
    content_hash_sha256: validated.content_hash_sha256 || validated.provenance_hash_sha256,
    parent_artifacts: validated.model_lineage.flatMap((entry) => entry.source_artifact_ids),
    transformation_chain: validated.transformation_chain,
    validation_status: validated.human_review_status === 'authorized' ? 'validated' : 'pending',
    uncertainty: validated.uncertainty,
    authority_class: validated.authority_class === 'FEDERAL_REGULATORY_REFERENCE' || validated.authority_class === 'STATE_REGULATORY_REFERENCE' ? 'REGULATORY' : validated.authority_class,
    derivation_class: validated.model_lineage.length ? 'MODELED' : 'RAW',
    software_version: validated.software_version,
    governance_status: validated.human_review_status === 'authorized' ? 'human_authorized' : 'human_review_required',
    is_simulation_demo: validated.authority_class === 'MODEL_OUTPUT' || validated.authority_class === 'VISUALIZATION',
    payload: validated,
  });
}
