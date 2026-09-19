#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const file = new URL('../../data/geospatial/terrain-runtime-contract-v1.json', import.meta.url);
const contract = JSON.parse(await readFile(file, 'utf8'));

if (contract.artifact_type !== 'tsm.terrain_runtime_contract.v1') throw new Error('terrain runtime contract type mismatch');
if (contract.browser_source_type !== 'raster-dem') throw new Error('terrain runtime must use MapLibre raster-dem');
if (contract.encoding !== 'mapbox') throw new Error('terrain runtime must use Mapbox Terrain-RGB encoding');
if (contract.tile_size !== 256) throw new Error('terrain tile size must remain 256');
if (contract.runtime_environment_variable !== 'VITE_TSM_TERRAIN_RGB_URL_TEMPLATE') throw new Error('terrain runtime variable mismatch');
if (contract.deployment_status === 'ACTIVE') {
  const endpoint = contract.endpoint;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) throw new Error('active terrain endpoint must be HTTPS');
  if (endpoint.includes('example.invalid')) throw new Error('placeholder terrain endpoint cannot be active');
}
if (contract.required_before_operational_terrain !== true) throw new Error('terrain must remain fail-closed before deployment');
for (const [key, value] of Object.entries(contract.health_requirements ?? {})) {
  if (value !== true) throw new Error('terrain health requirement disabled: ' + key);
}
if (contract.source_metadata?.authority !== 'USGS 3DEP') throw new Error('terrain authority must remain USGS 3DEP');

console.log('terrain runtime contract passed');
