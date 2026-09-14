import http from 'node:http';
import { createTelemetryWebSocketRouter } from './telemetry/websocket-router.mjs';
import { attachTelemetryWebSocket } from './telemetry/websocket-endpoint.mjs';
import { renderPrometheusMetrics } from './telemetry/prometheus-exporter.mjs';

const PORT = Number(process.env.TSM_TELEMETRY_PORT || 8788);
const router = createTelemetryWebSocketRouter({ maxQueue: 256 });
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(renderPrometheusMetrics());
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, clients: router.size(), service: 'tsm-telemetry-gateway' }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

attachTelemetryWebSocket(server, router, { path: '/ws/telemetry' });
server.listen(PORT, '127.0.0.1', () => console.log(`TSM telemetry gateway on 127.0.0.1:${PORT}`));

export { router, server };
