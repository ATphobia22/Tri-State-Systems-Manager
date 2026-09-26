#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const schemaPaths = [
  'data/schemas/tsm-data-contract-schema-v1.0.0.json',
  'data/schemas/tsm-evidence-artifact-schema-v1.0.0.json',
  'data/schemas/regulatory-gate.schema.json',
  path.join('data', 'schemas', 'nfip-discrepancy.schema.json'),
];
const failures = [];
const fail = (message) => failures.push(message);

function typeMatches(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => (
    type === 'null' ? value === null :
    type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) :
    type === 'array' ? Array.isArray(value) :
    type === 'integer' ? Number.isInteger(value) :
    type === 'number' ? typeof value === 'number' && Number.isFinite(value) :
    type === 'boolean' ? typeof value === 'boolean' :
    type === 'string' ? typeof value === 'string' : false
  ));
}

function validate(value, schema, at) {
  if (schema.type && !typeMatches(value, schema.type)) {
    fail(at + ': expected type ' + JSON.stringify(schema.type)); return;
  }
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    fail(at + ': expected const ' + JSON.stringify(schema.const));
  }
  if (schema.enum && !schema.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) {
    fail(at + ': value is outside enum');
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail(at + ': minLength');
    if (schema.maxLength !== undefined && value.length > schema.maxLength) fail(at + ': maxLength');
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) fail(at + ': pattern mismatch');
    if (schema.format === 'uri') {
      try { new URL(value); } catch { fail(at + ': invalid URI'); }
    }
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) fail(at + ': invalid date-time');
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) fail(at + ': below minimum');
    if (schema.maximum !== undefined && value > schema.maximum) fail(at + ': above maximum');
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail(at + ': minItems');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(at + ': maxItems');
    if (schema.uniqueItems) {
      const seen = new Set(value.map((item) => JSON.stringify(item)));
      if (seen.size !== value.length) fail(at + ': uniqueItems violated');
    }
    if (schema.items) value.forEach((item, index) => validate(item, schema.items, at + '[' + index + ']'));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      if (!(required in value)) fail(at + ': missing required property ' + required);
    }
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) validate(child, schema.properties[key], at + '.' + key);
      else if (schema.additionalProperties === false) fail(at + ': unexpected property ' + key);
    }
  }
}

const dataExample = {
  id: 'tsm-hydro-001', title: 'Tri-State River Stage Observations',
  description: 'Time-series river stage data for the Tri-State River Valley basin.',
  owner: { organization: 'USGS' },
  authoritative_source: { system: 'USGS NWIS', uri: 'https://waterdata.usgs.gov/nwis' },
  jurisdiction: 'Federal', domain: 'hydrology', classification: 'public',
  legal_basis: 'Public water monitoring authority', collection_method: 'Automated river gauges',
  spatial_extent: { description: 'Tri-State river network', crs: 'EPSG:4326' },
  temporal_extent: { start: '2026-01-01T00:00:00Z', end: null },
  update_frequency: 'real-time', schema_version: '1.0.0',
  lineage: [{ source_id: 'USGS-03378500' }], quality: { score: 1 },
  license: { name: 'Public data' }, retention: { policy: 'Retain indefinitely' },
  permitted_uses: ['planning'],
  prohibited_uses: ['autonomous-decision-without-human-oversight'],
  privacy_controls: ['none'],
  provenance: { evidence_id: 'EV-SCHEMA-001', content_hash: 'a'.repeat(64), created_at: '2026-01-01T00:00:00Z' },
  validation_status: 'validated',
};

const evidenceExample = {
  artifact_id: 'ART-SCHEMA-001', artifact_type: 'hydrologic_observation',
  source_authority: 'USGS', source_uri: 'https://waterdata.usgs.gov/nwis',
  retrieved_at: '2026-01-01T00:00:00Z',
  spatial_reference: { horizontal_crs: 'EPSG:2966', units: 'us-ft' },
  vertical_reference: { vertical_datum: 'NAVD88', units: 'us-ft' },
  content_hash_sha256: 'b'.repeat(64), parent_artifacts: [], transformation_chain: [],
  validation_status: 'pending', authority_class: 'OBSERVATION',
  derivation_class: 'RAW', governance_status: 'human_review_required',
};


const nfipLayer2Example = {
  schema_version: 'tsm-nfip-layer2-v1',
  case_metadata: { case_id: '26-05-2022A', analysis_status: 'DATA_COLLECTION', legal_theory_status: 'HYPOTHESIS_ONLY' },
  property_metadata: { parcel_id: null, community_id: null, structure_built_date: null, nearest_infrastructure_id: null, address: null, county: 'Posey', state: 'IN' },
  historical_timeline_track: [],
  actuarial_reconciliation: { comparison_status: 'DATA_INCOMPLETE', historical_charged_total: null, documented_refund_adjustment: null, modeled_comparison_premium: null, observed_delta: null, delta_definition: null, rr2_comparison_allowed: false, limitations: ['comparison requires documented policy/rating inputs'], misrating_status: 'UNTESTED', causation_status: 'UNTESTED' },
  hydrologic_hypothesis_test: { infrastructure_identified: false, historical_navigation_function_documented: false, construction_modification_dates_documented: false, fema_model_dependency_documented: false, operational_rules_documented: false, counterfactual_model_completed: false, hydraulic_difference_quantified: false, reproducible_map_defect: false, finding_status: 'UNTESTED' },
  evidence_provenance: [{ evidence_id: 'FEMA-26-05-2022A-001', source_type: 'FEMA correspondence', source_locator: '26-05-2022A-092226.pdf', acquisition_date: '2026-09-22', sha256: 'a'.repeat(64), processing_status: 'PRESERVED', notes: null }],
};

const regulatoryGateExample = {
  artifact_type: 'tsm.regulatory_gate_registry.v1',
  version: '1.0.0',
  gates: [{
    gate_id: 'PROFESSIONAL-REVIEW',
    authority: 'Qualified professional engineer/surveyor',
    status: 'HUMAN_REVIEW_REQUIRED',
    required_evidence: ['survey_control'],
    source_uri: null,
  }],
  software_policy: 'No calculation may transition a gate to AGENCY_ACCEPTED without an externally recorded human/agency decision.',
};

for (const relative of schemaPaths) {
  const file = path.join(repoRoot, relative);
  if (!fs.existsSync(file)) { fail(relative + ': schema file missing'); continue; }
  let schema;
  try { schema = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(relative + ': invalid JSON: ' + error.message); continue; }
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') fail(relative + ': unexpected JSON Schema dialect');
  const example = relative.includes('data-contract') ? dataExample : relative.includes('regulatory-gate') ? regulatoryGateExample : relative.includes('nfip-discrepancy') ? nfipLayer2Example : evidenceExample;
  validate(example, schema, relative);
  // Case-specific evidence is operator-retained and intentionally excluded from
  // the public repository. Validate the public schema against its synthetic,
  // non-identifying contract example above.
}

if (failures.length) {
  console.error('[tsm] FAIL-CLOSED JSON schema contract gate');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, schemas: schemaPaths, validatedExamples: 2, dialect: 'JSON Schema 2020-12 contract subset' }, null, 2));