import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../public/data/tiles', import.meta.url));
const root = resolve(process.env.TSM_TILE_ROOT ?? defaultRoot);
const host = process.env.TSM_TILE_HOST ?? '127.0.0.1';
const port = Number(process.env.TSM_TILE_PORT ?? 8788);
const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.pbf', '.json', '.terrain']);
const contentTypes = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'],
  ['.pbf', 'application/x-protobuf'], ['.json', 'application/json'], ['.terrain', 'application/octet-stream'],
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  if (!decoded.startsWith('/')) return null;
  const candidate = resolve(root, `.${decoded}`);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  const extension = extname(candidate).toLowerCase();
  return allowed.has(extension) ? candidate : null;
}

const server = createServer((request, response) => {
  try {
    const path = safePath(request.url ?? '/');
    if (!path || !existsSync(path) || !statSync(path).isFile()) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'tile-not-found' }));
      return;
    }
    const extension = extname(path).toLowerCase();
    response.writeHead(200, {
      'content-type': contentTypes.get(extension) ?? 'application/octet-stream',
      'cache-control': 'public, max-age=3600, immutable',
      'x-content-type-options': 'nosniff',
    });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(400, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'invalid-tile-request' }));
  }
});

server.listen(port, host, () => {
  console.log(`[tsm-tiles] http://${host}:${port} root=${root}`);
});
