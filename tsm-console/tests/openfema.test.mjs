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


test('newly registered v3 NFIP and v2 HMA endpoints do not silently use obsolete versions', () => {
  assert.equal(new URL(buildOpenFemaUrl('NfipPolicies')).pathname, '/api/open/v3/NfipPolicies');
  assert.equal(new URL(buildOpenFemaUrl('NfipClaims')).pathname, '/api/open/v3/NfipClaims');
  assert.equal(new URL(buildOpenFemaUrl('HazardMitigationGrantProgramDisasterSummaries')).pathname,
    '/api/open/v3/HazardMitigationGrantProgramDisasterSummaries');
  assert.equal(new URL(buildOpenFemaUrl('HmaSubapplications')).pathname, '/api/open/v2/HmaSubapplications');
  assert.equal(new URL(buildOpenFemaUrl('DisasterDeclarationsSummaries')).pathname,
    '/api/open/v2/DisasterDeclarationsSummaries');
});

test('missing/malformed API collection must not silently mean an empty successful query', () => {
  assert.throws(() => normalizeOpenFemaResponse({ metadata: {} }, 'FemaRegions'), /missing or invalid/);
  assert.throws(() => normalizeOpenFemaResponse({ data: [{ id: 'wrong envelope' }] }, 'FemaRegions'), /missing or invalid/);
  assert.throws(() => normalizeOpenFemaResponse({ FemaRegions: [null] }, 'FemaRegions'), /invalid record/);
});

test('OpenFEMA response on a short final page is complete, not automatically an NFHL map', async () => {
  let pages = 0;
  const result = await pageOpenFema('DisasterDeclarationsSummaries', {
    pageSize: 2,
    request: async () => {
      pages += 1;
      return { DisasterDeclarationsSummaries: pages === 1
        ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }] };
    },
  });
  assert.equal(result.complete, true);
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.reason, null);
  assert.equal(result.pageCount, 2);
  assert.match(result.authority, /not effective NFHL/);
});

test('one full page at maxPages is explicitly PARTIAL', async () => {
  const output = await pageOpenFema('FimaNfipClaims', {
    pageSize: 2,
    maxPages: 1,
    request: async () => ({ FimaNfipClaims: [{ id: 1 }, { id: 2 }] }),
  });
  assert.equal(output.complete, false);
  assert.equal(output.status, 'PARTIAL');
  assert.equal(output.reason, 'MAX_PAGES_REACHED');
});

test('maxRecords reached produces PARTIAL instead of claiming complete', async () => {
  const output = await pageOpenFema('FimaNfipPolicies', {
    pageSize: 2, maxRecords: 2,
    request: async () => ({ FimaNfipPolicies: [{ id: 1 }, { id: 2 }] }),
  });
  assert.equal(output.complete, false);
  assert.equal(output.reason, 'MAX_RECORDS_REACHED');
});

test('pager rejects non-bounded page options', async () => {
  await assert.rejects(pageOpenFema('FimaNfipPolicies', { pageSize: 0 }), /pageSize/);
  await assert.rejects(pageOpenFema('FimaNfipPolicies', { maxPages: 0 }), /maxPages/);
  await assert.rejects(pageOpenFema('FimaNfipPolicies', { maxRecords: 100001 }), /maxRecords/);
  await assert.rejects(pageOpenFema('FimaNfipPolicies', { skip: -1 }), /skip/);
});
