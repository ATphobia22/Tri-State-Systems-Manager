#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const registryPath = 'config/lidar_registry.json';
const pipelinePath = 'pipelines/pdal/bone_earth_crop.json';
const toolchainPath = 'config/geospatial_toolchain.json';

const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const pipeline = JSON.parse(await readFile(pipelinePath, 'utf8'));
const toolchain = JSON.parse(await readFile(toolchainPath, 'utf8'));

if (!registry.dataset_id || !Array.isArray(registry.primary_tiles) || registry.primary_tiles.length !== 1) {
  throw new Error('LiDAR registry must define exactly one primary tile.');
}

const allTiles = [...registry.primary_tiles, ...(registry.adjacent_tiles ?? [])];
if (allTiles.length < 4) throw new Error('LiDAR registry must define the four registered processing tiles.');
for (const tile of allTiles) {
  if (!/^IN2020_[0-9]+_[0-9]+\.las$/.test(tile.tile_id)) throw new Error(`Invalid LAS tile id: ${tile.tile_id}`);
  if (!String(tile.s3_path).startsWith('s3://giselevationingov/')) throw new Error(`Unexpected LiDAR URI: ${tile.s3_path}`);
}

const stages = pipeline.pipeline ?? [];
const stageTypes = stages.map((stage) => typeof stage === 'string' ? 'reader' : stage.type);
for (const required of ['filters.merge', 'filters.expression', 'filters.reprojection', 'filters.crop', 'writers.las', 'writers.gdal']) {
  if (!stageTypes.includes(required)) throw new Error(`PDAL pipeline missing required stage: ${required}`);
}

const reprojection = stages.find((stage) => stage?.type === 'filters.reprojection');
if (reprojection?.out_srs !== 'EPSG:6345') throw new Error('PDAL output CRS must be EPSG:6345.');
const crop = stages.find((stage) => stage?.type === 'filters.crop');
if (crop?.a_srs !== 'EPSG:6345' || crop?.distance !== 15.24) {
  throw new Error('PDAL crop must use EPSG:6345 and a 15.24 m (50 ft) radius.');
}

if (toolchain.policy?.raw_lidar_committed !== false) throw new Error('Raw LiDAR must remain external to Git.');
if (toolchain.policy?.source_provenance_required !== true) throw new Error('Source provenance must remain mandatory.');

console.log(`Geospatial processing contract valid: ${registry.dataset_id}`);
console.log(`Registered LAS tiles: ${allTiles.length}`);
console.log('PDAL pipeline: EPSG:2966 input → Class 2 ground → EPSG:6345 → 50 ft crop → LAS + 0.5 ft DEM');
