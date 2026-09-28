#!/usr/bin/env node
/**
 * tsm-terrain-tiles — HTTPS server for the TSM Terrain-RGB tile pyramid.
 *
 * Serves ./data/terrain-rgb/{z}/{x}/{y}.png plus ./data/terrain-rgb/tiles.json
 * (TileJSON) over TLS. This is a tile transport: it confers no authority on
 * the elevations inside the tiles, which remain screening-level and
 * not survey-grade.
 *
 * Env:
 *   TERRAIN_TILES_PORT  listen port (default 3443)
 *   TERRAIN_TILES_DIR   tile root (default ./data/terrain-rgb)
 *   TERRAIN_TILES_KEY   TLS private key (default ./certs/tiles.key)
 *   TERRAIN_TILES_CERT  TLS certificate (default ./certs/tiles.crt)
 */
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:https';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.TERRAIN_TILES_PORT ?? 3443);
const TILE_DIR = process.env.TERRAIN_TILES_DIR ?? join(ROOT, 'data', 'terrain-rgb');
const KEY_PATH = process.env.TERRAIN_TILES_KEY ?? join(ROOT, 'certs', 'tiles.key');
const CERT_PATH = process.env.TERRAIN_TILES_CERT ?? join(ROOT, 'certs', 'tiles.crt');

for (const [label, path] of [['key', KEY_PATH], ['cert', CERT_PATH]]) {
  if (!existsSync(path)) {
    console.error(`missing TLS ${label}: ${path}`);
    console.error('run ./gen-cert.sh first (self-signed; replace with a real cert in production).');
    process.exit(1);
  }
}
if (!existsSync(join(TILE_DIR, 'tiles.json'))) {
  console.error(`no tiles.json in ${TILE_DIR}; run scripts/geospatial/build-terrain-rgb-screening.sh first.`);
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

// Health probe (no tile I/O).
app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'tsm-terrain-tiles' }));

// TileJSON manifest.
app.get('/terrain-rgb/tiles.json', (_req, res) => {
  res.type('application/json');
  res.sendFile(join(TILE_DIR, 'tiles.json'));
});

// XYZ tiles. Strict numeric params — no path traversal.
// Served under both /terrain-rgb/... (build output name) and
// /terrain_3dep/... (production source-id form used by Martin).
for (const prefix of ['/terrain-rgb', '/terrain_3dep']) {
  app.get(`${prefix}/:z/:x/:y.png`, (req, res) => {
    const { z, x, y } = req.params;
    if (!/^\d{1,2}$/.test(z) || !/^\d{1,6}$/.test(x) || !/^\d{1,6}$/.test(y)) {
      res.status(400).json({ error: 'invalid tile coordinates' });
      return;
    }
    const zi = Number(z);
    if (zi < 0 || zi > 22) {
      res.status(400).json({ error: 'zoom out of range' });
      return;
    }
    res.type('image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(join(TILE_DIR, z, x, `${y}.png`), (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'tile not found' });
    });
  });
}

const server = createServer(
  { key: readFileSync(KEY_PATH), cert: readFileSync(CERT_PATH) },
  app,
);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`tsm-terrain-tiles: https://0.0.0.0:${PORT}/terrain-rgb/{z}/{x}/{y}.png`);
});
