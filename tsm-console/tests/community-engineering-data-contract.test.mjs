import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const readJson = async (relativePath) => JSON.parse(
  await readFile(resolve(repositoryRoot, relativePath), 'utf8'),
);

test('river registry includes the Louisville District Ohio River structure network', async () => {
  const registry = await readJson('artifacts/tsm-river-valley-realtime-stations-v1.json');
  const names = new Set(registry.candidate_structures.map((item) => item.name));
  for (const name of [
    'Markland Locks and Dam',
    'McAlpine Locks and Dam',
    'Cannelton Locks and Dam',
    'Newburgh Locks and Dam',
    'John T. Myers Locks and Dam',
    'Smithland Locks and Dam',
    'Olmsted Locks and Dam',
  ]) {
    assert.equal(names.has(name), true, `missing structure: ${name}`);
  }
});

test('river registry requires source and quality metadata for live stations', async () => {
  const registry = await readJson('artifacts/tsm-river-valley-realtime-stations-v1.json');
  for (const station of registry.verified_observation_stations) {
    assert.equal(typeof station.station_id, 'string');
    assert.equal(typeof station.provider, 'string');
    assert.equal(typeof station.source_uri === 'string' || station.status !== 'active', true);
    assert.equal(Array.isArray(station.variables), true);
  }
});

test('dredged material schema exists before implementation is accepted', async () => {
  const schema = await readJson('data/schemas/dredged-material.schema.json');
  assert.equal(schema.$id, 'https://tuckerinc82.org/schemas/dredged-material/v1.0.0.json');
  for (const field of [
    'source_dredging_project',
    'grain_size_distribution',
    'moisture_content',
    'compaction_characteristics',
    'shear_strength',
    'consolidation',
    'environmental_testing',
    'chain_of_custody',
    'review_state',
  ]) {
    assert.equal(field in schema.properties, true, `missing qualification field: ${field}`);
  }
});
