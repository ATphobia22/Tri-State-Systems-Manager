import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateManningFrictionSlope, calculateBackwaterAlpha, calculateLocalProfileWSE } from '../server/engineering/hydraulic-transfer.mjs';

test('Manning friction slope uses US customary coefficient', () => {
  const slope = calculateManningFrictionSlope({ roughness: 0.031, dischargeCfs: 10000, areaFt2: 10000, hydraulicRadiusFt: 10 });
  assert.ok(Number.isFinite(slope));
  assert.ok(slope > 0);
});

test('backwater alpha fails closed above one', () => {
  assert.equal(calculateBackwaterAlpha({
    distanceDownstreamFt: 79200,
    reachLengthFt: 79200,
    backwaterLengthFt: 63360,
    beta: 2.2,
    wseOhioNavd88Ft: 380,
    wseOpenChannelNavd88Ft: 370,
    invertNavd88Ft: 360,
  }), 1);
});

test('site transfer requires validated evidence profile', () => {
  assert.throws(() => calculateLocalProfileWSE({
    stationWseNavd88Ft: 370,
    ohioWseNavd88Ft: 375,
    distanceDownstreamFt: 1000,
    dischargeCfs: 10000,
    invertNavd88Ft: 350,
    profile: { validation_status: 'pending', evidence_artifact_id: 'x', source_uri: 'https://example.invalid/x', reach_length_ft: 1000, backwater_length_ft: 500, beta: 2, manning_constant: 1.486 },
    segments: [{ distanceDownstreamFt: 1000, areaFt2: 10000, wettedPerimeterFt: 1000, manningN: 0.031 }],
  }), /HYDRAULIC_PROFILE_NOT_VALIDATED/);
});

test('validated transfer returns human-review engineering output', () => {
  const result = calculateLocalProfileWSE({
    stationWseNavd88Ft: 370,
    ohioWseNavd88Ft: 375,
    distanceDownstreamFt: 1000,
    dischargeCfs: 10000,
    invertNavd88Ft: 350,
    profile: { validation_status: 'validated', evidence_artifact_id: 'artifact-1', source_uri: 'https://example.invalid/fis', reach_length_ft: 1000, backwater_length_ft: 500, beta: 2, manning_constant: 1.486 },
    segments: [{ distanceDownstreamFt: 1000, areaFt2: 10000, wettedPerimeterFt: 1000, manningN: 0.031 }],
  });
  assert.equal(result.governance_status, 'human_review_required');
  assert.equal(result.is_simulation_demo, false);
  assert.ok(Number.isFinite(result.wse_navd88_ft));
});
