#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { validateFile as validateIgIoHarvest } from './validate-igio-harvest-contract.mjs';

const registry = JSON.parse(await readFile(new URL('../../data/registries/tsm-tri-state-data-fabric-v2.json', import.meta.url)));
const required = ['USGS-3DEP','USGS-TNM-NHDPLUS-HR','FEMA-NFHL','USACE-NLD','USACE-SECTION-204','USDA-NRCS-SSURGO','USDA-NASS-CDL','IND-DNR-INFIP','OVERTURE-MAPS-BUILDINGS','INDIANA-3DEP-QL2-2016-2020','INDIANA-IGIC-LIDAR-DEM-CATALOG','NOAA-OCM-2024-IN-DNR-COASTLINE-10356'];
const ids = new Set(registry.sources.map((source) => source.id));
const missing = required.filter((id) => !ids.has(id));
if (missing.length) {
  console.error('Missing tri-state data-fabric sources:', missing.join(', '));
  process.exit(1);
}
for (const source of registry.sources) {
  if (!/^https:\/\//.test(source.access)) {
    console.error('Non-HTTPS source:', source.id);
    process.exit(1);
  }
}
const byId = new Map(registry.sources.map((source) => [source.id, source]));
const fema = byId.get('FEMA-NFHL');
if (!fema.access.endsWith('/public/NFHL/MapServer')) throw new Error('FEMA-NFHL must use the canonical public NFHL REST MapServer.');
if (!Array.isArray(fema.portalPages) || fema.portalPages.length < 2) throw new Error('FEMA NFHL viewer/search portals must remain discoverable separately from its REST service.');
const overture = byId.get('OVERTURE-MAPS-BUILDINGS');
if (!String(overture.license).startsWith('ODbL-1.0') || !overture.access.includes('overturemaps-py')) throw new Error('Overture source must retain its ODbL attribution and official client path.');
const coast = byId.get('NOAA-OCM-2024-IN-DNR-COASTLINE-10356');
if (coast.overlapWithPrimaryTriStatePilotAOI !== false) throw new Error('NOAA Coastline 10356 must not be treated as covering the primary Lower Wabash/Ohio pilot AOI.');
if (!/GEOID18/.test(coast.metadataSpatialReference) || !/verify each downloaded file/i.test(coast.metadataSpatialReference)) throw new Error('NOAA LiDAR spatial reference must preserve its verification gate.');
if (registry.scope.horizontal_crs !== 'EPSG:2966') throw new Error('Tri-state horizontal engineering frame must remain EPSG:2966.');
if (!/NAVD88/.test(registry.scope.vertical_datum_policy)) throw new Error('Vertical datum policy must explicitly preserve NAVD88 metadata.');
await validateIgIoHarvest();
console.log('Tri-state data-fabric registry and Indiana GIO harvest validation passed.');