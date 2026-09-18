import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeVerticalDatum } from '../server/ingestion/vertical-datum.mjs';

test('vertical datum middleware blocks unverified gage-to-NAVD88 conversion', () => {
  const result = normalizeVerticalDatum({ valueFt: 10, sourceDatum: 'GAGE_DATUM' });
  assert.equal(result.conversionApplied, false);
  assert.equal(result.conversionPublished, false);
  assert.equal(result.status, 'CONVERSION_BLOCKED');
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
