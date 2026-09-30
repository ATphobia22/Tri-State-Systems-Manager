import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenFemaUrl, normalizeOpenFemaResponse, queryOpenFema, pageOpenFema } from '../server/ingestion/openfema.mjs';

test('OpenFEMA URL uses versioned allowlisted entity', () => {
  const url = new URL(buildOpenFemaUrl('FimaNfipPolicies', { '$top': 10, '$select': 'id,state' }));
  assert.equal(url.pathname, '/api/open/v2/FimaNfipPolicies');
  assert.equal(url.searchParams.get('$top'), '10');
});

test('OpenFEMA rejects unknown entities and unsafe keys', () => {
  assert.throws(() => buildOpenFemaUrl('UnknownEntity'), /not allowlisted/);
  assert.throws(() => buildOpenFemaUrl('FemaRegions', { filter: 'state eq IN' }), /must start with/);
});

test('OpenFEMA normalizes entity envelope', () => {
  const result = normalizeOpenFemaResponse({ metadata: { count: 1 }, FemaRegions: [{ id: 'x' }] }, 'FemaRegions');
  assert.equal(result.records[0].id, 'x');
});

test('OpenFEMA query preserves provenance URL', async () => {
  const result = await queryOpenFema('NfipCommunityStatusBook', {
    top: 2,
    request: async () => ({ metadata: { top: 2 }, NfipCommunityStatusBook: [{ communityNumber: '180001' }] }),
  });
  assert.equal(result.records[0].communityNumber, '180001');
  assert.match(result.sourceUri, /NfipCommunityStatusBook/);
});

test('OpenFEMA paging is deterministic', async () => {
  let calls = 0;
  const result = await pageOpenFema('FimaNfipClaims', {
    pageSize: 2,
    request: async () => {
      calls += 1;
      return { metadata: {}, FimaNfipClaims: calls === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }] };
    },
  });
  assert.deepEqual(result.records.map((row) => row.id), [1, 2, 3]);
  assert.equal(calls, 2);
});
