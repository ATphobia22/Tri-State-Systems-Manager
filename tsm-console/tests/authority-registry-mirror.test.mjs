import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('runtime authority registry mirror matches canonical registry', async () => {
  const root = await readFile(new URL('../../tsm-authority-registry-v35.json', import.meta.url), 'utf8');
  const mirror = await readFile(new URL('../data/authority/tsm-authority-registry-v35.json', import.meta.url), 'utf8');
  assert.equal(JSON.stringify(JSON.parse(mirror)), JSON.stringify(JSON.parse(root)));
});
