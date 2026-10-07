import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.UACF_PLAYGROUND_PORT ?? 8792);
const gateway = process.env.UACF_GATEWAY_URL ?? 'http://127.0.0.1:8790';
const index = fileURLToPath(new URL('../public/index.html', import.meta.url));

export function createPlaygroundServer() {
  return createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/api/execute') {
      let body = '';
      for await (const chunk of request) body += chunk;
      try {
        const parsed = JSON.parse(body);
        const upstream = await fetch(new URL('/v1/execute', gateway), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed),
        });
        response.writeHead(upstream.status, { 'content-type': 'application/json' });
        response.end(await upstream.text());
      } catch (error) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: String(error) }));
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
  createPlaygroundServer().listen(port, '127.0.0.1', () => console.log(`UACF playground listening on http://127.0.0.1:${port}`));
}
