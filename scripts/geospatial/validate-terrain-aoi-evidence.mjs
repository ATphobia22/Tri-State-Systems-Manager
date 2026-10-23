#!/usr/bin/env node
/**
 * Validate a measured terrain AOI/source evidence manifest.
 *
 * This script validates evidence supplied by actual data inspection; it does
 * not infer coverage, nodata, CRS, datum, epoch, or checksums from filenames.
 *
 * Usage:
 *   node scripts/geospatial/validate-terrain-aoi-evidence.mjs <manifest.json> [report.json]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const REQUIRED_SOURCE_FIELDS = [
  'sourceId', 'sourceUrl', 'horizontalCrs', 'verticalDatum', 'units',
  'accuracyClass', 'sha256', 'coverageFraction', 'nodataFraction',
];

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function fraction(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateTerrainAoiManifest(manifest) {
  const errors = [];
  const missingFields = {};
  const sources = Array.isArray(manifest?.sources) ? manifest.sources : [];
  const aoi = manifest?.aoi;

  if (manifest?.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (!aoi || typeof aoi !== 'object') {
    errors.push('aoi object is required; an address alone is not an AOI');
  } else {
    if (typeof aoi.id !== 'string' || !aoi.id.trim()) errors.push('aoi.id is required');
    if (typeof aoi.horizontalCrs !== 'string' || !/^EPSG:\\d+$/.test(aoi.horizontalCrs)) {
      errors.push('aoi.horizontalCrs must be an explicit EPSG identifier');
    }
    if (!Array.isArray(aoi.bbox) || aoi.bbox.length !== 4 ||
        !aoi.bbox.every(Number.isFinite) || aoi.bbox[0] >= aoi.bbox[2] || aoi.bbox[1] >= aoi.bbox[3]) {
      errors.push('aoi.bbox must be [minX,minY,maxX,maxY] with positive area in the declared CRS');
    }
    if (!isSha256(aoi.geometrySha256)) errors.push('aoi.geometrySha256 must bind the approved AOI geometry bytes');
  }
  if (!isSha256(manifest?.catalogSnapshotSha256)) {
    errors.push('catalogSnapshotSha256 must bind the exact source catalog snapshot');
  }
  if (sources.length === 0) errors.push('sources must contain measured source records; empty is not coverage');

  let coverageSum = 0;
  let nodataWeightedSum = 0;
  let measuredCoverageCount = 0;
  const sourceReports = sources.map((source, index) => {
    const missing = REQUIRED_SOURCE_FIELDS.filter((field) => {
      const value = source?.[field];
      return value === undefined || value === null || value === '';
    });
    for (const field of missing) missingFields[field] = (missingFields[field] ?? 0) + 1;
    const sourceErrors = [];
    if (!source || typeof source !== 'object') {
      sourceErrors.push('source record must be an object');
    } else {
      if (source.sha256 && !isSha256(source.sha256)) sourceErrors.push('sha256 must be a 64-character hex digest');
      if (source.coverageFraction !== undefined && !fraction(source.coverageFraction)) {
        sourceErrors.push('coverageFraction must be within [0,1]');
      }
      if (source.nodataFraction !== undefined && !fraction(source.nodataFraction)) {
        sourceErrors.push('nodataFraction must be within [0,1]');
      }
      if (source.coordinateEpoch !== null && source.coordinateEpoch !== undefined &&
          (!Number.isFinite(source.coordinateEpoch) || source.coordinateEpoch < 1900 || source.coordinateEpoch > 2100)) {
        sourceErrors.push('coordinateEpoch must be a decimal year in [1900,2100] or null when not applicable');
      }
      if (source.units !== undefined && !['meters', 'feet'].includes(source.units)) {
        sourceErrors.push('units must be meters or feet');
      }
      if (source.acquisitionDate !== undefined && source.acquisitionDate !== null &&
          Number.isNaN(Date.parse(source.acquisitionDate))) {
        sourceErrors.push('acquisitionDate must be ISO-compatible or null');
      }
    }
    if (source && fraction(source.coverageFraction) && fraction(source.nodataFraction)) {
      coverageSum += source.coverageFraction;
      nodataWeightedSum += source.coverageFraction * source.nodataFraction;
      measuredCoverageCount++;
    }
    return { index, sourceId: source?.sourceId ?? null, missingFields: missing, errors: sourceErrors };
  });

  const missingCount = sourceReports.reduce((sum, source) => sum + source.missingFields.length, 0);
  const sourceErrorCount = sourceReports.reduce((sum, source) => sum + source.errors.length, 0);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: errors.length === 0 && missingCount === 0 && sourceErrorCount === 0 ? 'VALIDATED_INPUT_EVIDENCE' : 'INCOMPLETE',
    aoiId: aoi?.id ?? null,
    catalogSnapshotSha256: manifest?.catalogSnapshotSha256 ?? null,
    sourceCount: sources.length,
    sourcesWithMeasuredCoverage: measuredCoverageCount,
    missingFieldCounts: missingFields,
    sourceReports,
    errors,
    metrics: {
      // This is a per-source sum, not a unique AOI area coverage percentage.
      // Overlapping source footprints must be spatially unioned by a GIS tool.
      sumOfSourceCoverageFractions: measuredCoverageCount ? coverageSum : null,
      coverageWeightedNodataFraction: coverageSum > 0 ? nodataWeightedSum / coverageSum : null,
      uniqueAoiCoverageFraction: null,
      note: 'Unique AOI coverage requires a GIS footprint union and raster nodata analysis; it is never inferred by summing source fractions.',
    },
  };
  return report;
}

export function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg) {
    console.error('Usage: node scripts/geospatial/validate-terrain-aoi-evidence.mjs <manifest.json> [report.json]');
    process.exitCode = 2;
    return;
  }
  const manifest = JSON.parse(await readFile(resolve(inputArg), 'utf8'));
  const report = validateTerrainAoiManifest(manifest);
  const json = JSON.stringify(report, null, 2) + '\\n';
  if (outputArg) await writeFile(resolve(outputArg), json, 'utf8');
  else process.stdout.write(json);
  if (report.status !== 'VALIDATED_INPUT_EVIDENCE') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}
