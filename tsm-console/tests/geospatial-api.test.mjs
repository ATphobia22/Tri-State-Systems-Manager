import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPoseyAssetResponse } from '../server/geospatial/posey-assets.mjs';

test('Posey terrain request is constrained to EPSG:2966 and the registered AOI', () => {
  const result = buildPoseyAssetResponse('/api/geospatial/posey/raster?kind=terrain&bbox=2680000,940000,2685000,945000&width=1024&height=1024');
  assert.equal(result.contentType, 'image/tiff');
  assert.equal(result.source.sourceUri.includes('Indiana_2016_2020_DEM/ImageServer'), true);
  assert.equal(result.upstream.searchParams.get('bboxSR'), '2966');
  assert.equal(result.upstream.searchParams.get('imageSR'), '2966');
  assert.equal(result.upstream.searchParams.get('pixelType'), 'F32');
});

test('Posey orthophoto request is constrained to the registered NAIP 2020 source', () => {
  const result = buildPoseyAssetResponse('/api/geospatial/posey/raster?kind=orthophoto&bbox=2680000,940000,2685000,945000&width=1024&height=1024');
  assert.equal(result.contentType, 'image/png');
  assert.equal(result.source.sourceUri.includes('NAIP2020_CONUS/ImageServer'), true);
  assert.equal(result.upstream.searchParams.get('format'), 'png32');
});

test('arbitrary AOIs are rejected', () => {
  assert.throws(
    () => buildPoseyAssetResponse('/api/geospatial/posey/raster?kind=terrain&bbox=2679999,940000,2685000,945000'),
    /bbox exceeds the registered Posey site bounds/,
  );
});
