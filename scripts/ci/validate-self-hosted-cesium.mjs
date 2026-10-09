#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const required = [
  ['tsm-console/src/components/CesiumTilesLayer.tsx', [
    ['local Cesium base path', /vendor\/cesium\//],
    ['Cesium 3D Tiles API', /Cesium3DTileset\.fromUrl/],
    ['viewer zooms to the tileset', /viewer\.zoomTo\(tileset\)/],
  ]],
  ['tsm-console/src/routes/CesiumTerrainView.tsx', [
    ['terrain tileset URL', /3d-tiles\/terrain-3dep\/tileset\.json/],
    ['renderer status', /data-renderer-state/],
  ]],
  ['tsm-console/src/routes/PlatformCapabilitiesView.tsx', [
    ['capability index', /Capabilities, packages and operational boundaries/],
  ]],
  ['tsm-console/src/lib/router.tsx', [
    ['3D terrain route', /path: 'terrain-3d'/],
    ['platform index route', /path: 'platform'/],
  ]],
  ['tsm-console/src/components/RootLayout.tsx', [
    ['terrain navigation', /label: '3D Terrain \(3DEP\)'/],
    ['capabilities navigation', /label: 'Platform Capabilities'/],
  ]],
  ['scripts/ci/install-cesium-static.mjs', [
    ['pinned CesiumJS version', /version='1\.146\.0'/],
    ['static runtime asset list', /'Cesium\.js'.*'Workers'.*'ThirdParty'.*'Assets'.*'Widgets'/],
  ]],
  ['.github/workflows/deploy-pages.yml', [
    ['build terrain tiles', /build-terrain-3d-tiles\.py/],
    ['validate terrain tiles', /validate-terrain-3d-tiles\.py/],
    ['vendor Cesium runtime', /install-cesium-static\.mjs/],
    ['verify published Cesium runtime', /vendor\/cesium\/Cesium\.js/],
  ]],
  ['artifacts/tsm-terrain-3d-tiles-v1.json', [
    ['OGC 3D Tiles 1.1 output', /OGC 3D Tiles 1\.1/],
    ['USGS 3DEP source', /USGS 3DEP/],
    ['screening limitation', /not establish survey-grade engineering control/],
  ]],
  ['tsm-console/public/platform-capabilities.json', [
    ['capability manifest artifact type', /tsm\\.platform_capabilities\\.v1/],
    ['public route inventory', /publicRoutes/],
    ['operator skill inventory', /operatorSkills/],
  ]],
  ['data/schemas/tsm-platform-capabilities-v1.schema.json', [
    ['capability manifest schema', /TSM Platform Capabilities Manifest v1/],
    ['schema contract id', /tsm-platform-capabilities-v1/],
  ]],
];

const errors = [];
for (const [path, checks] of required) {
  let source;
  try {
    source = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  } catch (error) {
    errors.push(`${path}: cannot read source (${error instanceof Error ? error.message : String(error)})`);
    continue;
  }
  for (const [label, pattern] of checks) {
    if (!pattern.test(source)) errors.push(`${path}: missing ${label}`);
  }
}

if (errors.length) {
  console.error('Self-hosted Cesium/3D Tiles contract FAILED:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Self-hosted Cesium/3D Tiles contract passed (${required.length} files checked).`);
}
