import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeVerticalDatum } from '../server/ingestion/vertical-datum.mjs';

test('vertical datum middleware blocks unverified gage-to-NAVD88 conversion', () => {
  const result = normalizeVerticalDatum({ valueFt: 10, sourceDatum: 'GAGE_DATUM' });
  assert.equal(result.conversionApplied, false);
  assert.equal(result.conversionPublished, false);
  assert.equal(result.status, 'UNVERIFIED_CONVERSION');
});

test('vertical datum middleware applies only a supplied published offset', () => {
  const result = normalizeVerticalDatum({
    valueFt: 10,
    sourceDatum: 'NGVD29',
    targetDatum: 'NAVD88',
    offsetFt: -0.42,
    offsetSource: 'station-control-2026-01',
  });
  assert.equal(result.valueFt, 9.58);
  assert.equal(result.conversionApplied, true);
  assert.equal(result.offsetSource, 'station-control-2026-01');
});

test('vertical datum middleware preserves identity conversions', () => {
  const result = normalizeVerticalDatum({ valueFt: 375, sourceDatum: 'NAVD88', targetDatum: 'NAVD88' });
  assert.equal(result.valueFt, 375);
  assert.equal(result.conversionApplied, false);
  assert.equal(result.conversionPublished, true);
});


test('USGS 03378500 published relationship converts gage stage to station WSE', async () => {
  const { calculateGaugeWseNavd88 } = await import('../server/ingestion/hydraulic-calibration.mjs');
  const result = calculateGaugeWseNavd88({ stationId: '03378500', stageFt: 4.31 });
  assert.equal(result.ok, true);
  assert.equal(result.gage_zero_navd88_ft, 352.67);
  assert.equal(result.wse_navd88_ft, 356.98);
  assert.equal(result.vertical_conversion_status, 'VERIFIED_PUBLISHED_STATION_RELATIONSHIP');
  assert.equal(result.site_transfer_status, 'REQUIRES_VALIDATED_HYDRAULIC_PROFILE');
  assert.equal(result.hydraulic_extrusion_eligibility, 'BLOCKED_UNTIL_SITE_WSE_TRANSFER_VALIDATED');
});
