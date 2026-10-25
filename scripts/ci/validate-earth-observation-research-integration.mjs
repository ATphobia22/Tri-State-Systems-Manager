#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const catalogPath = path.join(root, 'data/fabrics/earth-observation-research-integration-v1.json');

function fail(message) {
  console.error(JSON.stringify({ ok: false, gate: 'earth-observation-research-integration', error: message }, null, 2));
  process.exit(1);
}

let catalog;
try {
  catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
} catch (error) {
  fail(`Cannot parse ${catalogPath}: ${error instanceof Error ? error.message : String(error)}`);
}

if (catalog.schemaVersion !== '1.0.0') fail('Unsupported schemaVersion.');
if (!Array.isArray(catalog.sources) || catalog.sources.length < 2) fail('At least two source records are required.');

const ids = new Set();
const allowedAuthorities = new Set(['AUTHORITATIVE', 'OBSERVATIONAL', 'DERIVED', 'PRESENTATION']);
const allowedStatuses = new Set(['RESEARCH_CANDIDATE', 'EVALUATION_ONLY', 'IMPLEMENTED']);
for (const source of catalog.sources) {
  if (!source.id || ids.has(source.id)) fail(`Missing or duplicate source id: ${source.id ?? '(empty)'}`);
  ids.add(source.id);
  if (!allowedAuthorities.has(source.authority)) fail(`${source.id}: invalid authority class.`);
  if (!allowedStatuses.has(source.integrationStatus)) fail(`${source.id}: invalid integration status.`);
  if (source.integrationStatus !== 'IMPLEMENTED' && source.runtimeAdapterImplemented !== false) {
    fail(`${source.id}: non-implemented source must not claim a runtime adapter.`);
  }
  if (source.integrationStatus !== 'IMPLEMENTED' && source.liveAccessVerifiedByTSM !== false) {
    fail(`${source.id}: unintegrated source must not claim TSM live access verification.`);
  }
  if (!source.sourceUrl?.startsWith('https://')) fail(`${source.id}: HTTPS source URL is required.`);
  if (!Array.isArray(source.provenanceRequirements) || source.provenanceRequirements.length < 4) {
    fail(`${source.id}: insufficient provenance requirements.`);
  }
  if (!Array.isArray(source.prohibitedUses) || source.prohibitedUses.length === 0) {
    fail(`${source.id}: prohibited-use boundary is required.`);
  }
  if (source.id === 'olmoearth-v1-3-global-embeddings') {
    if (source.authority !== 'DERIVED') fail('OlmoEarth must remain DERIVED.');
    if (source.nominalPixelResolutionMeters !== 10) fail('OlmoEarth nominal resolution contract drifted.');
    if (!source.license?.reviewRequiredBeforeDeployment) fail('OlmoEarth license review must gate deployment.');
    if (!source.prohibitedUses.some((item) => /direct flood depth/i.test(item))) fail('OlmoEarth must not infer hydraulic outcomes directly.');
  }
  if (source.id === 'planet-tanager-hyperspectral') {
    if (source.authority !== 'OBSERVATIONAL') fail('Tanager must remain OBSERVATIONAL.');
    if (source.integrationStatus !== 'EVALUATION_ONLY') fail('Tanager must remain evaluation-only until access and product validation.');
    if (source.nominalGroundResolutionMeters !== 30 || source.spectralChannelsMinimum < 400) fail('Tanager sensor/product specification contract drifted.');
    if (!source.accessPolicy?.includes('does not establish that all Tanager data is public')) {
      fail('Tanager access policy must not imply public access.');
    }
  }
}

if (catalog.policy?.forbidSyntheticFallback !== true
  || catalog.policy?.forbidDirectHydraulicConclusionsFromEmbeddings !== true
  || catalog.policy?.requireHumanReviewBeforeEngineeringUse !== true) {
  fail('Scientific safety policy is incomplete.');
}

console.log(JSON.stringify({
  ok: true,
  gate: 'earth-observation-research-integration',
  catalogId: catalog.catalogId,
  sourceCount: catalog.sources.length,
  runtimeAdaptersImplemented: catalog.sources.filter((source) => source.runtimeAdapterImplemented).length,
  liveAccessVerifiedByTSM: catalog.sources.filter((source) => source.liveAccessVerifiedByTSM).length,
  note: 'Metadata contract validated; this does not assert live source access, model suitability, or production integration.'
}, null, 2));
