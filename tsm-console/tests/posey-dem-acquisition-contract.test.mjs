import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import testRunner from 'node:test';

const manifestPath = new URL('../../data/posey-county/elevation/posey-dem-tile-manifest-2020.json', import.meta.url);
const downloaderPath = new URL('../../scripts/posey/download-dem-tiles.ps1', import.meta.url);
const researchPath = new URL('../../docs/geospatial/POSEY-DEM-OPEN-GIS-RESEARCH-2026-10-19.md', import.meta.url);

testRunner('Posey DEM manifest and downloader fail closed on unregistered tiles and oversized requests', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const downloader = await readFile(downloaderPath, 'utf8');
  assert.equal(manifest.tile_count, manifest.tiles.length);
  assert.equal(manifest.tile_count, 581);
  assert.ok(manifest.tiles.length > 0);

  const filenames = new Set();
  for (const tile of manifest.tiles) {
    assert.match(tile.filename, /^IN20(?:18|19|20)_[A-Za-z0-9_.-]+\.tif$/);
    assert.ok(!filenames.has(tile.filename), `duplicate tile ${tile.filename}`);
    filenames.add(tile.filename);
    assert.match(tile.urlpath, /^https:\/\/gisimageryingov\.s3\.us-east-2\.amazonaws\.com\/demoptimized\/statewide\/20(?:19|20)\/SPW\/2\.5ft\/[A-Za-z0-9_.-]+\.tif$/);
    assert.ok([2019, 2020].includes(tile.image_year));
  }

  assert.match(downloader, /-AllPoseyTiles/);
  assert.match(downloader, /MaxTiles = 25/);
  assert.match(downloader, /Get-FileHash -LiteralPath \$dest -Algorithm SHA256/);
  assert.match(downloader, /Refusing URL outside the expected Indiana DEM S3 path/);
  assert.match(downloader, /driver cog validate/);
  assert.match(downloader, /download-receipt\.json/);
});

testRunner('Posey DEM research documents authority separation and open GIS processing', async () => {
  const research = await readFile(researchPath, 'utf8');
  for (const required of [
    'proprietary commercial reference',
    'IndianaMap DEM dataset',
    'USGS National Map Downloader',
    'QGIS',
    'GRASS GIS',
    'GDAL',
    'vertical datum',
    'FEMA NFHL is regulatory evidence',
    'Do not commit bulk county raster data by default',
  ]) assert.ok(research.includes(required), `research missing requirement: ${required}`);
});
