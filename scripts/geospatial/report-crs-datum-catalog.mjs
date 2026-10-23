#!/usr/bin/env node
/**
 * Emit a complete declared-CRS/datum/epoch/units/accuracy inventory for the
 * Tri-State terrain source catalog. This reports omissions explicitly; it
 * never infers a vertical datum from horizontal CRS or fills metadata by guess.
 *
 * Usage: node scripts/geospatial/report-crs-datum-catalog.mjs <output.json>
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const catalogPath = resolve(root, 'data/registries/tsm-tri-state-data-fabric-v2.json');
const inputBytes = await readFile(catalogPath);
const catalog = JSON.parse(inputBytes.toString('utf8'));

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
function validEpoch(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1900 && value <= 2100;
}
function datumStatus(source) {
  if (nonEmpty(source.verticalDatum)) return { status: 'declared', value: source.verticalDatum };
  if (nonEmpty(source.datum) && /(?:vertical\s*:\s*|NAVD\s*88|NGVD\s*29|ellipsoid(?:al)? height)/i.test(source.datum)) {
    return { status: 'declared_in_datum_text', value: source.datum };
  }
  return { status: 'missing_or_unverified', value: null };
}
function epochStatus(source) {
  if (validEpoch(source.coordinateEpoch)) return { status: 'declared', value: source.coordinateEpoch };
  if (nonEmpty(source.coordinateEpochNotApplicableReason)) {
    return { status: 'documented_not_applicable', value: null, reason: source.coordinateEpochNotApplicableReason };
  }
  return { status: 'missing_or_unverified', value: null };
}

if (!Array.isArray(catalog.sources) || catalog.sources.length === 0) {
  throw new Error('Tri-State source catalog must contain a non-empty sources array');
}
const records = catalog.sources.map((source, index) => {
  if (!source || typeof source !== 'object' || !nonEmpty(source.id)) {
    throw new Error(`Invalid catalog source record at index ${index}: an id is required`);
  }
  const crs = nonEmpty(source.horizontalCrs) ? source.horizontalCrs : (nonEmpty(source.crs) ? source.crs : null);
  const datum = datumStatus(source);
  const epoch = epochStatus(source);
  const units = nonEmpty(source.units) ? source.units : null;
  const accuracy = nonEmpty(source.accuracyClass) ? source.accuracyClass : (nonEmpty(source.accuracy) ? source.accuracy : null);
  const vintage = nonEmpty(source.vintage) ? source.vintage : (nonEmpty(source.acquisitionVintage) ? source.acquisitionVintage : null);
  const metadata = {
    horizontalCrs: { status: crs ? 'declared' : 'missing_or_unverified', value: crs },
    horizontalDatum: {
      status: nonEmpty(source.horizontalDatum) || (nonEmpty(source.datum) && /horizontal\s*:/i.test(source.datum)) ? 'declared' : 'missing_or_unverified',
      value: source.horizontalDatum ?? (nonEmpty(source.datum) && /horizontal\s*:/i.test(source.datum) ? source.datum : null),
    },
    verticalDatum: datum,
    coordinateEpoch: epoch,
    units: { status: units ? 'declared' : 'missing_or_unverified', value: units },
    accuracyClass: { status: accuracy ? 'declared' : 'missing_or_unverified', value: accuracy },
    acquisitionVintage: { status: vintage ? 'declared' : 'missing_or_unverified', value: vintage },
    contentHash: { status: nonEmpty(source.sha256) && /^[a-f0-9]{64}$/i.test(source.sha256) ? 'declared_sha256' : 'missing_or_unverified', value: source.sha256 ?? null },
  };
  return {
    id: source.id,
    authority: source.authority ?? null,
    dataset: source.dataset ?? null,
    access: source.access ?? source.url ?? null,
    metadata,
    missingOrUnverifiedFields: Object.entries(metadata)
      .filter(([, value]) => value.status === 'missing_or_unverified')
      .map(([field]) => field),
    note: 'Catalog declaration only; not independent validation of each downloaded asset.',
  };
});

const fieldNames = ['horizontalCrs', 'horizontalDatum', 'verticalDatum', 'coordinateEpoch', 'units', 'accuracyClass', 'acquisitionVintage', 'contentHash'];
const counts = Object.fromEntries(fieldNames.map((field) => [field, {
  declared: records.filter((record) => ['declared', 'declared_in_datum_text', 'documented_not_applicable', 'declared_sha256'].includes(record.metadata[field].status)).length,
  missingOrUnverified: records.filter((record) => record.metadata[field].status === 'missing_or_unverified').length,
}]));
const report = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  status: records.every((record) => record.missingOrUnverifiedFields.length === 0) ? 'CATALOG_METADATA_COMPLETE_DECLARATIVELY' : 'INCOMPLETE_METADATA',
  releaseGate: records.every((record) => record.missingOrUnverifiedFields.length === 0) ? 'REVIEW_REQUIRED_FOR_ASSET_VERIFICATION' : 'OPEN',
  catalog: {
    id: catalog.$id ?? null,
    version: catalog.version ?? null,
    path: 'data/registries/tsm-tri-state-data-fabric-v2.json',
    sha256: sha256(inputBytes),
    sourceCount: records.length,
    horizontalEngineeringCrsPolicy: catalog.scope?.horizontal_crs ?? null,
    verticalDatumPolicy: catalog.scope?.vertical_datum_policy ?? null,
  },
  countsByField: counts,
  sources: records,
  limitations: [
    'A declared CRS or datum is not evidence that a particular downloaded asset uses it.',
    'A horizontal CRS does not establish a vertical datum or coordinate epoch.',
    'Missing metadata remains missing; this report does not invent values or claim transformations were validated.',
    'This catalog inventory does not calculate AOI footprint unions, raster NoData, or control-point transformation residuals.',
  ],
};
const outputPath = resolve(process.argv[2] ?? 'crs-datum-catalog-report.json');
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  outputPath,
  catalogSha256: report.catalog.sha256,
  sourceCount: report.catalog.sourceCount,
  status: report.status,
  releaseGate: report.releaseGate,
  countsByField: report.countsByField,
}, null, 2));
