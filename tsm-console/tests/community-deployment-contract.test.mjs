import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

 test('router exposes community river watch and engineering section routes', async () => {
  const router = await read('../src/lib/router.tsx');
  assert.match(router, /path: 'river-watch'/);
  assert.match(router, /path: 'engineering-section'/);
  assert.doesNotMatch(router, /private residence|APN|community-site/);
});

test('root layout does not expose parcel or private-site fields', async () => {
  const layout = await read('../src/components/RootLayout.tsx');
  assert.doesNotMatch(layout, /private residence|APN|site\.apn|siteSummary/);
  assert.match(layout, /Community River Valley|community river valley/i);
});

test('server exposes one community aggregation endpoint', async () => {
  const server = await read('../server/token-proxy.mjs');
  assert.match(server, /\/api\/hydrologic\/community/);
  assert.match(server, /fetchRiverNetwork/);
  assert.doesNotMatch(server, /private residence|RESTRICTED_SITE-digital-twin-engine/);
});

test('container web service supplies the API base variable used by the frontend', async () => {
  const compose = await read('../docker-compose.yml');
  assert.match(compose, /VITE_TSM_API_BASE_URL:/);
  assert.match(compose, /CORS_ORIGIN:/);
  assert.match(compose, /127\.0\.0\.1:8787\/ready/);
});

test('public manifest remains community scoped', async () => {
  const manifest = await read('../public/manifest.json');
  assert.match(manifest, /Tri-State River Valley/);
  assert.doesNotMatch(manifest, /private residence|BonebankTwin|RESTRICTED_SITE-digital-twin-engine/);
});
