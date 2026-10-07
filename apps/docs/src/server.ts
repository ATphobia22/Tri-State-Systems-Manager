import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.UACF_DOCS_PORT ?? 8793);
const index = fileURLToPath(new URL('../public/index.html', import.meta.url));

export function createDocsServer() {
  return createServer(async (request, response) => {
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
  createDocsServer().listen(port, '127.0.0.1', () => console.log(`UACF docs listening on http://127.0.0.1:${port}`));
}
