import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTnmProducts, select3depProducts } from './usgs-tnm.mjs';

test('normalizes TNM products with bounds, CRS, format and provenance', () => {
  const products = normalizeTnmProducts([{ title: '1m DEM', format: 'GeoTIFF', bbox: [-90, 37, -89, 38], crs: 'EPSG:5070', downloadURL: 'https://example.invalid/dem.tif', publicationDate: '2025-01-01' }], '2026-09-07T12:00:00Z');
  assert.equal(products[0].dataset, '3DEP');
  assert.equal(products[0].format, 'GeoTIFF');
  assert.equal(products[0].crs, 'EPSG:5070');
});

test('selects 3DEP products by resolution and rejects incomplete metadata', () => {
  const products = select3depProducts([
    { title: '10m', format: 'GeoTIFF', bbox: [-90, 37, -89, 38], crs: 'EPSG:5070', downloadURL: 'https://example.invalid/10m.tif', publicationDate: '2025-01-01', resolution: 10 },
    { title: '1m', format: 'GeoTIFF', bbox: [-90, 37, -89, 38], crs: 'EPSG:5070', downloadURL: 'https://example.invalid/1m.tif', publicationDate: '2025-01-01', resolution: 1 },
  ], 1);
  assert.equal(products[0].resolution, 1);
  assert.throws(() => normalizeTnmProducts([{ title: 'bad' }], '2026-09-07T12:00:00Z'), /CRS|bounds|format/i);
});
