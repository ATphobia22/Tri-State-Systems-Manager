import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 3000);
const STATIC_ROOT = path.resolve(process.env.TSM_STATIC_ROOT || path.join(process.cwd(), 'dist'));
const API_UPSTREAM = String(process.env.TSM_API_UPSTREAM || '').replace(/\/$/, '');
const INDEX_FILE = path.join(STATIC_ROOT, 'index.html');
const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.wasm', 'application/wasm'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded.replace(/^\/+/, '');
  const candidate = path.resolve(STATIC_ROOT, relative);
  if (candidate === STATIC_ROOT || candidate.startsWith(STATIC_ROOT + path.sep)) return candidate;
  return null;
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function proxyApi(req, res, targetUrl) {
  if (!API_UPSTREAM) return send(res, 503, { 'content-type': 'application/json; charset=utf-8' }, JSON.stringify({ ok: false, error: 'TSM_API_UPSTREAM is not configured' }));
  const upstream = new URL(targetUrl, API_UPSTREAM);
  const proxyReq = http.request(upstream, {
    method: req.method,
    headers: { ...req.headers, host: upstream.host },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (error) => send(res, 502, { 'content-type': 'application/json; charset=utf-8' }, JSON.stringify({ ok: false, error: 'API proxy failure: ' + error.message })));
  req.pipe(proxyReq);
}

function serveFile(res, filePath) {
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) return send(res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found');
    const type = CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': filePath === INDEX_FILE ? 'no-cache' : 'public, max-age=31536000, immutable' });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1:' + PORT);
    if (url.pathname === '/health' || url.pathname === '/ready') return send(res, 200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, JSON.stringify({ ok: true, service: 'tsm-static-web' }));
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return proxyApi(req, res, url.pathname + url.search);

    const requested = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    const candidate = safeStaticPath(requested);
    if (!candidate) return send(res, 400, { 'content-type': 'text/plain; charset=utf-8' }, 'Invalid path');
    fs.access(candidate, fs.constants.R_OK, (error) => {
      if (!error) return serveFile(res, candidate);
      return serveFile(res, INDEX_FILE);
    });
  } catch (error) {
    send(res, 500, { 'content-type': 'text/plain; charset=utf-8' }, 'Internal server error: ' + error.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('[tsm-static] listening on 0.0.0.0:' + PORT + '; root=' + STATIC_ROOT + '; api=' + (API_UPSTREAM || 'disabled'));
}
