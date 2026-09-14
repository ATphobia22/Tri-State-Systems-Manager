import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const manifestPath = path.join(root, 'artifacts', 'tsm-geospatial-tile-fabric-v1.json');
const schemaPath = path.join(root, 'data', 'schemas', 'geospatial-tile-fabric.schema.json');

test('geospatial tile manifest exists and contains required authoritative layers', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.schemaVersion, '1.0.0');
  const ids = new Set(manifest.assets.map((asset) => asset.id));
  for (const id of [
    'fema-effective',
    'indiana-bafm',
    'indiana-parcels-2025',
    'indiana-parcels-current',
    'indiana-current-imagery',
    'usgs-3dep-terrain',
    'usgs-03378500',
    'noaa-nwps',
    'point-township-historical',
  ]) assert.equal(ids.has(id), true, `missing ${id}`);
});

test('FEMA and Indiana BAFM remain separate authority planes', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const fema = manifest.assets.find((asset) => asset.id === 'fema-effective');
  const bafm = manifest.assets.find((asset) => asset.id === 'indiana-bafm');
  assert.notEqual(fema.authorityClass, bafm.authorityClass);
  assert.equal(fema.provenanceClass, 'FEMA_EFFECTIVE');
  assert.equal(bafm.provenanceClass, 'INDIANA_BAFM');
});

test('historical Point Township evidence cannot become current cadastral truth', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const historical = manifest.assets.find((asset) => asset.id === 'point-township-historical');
  assert.equal(historical.provenanceClass, 'HISTORICAL_COMMUNITY_EVIDENCE');
  assert.equal(historical.currentTruth, false);
  assert.equal(historical.layerType, 'historical-raster');
});

test('every production asset declares CRS and vertical datum policy', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const asset of manifest.assets) {
    assert.equal(typeof asset.crs, 'string', `${asset.id} CRS missing`);
    assert.equal(typeof asset.verticalDatum, 'string', `${asset.id} vertical datum missing`);
    assert.equal(typeof asset.verification, 'object', `${asset.id} verification missing`);
  }
});

test('JSON schema is present and declares the tile asset contract', () => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.equal(schema.$id, 'https://tri-state-systems-manager.org/schemas/geospatial-tile-fabric.schema.json');
  assert.ok(schema.properties.assets);
  assert.ok(schema.$defs.GeospatialTileAsset);
});
