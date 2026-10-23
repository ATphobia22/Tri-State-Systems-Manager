#!/usr/bin/env node
/**
 * CRS / vertical-datum / epoch coverage harness — full-catalog run.
 *
 * Runs the coverage evaluator against the COMPLETE supported source catalog
 * (TSM_SUPPORTED_SOURCE_CATALOG, aligned with REQUIRED_OPEN_WORLD_LAYERS +
 * NFHL S_BFE) and writes the machine-readable coverage report required by
 * NOT-COMPLETE registry item 4.
 *
 * Usage (also wired as `check:crs-coverage` in tsm-console/package.json):
 *   node scripts/geospatial/crs-datum-coverage-report.mjs
 *
 * Output: docs/validation/crs-datum-coverage/coverage-report-2026-10-23.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const modPath = join(root, 'tsm-console/src/lib/crs-vertical-datum-evidence.ts');

const {
  buildCatalogCoverageReport,
  canonicalCatalogJson,
  TSM_SUPPORTED_SOURCE_CATALOG,
  COVERAGE_HARNESS_VERSION,
} = await import(pathToFileURL(modPath).href);

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: root, encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

// Input snapshot digest: SHA-256 of the canonical catalog input.
const catalogJson = canonicalCatalogJson(TSM_SUPPORTED_SOURCE_CATALOG);
const snapshotSha256 = createHash('sha256').update(catalogJson, 'utf8').digest('hex');

const report = buildCatalogCoverageReport(TSM_SUPPORTED_SOURCE_CATALOG, {
  catalogSourceLabel:
    'tsm-console/src/lib/crs-vertical-datum-evidence.ts :: TSM_SUPPORTED_SOURCE_CATALOG',
  snapshotSha256,
  pinnedFixture: 'tsm-console/tests/fixtures/crs-datum-catalog-snapshot-2026-10-23.json',
  gitCommit: git('rev-parse HEAD'),
  gitBranch: git('rev-parse --abbrev-ref HEAD'),
});

const outDir = join(root, 'docs/validation/crs-datum-coverage');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'coverage-report-2026-10-23.json');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

console.log(
  JSON.stringify(
    {
      ok: true,
      harness_version: COVERAGE_HARNESS_VERSION,
      outPath,
      denominator: report.coverage.denominator,
      numerator: report.coverage.numerator,
      fraction: report.coverage.fraction,
      status_counts: report.status_counts,
      skipped: report.skipped.length,
      error_categories: report.error_categories.map((c) => `${c.category}:${c.count}`),
      input_snapshot_sha256: snapshotSha256,
    },
    null,
    2,
  ),
);
