#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const registryPath = 'config/lidar_registry.json';
const toolchainPath = 'config/geospatial_toolchain.json';

const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const toolchain = JSON.parse(await readFile(toolchainPath, 'utf8'));

if (!registry.dataset_id || registry.scope !== 'community') throw new Error('LiDAR registry must be community scoped.');
if (!Array.isArray(registry.tiles) || registry.tiles.length < 1) throw new Error('LiDAR registry must define at least one registered tile.');
for (const tile of registry.tiles) {
  if (!/^IN2020_[0-9]+_[0-9]+\.las$/.test(tile.tile_id)) throw new Error(`Invalid LAS tile id: ${tile.tile_id}`);
  if (!String(tile.s3_path).startsWith('s3://giselevationingov/')) throw new Error(`Unexpected LiDAR URI: ${tile.s3_path}`);
}

if (registry.site_parameters?.status !== 'PROJECT_SPECIFIC_SURVEY_REQUIRED') throw new Error('Community LiDAR registry must require project-specific survey evidence.');
if (registry.site_parameters?.base_flood_elevation_navd88_ft !== null || registry.site_parameters?.lowest_adjacent_grade_navd88_ft !== null) {
  throw new Error('Private/site-specific elevation targets must not be embedded in the community LiDAR registry.');
}
if (toolchain.policy?.raw_lidar_committed !== false) throw new Error('Raw LiDAR must remain external to Git.');
if (toolchain.policy?.source_provenance_required !== true) throw new Error('Source provenance must remain mandatory.');

console.log(`Geospatial processing contract valid: ${registry.dataset_id}`);
console.log(`Registered community LAS tiles: ${registry.tiles.length}`);
console.log('Project-specific survey and engineering geometry remain required before design conclusions.');
