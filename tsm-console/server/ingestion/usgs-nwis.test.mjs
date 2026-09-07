import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUsgsInstantaneousValues } from './usgs-nwis.mjs';

test('parses USGS 00065 and 00060 values with source timestamps and units', () => {
  const payload = { value: { timeSeries: [
    { sourceInfo: { siteCode: [{ value: '03378500' }] }, variable: { variableCode: [{ value: '00065' }], unit: { unitCode: 'ft' } }, values: [{ value: [{ value: '8.23', dateTime: '2026-09-07T12:00:00Z', qualifiers: ['P'] }] }] },
    { sourceInfo: { siteCode: [{ value: '03378500' }] }, variable: { variableCode: [{ value: '00060' }], unit: { unitCode: 'ft3/s' } }, values: [{ value: [{ value: '1000', dateTime: '2026-09-07T12:00:00Z', qualifiers: [] }] }] },
  ] } };
  const records = parseUsgsInstantaneousValues(payload, '2026-09-07T12:01:00Z');
  assert.equal(records.length, 2);
  assert.equal(records[0].sourceId, 'USGS-NWIS-03378500-00065');
  assert.equal(records[0].unit, 'ft');
  assert.equal(records[0].observedAt, '2026-09-07T12:00:00Z');
  assert.equal(records[1].unit, 'ft3/s');
});

test('rejects unitless USGS values', () => {
  assert.throws(() => parseUsgsInstantaneousValues({ value: { timeSeries: [{ variable: { variableCode: [{ value: '00065' }] }, values: [{ value: [{ value: '8.2', dateTime: '2026-09-07T12:00:00Z' }] }] }] } }, '2026-09-07T12:01:00Z'), /unit/i);
});
