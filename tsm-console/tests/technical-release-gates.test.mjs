import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { HECReleaseGateChecker, sha256Hex } from '../src/lib/hec-release-gates.ts';
import { StationDatumVerifier } from '../src/lib/geodetic/station-datum-verifier.ts';

const hash = (value) => createHash('sha256').update(value).digest('hex');

test('station datum verifier reports missing evidence as unavailable', async () => {
  const result = await StationDatumVerifier.verify(null, '03378500');
  assert.equal(result.state, 'unavailable');
  assert.equal(result.gageZeroNavd88Ft, null);
});

test('station datum verifier checks station/product semantics and document hash', async () => {
  const sourceDocumentText = 'Station 03378500 product 00065 gage zero 352.67 ft NAVD88';
  const result = await StationDatumVerifier.verify({
    stationId: '03378500',
    sourceStationId: '03378500',
    agency: 'USGS',
    productId: 'NWIS-00065',
    parameterCode: '00065',
    gageZeroNavd88Ft: 352.67,
    verticalDatum: 'NAVD88',
    unit: 'ft',
    sourceUri: 'https://example.usgs.gov/source',
    sourceDocumentText,
    sourceDocumentSha256: hash(sourceDocumentText),
    verifiedAt: '2026-10-19T00:00:00Z',
    sourceProductRelationshipConfirmed: true,
  }, '03378500');
  assert.equal(result.state, 'verified');
  assert.equal(result.gageZeroNavd88Ft, 352.67);
});

test('station datum verifier refuses mismatched station identity', async () => {
  const sourceDocumentText = 'different station';
  const result = await StationDatumVerifier.verify({
    stationId: '03378500',
    sourceStationId: '03322000',
    agency: 'USGS',
    productId: 'NWIS-00065',
    parameterCode: '00065',
    gageZeroNavd88Ft: 352.67,
    verticalDatum: 'NAVD88',
    unit: 'ft',
    sourceUri: 'https://example.usgs.gov/source',
    sourceDocumentText,
    sourceDocumentSha256: hash(sourceDocumentText),
    verifiedAt: '2026-10-19T00:00:00Z',
    sourceProductRelationshipConfirmed: true,
  }, '03378500');
  assert.equal(result.state, 'invalid');
  assert.equal(result.gageZeroNavd88Ft, null);
});

test('HEC release checker reports missing inputs without pretending run is accepted', async () => {
  const report = await HECReleaseGateChecker.check({
    aoi: null,
    dem: null,
    verticalDatum: null,
    solver: null,
  });
  assert.equal(report.schema, 'tsm.hec-release-gates.v1');
  assert.equal(report.status, 'incomplete');
  assert.equal(report.gates.length, 4);
  assert.equal(report.unavailable, 4);
  assert.equal(report.blocked, 0);
});

test('HEC release checker detects a solver artifact hash mismatch', async () => {
  const outputArtifact = '{"result":"model output"}';
  const report = await HECReleaseGateChecker.check({
    aoi: null,
    dem: null,
    verticalDatum: null,
    solver: {
      solverName: 'HEC-RAS',
      solverVersion: '6.x',
      inputManifest: '{}',
      inputSha256: await sha256Hex('{}'),
      outputArtifact,
      outputSha256: '0'.repeat(64),
    },
    peSignoff: null,
  });
  assert.equal(report.status, 'blocked');
  assert.ok(report.gates.find((item) => item.id === 'solver-hash').findings.some((item) => item.includes('does not match')));
});


test('all four technical HEC gates pass only when supplied evidence is internally consistent', async () => {
  const boundaryGeoJson = JSON.stringify({
    type: 'Polygon',
    coordinates: [[[-88, 37], [-87, 37], [-87, 38], [-88, 38], [-88, 37]]],
  });
  const rasterBytes = new Uint8Array(Buffer.from('dem-raster-fixture'));
  const inputManifest = JSON.stringify({ demSha256: hash('dem-raster-fixture'), boundarySha256: hash(boundaryGeoJson) });
  const outputArtifact = JSON.stringify({ solver: 'HEC-RAS', status: 'fixture-only' });
  const outputSha256 = hash(outputArtifact);
  const report = await HECReleaseGateChecker.check({
    aoi: {
      aoiId: 'fixture-aoi',
      watershedId: 'fixture-watershed',
      boundaryGeoJson,
      boundarySha256: hash(boundaryGeoJson),
      crs: 'EPSG:4326',
      areaSqKm: 1,
      sourceUri: 'https://example.gov/boundary',
      topologyValidation: 'passed',
      intersectsWatershed: true,
    },
    dem: {
      sourceName: 'test fixture only',
      sourceUri: 'https://example.gov/dem',
      acquisitionDate: '2026-10-01',
      resolutionM: 1,
      horizontalCrs: 'EPSG:2966',
      verticalDatum: 'NAVD88',
      verticalUnits: 'ft',
      rasterSha256: hash('dem-raster-fixture'),
      rasterBytes,
    },
    verticalDatum: {
      sourceVerticalDatum: 'NAVD88',
      targetVerticalDatum: 'NAVD88',
      transformationModel: 'identity (same datum)',
      transformationApplied: false,
      evidenceUri: 'https://example.gov/datum-evidence',
    },
    solver: {
      solverName: 'HEC-RAS',
      solverVersion: 'fixture',
      inputManifest,
      inputSha256: hash(inputManifest),
      outputArtifact,
      outputSha256,
    },
  });
  assert.equal(report.status, 'ready-for-engineering-review');
  assert.equal(report.passed, 4);
  assert.equal(report.unavailable, 0);
  assert.equal(report.blocked, 0);
  assert.match(report.note, /PE license is not required for TSM software runtime/);
});
