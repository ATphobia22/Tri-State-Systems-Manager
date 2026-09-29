#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const registry = JSON.parse(await readFile(new URL('../../data/registries/tsm-tri-state-data-fabric-v2.json', import.meta.url)));
const required = ['USGS-3DEP','USGS-TNM-NHDPLUS-HR','FEMA-NFHL','USACE-NLD','USACE-SECTION-204','USDA-NRCS-SSURGO','USDA-NASS-CDL','IND-DNR-INFIP'];
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
if (registry.scope.horizontal_crs !== 'EPSG:2966') throw new Error('Tri-state horizontal engineering frame must remain EPSG:2966.');
if (!/NAVD88/.test(registry.scope.vertical_datum_policy)) throw new Error('Vertical datum policy must explicitly preserve NAVD88 metadata.');
console.log('Tri-state data-fabric registry validation passed.');