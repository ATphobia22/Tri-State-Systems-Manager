import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const manifestPath = path.join(root, 'artifacts', 'tsm-geospatial-tile-fabric-v1.json');
const schemaPath = path.join(root, 'data', 'schemas', 'geospatial-tile-fabric.schema.json');
const liveRegistryPath = path.join(root, 'data', 'fabrics', 'live', 'tsm-live-hydrology-fabric-v1.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const liveRegistry = JSON.parse(fs.readFileSync(liveRegistryPath, 'utf8'));

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

const required = ['fema-effective', 'indiana-bafm', 'indiana-parcels-2025', 'indiana-current-imagery', 'usgs-3dep-terrain', 'usgs-03378500'];

// NOAA NWPS is configured only for user-triggered snapshots. Its forecast tile
// remains pending until the forecast-specific adapter and provenance checks pass.
const noaaNwps = manifest.assets.find((asset) => asset.id === 'noaa-nwps');
const noaaRegistryEntry = liveRegistry.sources.find((source) => source.id === 'NOAA_NWPS');
const noaaNwmRegistryEntry = liveRegistry.sources.find((source) => source.id === 'NOAA_NWM');
const usgsRegistryEntry = liveRegistry.sources.find((source) => source.id === 'USGS_WATERDATA');

for (const [id, source] of [['NOAA_NWPS', noaaRegistryEntry], ['USGS_WATERDATA', usgsRegistryEntry]]) {
  if (source?.status !== 'active') errors.push(`${id} must be active in the on-demand source registry`);
  if (source?.activationMode !== 'user_triggered') errors.push(`${id} must require explicit user-triggered snapshots`);
  if (source?.automaticPolling !== false) errors.push(`${id} must prohibit automatic polling`);
  if (source?.runtimeVerification !== 'PENDING_LIVE_SNAPSHOT_RECEIPT') {
    errors.push(`${id} must not claim runtime availability without a captured live snapshot receipt`);
  }
}
if (liveRegistry.controls?.automatic_polling_prohibited !== true) {
  errors.push('live hydrology registry must prohibit automatic polling');
}
if (noaaNwmRegistryEntry?.status !== 'retired') {
  errors.push('NOAA_NWM experimental model guidance must remain retired until independently validated');
}
if (!noaaNwps) {
  errors.push('noaa-nwps forecast asset is missing');
} else {
  if (noaaNwps.status !== 'PROGRAM_PENDING') errors.push('noaa-nwps forecast tile must remain PROGRAM_PENDING');
  if (noaaNwps.currentTruth !== false) errors.push('noaa-nwps forecast tile must not be current truth');
  if (noaaNwps.verification?.state !== 'PENDING') errors.push('noaa-nwps forecast tile must remain unverified until end-to-end checks pass');
}
for (const id of required) if (!ids.has(id)) errors.push(`required layer missing: ${id}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Geospatial tile fabric healthy: ${manifest.assets.length} assets validated.`);
