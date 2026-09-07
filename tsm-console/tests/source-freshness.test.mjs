import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySourceFreshness } from '../server/reliability/source-policies.mjs';

test('USGS observation freshness uses the configured 15-minute operational window', () => {
  const now = Date.parse('2026-09-07T12:00:00Z');
  assert.equal(classifySourceFreshness('USGS_NWIS_OBSERVATION', { observedAt: '2026-09-07T11:50:00Z' }, now), 'fresh');
  assert.equal(classifySourceFreshness('USGS_NWIS_OBSERVATION', { observedAt: '2026-09-07T11:30:00Z' }, now), 'delayed');
  assert.equal(classifySourceFreshness('USGS_NWIS_OBSERVATION', { observedAt: '2026-09-07T11:20:00Z' }, now), 'stale');
});

test('NOAA forecast has a separate freshness class from observations', () => {
  const now = Date.parse('2026-09-07T12:00:00Z');
  assert.equal(classifySourceFreshness('NOAA_NWPS_FORECAST', { retrievedAt: '2026-09-07T11:30:00Z' }, now), 'fresh');
});
