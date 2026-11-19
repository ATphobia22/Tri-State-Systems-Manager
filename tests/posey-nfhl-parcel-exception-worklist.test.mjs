import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worklist = JSON.parse(readFileSync(new URL('../artifacts/posey-nfhl-parcel-exception-worklist-v1.json', import.meta.url), 'utf8'));

test('source-traced Posey FEMA exceptions retain exact 147 + 9 OBJECTID denominator', () => {
  assert.equal(worklist.schema, 'tsm.posey.nfhl.parcel-exception-worklist.v1');
  assert.equal(worklist.authority, 'SCREENING_ONLY_NOT_REGULATORY');
  assert.equal(worklist.screenedParcelGeometryRecords, 20448);
  assert.equal(worklist.exceptionRecordCount, 156);
  assert.equal(worklist.unverifiedPanelJoinCount, 156);
  const groups = worklist.statusObjectIds;
  assert.deepEqual(Object.keys(groups).sort(), ['FEMA_ZONE_COVERAGE_INCOMPLETE','PARCEL_GEOMETRY_UNAVAILABLE']);
  assert.equal(groups.FEMA_ZONE_COVERAGE_INCOMPLETE.length, 147);
  assert.equal(groups.PARCEL_GEOMETRY_UNAVAILABLE.length, 9);
  const ids = Object.values(groups).flat();
  assert.equal(ids.length, 156);
  assert.equal(new Set(ids).size, 156);
  for (const group of Object.values(groups)) {
    assert.ok(group.every(Number.isSafeInteger));
    assert.ok(group.every((v, i) => v > 0 && (i === 0 || group[i - 1] < v)), 'OBJECTIDs must be positive, sorted and unique');
  }
});

test('worklist is privacy-minimized and never labels FEMA eligibility or BFE', () => {
  assert.equal(worklist.objectIdField, 'parcelObjectId');
  assert.match(worklist.privacy, /no names, addresses, state parcel IDs or geometries/);
  assert.match(worklist.warning, /No parcel may be labeled SAFE or LOMA_ELIGIBLE/);
  for (const k of ['coordinates','geometry','address','ownerName','stateParcelId','bfeNavd88Ft','firmPanelIds','femaDetermination']) {
    assert.equal(Object.hasOwn(worklist,k), false, 'unexpected confidential or unreviewed field: ' + k);
  }
  assert.ok(worklist.missingEvidence.includes('incorporated_lomc_review'));
  assert.ok(worklist.missingEvidence.includes('location_specific_bfe'));
  for (const key of ['zipSha256','reportSha256','parcelGeoJsonSha256','femaPanelReceiptSha256','femaZoneReceiptSha256']) {
    assert.match(worklist.source[key], /^[0-9a-f]{64}$/);
  }
});
