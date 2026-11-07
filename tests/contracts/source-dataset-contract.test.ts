import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSourceDataset, type SourceDataset } from '../../packages/contracts/src/SourceDataset.ts';
import { validateSourceDataset as validateFromIndex } from '../../packages/contracts/src/index.ts';
import { NldAdapter } from '../../packages/government/src/adapters/NldAdapter.ts';
import { validateEvidenceEnvelope } from '../../packages/government/src/index.ts';

/**
 * Real recorded values from the live NLD probe, 2026-11-07: GET
 * https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer?f=pjson
 * returned HTTP 200, 8,849 bytes, raw-body SHA-256
 * 3110ff362bfa86141b43725f088b48815292af6462024d77a0b87f77fb1517c7.
 */
const NLD_METADATA_URL = 'https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer?f=pjson';
const NLD_METADATA_SHA256 = 'sha256:3110ff362bfa86141b43725f088b48815292af6462024d77a0b87f77fb1517c7';

function validRecord(): SourceDataset {
  return {
    sourceId: 'usace-levees',
    datasetName: 'NLD Public FeatureServer service metadata',
    version: '11.5',
    endpoint: NLD_METADATA_URL,
    access: 'REST_JSON',
    retrievedAt: '2026-11-07T15:30:00.000Z',
    checksumSha256: NLD_METADATA_SHA256,
    byteSize: 8849,
    featureCount: 18,
    provenance: {
      retrievedBy: 'NldAdapter.getServiceMetadata',
      sourceUri: NLD_METADATA_URL,
      notes: 'Recorded live probe 2026-11-07; 18 layers, maxRecordCount 2000.',
    },
  };
}

test('source-dataset contract: valid record passes', () => {
  assert.deepEqual(validateSourceDataset(validRecord()), []);
  assert.deepEqual(validateFromIndex(validRecord()), []);
});

test('source-dataset contract: minimal record without optionals passes', () => {
  const { version, byteSize, featureCount, evidenceBundleHash, ingestionRunId, ...rest } = validRecord();
  void version;
  void byteSize;
  void featureCount;
  void evidenceBundleHash;
  void ingestionRunId;
  const minimal = { ...rest, provenance: { retrievedBy: 'NldAdapter', sourceUri: NLD_METADATA_URL } };
  assert.deepEqual(validateSourceDataset(minimal), []);
});

test('source-dataset contract: each invalid field fails with the expected error', () => {
  const cases: [string, (r: SourceDataset) => unknown, RegExp][] = [
    ['empty sourceId', (r) => ({ ...r, sourceId: '' }), /sourceId/],
    ['missing sourceId', (r) => { const { sourceId, ...rest } = r; void sourceId; return rest; }, /sourceId/],
    ['empty datasetName', (r) => ({ ...r, datasetName: '   ' }), /datasetName/],
    ['http endpoint', (r) => ({ ...r, endpoint: 'http://example.com/data.json' }), /https/],
    ['endpoint with credentials', (r) => ({ ...r, endpoint: 'https://user:pass@example.com/data.json' }), /credentials/],
    ['endpoint with fragment', (r) => ({ ...r, endpoint: 'https://example.com/data.json#frag' }), /fragment/],
    ['endpoint not a URL', (r) => ({ ...r, endpoint: 'not a url' }), /valid URL/],
    ['bad access', (r) => ({ ...r, access: 'SOAP' }), /access/],
    ['bad retrievedAt', (r) => ({ ...r, retrievedAt: 'yesterday' }), /retrievedAt/],
    ['checksum without prefix', (r) => ({ ...r, checksumSha256: '3110ff362bfa86141b43725f088b48815292af6462024d77a0b87f77fb1517c7' }), /checksumSha256/],
    ['checksum too short', (r) => ({ ...r, checksumSha256: 'sha256:abcd' }), /checksumSha256/],
    ['checksum uppercase hex', (r) => ({ ...r, checksumSha256: 'sha256:3110FF362BFA86141B43725F088B48815292AF6462024D77A0B87F77FB1517C7' }), /checksumSha256/],
    ['negative byteSize', (r) => ({ ...r, byteSize: -1 }), /byteSize/],
    ['negative featureCount', (r) => ({ ...r, featureCount: -5 }), /featureCount/],
    ['missing provenance', (r) => { const { provenance, ...rest } = r; void provenance; return rest; }, /provenance is required/],
    ['empty provenance.retrievedBy', (r) => ({ ...r, provenance: { ...r.provenance, retrievedBy: '' } }), /retrievedBy/],
    ['empty provenance.sourceUri', (r) => ({ ...r, provenance: { ...r.provenance, sourceUri: '' } }), /sourceUri/],
    ['empty evidenceBundleHash when present', (r) => ({ ...r, evidenceBundleHash: '' }), /evidenceBundleHash/],
    ['empty ingestionRunId when present', (r) => ({ ...r, ingestionRunId: ' ' }), /ingestionRunId/],
  ];
  for (const [label, mutate, pattern] of cases) {
    const errors = validateSourceDataset(mutate(validRecord()));
    assert.ok(errors.length > 0, label + ': expected at least one error');
    assert.ok(errors.some((e) => pattern.test(e)), label + ': expected error matching ' + pattern + ', got ' + JSON.stringify(errors));
  }
});

test('source-dataset contract: non-object input fails without throwing', () => {
  for (const bad of [null, undefined, 42, 'x', [], true]) {
    assert.ok(validateSourceDataset(bad).length > 0, 'expected error for ' + String(bad));
  }
});

test('source-dataset contract: references to EvidenceBundle/IngestionManifest stay by id/hash only', () => {
  const record: SourceDataset = {
    ...validRecord(),
    evidenceBundleHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    ingestionRunId: 'ingest-2026-11-07-nld-001',
  };
  assert.deepEqual(validateSourceDataset(record), []);
  // The type carries no EvidenceBundle or IngestionManifest fields of its own.
  assert.equal('evidenceBundle' in record, false);
  assert.equal('ingestionManifest' in record, false);
});

test('source-dataset contract: round-trip from a real NldAdapter envelope', async () => {
  const adapter = new NldAdapter();
  const fixture = {
    currentVersion: 11.5,
    maxRecordCount: 2000,
    layers: [
      { id: 0, name: 'Boreholes' },
      { id: 1, name: 'Crossings' },
      { id: 16, name: 'Leveed Areas' },
    ],
    tables: [],
  };
  const envelope = await adapter.getServiceMetadata({
    fetcher: (async () => new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
  });
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
  const record: SourceDataset = {
    sourceId: envelope.provenance.provider,
    datasetName: 'NLD Public FeatureServer service metadata',
    endpoint: envelope.citations[0].url,
    access: 'REST_JSON',
    retrievedAt: envelope.evidence[0].retrievedAt,
    checksumSha256: 'sha256:' + envelope.evidence[0].sha256,
    featureCount: (envelope.result.layers as unknown[]).length,
    provenance: {
      retrievedBy: 'NldAdapter.getServiceMetadata',
      sourceUri: envelope.citations[0].url,
    },
  };
  assert.deepEqual(validateSourceDataset(record), []);
  assert.equal(record.sourceId, 'usace-levees');
  assert.equal(record.featureCount, 3);
  assert.match(record.checksumSha256, /^sha256:[0-9a-f]{64}$/);
});
