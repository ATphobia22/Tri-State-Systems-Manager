#!/usr/bin/env node
/**
 * Emit CRS / vertical-datum evidence report against TSM supported catalog.
 * Usage: node scripts/geospatial/crs-vertical-datum-evidence-report.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const modPath = join(root, 'tsm-console/src/lib/crs-vertical-datum-evidence.ts');

const {
  buildCrsDatumEvidenceReport,
  TSM_SUPPORTED_SOURCE_CATALOG,
} = await import(pathToFileURL(modPath).href);

const report = buildCrsDatumEvidenceReport(TSM_SUPPORTED_SOURCE_CATALOG);
const outDir = join(root, 'data/geospatial');
mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, 'crs-vertical-datum-evidence-report-v1.json');
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

const md = [
  '# CRS and vertical-datum evidence report',
  '',
  `Generated: ${report.generated_at}`,
  '',
  `| Metric | Count |`,
  `| --- | ---: |`,
  `| Sources | ${report.source_count} |`,
  `| Complete | ${report.complete_count} |`,
  `| Incomplete | ${report.incomplete_count} |`,
  `| Missing critical | ${report.missing_critical_count} |`,
  '',
  '## Per-source',
  '',
  '| id | CRS | Datum | Status | Missing |',
  '| --- | --- | --- | --- | --- |',
  ...report.sources.map(
    (s) =>
      `| ${s.id} | ${s.horizontalCrs ?? '—'} | ${s.verticalDatum ?? '—'} | ${s.status} | ${s.missing.join(', ') || '—'} |`,
  ),
  '',
  '## Notes',
  '',
  ...report.notes.map((n) => `- ${n}`),
  '',
  '**Human authority remains final.**',
  '',
].join('\n');

const mdPath = join(root, 'docs/gpu/CRS-VERTICAL-DATUM-EVIDENCE-2026-10-23.md');
mkdirSync(dirname(mdPath), { recursive: true });
writeFileSync(mdPath, md);

console.log(JSON.stringify({ ok: true, jsonPath, mdPath, missing_critical: report.missing_critical_count }, null, 2));
