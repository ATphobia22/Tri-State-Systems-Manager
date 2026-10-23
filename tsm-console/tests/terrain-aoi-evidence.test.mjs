import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateTerrainAoiManifest } from '../../scripts/geospatial/validate-terrain-aoi-evidence.mjs';

const digest = 'a'.repeat(64);
const validManifest = {
  schemaVersion: 1,
  catalogSnapshotSha256: digest,
  aoi: {
    id: 'test-aoi',
    horizontalCrs: 'EPSG:4326',
    bbox: [-84.5, 33.5, -84.4, 33.6],
    geometrySha256: digest,
  },
  sources: [{
    sourceId: 'test-dem',
    sourceUrl: 'https://example.invalid/dem.tif',
    horizontalCrs: 'EPSG:26916',
    verticalDatum: 'NAVD88',
    coordinateEpoch: null,
    units: 'meters',
    accuracyClass: 'SCREENING',
    sha256: digest,
    acquisitionDate: '2025-01-01',
    coverageFraction: 0.75,
    nodataFraction: 0.02,
  }],
};

test('AOI evidence validator accepts complete measured evidence without claiming unique coverage', () => {
  const report = validateTerrainAoiManifest(validManifest);
  assert.equal(report.status, 'VALIDATED_INPUT_EVIDENCE');
  assert.equal(report.sourceCount, 1);
  assert.equal(report.metrics.uniqueAoiCoverageFraction, null);
});

test('AOI evidence validator fails closed for missing AOI/catalog/source provenance', () => {
  const report = validateTerrainAoiManifest({ schemaVersion: 1, aoi: {}, sources: [{}] });
  assert.equal(report.status, 'INCOMPLETE');
  assert.ok(report.errors.length > 0);
  assert.ok(report.missingFieldCounts.sourceId > 0);
  assert.equal(report.metrics.uniqueAoiCoverageFraction, null);
});

test('AOI evidence validator rejects impossible fractions, invalid digests, and malformed epochs', () => {
  const manifest = structuredClone(validManifest);
  manifest.sources[0].sha256 = 'not-a-digest';
  manifest.sources[0].coverageFraction = 1.1;
  manifest.sources[0].coordinateEpoch = 1800;
  const report = validateTerrainAoiManifest(manifest);
  assert.equal(report.status, 'INCOMPLETE');
  assert.ok(report.sourceReports[0].errors.length >= 3);
});

test('AOI evidence validator does not treat overlapping source coverage sums as unique AOI coverage', () => {
  const manifest = structuredClone(validManifest);
  manifest.sources.push({ ...manifest.sources[0], sourceId: 'second-dem', coverageFraction: 0.75 });
  const report = validateTerrainAoiManifest(manifest);
  assert.equal(report.metrics.sumOfSourceCoverageFractions, 1.5);
  assert.equal(report.metrics.uniqueAoiCoverageFraction, null);
});
