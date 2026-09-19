import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const contract = JSON.parse(readFileSync(new URL('../../data/engineering/evidence-pipeline-contract.json', import.meta.url), 'utf8'));
const grants = JSON.parse(readFileSync(new URL('../../data/grants/tsm-v35-grant-rules-v1.json', import.meta.url), 'utf8'));
const expected = [
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

test('engineering evidence contract preserves canonical stage order', () => {
  assert.deepEqual(contract.stages.map((stage) => stage.id), expected);
});

test('engineering evidence contract keeps all fail-closed controls enabled', () => {
  for (const value of Object.values(contract.controls)) assert.equal(value, true);
});

test('Section 204 funding values remain project-specific', () => {
  const section204 = grants.programs.find((program) => program.id === 'usace-section-204');
  assert.ok(section204);
  assert.equal(section204.federal_share, null);
  assert.equal(section204.non_federal_share, null);
  assert.equal(section204.status, 'authority_requires_project_review');
});

test('REAP ceiling is not modeled as a percentage of an arbitrary large hydro project', () => {
  const reap = grants.programs.find((program) => program.id === 'usda-reap');
  assert.ok(reap);
  assert.equal(reap.maximum_renewable_energy_grant_request_usd, 1_000_000);
  assert.equal(reap.status, 'screening_only');
});
