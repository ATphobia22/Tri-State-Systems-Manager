import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceManifest } from './manifest.mjs';

test('evidence manifest is deterministic and hashes canonical inputs', () => {
  const input = {
    artifactId: 'ENG-001',
    scenarioId: 'SCENARIO-001',
    sources: [{ id: 'USGS-03378500', retrievedAt: '2026-09-11T05:31:00Z' }],
    crs: 'EPSG:4326',
    verticalDatum: 'NAVD88',
    modelVersion: 'tsm-engineering@1.0.0',
    equationSetId: 'hydraulics-v1',
    numericalTolerance: 0.000001,
    reviewerRole: 'qualified_engineer',
    reviewState: 'ENGINEERING_REVIEW_READY',
    inputs: { stage_ft: 4.53 },
    outputs: { wse_ft: 357.24 },
  };
  const first = buildEvidenceManifest(input);
  const second = buildEvidenceManifest(input);
  assert.deepEqual(first, second);
  assert.match(first.manifestSha256, /^[a-f0-9]{64}$/);
  assert.match(first.inputSha256, /^[a-f0-9]{64}$/);
  assert.match(first.outputSha256, /^[a-f0-9]{64}$/);
});
