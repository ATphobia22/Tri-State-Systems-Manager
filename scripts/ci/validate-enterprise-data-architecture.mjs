import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const files = {
  architecture: 'architecture/contracts/enterprise-data-architecture.json',
  glossary: 'architecture/contracts/business-glossary.json',
  product: 'architecture/contracts/data-product-contract.json',
  metadata: 'architecture/contracts/metadata-catalog.json',
  logical: 'architecture/contracts/logical-data-model.json',
  dictionary: 'architecture/contracts/data-dictionary.json',
  physical: 'architecture/contracts/physical-data-model.json',
};

const errors = [];
const docs = {};
for (const [key, relative] of Object.entries(files)) {
  const filename = path.join(root, relative);
  if (!fs.existsSync(filename)) { errors.push('missing architecture contract: ' + relative); continue; }
  try { docs[key] = JSON.parse(fs.readFileSync(filename, 'utf8')); }
  catch (error) { errors.push('invalid JSON in ' + relative + ': ' + error.message); }
}

const requiredDomains = ['terrain','hydrology','hydraulics','infrastructure','geospatial-topology','telemetry','regulatory-reference','simulation','evidence','presentation'];
const products = new Set(docs.architecture?.dataProducts || []);
for (const domain of requiredDomains) if (!products.has(domain)) errors.push('missing data product domain: ' + domain);

for (const field of ['semanticLayer','dataContract','businessGlossary','masterDataGovernance','architectureRepository']) {
  if (!docs.architecture?.authoritativeDefinitions?.[field]) errors.push('missing governance definition: ' + field);
}

for (const artifact of ['logicalDataModel','dataDictionary','authoritativeSourceRegistry','metadataCatalog','lineageRegistry']) {
  if (!(docs.architecture?.logicalArchitecture?.requiredArtifacts || []).includes(artifact)) errors.push('missing logical artifact declaration: ' + artifact);
}

for (const name of ['evidence','analysis','presentation','runtime']) {
  if (!fs.existsSync(path.join(root, 'tsm-native/config/provenance-plane-contract.json'))) break;
}

if (docs.architecture?.processingPatterns?.streaming?.enabled !== false) {
  errors.push('streaming must remain disabled by default outside Connected Mode');
}

for (const field of ['owner','steward','schemaVersion','sourceDatasetIds','qualityPolicy','provenance','classification']) {
  if (!docs.product?.required?.includes(field)) errors.push('data-product contract missing required field: ' + field);
}

if (docs.metadata?.lineage?.acyclic !== true) errors.push('metadata lineage must be acyclic');
if (docs.physical?.stores?.find((s) => s.name === 'SQLite/SpatiaLite')?.runtimeMutation !== false) {
  errors.push('Sovereign SQLite/SpatiaLite runtime must remain read-only');
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Enterprise data architecture contracts: PASS');
