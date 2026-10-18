import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const manifestPath = path.join(root, 'artifacts', 'tsm-geospatial-tile-fabric-v1.json');
const schemaPath = path.join(root, 'data', 'schemas', 'geospatial-tile-fabric.schema.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const errors = [];
const ids = new Set();
for (const asset of manifest.assets) {
  if (ids.has(asset.id)) errors.push(`duplicate layer id: ${asset.id}`);
  ids.add(asset.id);
  for (const field of ['sourceUrl', 'crs', 'verticalDatum', 'tileScheme', 'provenanceClass']) {
    if (typeof asset[field] !== 'string' || asset[field].length === 0) errors.push(`${asset.id}: missing ${field}`);
  }
  if (!asset.verification?.checkedAt) errors.push(`${asset.id}: missing verification timestamp`);
  if (asset.status === 'PROGRAM_PENDING' && asset.currentTruth) errors.push(`${asset.id}: program-pending source cannot be current truth`);
  if (asset.provenanceClass === 'HISTORICAL_COMMUNITY_EVIDENCE' && asset.currentTruth) errors.push(`${asset.id}: historical evidence cannot be current truth`);
}

const fema = manifest.assets.find((asset) => asset.id === 'fema-effective');
const indianaBafm = manifest.assets.find((asset) => asset.id === 'indiana-bafm');
if (fema && indianaBafm && (fema.authorityClass === indianaBafm.authorityClass || fema.provenanceClass === indianaBafm.provenanceClass)) {
  errors.push('FEMA effective mapping and Indiana Best Available mapping must retain distinct authority and provenance classes');
}

const required = ['fema-effective', 'indiana-bafm', 'indiana-parcels-2025', 'indiana-current-imagery', 'usgs-3dep-terrain', 'usgs-03378500', 'noaa-nwps'];
for (const id of required) if (!ids.has(id)) errors.push(`required layer missing: ${id}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Geospatial tile fabric healthy: ${manifest.assets.length} assets validated.`);
