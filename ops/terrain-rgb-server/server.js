/**
 * TSM Terrain-RGB XYZ tile server (Express).
 *
 * Serves 256×256 Mapbox-encoded Terrain-RGB PNGs for MapLibre raster-dem / setTerrain().
 * Missing tiles → HTTP 204 (MapLibre-friendly empty response).
 *
 * Env:
 *   PORT      default 8080
 *   TILE_DIR  absolute or relative path to {z}/{x}/{y}.png tree
 *   CORS_ORIGIN  optional explicit origin (default: reflect request / *)
 *
 * Production prefer HTTPS reverse proxy + Cache-Control immutable for real tiles.
 * Do not point VITE_TSM_TERRAIN_RGB_URL_TEMPLATE at localhost in production builds
 * (fail-closed validator rejects localhost placeholders outside DEV).
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 8080);
const TILE_DIR = path.resolve(process.env.TILE_DIR || path.join(__dirname, 'tiles'));

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors(
    corsOrigin
      ? { origin: corsOrigin.split(',').map((s) => s.trim()) }
      : undefined,
  ),
);

function isSafeTilePath(resolvedFile) {
  const root = TILE_DIR.endsWith(path.sep) ? TILE_DIR : TILE_DIR + path.sep;
  return resolvedFile === TILE_DIR || resolvedFile.startsWith(root);
}

/**
 * GET /terrain/:z/:x/:y.png
 * Also accepts /:z/:x/:y.png for reverse-proxy strip-prefix deployments.
 */
function serveTerrainTile(req, res) {
  const { z, x, y } = req.params;
  if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
    return res.status(400).send('Invalid tile coordinates');
  }

  const tilePath = path.resolve(TILE_DIR, z, x, `${y}.png`);
  if (!isSafeTilePath(tilePath)) {
    return res.status(400).send('Invalid path');
  }

  fs.access(tilePath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(204).end();
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-TSM-Terrain-Encoding', 'mapbox');
    fs.createReadStream(tilePath).pipe(res);
  });
}

app.get('/terrain/:z/:x/:y.png', serveTerrainTile);
app.get('/:z/:x/:y.png', serveTerrainTile);

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    server: 'TSM Terrain-RGB Tile Server',
    tile_dir: TILE_DIR,
    encoding: 'mapbox',
    tile_size: 256,
  });
});

app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'tsm-terrain-rgb',
    template: '/terrain/{z}/{x}/{y}.png',
    vite_env: 'VITE_TSM_TERRAIN_RGB_URL_TEMPLATE',
    note: 'Publish under HTTPS for production; placeholders remain FAIL-CLOSED in TSM client.',
  });
});

app.listen(PORT, () => {
  console.log(`[TSM Tile Server] http://0.0.0.0:${PORT}`);
  console.log(`[TSM Tile Server] TILE_DIR=${TILE_DIR}`);
  console.log(`[TSM Tile Server] template=/terrain/{z}/{x}/{y}.png`);
});
