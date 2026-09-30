#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const files = [
  'data/fema/openfema-catalog.json',
  'tsm-console/server/ingestion/openfema.mjs',
  'tsm-console/server/ingestion/posey-xsoft-parcels.mjs',
  'tsm-console/server/ingestion/posey-spatial-chain.mjs',
  'tsm-console/tests/openfema.test.mjs',
  'tsm-console/tests/posey-spatial-chain.test.mjs',
];
const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(JSON.stringify({ ok:false, gate:'openfema', missing }, null, 2));
  process.exit(1);
}
const catalog = JSON.parse(fs.readFileSync(path.join(root, files[0]), 'utf8'));
for (const entity of ['NfipCommunityStatusBook','NfipCommunityLayerComprehensive','FimaNfipPolicies','FimaNfipClaims']) {
  if (!catalog.entities?.[entity]) throw new Error('OpenFEMA catalog missing ' + entity);
}
const source = fs.readFileSync(path.join(root, files[1]), 'utf8');
for (const token of ['OPENFEMA_BASE_URL','pageOpenFema','FimaNfipPolicies','FimaNfipClaims','$top','$skip']) {
  if (!source.includes(token)) throw new Error('OpenFEMA implementation missing ' + token);
}
console.log(JSON.stringify({ ok:true, gate:'openfema' }, null, 2));
