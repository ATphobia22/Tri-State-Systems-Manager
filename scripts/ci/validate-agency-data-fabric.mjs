import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const file = path.join(root, 'tsm-native', 'config', 'agency-data-fabric-contract.json');
const contract = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];

if (contract.schemaVersion !== 1) errors.push('agency data-fabric schemaVersion must be 1');
if (contract.inventedAuthoritativeDataAllowed !== false) errors.push('invented authoritative data must be disabled');

const requiredDomains = [
  'authority_registry', 'hydrologic_observation', 'forecast', 'terrain_elevation',
  'geospatial_topology', 'regulatory_reference', 'engineering_model',
  'simulation_scenario', 'evidence_artifact', 'presentation_asset', 'runtime_snapshot'
];

const domains = new Map((contract.domains || []).map((d) => [d.name, d]));
for (const name of requiredDomains) {
  if (!domains.has(name)) errors.push('missing data-fabric domain: ' + name);
}

const requiredFields = new Set(contract.recordContract?.required || []);
for (const field of ['recordId','datasetId','sourceVersion','retrievedAtUtc','contentSha256','lineage','governanceStatus']) {
  if (!requiredFields.has(field)) errors.push('missing required record field: ' + field);
}

for (const field of ['sourceUri','sourceRecordId','transformationId','transformationVersion']) {
  if (!(contract.recordContract?.lineageRequired || []).includes(field)) {
    errors.push('missing lineage field: ' + field);
  }
}

for (const name of [
  'hydrologic_observation','forecast','terrain_elevation','geospatial_topology',
  'regulatory_reference','engineering_model','simulation_scenario','evidence_artifact'
]) {
  if (domains.get(name)?.provenanceRequired !== true) errors.push(name + ' must require provenance');
}

if (domains.get('runtime_snapshot')?.sha256ManifestRequired !== true) {
  errors.push('runtime_snapshot must require SHA-256 manifest');
}
if (domains.get('geospatial_topology')?.geometryValidityRequired !== true) {
  errors.push('geospatial_topology must require geometry validity');
}
if (domains.get('terrain_elevation')?.verticalDatumRequired !== true) {
  errors.push('terrain_elevation must require vertical datum');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Agency data-fabric contract: PASS (' + domains.size + ' domains)');
