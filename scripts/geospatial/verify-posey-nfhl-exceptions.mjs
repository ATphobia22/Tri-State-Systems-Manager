#!/usr/bin/env node
/**
 * Verify the privacy-reduced Posey NFHL worklist against the original
 * archived screening report; never infer FEMA eligibility from this check.
 * Usage: node scripts/geospatial/verify-posey-nfhl-exceptions.mjs <posey-nfhl-parcel-review.json>
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: node scripts/geospatial/verify-posey-nfhl-exceptions.mjs <posey-nfhl-parcel-review.json>');
  process.exitCode = 2;
} else {
  const manifest = JSON.parse(readFileSync(new URL('../../artifacts/posey-nfhl-parcel-exception-worklist-v1.json', import.meta.url), 'utf8'));
  const sourceBytes = readFileSync(sourcePath);
  const digest = createHash('sha256').update(sourceBytes).digest('hex');
  assert.equal(digest, manifest.source.reportSha256, 'Archived screening report SHA-256 does not match');
  const report = JSON.parse(sourceBytes.toString('utf8'));
  assert.equal(report.schema, 'tsm.posey.fema-parcel-evidence-review.v1');
  assert.equal(report.screeningOnly, true);
  assert.equal(report.regulatoryEligibilityEstablished, false);
  assert.equal(report.elevationEvidence, 'NOT_INCLUDED_NO_FEMA_LOMA_ELIGIBILITY_INFERENCE');
  assert.equal(report.rows.length, manifest.screenedParcelGeometryRecords);
  assert.equal(report.sourceSha256.parcelGeoJson, manifest.source.parcelGeoJsonSha256);
  assert.equal(report.sourceSha256.femaPanelReceipt, manifest.source.femaPanelReceiptSha256);
  assert.equal(report.sourceSha256.femaZoneReceipt, manifest.source.femaZoneReceiptSha256);
  for (const [status, ids] of Object.entries(manifest.statusObjectIds)) {
    const sourceRows = report.rows.filter((row) => row.screeningStatus === status);
    const matched = sourceRows.map((row) => row.parcelObjectId).sort((a, b) => a - b);
    assert.deepEqual(matched, ids, 'Source exception OBJECTIDs mismatch for ' + status);
    assert.equal(report.statusCounts[status], ids.length, 'Source exception status count mismatch');
    for (const row of sourceRows) {
      assert.deepEqual(row.firmPanelIds, [], 'An unexpected panel join requires a reviewed regeneration');
      assert.equal(row.femaDetermination, null);
      assert.equal(row.bfeNavd88Ft, null);
      assert.equal(row.lowestAdjacentGradeNavd88Ft, null);
    }
  }
  console.log(JSON.stringify({
    verifiedSourceReportSha256: digest,
    screenedParcelGeometryRecords: report.rows.length,
    exceptionCounts: Object.fromEntries(Object.entries(manifest.statusObjectIds).map(([name, ids]) => [name, ids.length])),
    regulatoryDetermination: 'NOT_PERFORMED'
  }, null, 2));
}
