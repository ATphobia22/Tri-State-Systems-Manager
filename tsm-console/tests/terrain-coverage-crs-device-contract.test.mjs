import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  POSEY_BONEBANK_AOI,
  buildCoverageGrid,
  recoverTerrainProvider,
  simulateProviderFailureRecovery,
} from '../src/lib/terrain-coverage.ts';
import {
  buildCrsDatumEvidenceReport,
  TSM_SUPPORTED_SOURCE_CATALOG,
  evaluateSourceDatumEvidence,
} from '../src/lib/crs-vertical-datum-evidence.ts';
import {
  buildCrossDeviceValidationReport,
  REPRESENTATIVE_DEVICE_MATRIX,
  recordDeviceMeasurement,
} from '../src/lib/cross-device-validation.ts';

test('AOI manifest has verified geometry and providers', () => {
  assert.equal(POSEY_BONEBANK_AOI.aoi_id, 'posey-bonebank-13101');
  assert.ok(POSEY_BONEBANK_AOI.bbox.westLon < POSEY_BONEBANK_AOI.bbox.eastLon);
  assert.ok(POSEY_BONEBANK_AOI.providers.length >= 1);
  assert.equal(POSEY_BONEBANK_AOI.vertical_datum, 'NAVD88');
});

test('coverage report treats unknown cells as nodata (fail closed)', () => {
  const report = buildCoverageGrid(POSEY_BONEBANK_AOI);
  assert.ok(report.totalCells > 0);
  assert.equal(report.nodataCells, report.totalCells);
  assert.equal(report.coveredCells, 0);
  assert.equal(report.authority, 'OPERATIONS_REPORT');
});

test('coverage with measured fractions reports covered cells', () => {
  const fracs = new Map([['0:0', 0.95], ['0:1', 0.0]]);
  const report = buildCoverageGrid(POSEY_BONEBANK_AOI, fracs);
  assert.ok(report.coveredCells >= 1);
  assert.ok(report.nodataCells >= 1);
});

test('provider failure recovery fail-closes when nothing published', () => {
  const result = simulateProviderFailureRecovery(
    POSEY_BONEBANK_AOI,
    'usgs-3dep-terrain-rgb',
  );
  assert.equal(result.recovered, false);
  assert.equal(result.failClosed, true);
  assert.equal(result.activeProviderId, null);
  assert.ok(result.events.length >= 1);
});

test('provider recovery switches to published fallback', () => {
  const providers = [
    {
      id: 'primary',
      authority: 'A',
      product: 'P',
      horizontalCrs: 'EPSG:3857',
      verticalDatum: 'NAVD88',
      sourceUri: null,
      tileTemplate: null,
      status: 'UNAVAILABLE',
    },
    {
      id: 'fallback',
      authority: 'B',
      product: 'Q',
      horizontalCrs: 'EPSG:3857',
      verticalDatum: 'NAVD88',
      sourceUri: 'https://example.invalid/terrain',
      tileTemplate: 'https://example.invalid/{z}/{x}/{y}.png',
      status: 'PUBLISHED',
    },
  ];
  const r = recoverTerrainProvider(providers, 'primary', 'timeout');
  assert.equal(r.recovered, true);
  assert.equal(r.activeProviderId, 'fallback');
  assert.equal(r.failClosed, false);
});

test('CRS/datum evidence report flags missing critical metadata', () => {
  const report = buildCrsDatumEvidenceReport(TSM_SUPPORTED_SOURCE_CATALOG);
  assert.ok(report.source_count >= 8);
  assert.ok(report.missing_critical_count >= 1);
  const hist = report.sources.find((s) => s.id === 'point-township-historical');
  assert.ok(hist);
  assert.equal(hist.status, 'MISSING_CRITICAL');
  assert.ok(report.supported_vertical_datums.includes('NAVD88'));
  assert.equal(report.authority, 'EVIDENCE_REPORT');
});

test('evaluateSourceDatumEvidence complete when CRS+datum+provenance present', () => {
  const e = evaluateSourceDatumEvidence({
    id: 'x',
    dataset: 'd',
    authority: 'a',
    layerType: 'terrain',
    crs: 'EPSG:4326',
    verticalDatum: 'NAVD88',
    sourceUrl: 'https://example.invalid/',
  });
  assert.equal(e.status, 'COMPLETE');
  assert.deepEqual(e.missing, []);
});

test('cross-device report is honest PENDING_OPERATOR without hardware', () => {
  const report = buildCrossDeviceValidationReport({
    hizCpuParity: true,
    transvoxelSeams: true,
    coverageFailClosed: true,
    crsReportGenerated: true,
  });
  assert.equal(report.matrix.length, REPRESENTATIVE_DEVICE_MATRIX.length);
  assert.equal(report.allDevicesMeasured, false);
  assert.ok(report.measurements.every((m) => m.status === 'PENDING_OPERATOR'));
  assert.equal(report.correctness.hizCpuParity, true);
});

test('recordDeviceMeasurement accepts operator hardware results', () => {
  const m = recordDeviceMeasurement({
    deviceId: 'desktop-nvidia-class',
    measuredAt: '2026-10-23T00:00:00Z',
    webgpu: true,
    webgl2: true,
    peakMemoryMb: 420,
    hizBuildMs: 1.2,
    terrainFrameMs: 8.5,
    seamCheckMs: 3.1,
    renderCorrectnessPass: true,
    notes: 'Operator lab run',
  });
  assert.equal(m.status, 'MEASURED');
  assert.equal(m.webgpu, true);
});
