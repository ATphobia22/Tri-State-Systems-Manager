#!/usr/bin/env node
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, normalize, relative, isAbsolute } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist/3d-tiles/terrain-3dep');
const tilesetPath = resolve(root, 'tileset.json');
const tileset = JSON.parse(await readFile(tilesetPath, 'utf8'));

const wait = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));

const server = createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
    const candidate = normalize(resolve(root, '.' + pathname));
    const rel = relative(root, candidate);
    if (rel.startsWith('..') || isAbsolute(rel)) return res.writeHead(403).end();
    if (!statSync(candidate).isFile()) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': candidate.endsWith('.json') ? 'application/json' : 'model/gltf-binary' });
    createReadStream(candidate).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const url = 'http://127.0.0.1:' + port + '/tileset.json';

try {
  const { TilesRenderer } = await import('3d-tiles-renderer');
  const { PerspectiveCamera, Vector3 } = await import('three');
  const renderer = new TilesRenderer(url);
  const camera = new PerspectiveCamera(45, 1, 1, 1e9);
  const sphere = tileset.root.boundingVolume.sphere;
  const center = new Vector3(sphere[0], sphere[1], sphere[2]);
  camera.position.copy(center).add(new Vector3(0, 0, Math.max(sphere[3] * 2, 1000)));
  camera.lookAt(center);
  camera.updateMatrixWorld();
  renderer.setCamera(camera);
  renderer.setResolution(camera, 1280, 720);

  let loadedTileset = false;
  let loadedModels = 0;
  const errors = [];
  renderer.addEventListener('load-tileset', () => { loadedTileset = true; });
  renderer.addEventListener('load-model', () => { loadedModels += 1; });
  renderer.addEventListener('load-error', event => {
    errors.push(String(event?.error ?? event?.message ?? 'unknown load error'));
  });

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && (!loadedTileset || loadedModels < 1)) {
    camera.updateMatrixWorld();
    renderer.update();
    await wait(50);
  }
  renderer.update();
  if (!loadedTileset) throw new Error('3d-tiles-renderer did not load the tileset within 15 seconds');
  if (loadedModels < 1) throw new Error('3d-tiles-renderer loaded the tileset but no GLB model');
  if (errors.length) throw new Error('renderer reported load errors: ' + errors.join('; '));
  console.log(JSON.stringify({ ok: true, renderer: '3d-tiles-renderer@0.5.3', loadedTileset, loadedModels }));
  renderer.dispose();
} finally {
  server.close();
}
