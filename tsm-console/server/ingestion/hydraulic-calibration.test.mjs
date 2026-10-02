import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGaugeWseNavd88, getHydrologicNode } from './hydraulic-calibration.mjs';

test('03378500 retains distinct gage datum and monitoring-location altitude', () => {
  const node = getHydrologicNode('03378500');
  assert.equal(node.gage_zero_navd88_ft, 352.67);
  assert.equal(node.gage_site_altitude_navd88_ft, 352.71);
  assert.notEqual(node.gage_zero_navd88_ft, node.gage_site_altitude_navd88_ft);
});

test('4.31 ft stage converts to 356.98 ft NAVD88 at the station only', () => {
  const result = calculateGaugeWseNavd88({ stationId: '03378500', stageFt: 4.31 });
  assert.equal(result.ok, true);
  assert.equal(result.wse_navd88_ft, 356.98);
  assert.equal(result.site_transfer_status, 'REQUIRES_VALIDATED_HYDRAULIC_PROFILE');
  assert.equal(result.hydraulic_extrusion_eligibility, 'NOT_ELIGIBLE_UNVERIFIED_SITE_TRANSFER');
});

test('unregistered stations degrade explicitly', () => {
  assert.equal(getHydrologicNode('NOT_REGISTERED').role, 'UNREGISTERED_SOURCE');
});
