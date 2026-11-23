import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const cleanupScript = readFileSync(new URL('../public/sw-reset.js', import.meta.url), 'utf8');
const retiredScript = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const site = 'https://atphobia22.github.io/Tri-State-Systems-Manager/';

function registration(scope, scriptURL) {
  const record = { scope, active: { scriptURL }, unregistered: 0 };
  record.unregister = async () => { record.unregistered++; return true; };
  return record;
}

function runCleanup({ registrations = [], entries = {}, controlled = false, hasSW = true } = {}) {
  const requests = Object.fromEntries(Object.entries(entries).map(([name, urls]) => [name, new Set(urls)]));
  const storage = new Map();
  let reloads = 0;
  const context = {
    URL,
    document: { currentScript: { src: `${site}sw-reset.js` } },
    navigator: hasSW ? { serviceWorker: {
      getRegistrations: async () => registrations,
      controller: controlled ? { scriptURL: `${site}sw.js` } : null,
    } } : {},
    caches: {
      keys: async () => Object.keys(requests),
      open: async (name) => ({
        keys: async () => [...requests[name]].map((url) => ({ url })),
        delete: async (request) => requests[name].delete(request.url),
      }),
    },
    location: { reload: () => { reloads++; } },
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    console,
  };
  return {
    result: runInNewContext(cleanupScript, context),
    requests,
    storage,
    get reloads() { return reloads; },
  };
}

test('published entry loads cleanup before any application scripts; retirement code never registers a worker', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<script src="%BASE_URL%sw-reset\.js"><\/script>/);
  assert.ok(html.indexOf('sw-reset.js') < html.indexOf('spa-redirect.js'));
  assert.ok(html.indexOf('sw-reset.js') < html.indexOf('/src/main.tsx'));
  assert.doesNotMatch(cleanupScript, /serviceWorker\.register\s*\(/);
  assert.doesNotMatch(retiredScript, /addEventListener\s*\(\s*['"]fetch['"]/);
  assert.doesNotMatch(retiredScript, /caches\.open\s*\(/);
});

test('retire only TSM registrations, including legacy root-scoped worker from TSM; preserve other projects', async () => {
  const ours = registration(site, `${site}sw.js`);
  const nested = registration(`${site}atlas/`, `${site}atlas/service-worker.js`);
  const rootLegacy = registration('https://atphobia22.github.io/', `${site}service-worker.js`);
  const other = registration('https://atphobia22.github.io/Another-Project/', 'https://atphobia22.github.io/Another-Project/sw.js');
  const rootOther = registration('https://atphobia22.github.io/', 'https://atphobia22.github.io/sw.js');
  const s = runCleanup({ registrations: [ours, nested, rootLegacy, other, rootOther] });
  await s.result;
  assert.deepEqual([ours.unregistered, nested.unregistered, rootLegacy.unregistered, other.unregistered, rootOther.unregistered], [1, 1, 1, 0, 0]);
});

test('purge TSM cache entries without erasing another GitHub Pages application', async () => {
  const s = runCleanup({ entries: {
    shared: [site, `${site}assets/old.js`, 'https://atphobia22.github.io/Another-Project/main.js'],
    sibling: ['https://atphobia22.github.io/Another-Project/index.html'],
  } });
  await s.result;
  assert.deepEqual([...s.requests.shared], ['https://atphobia22.github.io/Another-Project/main.js']);
  assert.deepEqual([...s.requests.sibling], ['https://atphobia22.github.io/Another-Project/index.html']);
});

test('controlled pages reload once when a project worker is retired', async () => {
  const ours = registration(site, `${site}sw.js`);
  const s = runCleanup({ registrations: [ours], controlled: true });
  await s.result;
  assert.equal(s.reloads, 1);
  assert.equal(s.storage.get('tsm.service-worker-retired:/Tri-State-Systems-Manager/'), 'reloading');
});

test('works normally when the browser does not support service workers', async () => {
  const s = runCleanup({ hasSW: false });
  await s.result;
  assert.equal(s.reloads, 0);
});

test('console source and Vite settings cannot reintroduce service-worker registration', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  const checkFile = (path) => {
    const content = readFileSync(path, 'utf8');
    assert.doesNotMatch(content, /serviceWorker\s*\.\s*register\s*\(/, path);
    assert.doesNotMatch(content, /registerSW\s*\(/, path);
  };
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:js|mjs|jsx|ts|tsx)$/.test(entry.name)) checkFile(path);
    }
  };
  walk(root);
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(vite, /VitePWA|vite-plugin-pwa/);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(Boolean(pkg.dependencies?.['vite-plugin-pwa'] || pkg.devDependencies?.['vite-plugin-pwa']), false);
});
