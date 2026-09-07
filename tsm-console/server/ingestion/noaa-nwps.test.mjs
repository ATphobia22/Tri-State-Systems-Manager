import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNoaaStageFlow } from './noaa-nwps.mjs';

test('preserves NOAA observed and forecast product classes', () => {
  const observed = normalizeNoaaStageFlow({ identifier: 'UNWK2', product: 'observed', payload: { data: [{ time: '2026-09-07T12:00:00Z', primary: 8.1, unit: 'ft' }] }, retrievedAt: '2026-09-07T12:01:00Z' });
  const forecast = normalizeNoaaStageFlow({ identifier: 'UNWK2', product: 'forecast', payload: { data: [{ time: '2026-09-07T13:00:00Z', primary: 8.4, unit: 'ft' }] }, retrievedAt: '2026-09-07T12:01:00Z' });
  assert.equal(observed[0].dataClass, 'observation');
  assert.equal(forecast[0].dataClass, 'forecast');
  assert.notEqual(observed[0].dataClass, forecast[0].dataClass);
});

test('rejects NOAA series without timestamp or unit', () => {
  assert.throws(() => normalizeNoaaStageFlow({ identifier: 'UNWK2', product: 'observed', payload: { data: [{ primary: 8.1 }] }, retrievedAt: '2026-09-07T12:01:00Z' }), /timestamp|unit/i);
});
