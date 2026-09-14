import { createHash } from 'node:crypto';
import { assertTelemetryEnvelope } from './contracts.mjs';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKey(key) { return createHash('sha1').update(`${key}${GUID}`).digest('base64'); }

function frameText(text) {
  const payload = Buffer.from(text);
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  if (payload.length <= 0xffff) { const head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(payload.length, 2); return Buffer.concat([head, payload]); }
  const head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(payload.length), 2); return Buffer.concat([head, payload]);
}

export function createWebSocketUpgradeResponse(secWebSocketKey) {
  if (!secWebSocketKey) throw new TypeError('Sec-WebSocket-Key is required');
  return `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(secWebSocketKey)}\r\n\r\n`;
}

export function createTelemetryWebSocketRouter({ maxQueue = 256 } = {}) {
  const clients = new Set();
  function addClient(socket) {
    const client = { socket, queue: [], closed: false };
    clients.add(client);
    socket.on('close', () => { client.closed = true; clients.delete(client); });
    socket.on('error', () => { client.closed = true; clients.delete(client); });
    return client;
  }
  function publish(envelope) {
    assertTelemetryEnvelope(envelope);
    const payload = frameText(JSON.stringify({ type: 'telemetry.v1', data: envelope }));
    for (const client of clients) {
      if (client.closed || !client.socket.writable) { clients.delete(client); continue; }
      if (client.socket.writableLength > 1_000_000 || client.queue.length >= maxQueue) {
        client.socket.destroy(new Error('telemetry websocket backpressure limit exceeded'));
        clients.delete(client);
        continue;
      }
      client.queue.push(payload);
      while (client.queue.length && client.socket.writable) client.socket.write(client.queue.shift());
    }
  }
  return Object.freeze({ addClient, publish, size: () => clients.size });
}
