import { createServer } from 'node:http';

const port = Number(process.env.UACF_ADMIN_PORT ?? 8794);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('UACF_ADMIN_PORT must be 1..65535');
const server = createServer((req, res) => {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200).end(JSON.stringify({ service: 'uacf-admin', status: 'ready', mode: 'read-only-skeleton' }));
    return;
  }
  // Administrative mutations are intentionally unavailable until authentication,
  // tenant authorization, CSRF protection, and audit logging are wired end-to-end.
  res.writeHead(503).end(JSON.stringify({ error: 'ADMIN_MUTATIONS_NOT_CONFIGURED' }));
});
if (process.env.NODE_ENV !== 'test') server.listen(port, '127.0.0.1');
export { server };
