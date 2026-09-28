import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatePrismVolumeCy, screenRoadBermScenario } from './placement-screening.mjs';

test('estimatePrismVolumeCy computes trapezoidal prism volume', () => {
  assert.equal(estimatePrismVolumeCy({
    lengthFt: 27,
    topWidthFt: 9,
    heightFt: 3,
    sideSlopeHv: 2,
  }), 54);
});

test('screenRoadBermScenario requires all engineering review gates', () => {
  const result = screenRoadBermScenario({
    scenario_id: 'test',
    alignment: { length_ft: 100 },
    design: { crest_elevation_ft: 400, top_width_ft: 12, side_slope_hv: 2 },
    constraints: {
      no_rise_required: true,
      floodway_check_required: true,
      wetland_check_required: true,
      property_rights_verified: true,
      utility_conflicts_checked: true,
    },
    simulation: {
      baseline_model_ref: 'baseline',
      alternative_model_ref: 'alternative',
    },
  });
  assert.equal(result.review_ready, true);
  assert.equal(result.human_review_required, true);
  assert.equal(result.agency_acceptance, false);
});
