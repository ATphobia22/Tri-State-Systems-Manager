import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthoritativeSource, listAuthoritativeSources } from '../server/ingestion/source-fabric.mjs';

test('authoritative source catalog exposes all governed providers', () => {
  const ids = new Set(listAuthoritativeSources().map((source) => source.id));
  for (const id of ['USGS-NWIS-IV', 'USGS-TNM', 'NOAA-NWPS', 'FEMA-NFHL', 'IDNR-BAFL', 'INDIANA-GIS', 'USACE-NLD']) {
    assert.equal(ids.has(id), true, `missing source ${id}`);
  }
});

test('authoritative source lookup fails closed for unknown sources', () => {
  assert.throws(() => getAuthoritativeSource('UNKNOWN'), /unknown authoritative source/);
});
