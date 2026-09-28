/**
 * Fail-closed Terrain-RGB / MapLibre 3D terrain contract tests.
 * Pure logic mirrored from src/lib/terrain-rgb-contract.ts for node:test
 * (avoids Vite import.meta.env in the unit path).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const PLACEHOLDER_PATTERNS = [
  /example\.invalid/i,
  /example\.com/i,
  /example\.org/i,
  /example\.net/i,
  /YOUR[-_]?HOST/i,
  /YOUR[-_]?PROVENANCE[-_]?HOST/i,
  /YOUR[-_]?DOMAIN/i,
  /REPLACE[-_]?ME/i,
  /placeholder/i,
  /\$\{VITE_TSM_TERRAIN/,
];
const LOCAL_HOST_PATTERNS = [/localhost/i, /127\.0\.0\.1/, /0\.0\.0\.0/];

function isLocalHost(hostname) {
  return LOCAL_HOST_PATTERNS.some((re) => re.test(hostname));
}

function validateTerrainRgbUrlTemplate(raw, options = {}) {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { enabled: false, reason: 'missing' };
  for (const re of PLACEHOLDER_PATTERNS) {
    if (re.test(trimmed)) return { enabled: false, reason: 'placeholder' };
  }
  if (!trimmed.includes('{z}') || !trimmed.includes('{x}') || !trimmed.includes('{y}')) {
    return { enabled: false, reason: 'invalid_template' };
  }
  let url;
  try {
    url = new URL(trimmed.replace(/\{z\}/g, '0').replace(/\{x\}/g, '0').replace(/\{y\}/g, '0'));
  } catch {
    return { enabled: false, reason: 'invalid_template' };
  }
  const host = url.hostname.toLowerCase();
  const allowLocal = options.allowHttpLocal === true;
  if (isLocalHost(host) && !allowLocal) {
    return { enabled: false, reason: 'placeholder' };
  }
  if (url.protocol === 'https:') {
    if (isLocalHost(host) && !allowLocal) return { enabled: false, reason: 'placeholder' };
    return { enabled: true, reason: 'configured' };
  }
  if (url.protocol === 'http:') {
    if (allowLocal && isLocalHost(host)) return { enabled: true, reason: 'configured' };
    return { enabled: false, reason: 'insecure_scheme' };
  }
  return { enabled: false, reason: 'invalid_template' };
}

test('missing template is fail-closed', () => {
  assert.equal(validateTerrainRgbUrlTemplate('').enabled, false);
  assert.equal(validateTerrainRgbUrlTemplate(undefined).reason, 'missing');
  assert.equal(validateTerrainRgbUrlTemplate('   ').reason, 'missing');
});

test('placeholder hosts are fail-closed', () => {
  assert.equal(
    validateTerrainRgbUrlTemplate('https://tiles.example.invalid/terrain/{z}/{x}/{y}.png').reason,
    'placeholder',
  );
  assert.equal(
    validateTerrainRgbUrlTemplate('https://example.com/{z}/{x}/{y}.png').reason,
    'placeholder',
  );
  assert.equal(
    validateTerrainRgbUrlTemplate('https://YOUR-HOST/terrain/{z}/{x}/{y}.png').reason,
    'placeholder',
  );
  assert.equal(
    validateTerrainRgbUrlTemplate('https://tiles.YOUR-PROVENANCE-HOST.example/terrain/{z}/{x}/{y}.png').reason,
    'placeholder',
  );
});

test('templates without z/x/y tokens are fail-closed', () => {
  assert.equal(
    validateTerrainRgbUrlTemplate('https://tiles.usgs.gov/terrain/0/0/0.png').reason,
    'invalid_template',
  );
});

test('valid https XYZ template is enabled', () => {
  const s = validateTerrainRgbUrlTemplate(
    'https://tiles.nationalmap.gov/arcgis/rest/services/Elevation/ImageServer/tile/{z}/{y}/{x}',
  );
  assert.equal(s.enabled, true);
  assert.equal(s.reason, 'configured');
});

test('http non-local is blocked (production)', () => {
  assert.equal(
    validateTerrainRgbUrlTemplate('http://tiles.real-cdn.example.net/{z}/{x}/{y}.png').reason,
    'placeholder',
  );
  assert.equal(
    validateTerrainRgbUrlTemplate('http://tiles.usgs.gov/terrain/{z}/{x}/{y}.png').reason,
    'insecure_scheme',
  );
});

test('localhost blocked in production; allowed only when allowHttpLocal', () => {
  assert.equal(
    validateTerrainRgbUrlTemplate('http://localhost:8080/terrain/{z}/{x}/{y}.png').reason,
    'placeholder',
  );
  assert.equal(
    validateTerrainRgbUrlTemplate('http://localhost:8080/terrain/{z}/{x}/{y}.png', {
      allowHttpLocal: true,
    }).enabled,
    true,
  );
  assert.equal(
    validateTerrainRgbUrlTemplate('http://127.0.0.1:8080/terrain/{z}/{x}/{y}.png', {
      allowHttpLocal: true,
    }).enabled,
    true,
  );
});

test('twin-map-style wires fail-closed applyTwinTerrain', () => {
  const source = read('src/lib/twin-map-style.ts');
  assert.match(source, /getTerrainRgbStatus/);
  assert.match(source, /if \(!terrain\.enabled\)/);
  assert.match(source, /setTerrain\(null\)/);
  assert.match(source, /setTerrain\(\{\s*source:\s*TERRAIN_RGB_SOURCE_ID/);
  assert.match(source, /TERRAIN_RGB_TILE_SIZE|tileSize:\s*TERRAIN_RGB_TILE_SIZE/);
  assert.match(source, /TERRAIN_RGB_ENCODING|encoding:\s*TERRAIN_RGB_ENCODING/);
  assert.match(source, /TERRAIN_RGB_DEFAULT_EXAGGERATION/);
  assert.match(source, /removeSource\(TERRAIN_RGB_SOURCE_ID\)/);
  assert.match(source, /VITE_TSM_TERRAIN_RGB_URL_TEMPLATE/);
  assert.doesNotMatch(source, /mockTerrain|fabricatedTerrain/i);
});

test('terrain-rgb-contract module exports fail-closed helpers', () => {
  const source = read('src/lib/terrain-rgb-contract.ts');
  assert.match(source, /validateTerrainRgbUrlTemplate/);
  assert.match(source, /fail-closed/i);
  assert.match(source, /TERRAIN_RGB_SOURCE_ID/);
  assert.match(source, /TERRAIN_RGB_TILE_SIZE\s*=\s*256/);
  assert.match(source, /TERRAIN_RGB_ENCODING\s*=\s*'mapbox'/);
  assert.match(source, /TERRAIN_RGB_DEFAULT_EXAGGERATION\s*=\s*1\.0/);
});

test('terrain-pipeline.json requires fail_closed_when_missing', () => {
  const cfg = JSON.parse(read('config/terrain-pipeline.json'));
  assert.equal(cfg.runtime.fail_closed_when_missing, true);
  assert.equal(cfg.runtime.environment_variable, 'VITE_TSM_TERRAIN_RGB_URL_TEMPLATE');
  assert.equal(cfg.processing.browser_source_type, 'raster-dem');
  assert.equal(cfg.processing.encoding, 'mapbox');
  assert.equal(cfg.processing.tile_size, 256);
  assert.equal(cfg.evidence.bulk_source_data_committed_to_git, false);
});

test('RealWorldTwinMap surfaces fail-closed terrain status', () => {
  const ui = read('src/components/RealWorldTwinMap.tsx');
  assert.match(ui, /terrainRgbBlockMessage|getTerrainRgbStatus/);
  assert.match(ui, /FAIL-CLOSED|terrainMessage|terrainStatus/);
  assert.match(ui, /applyTwinTerrain/);
});
