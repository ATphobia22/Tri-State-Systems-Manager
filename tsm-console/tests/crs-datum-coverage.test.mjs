/**
 * Regression test for NOT-COMPLETE registry item 4:
 * CRS / vertical-datum / epoch catalog coverage.
 *
 * Pins the supported source catalog snapshot and verifies:
 *  1. The live catalog has not drifted from the pinned fixture (SHA-256).
 *  2. A fresh harness run reproduces the pinned snapshot digest.
 *  3. The committed coverage report matches the fixture digest and a fresh
 *     run's per-entry statuses (guards against hand-edited reports).
 *  4. Honesty invariants: unknown/unresolvable transforms are UNAVAILABLE,
 *     never approximated; nothing is silently skipped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const {
  TSM_SUPPORTED_SOURCE_CATALOG,
  canonicalCatalogJson,
  buildCatalogCoverageReport,
} = await import('../src/lib/crs-vertical-datum-evidence.ts');

const FIXTURE_PATH = join(here, 'fixtures', 'crs-datum-catalog-snapshot-2026-10-23.json');
const REPORT_PATH = join(root, 'docs/validation/crs-datum-coverage/coverage-report-2026-10-23.json');

function digest(catalog) {
  return createHash('sha256').update(canonicalCatalogJson(catalog), 'utf8').digest('hex');
}

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

test('pinned catalog snapshot is internally consistent', () => {
  assert.equal(fixture.schema_version, 'crs-datum-catalog-snapshot/1.0.0');
  assert.equal(fixture.entry_count, fixture.catalog.length);
  assert.deepEqual(
    fixture.entry_ids,
    fixture.catalog.map((s) => s.id),
  );
  assert.equal(fixture.sha256, digest(fixture.catalog), 'fixture digest must match its own catalog');
});

test('live catalog has not drifted from the pinned snapshot', () => {
  const liveDigest = digest(TSM_SUPPORTED_SOURCE_CATALOG);
  assert.equal(
    liveDigest,
    fixture.sha256,
    'catalog drifted — update the pinned fixture deliberately (with review), not silently',
  );
  assert.equal(TSM_SUPPORTED_SOURCE_CATALOG.length, fixture.entry_count);
});

test('fresh harness run reproduces the snapshot digest and sane coverage math', () => {
  const report = buildCatalogCoverageReport(TSM_SUPPORTED_SOURCE_CATALOG, {
    snapshotSha256: digest(TSM_SUPPORTED_SOURCE_CATALOG),
  });
  assert.equal(report.input_snapshot.sha256, fixture.sha256);
  assert.equal(report.coverage.denominator, fixture.entry_count);
  assert.ok(
    report.coverage.numerator <= report.coverage.denominator,
    'numerator must not exceed denominator',
  );
  assert.equal(
    report.coverage.numerator,
    report.status_counts.VALIDATED,
    'numerator equals VALIDATED count',
  );
  const counted =
    report.status_counts.VALIDATED +
    report.status_counts.UNAVAILABLE +
    report.status_counts.INCOMPLETE +
    report.status_counts.MISSING_CRITICAL;
  assert.equal(counted, report.coverage.denominator, 'status counts partition the denominator');
  assert.ok(Array.isArray(report.skipped), 'skipped records must be listed explicitly');
});

test('unknown/unresolvable transforms stay labeled UNAVAILABLE, never approximated', () => {
  const report = buildCatalogCoverageReport(TSM_SUPPORTED_SOURCE_CATALOG);
  for (const entry of report.entries) {
    if (entry.vertical_datum.status === 'UNKNOWN_UNAVAILABLE') {
      assert.equal(entry.status, 'UNAVAILABLE', `${entry.id}: unknown datum must be UNAVAILABLE`);
      assert.equal(
        entry.vertical_datum.transform_availability,
        'UNAVAILABLE',
        `${entry.id}: unresolvable transform must be UNAVAILABLE`,
      );
    }
  }
  const unavailableIds = report.entries.filter((e) => e.status === 'UNAVAILABLE').map((e) => e.id);
  // Gage stage (unpublished gage zero) and NWPS forecast reference are not orthometric datums.
  assert.ok(unavailableIds.includes('usgs-03378500'), 'gage 03378500 vertical stays UNAVAILABLE');
  assert.ok(unavailableIds.includes('noaa-nwps'), 'NWPS vertical stays UNAVAILABLE');
});

test('error categories reference real catalog entries only', () => {
  const report = buildCatalogCoverageReport(TSM_SUPPORTED_SOURCE_CATALOG);
  const ids = new Set(report.entries.map((e) => e.id));
  for (const cat of report.error_categories) {
    assert.ok(cat.count >= 0, 'error counts are non-negative');
    assert.equal(cat.count, cat.entries.length, 'error count matches listed entries');
    for (const id of cat.entries) {
      assert.ok(ids.has(id), `error category ${cat.category} references unknown entry ${id}`);
    }
  }
});

test('committed coverage report matches fixture and a fresh run', () => {
  assert.ok(existsSync(REPORT_PATH), `committed report missing at ${REPORT_PATH}`);
  const committed = JSON.parse(readFileSync(REPORT_PATH, 'utf8'));
  assert.equal(committed.input_snapshot.sha256, fixture.sha256, 'committed report digest matches fixture');
  assert.equal(committed.input_snapshot.entry_count, fixture.entry_count);

  const fresh = buildCatalogCoverageReport(TSM_SUPPORTED_SOURCE_CATALOG, {
    snapshotSha256: digest(TSM_SUPPORTED_SOURCE_CATALOG),
  });
  const slim = (entries) =>
    entries.map((e) => ({
      id: e.id,
      status: e.status,
      crs: e.horizontal_crs.status,
      datum: e.vertical_datum.status,
      transform: e.vertical_datum.transform_availability,
      provenance: e.source_provenance.status,
    }));
  assert.deepEqual(slim(committed.entries), slim(fresh.entries), 'committed per-entry statuses match a fresh harness run');
  assert.deepEqual(committed.status_counts, fresh.status_counts);
  assert.deepEqual(committed.coverage, fresh.coverage);
});
