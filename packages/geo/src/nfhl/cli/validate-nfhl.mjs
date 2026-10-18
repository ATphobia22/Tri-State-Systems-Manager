#!/usr/bin/env node
/**
 * Live FEMA NFHL MapServer drift detector — zero-deps Node CLI for CI.
 * Does not require tsx or root npm install.
 *
 * Usage: node packages/geo/src/nfhl/cli/validate-nfhl.mjs
 * Exit 1 on layer count / geometry / missing ID drift.
 */

const SERVICE_URL =
  'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=pjson';

const NFHL_EXPECTED_COUNTS = {
  total: 32,
  polygon: 12,
  polyline: 12,
  point: 8,
};

const NFHL_EXPECTED_LAYERS = [
  { id: 0, name: 'NFHL Availability', geometryType: 'Polygon' },
  { id: 1, name: 'LOMRs', geometryType: 'Polygon' },
  { id: 3, name: 'FIRM Panels', geometryType: 'Polygon' },
  { id: 4, name: 'Base Index', geometryType: 'Polygon' },
  { id: 5, name: 'PLSS', geometryType: 'Polygon' },
  { id: 6, name: 'Topographic Low Confidence Areas', geometryType: 'Polygon' },
  { id: 22, name: 'Political Jurisdictions', geometryType: 'Polygon' },
  { id: 28, name: 'Flood Hazard Zones', geometryType: 'Polygon' },
  { id: 29, name: 'Seclusion Boundaries', geometryType: 'Polygon' },
  { id: 30, name: 'Alluvial Fans', geometryType: 'Polygon' },
  { id: 31, name: 'Subbasins', geometryType: 'Polygon' },
  { id: 32, name: 'Water Areas', geometryType: 'Polygon' },
  { id: 14, name: 'Cross-Sections', geometryType: 'Polyline' },
  { id: 15, name: 'Coastal Transects', geometryType: 'Polyline' },
  { id: 16, name: 'Base Flood Elevations', geometryType: 'Polyline' },
  { id: 17, name: 'Profile Baselines', geometryType: 'Polyline' },
  { id: 18, name: 'Transect Baselines', geometryType: 'Polyline' },
  { id: 19, name: 'Limit of Moderate Wave Action', geometryType: 'Polyline' },
  { id: 20, name: 'Water Lines', geometryType: 'Polyline' },
  { id: 23, name: 'Levees', geometryType: 'Polyline' },
  { id: 24, name: 'General Structures', geometryType: 'Polyline' },
  { id: 25, name: 'Primary Frontal Dunes', geometryType: 'Polyline' },
  { id: 26, name: 'Hydrologic Reaches', geometryType: 'Polyline' },
  { id: 27, name: 'Flood Hazard Boundaries', geometryType: 'Polyline' },
  { id: 7, name: 'River Mile Markers', geometryType: 'Point' },
  { id: 8, name: 'Datum Conversion Points', geometryType: 'Point' },
  { id: 9, name: 'Coastal Gages', geometryType: 'Point' },
  { id: 10, name: 'Gages', geometryType: 'Point' },
  { id: 11, name: 'Nodes', geometryType: 'Point' },
  { id: 12, name: 'High Water Marks', geometryType: 'Point' },
  { id: 13, name: 'Station Start Points', geometryType: 'Point' },
  { id: 34, name: 'LOMAs', geometryType: 'Point' },
];

function mapGeometry(arcgisType) {
  switch (arcgisType) {
    case 'esriGeometryPolygon':
      return 'Polygon';
    case 'esriGeometryPolyline':
      return 'Polyline';
    case 'esriGeometryPoint':
      return 'Point';
    default:
      return arcgisType ?? 'unknown';
  }
}

async function validateLiveNfhl() {
  const warnings = [];
  const errors = [];
  const checkedAt = new Date().toISOString();

  const response = await fetch(SERVICE_URL);
  if (!response.ok) {
    throw new Error(`NFHL request failed ${response.status}`);
  }

  const service = await response.json();
  const layers = service.layers ?? [];

  const actualCounts = { Polygon: 0, Polyline: 0, Point: 0 };
  for (const layer of layers) {
    const g = mapGeometry(layer.geometryType);
    if (g === 'Polygon') actualCounts.Polygon++;
    else if (g === 'Polyline') actualCounts.Polyline++;
    else if (g === 'Point') actualCounts.Point++;
  }

  if (layers.length !== NFHL_EXPECTED_COUNTS.total) {
    errors.push(
      `Layer count mismatch. Expected ${NFHL_EXPECTED_COUNTS.total}. Actual ${layers.length}`,
    );
  }
  if (actualCounts.Polygon !== NFHL_EXPECTED_COUNTS.polygon) {
    errors.push(
      `Polygon count mismatch. Expected ${NFHL_EXPECTED_COUNTS.polygon}. Actual ${actualCounts.Polygon}`,
    );
  }
  if (actualCounts.Polyline !== NFHL_EXPECTED_COUNTS.polyline) {
    errors.push(
      `Polyline count mismatch. Expected ${NFHL_EXPECTED_COUNTS.polyline}. Actual ${actualCounts.Polyline}`,
    );
  }
  if (actualCounts.Point !== NFHL_EXPECTED_COUNTS.point) {
    errors.push(
      `Point count mismatch. Expected ${NFHL_EXPECTED_COUNTS.point}. Actual ${actualCounts.Point}`,
    );
  }

  const serverLookup = new Map(layers.map((layer) => [layer.id, layer]));

  for (const exp of NFHL_EXPECTED_LAYERS) {
    const actual = serverLookup.get(exp.id);
    if (!actual) {
      errors.push(`Missing layer ${exp.id} (${exp.name})`);
      continue;
    }
    if (actual.name !== exp.name) {
      warnings.push(
        `Name mismatch for ${exp.id}: expected "${exp.name}" actual "${actual.name}"`,
      );
    }
    const actualGeometry = mapGeometry(actual.geometryType);
    if (actualGeometry !== exp.geometryType) {
      errors.push(
        `Geometry mismatch for ${exp.id}: expected ${exp.geometryType} actual ${actualGeometry}`,
      );
    }
  }

  const expectedIds = new Set(NFHL_EXPECTED_LAYERS.map((l) => l.id));
  for (const layer of layers) {
    if (!expectedIds.has(layer.id)) {
      warnings.push(`Unexpected server layer ${layer.id} (${layer.name})`);
    }
  }

  return {
    kind: 'NFHL_METADATA_DRIFT_CHECK',
    authority_class: 'REGULATORY_DISPLAY',
    valid: errors.length === 0,
    warnings,
    errors,
    checkedAt,
    actualTotal: layers.length,
    expectedTotal: NFHL_EXPECTED_COUNTS.total,
  };
}

const result = await validateLiveNfhl();
console.log(JSON.stringify(result, null, 2));
if (!result.valid) {
  process.exit(1);
}
