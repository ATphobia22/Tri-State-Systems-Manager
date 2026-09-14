import { createWebSocketUpgradeResponse } from './websocket-router.mjs';

export function attachTelemetryWebSocket(server, router, { path = '/ws/telemetry', token = process.env.TSM_TELEMETRY_WS_TOKEN } = {}) {
  if (!token) throw new Error('TSM_TELEMETRY_WS_TOKEN is required before enabling telemetry WebSocket access');
  server.on('upgrade', (request, socket) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname !== path) { socket.destroy(); return; }
      const supplied = url.searchParams.get('token') || request.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (supplied !== token) { socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
      const key = request.headers['sec-websocket-key'];
      if (typeof key !== 'string' || request.headers.upgrade?.toLowerCase() !== 'websocket') { socket.destroy(); return; }
      socket.write(createWebSocketUpgradeResponse(key));
      router.addClient(socket);
    } catch { socket.destroy(); }
  });
}
