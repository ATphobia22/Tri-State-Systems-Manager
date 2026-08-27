import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tokenProxyPath = new URL('../server/token-proxy.mjs', import.meta.url);
const source = await readFile(tokenProxyPath, 'utf8');

test('token proxy does not depend on fileURLToPath or __dirname resolution', () => {
  assert.doesNotMatch(source, /fileURLToPath\s*\(/, 'token proxy must remain independent of fileURLToPath');
  assert.doesNotMatch(source, /__dirname\b/, 'token proxy must remain independent of __dirname');
  assert.doesNotMatch(source, /__filename\b/, 'token proxy must remain independent of __filename');
});

test('token proxy uses native ESM-compatible node imports', () => {
  assert.match(source, /from ['"]node:http['"];/);
  assert.doesNotMatch(source, /from ['"]url['"];|from ['"]path['"];/, 'token proxy should not reintroduce URL/path bootstrap dependencies');
});

test('mobile launch command references the canonical .mjs file', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts['dev:proxy'], 'node server/token-proxy.mjs');
  assert.equal(packageJson.scripts.proxy, 'node server/token-proxy.mjs');
});
