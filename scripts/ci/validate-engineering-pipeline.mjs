#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const schemaPath = new URL('data/schemas/engineering-evidence-pipeline-v1.schema.json', root);
const examplePath = new URL('data/engineering/evidence-pipeline-contract.json', root);
const grantsPath = new URL('data/grants/tsm-v35-grant-rules-v1.json', root);

const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const example = JSON.parse(await readFile(examplePath, 'utf8'));
const grants = JSON.parse(await readFile(grantsPath, 'utf8'));

if (schema.$id !== 'urn:tsm:engineering-evidence-pipeline:v1') throw new Error('engineering evidence schema id mismatch');
if (example.schema_version !== '1.0.0') throw new Error('engineering evidence contract version mismatch');

const ordered = [
  'authoritative_terrain',
  'verified_bathymetry',
  'datum_control',
  'baseline_hec_ras',
  'calibrated_hydraulics',
  'alternative_scenarios',
  'independent_earthwork',
  'sediment_suitability',
  'environmental_screening',
  'agency_eligibility',
  'benefit_cost_analysis',
  'funding_application',
  'qa_qc',
];

const stages = example.stages;
if (stages.length !== ordered.length) throw new Error('engineering evidence contract has an unexpected stage count');
for (let i = 0; i < ordered.length; i += 1) {
  if (stages[i]?.id !== ordered[i]) throw new Error(`stage order mismatch at ${i}: expected ${ordered[i]}`);
  if (!['not_started', 'blocked', 'provisional', 'verified', 'approved'].includes(stages[i].status)) {
    throw new Error(`${stages[i].id}: invalid status`);
  }
  if (!Array.isArray(stages[i].evidence_ids)) throw new Error(`${stages[i].id}: evidence_ids must be an array`);
}

const controls = example.controls;
for (const key of [
  'no_downstream_without_upstream',
  'bathymetry_required_for_submerged_channel',
  'datum_must_be_explicit',
  'earthwork_must_be_independent',
  'sediment_not_structural_fill_by_default',
  'agency_eligibility_is_not_inferred',
  'funding_is_not_an_award',
  'human_engineering_review_required',
]) {
  if (controls[key] !== true) throw new Error(`engineering evidence control missing: ${key}`);
}

const rank = { not_started: 0, blocked: 0, provisional: 1, verified: 2, approved: 3 };
for (let i = 1; i < stages.length; i += 1) {
  const previous = stages[i - 1];
  const current = stages[i];
  if (rank[current.status] > rank[previous.status]) {
    throw new Error(`${current.id}: downstream stage cannot outrank upstream stage ${previous.id}`);
  }
}

const section204 = grants.programs?.find((program) => program.id === 'usace-section-204');
if (!section204) throw new Error('USACE Section 204 rule is missing');
if (section204.federal_share !== null || section204.non_federal_share !== null) {
  throw new Error('USACE Section 204 cost share must not be hard-coded as a universal funding value');
}
if (section204.status !== 'authority_requires_project_review') {
  throw new Error('USACE Section 204 must remain project-specific');
}

console.log('engineering evidence pipeline gate passed');
