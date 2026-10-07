import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.UACF_DASHBOARD_PORT ?? 8791);
const gateway = process.env.UACF_GATEWAY_URL ?? 'http://127.0.0.1:8790';
const index = fileURLToPath(new URL('../public/index.html', import.meta.url));

export function createDashboardServer() {
  return createServer(async (request, response) => {
    if (request.url === '/api/health') {
      try {
        const upstream = await fetch(new URL('/v1/health', gateway));
        response.writeHead(upstream.status, { 'content-type': 'application/json' });
        response.end(await upstream.text());
      } catch {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ healthy: false, gateway }));
      }
      return;
    }
    if (request.url !== '/') {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(await readFile(index, 'utf8'));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createDashboardServer().listen(port, '127.0.0.1', () => console.log(`UACF dashboard listening on http://127.0.0.1:${port}`));
}
