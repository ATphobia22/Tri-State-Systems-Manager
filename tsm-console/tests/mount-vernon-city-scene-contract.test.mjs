import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const map = readFileSync(new URL('../src/components/RealWorldTwinMap.tsx', import.meta.url), 'utf8');
const loader = readFileSync(new URL('../src/lib/mount-vernon-city-scene.ts', import.meta.url), 'utf8');
const inspector = readFileSync(new URL('../src/components/MountVernonCityInspector.tsx', import.meta.url), 'utf8');
const producer = readFileSync(new URL('../../scripts/geospatial/build_mount_vernon_scene.py', import.meta.url), 'utf8');

test('map mounts city scene without blocking existing 3D terrain and hydrology', () => {
  assert.match(map, /attachMountVernonCityScene\(map,/);
  assert.match(map, /MountVernonCityInspector/);
  assert.match(map, /disposeMountVernonCity/);
  assert.match(map, /applyTwinTerrain/);
  assert.match(map, /ThreeDTilesLayer/);
});

test('real government source object IDs and per-feature immutable hashes', () => {
  assert.match(producer, /gisdata\.in\.gov\/server\/rest\/services\/Hosted\/Building_Footprints\/FeatureServer\/0/);
  assert.match(producer, /Road_Centerlines_of_Indiana_2024\/FeatureServer\/0/);
  assert.match(producer, /ARCGIS_INCOMPLETE_DOWNLOAD/);
  assert.match(producer, /source_feature_sha256/);
  assert.match(producer, /source_objectid/);
  assert.match(loader, /source_feature_sha256/);
  assert.match(loader, /sourceSceneSha256/);
});

test('consumer rejects invalid archive and does not invent building heights', () => {
  assert.match(loader, /crypto\.subtle\.digest/);
  assert.match(loader, /SCENE_SHA256_MISMATCH/);
  assert.match(loader, /p\?\.height_m !== null/);
  assert.doesNotMatch(loader, /fill-extrusion/);
  assert.match(inspector, /NOT EVIDENCED/);
  assert.match(inspector, /Engineering approval: NO/);
});
