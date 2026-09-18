import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFirmBfeMatch, buildFirmBfeEvidence } from '../server/geospatial/fema-bfe-contract.mjs';

test('FIRM 18129C0265C contract accepts an exact NAVD88 BFE match', () => {
  assert.deepEqual(
    assertFirmBfeMatch({ panelId: '18129C0265C', femaBfeFt: 375.0, meshBfeFt: 375.0 }),
    { ok: true, panelId: '18129C0265C', femaBfeFt: 375, meshBfeFt: 375, verticalDatum: 'NAVD88', toleranceFt: 0.001 },
  );
});

test('FIRM BFE contract rejects a mesh mismatch', () => {
  assert.throws(
    () => assertFirmBfeMatch({ panelId: '18129C0265C', femaBfeFt: 375.0, meshBfeFt: 374.9 }),
    (error) => error?.code === 'FEMA_BFE_MISMATCH',
  );
});

test('FIRM BFE evidence requires provenance', () => {
  assert.throws(() => buildFirmBfeEvidence({
    panelId: '18129C0265C',
    femaBfeFt: 375,
    sourceEvidenceId: '',
    sourceUri: 'https://msc.fema.gov',
    effectiveDate: '2026-01-01',
  }));
});
